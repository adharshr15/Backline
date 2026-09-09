// One-off backfill for the Explore/Scenes feature. Populates everything the new
// schema needs from data that already exists:
//
//   1. Scene rows for every city that has venues, shows, bands or users
//   2. sceneId stamped onto Venue, Show, Band and User
//   3. SceneFollow repointed at sceneId, then deduplicated
//   4. Genre taxonomy seeded, and the free-text Band.genre normalized into BandGenre
//   5. User.isPromoter migrated into UserCraft
//
// Every step is idempotent -- upsert, skipDuplicates, or `where: { sceneId: null }`
// -- so a partial or interrupted run can simply be re-run.
//
// Step 3's dedupe is mandatory: the follow-up migration that makes sceneId NOT NULL
// and moves the unique constraint onto it will FAIL if two legacy rows with
// different city casings collapse onto the same (followerId, followerType, sceneId).
//
// Run with:
//   npx tsx scripts/backfill-explore.ts --dry-run
//   npx tsx scripts/backfill-explore.ts
//   npx tsx scripts/backfill-explore.ts --env=test
import 'dotenv/config';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const USE_TEST_ENV = args.includes('--env=test');

// .env.test has to win before src/lib/prisma reads DATABASE_URL, so the prisma
// import below is dynamic. Mirrors what scripts/migrate-test-db.mjs does.
if (USE_TEST_ENV) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.test', override: true });
}

const { prisma } = await import('../src/lib/prisma');
const { sceneSlugBase, uniqueSceneSlug, normalizeState, stateSpellings } = await import(
  '../src/lib/scenes'
);
const { syncGenreSeed } = await import('../src/lib/genres');
const { matchGenreText, unmatchedTokens } = await import('../src/lib/genreMatch');

const log = (msg: string) => console.log(`${DRY_RUN ? '[dry-run] ' : ''}${msg}`);

const displayName = (city: string) =>
  city
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s|-)([a-z])/g, (_m, sep, ch) => `${sep}${ch.toUpperCase()}`);

type LocationGroup = {
  city: string;
  state: string;
  country: string | null;
  latitude?: number | null;
  longitude?: number | null;
  count: number;
};

/**
 * Find the scene for a city without creating one. Matches every spelling of the
 * state, so a row saying "Texas" finds the scene stored as "TX".
 */
const findScene = (city: string, state: string) =>
  prisma.scene.findFirst({
    where: {
      city: { equals: city, mode: 'insensitive' },
      state: { in: stateSpellings(state), mode: 'insensitive' },
    },
  });

// ---------------------------------------------------------------------------
// Step 0 -- merge scenes that are the same place under different state spellings
// ---------------------------------------------------------------------------

/**
 * "College Station, Texas" and "College Station, TX" are one city, but were
 * created as two scenes before the state was canonicalized. Collapse each such
 * group onto a single winner and repoint every reference.
 *
 * The winner is whoever already has coordinates, else the canonically-slugged
 * one, else the oldest. Losers are deleted only after every FK is moved.
 */
async function mergeDuplicateScenes() {
  const scenes = await prisma.scene.findMany({ orderBy: { createdAt: 'asc' } });

  const groups = new Map<string, typeof scenes>();
  for (const s of scenes) {
    const key = `${s.city.trim().toLowerCase()}|${normalizeState(s.state)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  let merged = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const canonical = (s: (typeof scenes)[number]) =>
      s.slug === sceneSlugBase(s.city, s.state, s.country);

    const winner =
      group.find(s => s.latitude != null && canonical(s)) ??
      group.find(s => s.latitude != null) ??
      group.find(canonical) ??
      group[0];

    const losers = group.filter(s => s.id !== winner.id);
    merged += losers.length;

    log(
      `  merging ${losers.map(l => `"${l.slug}"`).join(', ')} into "${winner.slug}" ` +
        `(${winner.city}, ${normalizeState(winner.state)})`,
    );

    if (DRY_RUN) continue;

    const loserIds = losers.map(l => l.id);

    await prisma.venue.updateMany({ where: { sceneId: { in: loserIds } }, data: { sceneId: winner.id } });
    await prisma.show.updateMany({ where: { sceneId: { in: loserIds } }, data: { sceneId: winner.id } });
    await prisma.band.updateMany({ where: { sceneId: { in: loserIds } }, data: { sceneId: winner.id } });
    await prisma.user.updateMany({ where: { sceneId: { in: loserIds } }, data: { sceneId: winner.id } });
    await prisma.scene.updateMany({ where: { parentId: { in: loserIds } }, data: { parentId: winner.id } });

    // Follows are moved one at a time: a follower may already follow the winner,
    // which would violate the unique key the next migration adds.
    const follows = await prisma.sceneFollow.findMany({ where: { sceneId: { in: loserIds } } });
    for (const f of follows) {
      const clash = await prisma.sceneFollow.findFirst({
        where: { followerId: f.followerId, followerType: f.followerType, sceneId: winner.id },
      });
      if (clash) await prisma.sceneFollow.delete({ where: { id: f.id } });
      else await prisma.sceneFollow.update({ where: { id: f.id }, data: { sceneId: winner.id } });
    }

    await prisma.scene.deleteMany({ where: { id: { in: loserIds } } });

    // Normalize the survivor's own state, and take the canonical slug now that
    // the duplicate holding it is gone.
    const canonicalSlug = sceneSlugBase(winner.city, winner.state, winner.country);
    const slugFree =
      canonicalSlug &&
      canonicalSlug !== winner.slug &&
      !(await prisma.scene.findUnique({ where: { slug: canonicalSlug } }));

    await prisma.scene.update({
      where: { id: winner.id },
      data: {
        state: normalizeState(winner.state),
        ...(slugFree ? { slug: canonicalSlug } : {}),
      },
    });
  }

  log(`Step 0: merged ${merged} duplicate scene(s).`);

  // Canonicalize state and slug on every remaining scene, so later lookups are
  // exact and the public slug matches what resolveScene would generate today.
  let renamed = 0;
  for (const s of await prisma.scene.findMany()) {
    const state = normalizeState(s.state);
    const slug = sceneSlugBase(s.city, state, s.country);

    const slugChanged =
      slug && slug !== s.slug && !(await prisma.scene.findUnique({ where: { slug } }));
    if (state === s.state && !slugChanged) continue;

    renamed++;
    if (slugChanged) log(`  renaming scene "${s.slug}" -> "${slug}"`);
    if (DRY_RUN) continue;

    await prisma.scene.update({
      where: { id: s.id },
      data: { state, ...(slugChanged ? { slug } : {}) },
    });
  }
  if (renamed) log(`  canonicalized ${renamed} scene(s).`);
}

// ---------------------------------------------------------------------------
// Step 1 -- create Scene rows
// ---------------------------------------------------------------------------

/**
 * Four passes, richest source first. Venues are the only entity carrying real
 * lat/lng, so they seed the scene coordinates; the later passes exist so that
 * cities with shows/bands/users but no venue still get a scene. Without them
 * those rows keep sceneId = null and vanish from every explore query.
 */
async function createScenes() {
  const groups: LocationGroup[] = [];

  const venueGroups = await prisma.venue.groupBy({
    by: ['city', 'state', 'country'],
    where: { deletedAt: null },
    _avg: { latitude: true, longitude: true },
    _count: { _all: true },
  });
  for (const g of venueGroups) {
    groups.push({
      city: g.city,
      state: g.state,
      country: g.country,
      latitude: g._avg.latitude,
      longitude: g._avg.longitude,
      count: g._count._all,
    });
  }

  const showGroups = await prisma.show.groupBy({
    by: ['city', 'state', 'country'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  for (const g of showGroups) {
    groups.push({ city: g.city, state: g.state, country: g.country, count: g._count._all });
  }

  // Band and User have nullable city/state -- skip any group missing either.
  const bandGroups = await prisma.band.groupBy({
    by: ['city', 'state', 'country'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  for (const g of bandGroups) {
    if (g.city && g.state) {
      groups.push({ city: g.city, state: g.state, country: g.country, count: g._count._all });
    }
  }

  const userGroups = await prisma.user.groupBy({
    by: ['city', 'state', 'country'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  for (const g of userGroups) {
    if (g.city && g.state) {
      groups.push({ city: g.city, state: g.state, country: g.country, count: g._count._all });
    }
  }

  let created = 0;
  let coordsAdded = 0;
  const suffixed: string[] = [];
  const handled = new Set<string>();

  for (const g of groups) {
    const key = `${g.city.toLowerCase()}|${g.state.toLowerCase()}`;

    const existing = await findScene(g.city, g.state);

    if (existing) {
      // A scene created by the write-path stamping has no coordinates. The venue
      // pass can fill them in.
      if (existing.latitude == null && g.latitude != null && g.longitude != null) {
        coordsAdded++;
        if (!DRY_RUN) {
          await prisma.scene.update({
            where: { id: existing.id },
            data: { latitude: g.latitude, longitude: g.longitude },
          });
        }
      }
      handled.add(key);
      continue;
    }

    if (handled.has(key)) continue;
    handled.add(key);

    const base = sceneSlugBase(g.city, g.state, g.country);
    if (!base) {
      log(`  ! skipping unnameable location: city="${g.city}" state="${g.state}"`);
      continue;
    }

    const slug = DRY_RUN ? base : await uniqueSceneSlug(base, g.city, g.state);
    if (slug !== base) suffixed.push(`${slug} (base "${base}" taken by another city)`);

    created++;
    if (!DRY_RUN) {
      await prisma.scene.create({
        data: {
          slug,
          name: displayName(g.city),
          city: g.city,
          state: normalizeState(g.state),
          country: g.country?.trim() || 'USA',
          latitude: g.latitude ?? null,
          longitude: g.longitude ?? null,
        },
      });
    }
  }

  log(`Step 1: created ${created} scene(s); added coordinates to ${coordsAdded} existing scene(s).`);
  if (suffixed.length) {
    log(`  ${suffixed.length} slug collision(s) resolved with a suffix -- worth curating by hand:`);
    for (const s of suffixed) log(`    ${s}`);
  }
}

// ---------------------------------------------------------------------------
// Step 2 -- stamp sceneId
// ---------------------------------------------------------------------------

/**
 * One updateMany per scene per table, so the statement count is O(scenes) rather
 * than O(rows). `sceneId: null` in the where is what makes this re-runnable and
 * what stops a later suffixed scene stealing an already-stamped row.
 */
async function stampSceneIds() {
  const scenes = await prisma.scene.findMany({ select: { id: true, city: true, state: true } });
  const totals = { venue: 0, show: 0, band: 0, user: 0 };

  for (const scene of scenes) {
    // Match every spelling of the state: the scene stores "TX" but legacy rows
    // may still say "Texas", and those rows must be stamped too.
    const loc = {
      city: { equals: scene.city, mode: 'insensitive' as const },
      state: { in: stateSpellings(scene.state), mode: 'insensitive' as const },
      sceneId: null,
    };

    if (DRY_RUN) {
      totals.venue += await prisma.venue.count({ where: loc });
      totals.show += await prisma.show.count({ where: loc });
      totals.band += await prisma.band.count({ where: loc });
      totals.user += await prisma.user.count({ where: loc });
      continue;
    }

    totals.venue += (await prisma.venue.updateMany({ where: loc, data: { sceneId: scene.id } })).count;
    totals.show += (await prisma.show.updateMany({ where: loc, data: { sceneId: scene.id } })).count;
    totals.band += (await prisma.band.updateMany({ where: loc, data: { sceneId: scene.id } })).count;
    totals.user += (await prisma.user.updateMany({ where: loc, data: { sceneId: scene.id } })).count;
  }

  log(
    `Step 2: stamped sceneId on ${totals.venue} venue(s), ${totals.show} show(s), ` +
      `${totals.band} band(s), ${totals.user} user(s).`,
  );

  // Anything still null after this either has no city/state, or has one that
  // named no scene. Worth surfacing rather than leaving silent.
  const orphans = {
    venue: await prisma.venue.count({ where: { sceneId: null, deletedAt: null } }),
    show: await prisma.show.count({ where: { sceneId: null, deletedAt: null } }),
    band: await prisma.band.count({ where: { sceneId: null, deletedAt: null, city: { not: null } } }),
    user: await prisma.user.count({ where: { sceneId: null, deletedAt: null, city: { not: null } } }),
  };
  const stragglers = Object.entries(orphans).filter(([, n]) => n > 0);
  if (stragglers.length) {
    log(`  rows still without a scene despite having a city: ${stragglers.map(([k, n]) => `${k}=${n}`).join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Step 3 -- repoint SceneFollow, then dedupe
// ---------------------------------------------------------------------------

async function repointSceneFollows() {
  const legacy = await prisma.sceneFollow.groupBy({ by: ['city', 'state', 'country'] });

  let repointed = 0;
  let unresolved = 0;

  for (const g of legacy) {
    if (!g.city || !g.state) {
      unresolved += await prisma.sceneFollow.count({
        where: { city: g.city, state: g.state, sceneId: null },
      });
      continue;
    }

    let scene = await findScene(g.city, g.state);

    // A follow can name a city with no venues, shows, bands or users -- someone
    // followed a scene before anything landed in it. Create it rather than
    // dropping the follow.
    if (!scene && !DRY_RUN) {
      const base = sceneSlugBase(g.city, g.state, g.country);
      if (base) {
        const slug = await uniqueSceneSlug(base, g.city, g.state);
        scene = await prisma.scene.create({
          data: {
            slug,
            name: displayName(g.city),
            city: g.city,
            state: g.state,
            country: g.country?.trim() || 'USA',
          },
        });
      }
    }

    if (!scene) {
      unresolved += await prisma.sceneFollow.count({
        where: { city: g.city, state: g.state, sceneId: null },
      });
      continue;
    }

    if (DRY_RUN) {
      repointed += await prisma.sceneFollow.count({
        where: { city: g.city, state: g.state, sceneId: null },
      });
    } else {
      repointed += (
        await prisma.sceneFollow.updateMany({
          where: { city: g.city, state: g.state, sceneId: null },
          data: { sceneId: scene.id },
        })
      ).count;
    }
  }

  log(`Step 3: repointed ${repointed} scene follow(s).`);
  if (unresolved) log(`  ${unresolved} follow(s) could not be resolved to a scene.`);

  // Dedupe. "Houston"/"TX" and "houston"/"tx" were distinct under the old unique
  // constraint but are the same row once mapped to a sceneId. Collapse to the
  // oldest, or the next migration's unique index cannot be created.
  const all = await prisma.sceneFollow.findMany({ orderBy: { createdAt: 'asc' } });
  const seen = new Set<string>();
  const dupes: string[] = [];

  for (const f of all) {
    if (!f.sceneId) continue;
    const key = `${f.followerId}|${f.followerType}|${f.sceneId}`;
    if (seen.has(key)) dupes.push(f.id);
    else seen.add(key);
  }

  if (dupes.length && !DRY_RUN) {
    await prisma.sceneFollow.deleteMany({ where: { id: { in: dupes } } });
  }
  log(`  removed ${dupes.length} duplicate follow(s) that collapsed onto one scene.`);

  const stillNull = await prisma.sceneFollow.count({ where: { sceneId: null } });
  if (stillNull > 0) {
    log(`  WARNING: ${stillNull} SceneFollow row(s) still have a null sceneId.`);
    log(`  The migration that makes sceneId NOT NULL will fail until these are resolved.`);
  }
}

// ---------------------------------------------------------------------------
// Step 4 -- genres
// ---------------------------------------------------------------------------

async function backfillGenres() {
  if (!DRY_RUN) await syncGenreSeed();

  const genres = await prisma.genre.findMany({
    select: { id: true, slug: true, name: true, aliases: true },
  });
  if (genres.length === 0) {
    log('Step 4: no genres seeded yet -- run without --dry-run, or seed first.');
    return;
  }

  const bands = await prisma.band.findMany({
    where: { deletedAt: null, genre: { not: null } },
    select: { id: true, genre: true },
  });

  let tagged = 0;
  let rows = 0;
  const unmatchedCounts = new Map<string, number>();

  for (const band of bands) {
    const raw = band.genre?.trim();
    if (!raw) continue;

    for (const token of unmatchedTokens(raw, genres)) {
      unmatchedCounts.set(token, (unmatchedCounts.get(token) ?? 0) + 1);
    }

    const matches = matchGenreText(raw, genres, 3);
    if (matches.length === 0) continue;

    tagged++;
    rows += matches.length;

    if (!DRY_RUN) {
      await prisma.bandGenre.createMany({
        data: matches.map((g, position) => ({ bandId: band.id, genreId: g.id, position })),
        skipDuplicates: true,
      });
    }
  }

  log(`Step 4: tagged ${tagged} of ${bands.length} band(s) with a genre, ${rows} BandGenre row(s).`);

  // Band.genre is deliberately left populated: it stays the display fallback for
  // one release, and it is the input if this needs re-running with more aliases.
  if (unmatchedCounts.size) {
    const sorted = [...unmatchedCounts.entries()].sort((a, b) => b[1] - a[1]);
    log(`  ${sorted.length} unmatched token(s). Add the common ones to GENRE_SEED aliases and re-run:`);
    for (const [token, count] of sorted.slice(0, 25)) {
      log(`    ${String(count).padStart(4)}  ${token}`);
    }
    if (sorted.length > 25) log(`    ... and ${sorted.length - 25} more`);
  }
}

// ---------------------------------------------------------------------------
// Step 5 -- crafts
// ---------------------------------------------------------------------------

async function backfillCrafts() {
  const promoters = await prisma.user.findMany({
    where: { isPromoter: true, deletedAt: null },
    select: { id: true },
  });

  if (!DRY_RUN && promoters.length) {
    await prisma.userCraft.createMany({
      data: promoters.map(u => ({ userId: u.id, craft: 'PROMOTER' as const })),
      skipDuplicates: true,
    });
  }

  log(`Step 5: migrated ${promoters.length} isPromoter user(s) into UserCraft.`);
}

// ---------------------------------------------------------------------------

async function main() {
  if (DRY_RUN) {
    console.log('Dry run: reporting what would change. No writes will be made.\n');
  }
  if (USE_TEST_ENV) {
    console.log('Using .env.test.\n');
  }

  await mergeDuplicateScenes();
  await createScenes();

  if (DRY_RUN) {
    console.log(
      '\n  Note: steps 2 and 3 are reported against scenes that already exist.\n' +
        '  The scenes step 1 would have created were not written, so their rows still\n' +
        '  count as unstamped below. A real run resolves them.\n',
    );
  }

  await stampSceneIds();
  await repointSceneFollows();
  await backfillGenres();
  await backfillCrafts();

  console.log(`\nDone${DRY_RUN ? ' (nothing was written)' : ''}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
