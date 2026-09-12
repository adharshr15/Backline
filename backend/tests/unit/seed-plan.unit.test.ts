import { describe, it, expect } from "vitest";
import { buildSeedPlan, SEED_PREFIX, type SeedPlan } from "../../scripts/seed/plan";
import { CITIES } from "../../scripts/seed/fixtures";
import { postImage, PNG_SIGNATURE } from "../../scripts/seed/png";

const NOW = new Date("2026-09-11T17:00:00Z");
const plan = buildSeedPlan(NOW);

const cityOf = new Map<string, string>([
  ...plan.users.map(u => [u.id, u.city] as const),
  ...plan.bands.map(b => [b.id, b.city] as const),
  ...plan.venues.map(v => [v.id, v.city] as const),
]);

const membersOf = (bandId: string) => plan.bandMembers.filter(m => m.bandId === bandId).map(m => m.userId);
const repsOf = (venueId: string) => plan.venueReps.filter(r => r.venueId === venueId).map(r => r.userId);

/** Mirrors canActAs(): may this user act as the given profile? */
const canActAs = (userId: string, profile: { user: string | null; band: string | null; venue: string | null }) =>
  profile.user ? profile.user === userId
  : profile.band ? membersOf(profile.band).includes(userId)
  : profile.venue ? repsOf(profile.venue).includes(userId)
  : false;

const REQUESTED = {
  austin: { bands: ["Fawn", "Mayfly", "Ritual", "Stab", "Grocery Bag"], venues: ["Pearl St. Co-op", "Chess Club", "Coral Snake", "Radio/East"] },
  houston: { bands: ["Cement Diver", "Divine Divine", "Daze", "Glia", "Tincture"], venues: ["Notsuoh", "Bad Astronaut", "The End", "White Swan", "1810 Ojeman"] },
  dallas: { bands: ["Spurred", "Cloverfield", "Trauma Ray", "Empty Shell Casing"], venues: ["Witch House", "Rubber Gloves", "Andy's"] },
  "college-station": { bands: ["Heel", "Minge", "Memory Ends", "Bloodprice", "Moonage"], venues: ["The 101", "CAMP House", "The Grand Stafford", "Aggie Park"] },
} as const;

describe("buildSeedPlan: identity", () => {
  it("is deterministic for the same clock and seed", () => {
    expect(buildSeedPlan(NOW)).toEqual(plan);
  });

  it("varies with the seed", () => {
    expect(buildSeedPlan(NOW, 1).follows).not.toEqual(plan.follows);
  });

  it("prefixes every row id and never repeats one", () => {
    const ids = (Object.values(plan) as { id?: string; showId?: string }[][])
      .flat()
      .map(r => r.id)
      .filter((id): id is string => id !== undefined);
    expect(ids.length).toBeGreaterThan(1000);
    expect(ids.every(id => id.startsWith(SEED_PREFIX))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildSeedPlan: profiles", () => {
  it("has 15 users, 10 bands and 10 venues in each of the four cities", () => {
    expect(plan.users).toHaveLength(60);
    expect(plan.bands).toHaveLength(40);
    expect(plan.venues).toHaveLength(40);
    for (const c of CITIES) {
      expect(plan.users.filter(u => u.city === c.key)).toHaveLength(15);
      expect(plan.bands.filter(b => b.city === c.key)).toHaveLength(10);
      expect(plan.venues.filter(v => v.city === c.key)).toHaveLength(10);
    }
  });

  it("includes every requested band and venue in the right city", () => {
    for (const [key, want] of Object.entries(REQUESTED)) {
      const bands = plan.bands.filter(b => b.city === key).map(b => b.name);
      const venues = plan.venues.filter(v => v.city === key).map(v => v.name);
      expect(bands).toEqual(expect.arrayContaining([...want.bands]));
      expect(venues).toEqual(expect.arrayContaining([...want.venues]));
    }
  });

  it("gives every band and venue exactly one manager from its own city", () => {
    for (const b of plan.bands) {
      const members = plan.bandMembers.filter(m => m.bandId === b.id);
      expect(members.filter(m => m.role === "MANAGER")).toHaveLength(1);
      expect(members.every(m => cityOf.get(m.userId) === b.city)).toBe(true);
    }
    for (const v of plan.venues) {
      const reps = plan.venueReps.filter(r => r.venueId === v.id);
      expect(reps.filter(r => r.role === "MANAGER")).toHaveLength(1);
      expect(reps.every(r => cityOf.get(r.userId) === v.city)).toBe(true);
    }
  });

  it("leaves pure fans without crafts, bands or venues", () => {
    const fans = plan.users.filter(u => u.role === "fan");
    expect(fans.length).toBeGreaterThanOrEqual(12);
    for (const f of fans) {
      expect(plan.crafts.some(c => c.userId === f.id)).toBe(false);
      expect(plan.bandMembers.some(m => m.userId === f.id)).toBe(false);
      expect(plan.venueReps.some(r => r.userId === f.id)).toBe(false);
    }
  });

  it("has photographers and promoters in every city", () => {
    for (const c of CITIES) {
      const local = new Set(plan.users.filter(u => u.city === c.key).map(u => u.id));
      const craftsHere = plan.crafts.filter(cr => local.has(cr.userId)).map(cr => cr.craft);
      expect(craftsHere.filter(cr => cr === "PHOTOGRAPHER").length).toBeGreaterThanOrEqual(2);
      expect(craftsHere).toContain("PROMOTER");
    }
  });
});

describe("buildSeedPlan: social graph", () => {
  const endpoints = (f: SeedPlan["follows"][number]) => ({
    from: (f.followerUserId ?? f.followerBandId ?? f.followerVenueId)!,
    to: (f.followeeUserId ?? f.followeeBandId ?? f.followeeVenueId)!,
  });

  it("has no self-follows or duplicate follows", () => {
    const keys = plan.follows.map(f => {
      const { from, to } = endpoints(f);
      expect(from).not.toBe(to);
      return `${from}>${to}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sets exactly one follower and one followee column matching the declared types", () => {
    for (const f of plan.follows) {
      expect([f.followerUserId, f.followerBandId, f.followerVenueId].filter(Boolean)).toHaveLength(1);
      expect([f.followeeUserId, f.followeeBandId, f.followeeVenueId].filter(Boolean)).toHaveLength(1);
      expect(f.followerType === "USER" ? f.followerUserId : f.followerType === "BAND" ? f.followerBandId : f.followerVenueId).toBeTruthy();
      expect(f.followeeType === "USER" ? f.followeeUserId : f.followeeType === "BAND" ? f.followeeBandId : f.followeeVenueId).toBeTruthy();
    }
  });

  it("is mostly local, with some out-of-town follows", () => {
    const local = plan.follows.filter(f => {
      const { from, to } = endpoints(f);
      return cityOf.get(from) === cityOf.get(to);
    }).length;
    expect(local / plan.follows.length).toBeGreaterThanOrEqual(0.75);
    expect(local).toBeLessThan(plan.follows.length);
  });

  it("gives every band and venue at least one follower", () => {
    const followed = new Set(plan.follows.map(f => endpoints(f).to));
    for (const b of plan.bands) expect(followed.has(b.id)).toBe(true);
    for (const v of plan.venues) expect(followed.has(v.id)).toBe(true);
  });

  it("stores scene follows with lowercase types and every profile following its own scene", () => {
    expect(plan.sceneFollows.every(s => ["user", "band", "venue"].includes(s.followerType))).toBe(true);
    for (const [id, city] of cityOf) {
      expect(plan.sceneFollows.some(s => s.followerId === id && s.city === city)).toBe(true);
    }
  });
});

describe("buildSeedPlan: shows", () => {
  it("only schedules upcoming shows, doors before start, within ~3 months", () => {
    expect(plan.shows.length).toBe(36);
    for (const s of plan.shows) {
      expect(s.doors.getTime()).toBeGreaterThan(NOW.getTime());
      expect(s.doors.getTime()).toBeLessThan(s.date.getTime());
      expect(s.date.getTime() - NOW.getTime()).toBeLessThan(95 * 86_400_000);
    }
  });

  it("puts doors at 7-8pm Central across the DST change", () => {
    for (const s of plan.shows) {
      const hour = Number(s.doors.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }));
      expect([19, 20]).toContain(hour);
    }
  });

  it("holds each show in its venue's city, or at a DIY address", () => {
    for (const s of plan.shows) {
      if (s.venueId) expect(cityOf.get(s.venueId)).toBe(s.city);
      else expect(s.venueName && s.venueAddress).toBeTruthy();
    }
  });

  it("has one creator, one headliner, and only known bands on each lineup", () => {
    for (const s of plan.shows) {
      expect([s.createdByUserId, s.createdByBandId, s.createdByVenueId].filter(Boolean)).toHaveLength(1);
      const lineup = plan.showBands.filter(sb => sb.showId === s.id);
      expect(lineup.filter(sb => sb.role === "HEADLINER")).toHaveLength(1);
      expect(lineup.every(sb => cityOf.has(sb.bandId))).toBe(true);
    }
  });

  it("mixes statuses and leaves pending shows with a pending invite", () => {
    const statuses = plan.shows.map(s => s.status);
    expect(statuses).toContain("PENDING");
    expect(statuses).toContain("CANCELLED");
    for (const s of plan.shows.filter(sh => sh.status === "PENDING")) {
      expect(plan.showInvites.some(i => i.showId === s.id && i.status === "PENDING")).toBe(true);
    }
  });

  it("only lets same-city users RSVP, and never to a cancelled show", () => {
    const cancelled = new Set(plan.shows.filter(s => s.status === "CANCELLED").map(s => s.id));
    const showCity = new Map(plan.shows.map(s => [s.id, s.city]));
    for (const e of plan.engagements) {
      if (cancelled.has(e.showId)) expect(e.rsvpUserIds).toHaveLength(0);
      for (const u of e.rsvpUserIds) expect(cityOf.get(u)).toBe(showCity.get(e.showId));
    }
    expect(plan.engagements.reduce((n, e) => n + e.rsvpUserIds.length, 0)).toBeGreaterThan(50);
  });
});

describe("buildSeedPlan: posts and messages", () => {
  it("serves post images from seed-* uploads, uploaded by someone allowed to post as the owner", () => {
    for (const p of plan.posts) {
      expect(p.url).toBe(`/uploads/${p.fileName}`);
      expect(p.fileName).toMatch(/^seed-post-\d+\.png$/);
      expect(canActAs(p.uploaderUserId, { user: p.ownerUserId, band: p.ownerBandId, venue: p.ownerVenueId })).toBe(true);
    }
  });

  it("stores likes with uppercase liker types and no duplicates", () => {
    expect(plan.postLikes.every(l => ["USER", "BAND", "VENUE"].includes(l.likerType))).toBe(true);
    const keys = plan.postLikes.map(l => `${l.postId}|${l.likerType}|${l.likerId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("attributes comments to a user allowed to act as the author", () => {
    expect(plan.postComments.length).toBeGreaterThan(0);
    for (const c of plan.postComments) {
      expect(canActAs(c.commenterUserId, { user: c.authorUserId, band: c.authorBandId, venue: c.authorVenueId })).toBe(true);
    }
  });

  it("only has conversation participants send messages, in the past", () => {
    for (const m of plan.messages) {
      const parts = plan.participants.filter(p => p.conversationId === m.conversationId);
      const sender = (m.senderUserId ?? m.senderBandId ?? m.senderVenueId)!;
      expect(parts.some(p => (p.userId ?? p.bandId ?? p.venueId) === sender)).toBe(true);
      expect(m.createdAt.getTime()).toBeLessThan(NOW.getTime());
    }
    expect(plan.conversations).toHaveLength(24);
  });
});

describe("buildSeedPlan: listings", () => {
  const ownerOf = (l: SeedPlan["listings"][number]) => ({ user: l.createdByUserId, band: l.createdByBandId, venue: l.createdByVenueId });
  const ownerId = (l: SeedPlan["listings"][number]) => (l.createdByUserId ?? l.createdByBandId ?? l.createdByVenueId)!;

  it("has 10 listings per city, each with exactly one owner from that city", () => {
    expect(plan.listings).toHaveLength(40);
    for (const c of CITIES) expect(plan.listings.filter(l => l.city === c.key)).toHaveLength(10);
    for (const l of plan.listings) {
      expect([l.createdByUserId, l.createdByBandId, l.createdByVenueId].filter(Boolean)).toHaveLength(1);
      expect(cityOf.get(ownerId(l))).toBe(l.city);
    }
  });

  it("mixes rentals and sales from users, bands and venues", () => {
    expect(new Set(plan.listings.map(l => l.kind))).toEqual(new Set(["RENT", "SALE"]));
    expect(plan.listings.some(l => l.createdByUserId)).toBe(true);
    expect(plan.listings.some(l => l.createdByBandId)).toBe(true);
    expect(plan.listings.some(l => l.createdByVenueId)).toBe(true);
    expect(plan.listings.some(l => l.openToTrades)).toBe(true);
    expect(plan.listings.some(l => l.status === "CLAIMED")).toBe(true);
    expect(plan.listings.some(l => l.price === null)).toBe(true);
  });

  it("serves covers and gallery photos from seed uploads, added by someone who can act as the owner", () => {
    const byId = new Map(plan.listings.map(l => [l.id, l]));
    for (const l of plan.listings) {
      expect(l.fileName).toMatch(/^seed-listing-\d+\.png$/);
      expect(l.coverUrl).toBe(`/uploads/${l.fileName}`);
    }
    expect(plan.listingMedia.length).toBeGreaterThan(0);
    for (const m of plan.listingMedia) {
      const listing = byId.get(m.listingId)!;
      expect(listing).toBeDefined();
      expect(m.url).toBe(`/uploads/${m.fileName}`);
      expect(canActAs(m.uploaderUserId, ownerOf(listing))).toBe(true);
    }
  });

  it("attaches a listing to the opening message of one buyer thread per city", () => {
    const attached = plan.messages.filter(m => m.listingId);
    expect(attached).toHaveLength(4);
    for (const m of attached) {
      const listing = plan.listings.find(l => l.id === m.listingId)!;
      const parts = plan.participants.filter(p => p.conversationId === m.conversationId).map(p => (p.userId ?? p.bandId ?? p.venueId)!);
      expect(parts).toContain(ownerId(listing));
      expect(m.senderUserId).not.toBe(ownerId(listing));
      expect(plan.messages.filter(x => x.conversationId === m.conversationId)[0].id).toBe(m.id);
    }
  });
});

describe("postImage", () => {
  it("encodes a PNG with the requested dimensions", () => {
    const png = postImage({ hueA: 10, hueB: 200, style: 1 }, 16);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(png.readUInt32BE(16)).toBe(16); // IHDR width
    expect(png.readUInt32BE(20)).toBe(16); // IHDR height
  });
});
