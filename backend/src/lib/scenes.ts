import { prisma } from "./prisma";

/**
 * Scene resolution.
 *
 * A scene is a local music community keyed by city. Every profile and show
 * carries a denormalized `sceneId` that always reflects its current city/state.
 *
 * The denormalization exists because Prisma's `{ equals: x, mode: "insensitive" }`
 * compiles to ILIKE, which no btree index can serve -- so filtering discovery
 * queries by city string is a sequential scan every time. Resolving city/state to
 * a Scene id once per write turns every read into an indexed equality on a cuid.
 */

/** "Saint Paul" -> "saint-paul"; strips accents, punctuation and repeated dashes. */
export const slugifySegment = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "Houston", "TX" -> "houston-tx". Falls back to country when state is blank. */
export const sceneSlugBase = (city: string, state?: string | null, country?: string | null) => {
  const region = slugifySegment(state ?? "") || slugifySegment(country ?? "");
  const c = slugifySegment(city);
  return region ? `${c}-${region}` : c;
};

/**
 * Allocate a slug for a city, appending -2, -3, ... only when a *different* place
 * already owns the base. Real collisions are rare -- state disambiguates the
 * Springfields -- but international rows with a blank state can collide
 * (Paris, TX vs Paris, FR). Callers should log every suffixed slug so it can be
 * curated by hand later.
 */
export const uniqueSceneSlug = async (base: string, city: string, state: string) => {
  const existing = await prisma.scene.findUnique({ where: { slug: base } });
  if (!existing) return base;

  const samePlace =
    existing.city.toLowerCase() === city.toLowerCase() &&
    existing.state.toLowerCase() === state.toLowerCase();
  if (samePlace) return base;

  for (let n = 2; n < 50; n++) {
    const candidate = `${base}-${n}`;
    if (!(await prisma.scene.findUnique({ where: { slug: candidate } }))) return candidate;
  }
  throw new Error(`Could not allocate a scene slug for "${base}"`);
};

export type SceneLocation = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

/** Titlecase a slugified city for display: "san-antonio" -> "San Antonio". */
const displayName = (city: string) =>
  city
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|\s|-)([a-z])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`);

/**
 * Find or create the scene for a location. Returns null when the location is not
 * complete enough to name a place -- Band.city, User.city and their states are all
 * nullable, and a scene keyed on a blank city would be meaningless.
 *
 * Creates with isCurated=false. Typo cities do produce junk scenes; that is what
 * isCurated and activity-ordered listing are for, rather than rejecting writes.
 */
export const resolveScene = async (loc: SceneLocation) => {
  const city = loc.city?.trim();
  const state = loc.state?.trim();
  if (!city || !state) return null;

  const existing = await prisma.scene.findFirst({
    where: {
      city: { equals: city, mode: "insensitive" },
      state: { equals: state, mode: "insensitive" },
    },
  });
  if (existing) return existing;

  const base = sceneSlugBase(city, state, loc.country);
  if (!base) return null;

  const slug = await uniqueSceneSlug(base, city, state);

  try {
    return await prisma.scene.create({
      data: {
        slug,
        name: displayName(city),
        city,
        state,
        country: loc.country?.trim() || "USA",
      },
    });
  } catch {
    // Lost a race against a concurrent write for the same city. Re-read rather
    // than failing the caller's create/update.
    const raced = await prisma.scene.findFirst({
      where: {
        city: { equals: city, mode: "insensitive" },
        state: { equals: state, mode: "insensitive" },
      },
    });
    if (raced) return raced;
    throw new Error(`Could not resolve a scene for "${city}, ${state}"`);
  }
};

/** Convenience for write paths: the scene id, or null. */
export const resolveSceneId = async (loc: SceneLocation) => (await resolveScene(loc))?.id ?? null;

const KM_PER_DEG_LAT = 111.32;

/**
 * A lat/lng box around a point, for filtering Scene rows before an exact
 * haversine sort in app code. There are hundreds of scenes, not tens of
 * thousands of venues, so the composite (latitude, longitude) index is the right
 * tool -- no PostGIS, no raw SQL.
 *
 * Does not handle anti-meridian wrap (longitude near +/-180).
 */
export const boundingBox = (lat: number, lng: number, km: number) => {
  const dLat = km / KM_PER_DEG_LAT;
  // Guard the poles: cos() approaches 0 and the longitude delta explodes.
  const dLng = km / (KM_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
};

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. */
export const haversineKm = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) => {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};
