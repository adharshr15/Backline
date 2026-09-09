import { describe, it, expect } from "vitest";
import {
  slugifySegment,
  sceneSlugBase,
  normalizeState,
  stateSpellings,
  boundingBox,
  haversineKm,
} from "../../src/lib/scenes";

describe("normalizeState", () => {
  it("uppercases a two-letter code", () => {
    expect(normalizeState("tx")).toBe("TX");
    expect(normalizeState("Tx")).toBe("TX");
  });

  it("maps a full state name to its code", () => {
    expect(normalizeState("Texas")).toBe("TX");
    expect(normalizeState("texas")).toBe("TX");
    expect(normalizeState("New York")).toBe("NY");
    expect(normalizeState("north carolina")).toBe("NC");
    expect(normalizeState("District of Columbia")).toBe("DC");
  });

  it("passes through unrecognized regions untouched", () => {
    expect(normalizeState("Ontario")).toBe("Ontario");
    expect(normalizeState("Jalisco")).toBe("Jalisco");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeState("")).toBe("");
    expect(normalizeState(null)).toBe("");
    expect(normalizeState(undefined)).toBe("");
  });
});

describe("stateSpellings", () => {
  it("covers both the code and the full name so legacy rows still match", () => {
    const spellings = stateSpellings("TX").map(s => s.toLowerCase());
    expect(spellings).toContain("tx");
    expect(spellings).toContain("texas");
  });

  it("is the same set whichever spelling it is given", () => {
    const fromCode = new Set(stateSpellings("TX").map(s => s.toLowerCase()));
    const fromName = new Set(stateSpellings("Texas").map(s => s.toLowerCase()));
    expect([...fromName]).toEqual(expect.arrayContaining([...fromCode]));
  });
});

describe("slugifySegment", () => {
  it("lowercases and dashes multi-word names", () => {
    expect(slugifySegment("Saint Paul")).toBe("saint-paul");
    expect(slugifySegment("New York")).toBe("new-york");
  });

  it("strips accents", () => {
    expect(slugifySegment("Ciudad Juárez")).toBe("ciudad-juarez");
    expect(slugifySegment("Montréal")).toBe("montreal");
  });

  it("strips punctuation without leaving stray dashes", () => {
    expect(slugifySegment("O'Fallon")).toBe("o-fallon");
    expect(slugifySegment("Winston-Salem")).toBe("winston-salem");
    expect(slugifySegment("  Austin!  ")).toBe("austin");
  });

  it("returns an empty string for empty or punctuation-only input", () => {
    expect(slugifySegment("")).toBe("");
    expect(slugifySegment("   ")).toBe("");
    expect(slugifySegment("!!!")).toBe("");
  });
});

describe("sceneSlugBase", () => {
  it("joins city and state", () => {
    expect(sceneSlugBase("Houston", "TX")).toBe("houston-tx");
    expect(sceneSlugBase("San Antonio", "TX")).toBe("san-antonio-tx");
  });

  it("falls back to country when state is blank", () => {
    expect(sceneSlugBase("Paris", "", "France")).toBe("paris-france");
    expect(sceneSlugBase("Paris", null, "France")).toBe("paris-france");
  });

  it("returns the bare city when neither state nor country is usable", () => {
    expect(sceneSlugBase("Paris", "", "")).toBe("paris");
    expect(sceneSlugBase("Paris")).toBe("paris");
  });

  it("collides deliberately across casings so one city cannot become two scenes", () => {
    expect(sceneSlugBase("Houston", "TX")).toBe(sceneSlugBase("houston", "tx"));
    expect(sceneSlugBase("HOUSTON", "Tx")).toBe(sceneSlugBase("Houston", "TX"));
  });

  it("collapses a spelled-out state onto its code", () => {
    // "College Station, Texas" and "College Station, TX" are one city; without
    // this they became two scenes and split the city's bands and venues.
    expect(sceneSlugBase("College Station", "Texas")).toBe("college-station-tx");
    expect(sceneSlugBase("College Station", "Texas")).toBe(
      sceneSlugBase("College Station", "TX"),
    );
  });
});

describe("boundingBox", () => {
  it("spans the expected latitude delta", () => {
    // 50 km / 111.32 km-per-degree ~= 0.449 degrees.
    const box = boundingBox(29.76, -95.36, 50);
    expect(box.maxLat - 29.76).toBeCloseTo(0.449, 3);
    expect(29.76 - box.minLat).toBeCloseTo(0.449, 3);
  });

  it("widens the longitude delta as latitude increases", () => {
    const houston = boundingBox(29.76, -95.36, 50);
    const anchorage = boundingBox(61.2, -149.9, 50);

    const houstonWidth = houston.maxLng - houston.minLng;
    const anchorageWidth = anchorage.maxLng - anchorage.minLng;
    expect(anchorageWidth).toBeGreaterThan(houstonWidth);
  });

  it("guards the poles instead of dividing by ~0", () => {
    const box = boundingBox(89.9, 0, 50);
    expect(Number.isFinite(box.minLng)).toBe(true);
    expect(Number.isFinite(box.maxLng)).toBe(true);
    // cos(89.9deg) ~= 0.0017, clamped to 0.01, so the span stays bounded.
    expect(box.maxLng - box.minLng).toBeLessThan(100);
  });

  it("is symmetric around the origin point", () => {
    const box = boundingBox(0, 0, 10);
    expect(box.minLat).toBeCloseTo(-box.maxLat, 10);
    expect(box.minLng).toBeCloseTo(-box.maxLng, 10);
  });
});

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(29.76, -95.36, 29.76, -95.36)).toBeCloseTo(0, 6);
  });

  it("measures Houston to Austin at roughly 235 km", () => {
    const d = haversineKm(29.7604, -95.3698, 30.2672, -97.7431);
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(250);
  });

  it("is symmetric", () => {
    const ab = haversineKm(29.76, -95.36, 30.26, -97.74);
    const ba = haversineKm(30.26, -97.74, 29.76, -95.36);
    expect(ab).toBeCloseTo(ba, 9);
  });

  it("agrees with the bounding box it is paired with", () => {
    // A point on the box edge should be about the requested radius away.
    const box = boundingBox(29.76, -95.36, 50);
    const d = haversineKm(29.76, -95.36, box.maxLat, -95.36);
    expect(d).toBeCloseTo(50, 0);
  });
});
