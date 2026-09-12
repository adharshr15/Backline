// Pure builder for the seed dataset: fixtures + a fixed-seed PRNG in, plain rows
// out. No database access here -- scripts/seed-test-data.ts writes the rows, and
// tests/unit/seed-plan.unit.test.ts checks the invariants.
//
// Every row id starts with SEED_PREFIX. Profile ids are derived from usernames and
// slugs (stable across runs, so app tokens survive a reseed); everything else is
// numbered in generation order, which is deterministic for a given `now` + seed.
import {
  BANDS, CITIES, USERS, VENUES, DIY_SPOTS, SHOW_NOTES, CAPTIONS, COMMENTS,
  BOOKING_SCRIPT, VENUE_OUTREACH_SCRIPT, PROMOTER_SCRIPT, PHOTOGRAPHER_SCRIPT, FAN_SCRIPT,
  LISTINGS, LISTING_SCRIPT,
  type CityKey, type CraftName, type ListingFixture, type ScriptLine, type UserRole,
} from "./fixtures";

export const SEED_PREFIX = "seed_";
export const SEED_PASSWORD = "password";
export const DEFAULT_SEED = 20260911;
const SHOWS_PER_CITY = 9;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type ProfileType = "USER" | "BAND" | "VENUE";
export type ProfileRef = { type: ProfileType; id: string; city: CityKey };
type ShowStatusName = "PENDING" | "CONFIRMED" | "CANCELLED";
type InviteStatusName = "PENDING" | "ACCEPTED";

const idPart = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
export const seedUserId = (username: string) => `${SEED_PREFIX}u_${idPart(username)}`;
export const seedBandId = (slug: string) => `${SEED_PREFIX}b_${idPart(slug)}`;
export const seedVenueId = (slug: string) => `${SEED_PREFIX}v_${idPart(slug)}`;

export type SeedUser = { id: string; username: string; name: string; email: string; bio: string; city: CityKey; role: UserRole };
export type SeedBand = { id: string; slug: string; name: string; city: CityKey; bio: string };
export type SeedVenue = {
  id: string; slug: string; name: string; city: CityKey; address: string; capacity: number;
  latitude: number; longitude: number; contactEmail: string; bio: string;
};
export type SeedCraft = { id: string; userId: string; craft: CraftName; forHire: boolean; headline: string | null; position: number };
export type SeedBandMember = { id: string; userId: string; bandId: string; role: "MANAGER" | "MEMBER" };
export type SeedVenueRep = { id: string; userId: string; venueId: string; role: "MANAGER" | "REPRESENTATIVE" };
export type SeedBandGenre = { id: string; bandId: string; genreSlug: string; position: number };
export type SeedFollow = {
  id: string;
  followerType: ProfileType; followerUserId: string | null; followerBandId: string | null; followerVenueId: string | null;
  followeeType: ProfileType; followeeUserId: string | null; followeeBandId: string | null; followeeVenueId: string | null;
  createdAt: Date;
};
/** followerType is lowercase: that is what the scene endpoints store. */
export type SeedSceneFollow = { id: string; followerId: string; followerType: "user" | "band" | "venue"; city: CityKey; createdAt: Date };
export type SeedShow = {
  id: string; city: CityKey; date: Date; doors: Date; status: ShowStatusName;
  venueId: string | null; venueName: string | null; venueAddress: string | null;
  notes: string | null; ticketsUrl: string | null;
  createdByUserId: string | null; createdByBandId: string | null; createdByVenueId: string | null;
  createdAt: Date;
};
export type SeedShowBand = { id: string; showId: string; bandId: string; role: "HEADLINER" | "SUPPORT" };
export type SeedShowInvite = { id: string; showId: string; bandId: string | null; venueId: string | null; status: InviteStatusName };
export type SeedShowEngagement = {
  showId: string; rsvpUserIds: string[]; repostUserIds: string[]; repostBandIds: string[]; repostVenueIds: string[];
};
export type SeedPost = {
  id: string; fileName: string; url: string; caption: string; uploaderUserId: string;
  ownerUserId: string | null; ownerBandId: string | null; ownerVenueId: string | null;
  createdAt: Date; image: { hueA: number; hueB: number; style: number };
};
/** likerType is uppercase (ParticipantType): that is what the post endpoints store. */
export type SeedPostLike = { id: string; postId: string; likerType: ProfileType; likerId: string; createdAt: Date };
export type SeedPostComment = {
  id: string; postId: string; text: string; commenterUserId: string;
  authorUserId: string | null; authorBandId: string | null; authorVenueId: string | null; createdAt: Date;
};
export type SeedConversation = { id: string; createdAt: Date; updatedAt: Date };
export type SeedParticipant = {
  id: string; conversationId: string; participantType: ProfileType;
  userId: string | null; bandId: string | null; venueId: string | null; joinedAt: Date; lastReadAt: Date;
};
export type SeedMessage = {
  id: string; conversationId: string; content: string;
  senderUserId: string | null; senderBandId: string | null; senderVenueId: string | null;
  listingId: string | null; createdAt: Date;
};
type ImageSpec = { hueA: number; hueB: number; style: number };
export type SeedListing = {
  id: string; fileName: string; coverUrl: string; image: ImageSpec;
  title: string; description: string; category: string | null;
  kind: ListingFixture["kind"]; price: number | null; openToTrades: boolean;
  status: NonNullable<ListingFixture["status"]>;
  city: CityKey; latitude: number; longitude: number;
  createdByUserId: string | null; createdByBandId: string | null; createdByVenueId: string | null;
  createdAt: Date;
};
export type SeedListingMedia = {
  id: string; listingId: string; fileName: string; url: string; image: ImageSpec;
  position: number; uploaderUserId: string; createdAt: Date;
};

export type SeedPlan = {
  users: SeedUser[]; bands: SeedBand[]; venues: SeedVenue[];
  crafts: SeedCraft[]; bandMembers: SeedBandMember[]; venueReps: SeedVenueRep[]; bandGenres: SeedBandGenre[];
  follows: SeedFollow[]; sceneFollows: SeedSceneFollow[];
  shows: SeedShow[]; showBands: SeedShowBand[]; showInvites: SeedShowInvite[]; engagements: SeedShowEngagement[];
  posts: SeedPost[]; postLikes: SeedPostLike[]; postComments: SeedPostComment[];
  listings: SeedListing[]; listingMedia: SeedListingMedia[];
  conversations: SeedConversation[]; participants: SeedParticipant[]; messages: SeedMessage[];
};

/** mulberry32 -- tiny, fast, and good enough for test data. */
const makeRng = (seed: number) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const chance = (p: number) => next() < p;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  /** k items without replacement, each draw proportional to weight. */
  const weighted = <T>(xs: readonly T[], weight: (x: T) => number, k: number): T[] => {
    const pool = [...xs];
    const out: T[] = [];
    while (out.length < k && pool.length) {
      let r = next() * pool.reduce((s, x) => s + weight(x), 0);
      let i = 0;
      for (; i < pool.length - 1; i++) {
        r -= weight(pool[i]);
        if (r <= 0) break;
      }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  };
  return { next, int, chance, pick, shuffle, weighted };
};

const nthSundayOfMonth = (year: number, month: number, n: number) => {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
};

/** Hours to add to Central wall-clock time to get UTC (US DST rules). */
const centralOffsetHours = (dayUtcMidnight: number) => {
  const d = new Date(dayUtcMidnight);
  const y = d.getUTCFullYear();
  const dstStart = Date.UTC(y, 2, nthSundayOfMonth(y, 2, 2));
  const dstEnd = Date.UTC(y, 10, nthSundayOfMonth(y, 10, 1));
  return dayUtcMidnight >= dstStart && dayUtcMidnight < dstEnd ? 5 : 6;
};

const centralTime = (dayUtcMidnight: number, hour: number, minute: number) =>
  new Date(dayUtcMidnight + (hour + centralOffsetHours(dayUtcMidnight)) * HOUR + minute * MINUTE);

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;

const byType = <T>(r: ProfileRef, id: string, value: T) => ({
  user: r.type === "USER" ? value : null,
  band: r.type === "BAND" ? value : null,
  venue: r.type === "VENUE" ? value : null,
  id,
});

export function buildSeedPlan(now: Date, seed = DEFAULT_SEED): SeedPlan {
  const rng = makeRng(seed);
  const nowMs = now.getTime();
  const ago = (ms: number) => new Date(nowMs - ms);

  const counters = new Map<string, number>();
  const nextId = (kind: string) => {
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    return `${SEED_PREFIX}${kind}_${n}`;
  };

  const cityFixture = (c: CityKey) => CITIES.find(x => x.key === c)!;

  // -------------------------------------------------------------------------
  // Profiles
  // -------------------------------------------------------------------------

  const users: SeedUser[] = USERS.map(u => ({
    id: seedUserId(u.username),
    username: u.username,
    name: u.name,
    email: `${u.username}@backline.test`,
    bio: u.bio,
    city: u.city,
    role: u.role,
  }));

  const bands: SeedBand[] = BANDS.map(b => ({ id: seedBandId(b.slug), slug: b.slug, name: b.name, city: b.city, bio: b.bio }));

  const venues: SeedVenue[] = VENUES.map(v => {
    const c = cityFixture(v.city);
    return {
      id: seedVenueId(v.slug),
      slug: v.slug,
      name: v.name,
      city: v.city,
      address: `${v.address}, ${c.name}, TX`,
      capacity: v.capacity,
      latitude: round5(c.lat + (rng.next() - 0.5) * 0.06),
      longitude: round5(c.lng + (rng.next() - 0.5) * 0.06),
      contactEmail: `booking@${v.slug}.backline.test`,
      bio: v.bio,
    };
  });

  const cityOf = new Map<string, CityKey>([
    ...users.map(u => [u.id, u.city] as const),
    ...bands.map(b => [b.id, b.city] as const),
    ...venues.map(v => [v.id, v.city] as const),
  ]);
  const names = new Map<string, string>([
    ...users.map(u => [u.id, u.name] as const),
    ...bands.map(b => [b.id, b.name] as const),
    ...venues.map(v => [v.id, v.name] as const),
  ]);
  const nameOf = (id: string) => names.get(id)!;

  const crafts: SeedCraft[] = [];
  const bandMembers: SeedBandMember[] = [];
  const venueReps: SeedVenueRep[] = [];

  for (const u of USERS) {
    const userId = seedUserId(u.username);
    (u.crafts ?? []).forEach((c, position) =>
      crafts.push({ id: nextId("craft"), userId, craft: c.craft, forHire: c.forHire ?? false, headline: c.headline ?? null, position }),
    );
    for (const [slug, role] of u.bands ?? []) {
      const bandId = seedBandId(slug);
      if (cityOf.get(bandId) !== u.city) throw new Error(`${u.username}: band "${slug}" is unknown or in another city`);
      bandMembers.push({ id: nextId("member"), userId, bandId, role });
    }
    for (const [slug, role] of u.venues ?? []) {
      const venueId = seedVenueId(slug);
      if (cityOf.get(venueId) !== u.city) throw new Error(`${u.username}: venue "${slug}" is unknown or in another city`);
      venueReps.push({ id: nextId("rep"), userId, venueId, role });
    }
  }

  for (const b of bands) {
    const managers = bandMembers.filter(m => m.bandId === b.id && m.role === "MANAGER").length;
    if (managers !== 1) throw new Error(`Band "${b.slug}" has ${managers} managers; expected exactly 1`);
  }
  for (const v of venues) {
    const managers = venueReps.filter(r => r.venueId === v.id && r.role === "MANAGER").length;
    if (managers !== 1) throw new Error(`Venue "${v.slug}" has ${managers} managers; expected exactly 1`);
  }

  const bandGenres: SeedBandGenre[] = BANDS.flatMap(b =>
    b.genres.map((genreSlug, position) => ({ id: nextId("genre"), bandId: seedBandId(b.slug), genreSlug, position })),
  );

  const membersOf = (bandId: string) => bandMembers.filter(m => m.bandId === bandId).map(m => m.userId);
  const repsOf = (venueId: string) => venueReps.filter(r => r.venueId === venueId).map(r => r.userId);
  const hasCraft = (userId: string, craft: CraftName) => crafts.some(c => c.userId === userId && c.craft === craft);

  const userRefs = users.map((u): ProfileRef => ({ type: "USER", id: u.id, city: u.city }));
  const bandRefs = bands.map((b): ProfileRef => ({ type: "BAND", id: b.id, city: b.city }));
  const venueRefs = venues.map((v): ProfileRef => ({ type: "VENUE", id: v.id, city: v.city }));
  const allRefs = [...userRefs, ...bandRefs, ...venueRefs];
  const refById = new Map(allRefs.map(r => [r.id, r]));
  const ref = (id: string) => refById.get(id)!;
  const inCity = (refs: ProfileRef[], c: CityKey) => refs.filter(r => r.city === c);
  const outCity = (refs: ProfileRef[], c: CityKey) => refs.filter(r => r.city !== c);

  // Uneven popularity so follower counts look like a real scene, not a grid.
  const popularity = new Map<string, number>(allRefs.map(r => [r.id, 0.4 + rng.next() * 1.6]));
  for (const u of users) {
    if (u.role === "photographer" || u.role === "scene") popularity.set(u.id, popularity.get(u.id)! + 1.5);
  }
  const weight = (r: ProfileRef) => popularity.get(r.id)!;

  // -------------------------------------------------------------------------
  // Follows -- overwhelmingly within a city, with the odd out-of-town tie
  // -------------------------------------------------------------------------

  const follows: SeedFollow[] = [];
  const followKeys = new Set<string>();
  const followKey = (a: ProfileRef, b: ProfileRef) => `${a.type}:${a.id}>${b.type}:${b.id}`;
  const isFollowing = (a: ProfileRef, b: ProfileRef) => followKeys.has(followKey(a, b));

  const follow = (a: ProfileRef, b: ProfileRef) => {
    if (a.id === b.id || isFollowing(a, b)) return;
    followKeys.add(followKey(a, b));
    const from = byType(a, a.id, a.id);
    const to = byType(b, b.id, b.id);
    follows.push({
      id: nextId("follow"),
      followerType: a.type, followerUserId: from.user, followerBandId: from.band, followerVenueId: from.venue,
      followeeType: b.type, followeeUserId: to.user, followeeBandId: to.band, followeeVenueId: to.venue,
      createdAt: ago(rng.int(3, 180) * DAY + rng.int(0, 23) * HOUR),
    });
  };
  const followSome = (a: ProfileRef, pool: ProfileRef[], k: number) => {
    const candidates = pool.filter(p => p.id !== a.id && !isFollowing(a, p));
    for (const b of rng.weighted(candidates, weight, k)) follow(a, b);
  };

  for (const me of userRefs) {
    for (const m of bandMembers) if (m.userId === me.id) follow(me, ref(m.bandId));
    for (const r of venueReps) if (r.userId === me.id) follow(me, ref(r.venueId));
    followSome(me, inCity(bandRefs, me.city), rng.int(4, 9));
    if (rng.chance(0.15)) followSome(me, outCity(bandRefs, me.city), rng.int(1, 2));
    followSome(me, inCity(venueRefs, me.city), rng.int(3, 6));
    if (rng.chance(0.08)) followSome(me, outCity(venueRefs, me.city), 1);
    followSome(me, inCity(userRefs, me.city), rng.int(3, 8));
    if (rng.chance(0.1)) followSome(me, outCity(userRefs, me.city), 1);
  }
  for (const me of bandRefs) {
    for (const userId of membersOf(me.id)) follow(me, ref(userId));
    followSome(me, inCity(bandRefs, me.city), rng.int(3, 6));
    followSome(me, outCity(bandRefs, me.city), rng.int(0, 2)); // touring friends
    followSome(me, inCity(venueRefs, me.city), rng.int(2, 4));
  }
  for (const me of venueRefs) {
    followSome(me, inCity(bandRefs, me.city), rng.int(3, 6));
    followSome(me, inCity(venueRefs, me.city), rng.int(1, 2));
  }

  const followersOf = new Map<string, ProfileRef[]>();
  for (const f of follows) {
    const followee = (f.followeeUserId ?? f.followeeBandId ?? f.followeeVenueId)!;
    const follower = (f.followerUserId ?? f.followerBandId ?? f.followerVenueId)!;
    followersOf.set(followee, [...(followersOf.get(followee) ?? []), ref(follower)]);
  }

  const sceneFollows: SeedSceneFollow[] = [];
  const lowerType = { USER: "user", BAND: "band", VENUE: "venue" } as const;
  for (const r of allRefs) {
    sceneFollows.push({ id: nextId("scenefollow"), followerId: r.id, followerType: lowerType[r.type], city: r.city, createdAt: ago(rng.int(10, 200) * DAY) });
    if (r.type === "USER" && rng.chance(0.2)) {
      const other = rng.pick(CITIES.filter(c => c.key !== r.city)).key;
      sceneFollows.push({ id: nextId("scenefollow"), followerId: r.id, followerType: "user", city: other, createdAt: ago(rng.int(10, 200) * DAY) });
    }
  }

  // -------------------------------------------------------------------------
  // Shows -- upcoming only, mostly Fri/Sat, doors at 7-8pm Central
  // -------------------------------------------------------------------------

  const promoterOf = (c: CityKey) => users.find(u => u.city === c && u.role === "scene" && hasCraft(u.id, "PROMOTER"))!;

  const shows: SeedShow[] = [];
  const showBands: SeedShowBand[] = [];
  const showInvites: SeedShowInvite[] = [];
  const engagements: SeedShowEngagement[] = [];
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  CITIES.forEach((city, cityIndex) => {
    const localBands = inCity(bandRefs, city.key);
    const localVenues = venues.filter(v => v.city === city.key);
    const promoter = promoterOf(city.key);
    const diySpots = DIY_SPOTS[city.key];

    const days = Array.from({ length: SHOWS_PER_CITY }, () => {
      let day = todayUtc + rng.int(2, 84) * DAY;
      if (rng.chance(0.7)) {
        const target = rng.chance(0.5) ? 5 : 6; // Friday or Saturday
        day += ((target - new Date(day).getUTCDay() + 7) % 7) * DAY;
      }
      return day;
    }).sort((a, b) => a - b);

    days.forEach((day, i) => {
      const id = nextId("show");
      const isDiy = i % 4 === 1;
      const status: ShowStatusName =
        i === 7 ? "PENDING" : i === 4 && (cityIndex === 1 || cityIndex === 2) ? "CANCELLED" : "CONFIRMED";

      const venue = isDiy ? null : rng.pick(localVenues);
      const diy = isDiy ? diySpots[(i >> 2) % diySpots.length] : null;

      const lineup = rng.weighted(localBands, weight, rng.int(2, 4));
      if (rng.chance(0.25)) lineup.push(rng.pick(outCity(bandRefs, city.key))); // touring support

      const creatorKind: ProfileType = i % 3 === 0 && venue ? "VENUE" : i % 3 === 2 ? "USER" : "BAND";
      const createdByVenueId = creatorKind === "VENUE" ? venue!.id : null;
      const createdByBandId = creatorKind === "BAND" ? lineup[0].id : null;
      const createdByUserId = creatorKind === "USER" ? promoter.id : null;

      const doors = centralTime(day, rng.pick([19, 19, 20]), rng.pick([0, 30]));
      const date = new Date(doors.getTime() + rng.pick([30, 45, 60]) * MINUTE);

      shows.push({
        id, city: city.key, date, doors, status,
        venueId: venue?.id ?? null,
        venueName: diy?.name ?? null,
        venueAddress: diy?.address ?? null,
        notes: isDiy ? "All ages. DM a band for the address." : rng.pick(SHOW_NOTES),
        ticketsUrl: venue && venue.capacity >= 250 ? `https://tickets.example.com/backline/${id}` : null,
        createdByUserId, createdByBandId, createdByVenueId,
        createdAt: ago(rng.int(1, 20) * DAY),
      });

      // A pending show is still waiting on its last band. Everyone else has
      // accepted, mirroring what createShow + respondToShowInvite would leave.
      const pendingBandId = status === "PENDING" ? lineup[lineup.length - 1].id : null;
      lineup.forEach((b, idx) => {
        if (b.id !== pendingBandId) {
          showBands.push({ id: nextId("showband"), showId: id, bandId: b.id, role: idx === 0 ? "HEADLINER" : "SUPPORT" });
        }
        if (b.id !== createdByBandId) {
          showInvites.push({ id: nextId("showinvite"), showId: id, bandId: b.id, venueId: null, status: b.id === pendingBandId ? "PENDING" : "ACCEPTED" });
        }
      });
      if (venue && creatorKind !== "VENUE") {
        showInvites.push({ id: nextId("showinvite"), showId: id, bandId: null, venueId: venue.id, status: status === "PENDING" ? "PENDING" : "ACCEPTED" });
      }

      const eng: SeedShowEngagement = { showId: id, rsvpUserIds: [], repostUserIds: [], repostBandIds: [], repostVenueIds: [] };
      if (status !== "CANCELLED") {
        const venueRef = venue ? ref(venue.id) : null;
        for (const u of inCity(userRefs, city.key)) {
          const interested = lineup.some(b => isFollowing(u, b)) || (venueRef !== null && isFollowing(u, venueRef));
          if (rng.chance(interested ? 0.5 : 0.08)) {
            eng.rsvpUserIds.push(u.id);
            if (rng.chance(0.15)) eng.repostUserIds.push(u.id);
          }
        }
        for (const b of lineup) {
          if (b.id !== createdByBandId && b.id !== pendingBandId && rng.chance(0.8)) eng.repostBandIds.push(b.id);
        }
        if (venue && creatorKind !== "VENUE" && rng.chance(0.9)) eng.repostVenueIds.push(venue.id);
      }
      engagements.push(eng);
    });
  });

  // -------------------------------------------------------------------------
  // Posts, likes, comments
  // -------------------------------------------------------------------------

  const posts: SeedPost[] = [];
  const addPost = (owner: ProfileRef, uploaderUserId: string, pool: readonly string[]) => {
    const n = posts.length + 1;
    const fileName = `seed-post-${n}.png`;
    const localBands = inCity(bandRefs, owner.city);
    const caption = fill(rng.pick(pool), {
      band: nameOf(rng.pick(localBands).id),
      friend: nameOf(rng.pick(localBands.filter(b => b.id !== owner.id)).id),
      venue: nameOf(rng.pick(inCity(venueRefs, owner.city)).id),
      city: cityFixture(owner.city).name,
    });
    const hueA = rng.int(0, 359);
    const o = byType(owner, owner.id, owner.id);
    posts.push({
      id: `${SEED_PREFIX}post_${n}`,
      fileName,
      url: `/uploads/${fileName}`,
      caption,
      uploaderUserId,
      ownerUserId: o.user, ownerBandId: o.band, ownerVenueId: o.venue,
      createdAt: ago(rng.int(1, 60) * DAY + rng.int(0, 23) * HOUR),
      image: { hueA, hueB: (hueA + rng.int(40, 160)) % 360, style: rng.int(0, 2) },
    });
  };

  for (const b of bandRefs) {
    const members = membersOf(b.id);
    for (let i = rng.int(1, 2); i > 0; i--) addPost(b, rng.pick(members), CAPTIONS.band);
  }
  for (const v of venueRefs) {
    const manager = venueReps.find(r => r.venueId === v.id && r.role === "MANAGER")!.userId;
    for (let i = rng.int(0, 2); i > 0; i--) addPost(v, manager, CAPTIONS.venue);
  }
  for (const u of users) {
    const shooter = u.role === "photographer" || hasCraft(u.id, "PHOTOGRAPHER");
    const count = shooter ? rng.int(3, 5) : rng.int(0, 1);
    for (let i = count; i > 0; i--) addPost(ref(u.id), u.id, shooter ? CAPTIONS.photographer : CAPTIONS.user);
  }

  /** The logged-in user behind an action taken as this profile. */
  const actingUser = (r: ProfileRef) =>
    r.type === "USER" ? r.id : r.type === "BAND" ? rng.pick(membersOf(r.id)) : rng.pick(repsOf(r.id));

  const postLikes: SeedPostLike[] = [];
  const postComments: SeedPostComment[] = [];
  for (const p of posts) {
    const ownerId = (p.ownerUserId ?? p.ownerBandId ?? p.ownerVenueId)!;
    const fans = followersOf.get(ownerId) ?? [];
    const after = (hours: number) => new Date(Math.min(nowMs - MINUTE, p.createdAt.getTime() + hours * HOUR));

    for (const f of fans) {
      if (rng.chance(0.4)) postLikes.push({ id: nextId("like"), postId: p.id, likerType: f.type, likerId: f.id, createdAt: after(rng.int(1, 48)) });
    }
    const commenters = rng.shuffle(fans).slice(0, rng.int(0, 3));
    for (const f of commenters) {
      const a = byType(f, f.id, f.id);
      postComments.push({
        id: nextId("comment"),
        postId: p.id,
        text: rng.pick(COMMENTS),
        commenterUserId: actingUser(f),
        authorUserId: a.user, authorBandId: a.band, authorVenueId: a.venue,
        createdAt: after(rng.int(1, 72)),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Marketplace listings
  // -------------------------------------------------------------------------

  const image = (): ImageSpec => {
    const hueA = rng.int(0, 359);
    return { hueA, hueB: (hueA + rng.int(40, 160)) % 360, style: rng.int(0, 2) };
  };
  const ownerRef = ([kind, key]: ListingFixture["owner"]) => {
    const id = kind === "user" ? seedUserId(key) : kind === "band" ? seedBandId(key) : seedVenueId(key);
    const r = refById.get(id);
    if (!r) throw new Error(`Listing owner ${kind} "${key}" is unknown`);
    return r;
  };

  const listings: SeedListing[] = [];
  const listingMedia: SeedListingMedia[] = [];
  LISTINGS.forEach((l, i) => {
    const n = i + 1;
    const owner = ownerRef(l.owner);
    if (owner.city !== l.city) throw new Error(`Listing "${l.title}" is in another city than its owner`);
    const id = `${SEED_PREFIX}listing_${n}`;
    const fileName = `seed-listing-${n}.png`;
    const c = cityFixture(l.city);
    const o = byType(owner, owner.id, owner.id);
    const createdAt = ago(rng.int(1, 45) * DAY + rng.int(0, 23) * HOUR);

    listings.push({
      id, fileName, coverUrl: `/uploads/${fileName}`, image: image(),
      title: l.title, description: l.description, category: l.category,
      kind: l.kind, price: l.price, openToTrades: l.openToTrades ?? false, status: l.status ?? "ACTIVE",
      city: l.city,
      latitude: round5(c.lat + (rng.next() - 0.5) * 0.06),
      longitude: round5(c.lng + (rng.next() - 0.5) * 0.06),
      createdByUserId: o.user, createdByBandId: o.band, createdByVenueId: o.venue,
      createdAt,
    });

    // Extra gallery photos beyond the cover, uploaded by someone who can post as the owner.
    for (let m = 1, extra = rng.int(0, 2); m <= extra; m++) {
      const mediaFile = `seed-listing-${n}-${m}.png`;
      listingMedia.push({
        id: nextId("lmedia"), listingId: id, fileName: mediaFile, url: `/uploads/${mediaFile}`, image: image(),
        position: m - 1, uploaderUserId: actingUser(owner), createdAt,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  const conversations: SeedConversation[] = [];
  const participants: SeedParticipant[] = [];
  const messages: SeedMessage[] = [];

  const thread = (
    a: ProfileRef, b: ProfileRef, script: readonly ScriptLine[], vars: Record<string, string>,
    attachListingId: string | null = null,
  ) => {
    const conversationId = nextId("conv");
    // Starting 2-14 days back leaves room for every gap below (max ~1 day total).
    let t = nowMs - rng.int(2, 14) * DAY - rng.int(0, 12) * HOUR;
    const times: number[] = [];
    for (const line of script) {
      t += rng.int(5, 240) * MINUTE;
      times.push(t);
      const from = byType(line.from === "a" ? a : b, "", (line.from === "a" ? a : b).id);
      messages.push({
        id: nextId("msg"), conversationId, content: fill(line.text, vars),
        senderUserId: from.user, senderBandId: from.band, senderVenueId: from.venue,
        listingId: times.length === 1 ? attachListingId : null,
        createdAt: new Date(t),
      });
    }
    const first = times[0];
    const last = times[times.length - 1];
    const beforeLast = times[times.length - 2] ?? first;
    const lastFrom = script[script.length - 1].from;

    conversations.push({ id: conversationId, createdAt: new Date(first), updatedAt: new Date(last) });
    for (const [side, r] of [["a", a], ["b", b]] as const) {
      // Whoever sent the last message has read it; the other side sometimes hasn't.
      const read = side === lastFrom || rng.chance(0.5);
      const p = byType(r, r.id, r.id);
      participants.push({
        id: nextId("participant"), conversationId, participantType: r.type,
        userId: p.user, bandId: p.band, venueId: p.venue,
        joinedAt: new Date(first), lastReadAt: new Date(read ? last : beforeLast),
      });
    }
  };

  for (const city of CITIES) {
    const cb = rng.shuffle(inCity(bandRefs, city.key));
    const cv = rng.shuffle(inCity(venueRefs, city.key));
    const cityUsers = users.filter(u => u.city === city.key);
    const vars = (band: ProfileRef, venue: ProfileRef, friend: ProfileRef) => ({
      band: nameOf(band.id), venue: nameOf(venue.id), friend: nameOf(friend.id), city: city.name,
      date1: fmtDay(new Date(nowMs + rng.int(20, 45) * DAY)),
      date2: fmtDay(new Date(nowMs + rng.int(46, 70) * DAY)),
    });

    thread(cb[0], cv[0], BOOKING_SCRIPT, vars(cb[0], cv[0], cb[5]));
    thread(cb[1], cv[1], VENUE_OUTREACH_SCRIPT, vars(cb[1], cv[1], cb[5]));
    thread(ref(promoterOf(city.key).id), cb[2], PROMOTER_SCRIPT, vars(cb[2], cv[2], cb[3]));

    const photographer = cityUsers.find(u => u.role === "photographer")!;
    const musician = rng.pick(cityUsers.filter(u => u.role === "musician"));
    thread(ref(photographer.id), ref(musician.id), PHOTOGRAPHER_SCRIPT, vars(cb[3], cv[3], cb[4]));

    const fans = cityUsers.filter(u => u.role === "fan");
    thread(ref(fans[0].id), ref(fans[1].id), FAN_SCRIPT, vars(cb[4], cv[4], cb[5]));

    // A fan asking about the city's first listing, with the listing attached.
    const listing = listings.find(l => l.city === city.key)!;
    const seller = ref((listing.createdByUserId ?? listing.createdByBandId ?? listing.createdByVenueId)!);
    thread(ref(fans[2].id), seller, LISTING_SCRIPT, { listing: listing.title }, listing.id);
  }

  return {
    users, bands, venues, crafts, bandMembers, venueReps, bandGenres,
    follows, sceneFollows, shows, showBands, showInvites, engagements,
    posts, postLikes, postComments, listings, listingMedia, conversations, participants, messages,
  };
}

/** Row counts per table, for logging. */
export const planCounts = (plan: SeedPlan): Record<string, number> => ({
  ...Object.fromEntries(Object.entries(plan).map(([k, rows]) => [k, (rows as unknown[]).length])),
  rsvps: plan.engagements.reduce((n, e) => n + e.rsvpUserIds.length, 0),
  reposts: plan.engagements.reduce((n, e) => n + e.repostUserIds.length + e.repostBandIds.length + e.repostVenueIds.length, 0),
});
