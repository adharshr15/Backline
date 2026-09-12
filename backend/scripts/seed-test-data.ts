// Seed a realistic Texas scene (Austin, Houston, Dallas, College Station) into the
// dev database for manual testing: 60 users, 40 bands, 40 venues, follows, scene
// follows, upcoming shows with RSVPs/reposts, posts with likes/comments, 40
// marketplace listings, and a few conversations. Every account's password is "password".
//
// Re-runnable. Every row it creates has an id starting with "seed_":
//   - users, bands and venues are upserted by id, and the update never touches
//     profileImageUrl/headerImageUrl, so pfps set in the app survive a reseed;
//   - everything else seeded is deleted and recreated;
//   - nothing without the prefix is touched (except rows pointing at seed rows
//     when running --clean).
//
// Run with:
//   npm run seed:test               seed / reseed the dev database
//   npm run seed:test -- --dry-run  print what would be written
//   npm run seed:test -- --clean    remove every seed row and seed upload
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';
import { resolveScene } from '../src/lib/scenes';
import { syncGenreSeed } from '../src/lib/genres';
import { buildSeedPlan, planCounts, SEED_PREFIX, SEED_PASSWORD } from './seed/plan';
import { CITIES, type CityKey } from './seed/fixtures';
import { postImage } from './seed/png';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAN_ONLY = args.includes('--clean');

// Same cost factor as auth.controller.ts.
const BCRYPT_ROUNDS = 12;
const UPLOADS_DIR = fileURLToPath(new URL('../uploads', import.meta.url));
const SEED_FILE = /^seed-/;

const seedId = { startsWith: SEED_PREFIX };
const city = (key: CityKey) => CITIES.find(c => c.key === key)!;

const dbLabel = () => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return `${url.host}${url.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
};

const removeSeedUploads = () => {
  if (!fs.existsSync(UPLOADS_DIR)) return 0;
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => SEED_FILE.test(f));
  for (const f of files) fs.unlinkSync(path.join(UPLOADS_DIR, f));
  return files.length;
};

/** Delete every derived seed row. Profiles (users/bands/venues) are kept. */
async function cleanDerived() {
  // Implicit many-to-many joins have no emulated cascade -- detach before deleting.
  const seedShows = await prisma.show.findMany({ where: { id: seedId }, select: { id: true } });
  for (const { id } of seedShows) {
    await prisma.show.update({
      where: { id },
      data: {
        rsvpUsers: { set: [] }, rsvpBands: { set: [] }, rsvpVenues: { set: [] },
        repostedByUsers: { set: [] }, repostedByBands: { set: [] }, repostedByVenues: { set: [] },
      },
    });
  }

  await prisma.postLike.deleteMany({ where: { OR: [{ id: seedId }, { postId: seedId }] } });
  await prisma.postComment.deleteMany({ where: { OR: [{ id: seedId }, { postId: seedId }] } });
  await prisma.post.deleteMany({ where: { id: seedId } });
  await prisma.message.deleteMany({ where: { conversationId: seedId } });
  await prisma.conversationInvite.deleteMany({ where: { conversationId: seedId } });
  await prisma.conversationParticipant.deleteMany({ where: { conversationId: seedId } });
  await prisma.conversation.deleteMany({ where: { id: seedId } });
  // A real conversation may have attached a seed listing: detach it, don't delete the message.
  await prisma.message.updateMany({ where: { listingId: seedId }, data: { listingId: null } });
  await prisma.listingMedia.deleteMany({ where: { listingId: seedId } });
  await prisma.listing.deleteMany({ where: { id: seedId } });
  await prisma.follow.deleteMany({ where: { id: seedId } });
  await prisma.sceneFollow.deleteMany({ where: { id: seedId } });
  await prisma.showBand.deleteMany({ where: { showId: seedId } });
  await prisma.showInvite.deleteMany({ where: { showId: seedId } });
  await prisma.show.deleteMany({ where: { id: seedId } });
  await prisma.bandGenre.deleteMany({ where: { id: seedId } });
  await prisma.bandMember.deleteMany({ where: { id: seedId } });
  await prisma.venueRepresentative.deleteMany({ where: { id: seedId } });
  await prisma.userCraft.deleteMany({ where: { id: seedId } });
  return removeSeedUploads();
}

/** Remove the seed profiles too, plus anything that still points at them. */
async function cleanAll() {
  const files = await cleanDerived();

  await prisma.follow.deleteMany({
    where: {
      OR: [
        { followerUserId: seedId }, { followerBandId: seedId }, { followerVenueId: seedId },
        { followeeUserId: seedId }, { followeeBandId: seedId }, { followeeVenueId: seedId },
      ],
    },
  });
  await prisma.sceneFollow.deleteMany({ where: { followerId: seedId } });
  await prisma.postLike.deleteMany({ where: { likerId: seedId } });
  await prisma.postComment.deleteMany({
    where: { OR: [{ commenterUserId: seedId }, { authorUserId: seedId }, { authorBandId: seedId }, { authorVenueId: seedId }] },
  });
  await prisma.message.deleteMany({
    where: { OR: [{ senderUserId: seedId }, { senderBandId: seedId }, { senderVenueId: seedId }] },
  });
  await prisma.conversationParticipant.deleteMany({
    where: { OR: [{ userId: seedId }, { bandId: seedId }, { venueId: seedId }] },
  });
  await prisma.showBand.deleteMany({ where: { bandId: seedId } });
  await prisma.showInvite.deleteMany({ where: { OR: [{ bandId: seedId }, { venueId: seedId }] } });
  await prisma.bandInvite.deleteMany({ where: { OR: [{ bandId: seedId }, { userId: seedId }] } });
  await prisma.venueInvite.deleteMany({ where: { OR: [{ venueId: seedId }, { userId: seedId }] } });
  await prisma.bandMember.deleteMany({ where: { OR: [{ bandId: seedId }, { userId: seedId }] } });
  await prisma.venueRepresentative.deleteMany({ where: { OR: [{ venueId: seedId }, { userId: seedId }] } });
  await prisma.bandGenre.deleteMany({ where: { bandId: seedId } });
  await prisma.userCraft.deleteMany({ where: { userId: seedId } });

  const bands = await prisma.band.deleteMany({ where: { id: seedId } });
  const venues = await prisma.venue.deleteMany({ where: { id: seedId } });
  const users = await prisma.user.deleteMany({ where: { id: seedId } });
  console.log(`Removed ${users.count} user(s), ${bands.count} band(s), ${venues.count} venue(s) and ${files} upload(s).`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed test data with NODE_ENV=production.');
  }

  const plan = buildSeedPlan(new Date());

  if (DRY_RUN) {
    console.log('Dry run -- nothing will be written. Rows per table:');
    console.table(planCounts(plan));
    return;
  }

  console.log(`Database: ${dbLabel()}`);

  if (CLEAN_ONLY) {
    await cleanAll();
    return;
  }

  // Usernames and emails are unique. Fail loudly rather than half-seeding if a
  // real account already holds one.
  const clashes = await prisma.user.findMany({
    where: {
      NOT: { id: seedId },
      OR: [
        { username: { in: plan.users.map(u => u.username) } },
        { email: { in: plan.users.map(u => u.email) } },
      ],
    },
    select: { username: true, email: true },
  });
  if (clashes.length) {
    throw new Error(`Non-seed accounts already use these usernames/emails: ${clashes.map(c => c.username).join(', ')}`);
  }

  const removedFiles = await cleanDerived();
  console.log(`Cleared previous seed rows (and ${removedFiles} seed upload(s)).`);

  await syncGenreSeed();
  const genres = await prisma.genre.findMany({ select: { id: true, slug: true } });
  const genreId = new Map(genres.map(g => [g.slug, g.id]));
  const missing = [...new Set(plan.bandGenres.map(g => g.genreSlug).filter(s => !genreId.has(s)))];
  if (missing.length) throw new Error(`Unknown genre slug(s) in fixtures: ${missing.join(', ')}`);

  const sceneId = {} as Record<CityKey, string>;
  for (const c of CITIES) {
    const scene = await resolveScene({ city: c.name, state: c.state, country: 'USA' });
    if (!scene) throw new Error(`Could not resolve a scene for ${c.name}`);
    if (scene.latitude == null || scene.longitude == null) {
      await prisma.scene.update({ where: { id: scene.id }, data: { latitude: c.lat, longitude: c.lng } });
    }
    sceneId[c.key] = scene.id;
  }

  const password = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
  const place = (key: CityKey) => ({ city: city(key).name, state: city(key).state, country: 'USA', sceneId: sceneId[key] });

  // Profiles: upsert, never overwriting images set in the app.
  for (const u of plan.users) {
    const data = { username: u.username, name: u.name, email: u.email, password, bio: u.bio, ...place(u.city), deletedAt: null };
    await prisma.user.upsert({ where: { id: u.id }, create: { id: u.id, accountType: 'USER', ...data }, update: data });
  }
  for (const b of plan.bands) {
    const data = { name: b.name, bio: b.bio, ...place(b.city), deletedAt: null };
    await prisma.band.upsert({ where: { id: b.id }, create: { id: b.id, accountType: 'BAND', ...data }, update: data });
  }
  for (const v of plan.venues) {
    const data = {
      name: v.name, bio: v.bio, address: v.address, capacity: v.capacity,
      latitude: v.latitude, longitude: v.longitude, contactEmail: v.contactEmail,
      ...place(v.city), deletedAt: null,
    };
    await prisma.venue.upsert({ where: { id: v.id }, create: { id: v.id, accountType: 'VENUE', ...data }, update: data });
  }

  // skipDuplicates: a real user may have recreated one of these links in the app.
  const skipDuplicates = true;
  await prisma.userCraft.createMany({ data: plan.crafts, skipDuplicates });
  await prisma.bandMember.createMany({ data: plan.bandMembers, skipDuplicates });
  await prisma.venueRepresentative.createMany({ data: plan.venueReps, skipDuplicates });
  await prisma.bandGenre.createMany({
    data: plan.bandGenres.map(({ genreSlug, ...g }) => ({ ...g, genreId: genreId.get(genreSlug)! })),
    skipDuplicates,
  });
  await prisma.follow.createMany({ data: plan.follows });
  await prisma.sceneFollow.createMany({
    data: plan.sceneFollows.map(({ city: key, ...f }) => ({ ...f, sceneId: sceneId[key] })),
    skipDuplicates,
  });

  await prisma.show.createMany({ data: plan.shows.map(({ city: key, ...s }) => ({ ...s, ...place(key) })) });
  await prisma.showBand.createMany({ data: plan.showBands, skipDuplicates });
  await prisma.showInvite.createMany({ data: plan.showInvites });
  for (const e of plan.engagements) {
    const ids = (xs: string[]) => ({ connect: xs.map(id => ({ id })) });
    await prisma.show.update({
      where: { id: e.showId },
      data: {
        rsvpUsers: ids(e.rsvpUserIds),
        repostedByUsers: ids(e.repostUserIds),
        repostedByBands: ids(e.repostBandIds),
        repostedByVenues: ids(e.repostVenueIds),
      },
    });
  }

  await prisma.post.createMany({ data: plan.posts.map(({ fileName, image, ...p }) => ({ ...p, type: 'PHOTO' as const })) });
  await prisma.postLike.createMany({ data: plan.postLikes, skipDuplicates });
  await prisma.postComment.createMany({ data: plan.postComments });

  await prisma.listing.createMany({
    data: plan.listings.map(({ fileName, image, city: key, ...l }) => ({
      ...l, city: city(key).name, state: city(key).state, country: 'USA',
    })),
  });
  await prisma.listingMedia.createMany({
    data: plan.listingMedia.map(({ fileName, image, ...m }) => ({ ...m, type: 'PHOTO' as const })),
  });

  await prisma.conversation.createMany({ data: plan.conversations });
  await prisma.conversationParticipant.createMany({ data: plan.participants });
  await prisma.message.createMany({ data: plan.messages });

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const item of [...plan.posts, ...plan.listings, ...plan.listingMedia]) {
    fs.writeFileSync(path.join(UPLOADS_DIR, item.fileName), postImage(item.image));
  }

  console.log('\nSeeded:');
  console.table(planCounts(plan));
  console.log(`\nEvery seed account logs in with password "${SEED_PASSWORD}". A few to try:`);
  for (const c of CITIES) {
    const sample = ['musician', 'scene', 'photographer', 'fan']
      .map(role => plan.users.find(u => u.city === c.key && u.role === role)!.username);
    console.log(`  ${c.name.padEnd(16)} ${sample.join(', ')}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
