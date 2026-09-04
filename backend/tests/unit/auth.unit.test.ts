import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { generateToken, verifyToken } from "../../src/lib/auth";
import { authenticate, AuthRequest } from "../../src/middlewares/auth.middleware";
import { requireEnv, jwtSecret } from "../../src/lib/env";

/**
 * Pure unit tests: no database, no HTTP server. These run in milliseconds and are
 * the first thing to check when auth behaviour changes.
 */

const mockRes = () => {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = vi.fn().mockImplementation((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn().mockImplementation((body: unknown) => { res.body = body; return res; });
  return res;
};

describe("token helpers", () => {
  it("round-trips a user id", () => {
    const token = generateToken("user-123");
    expect(verifyToken(token).userId).toBe("user-123");
  });

  it("does not put anything but the user id in the payload", () => {
    const payload = jwt.decode(generateToken("user-123")) as Record<string, unknown>;
    // The middleware used to read `role` off the token even though nothing signs it.
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "userId"]);
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ userId: "user-123" }, "another-secret");
    expect(() => verifyToken(forged)).toThrow();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ userId: "user-123" }, jwtSecret(), { expiresIn: "-1s" });
    expect(() => verifyToken(expired)).toThrow();
  });
});

describe("authenticate middleware", () => {
  let next: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => { next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>; });

  const run = (headers: Record<string, string>) => {
    const req = { headers } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, next);
    return { req, res };
  };

  it("passes a valid Bearer token through and attaches the user", () => {
    const { req } = run({ authorization: `Bearer ${generateToken("user-abc")}` });
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ userId: "user-abc" });
  });

  it("accepts a lowercase scheme", () => {
    run({ authorization: `bearer ${generateToken("user-abc")}` });
    expect(next).toHaveBeenCalledOnce();
  });

  it("401s when the header is absent", () => {
    const { res } = run({});
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the scheme is not Bearer", () => {
    const { res } = run({ authorization: `Basic ${generateToken("user-abc")}` });
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s on a bare token with no scheme", () => {
    const { res } = run({ authorization: generateToken("user-abc") });
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s on a token whose payload has no userId", () => {
    const { res } = run({ authorization: `Bearer ${jwt.sign({ sub: "x" }, jwtSecret())}` });
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s rather than throwing on a garbage token", () => {
    const { res } = run({ authorization: "Bearer not-a-jwt" });
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("environment validation", () => {
  it("passes when the required variables are present", () => {
    expect(() => requireEnv()).not.toThrow();
  });

  it("names the variable that is missing", () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => requireEnv()).toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = saved;
    }
  });

  it("refuses a short secret in production", () => {
    const savedSecret = process.env.JWT_SECRET;
    const savedEnv = process.env.NODE_ENV;
    process.env.JWT_SECRET = "tooshort";
    process.env.NODE_ENV = "production";
    try {
      expect(() => requireEnv()).toThrow(/at least 32/);
    } finally {
      process.env.JWT_SECRET = savedSecret;
      process.env.NODE_ENV = savedEnv;
    }
  });
});
