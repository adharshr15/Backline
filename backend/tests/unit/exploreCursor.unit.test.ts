import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "../../src/lib/exploreCursor";
import { MAX_RANKED } from "../../src/lib/postRanking";

const NOW = new Date("2026-09-11T12:00:00Z");
const raw = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");

describe("explore cursor", () => {
  it("round-trips", () => {
    const asOf = new Date("2026-09-11T11:59:00Z");
    const cursor = encodeCursor({ asOf, offset: 27 });

    expect(decodeCursor(cursor, NOW)).toEqual({ asOf, offset: 27 });
  });

  it("is URL-safe", () => {
    const cursor = encodeCursor({ asOf: NOW, offset: 9 });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["a non-string", 42],
    ["an empty string", ""],
    ["garbage", "not-a-cursor!!"],
    ["non-JSON base64", Buffer.from("hello").toString("base64url")],
    ["a JSON array", raw([1, 2])],
    ["a missing offset", raw({ a: NOW.toISOString() })],
    ["a missing asOf", raw({ o: 9 })],
    ["an unparseable date", raw({ a: "yesterday", o: 9 })],
    ["a negative offset", raw({ a: NOW.toISOString(), o: -9 })],
    ["a fractional offset", raw({ a: NOW.toISOString(), o: 4.5 })],
    ["an offset past the ranked cap", raw({ a: NOW.toISOString(), o: MAX_RANKED + 1 })],
    ["an asOf in the future", raw({ a: new Date(NOW.getTime() + 3_600_000).toISOString(), o: 9 })],
    ["an oversized string", "a".repeat(500)],
  ])("rejects %s", (_label, value) => {
    expect(decodeCursor(value, NOW)).toBeNull();
  });
});
