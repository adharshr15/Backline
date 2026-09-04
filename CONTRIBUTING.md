# Contributing to Backline

## The feature standard

**No feature merges without tests that cover it, and the full suite must pass.**

This is not a style preference. Every one of the authorization holes found in the
September 2026 security review existed because an endpoint shipped without a test
that asked "what happens when someone else calls this?". The suite is the mechanism
that stops that recurring.

### Definition of done

A change is ready to merge when all of the following hold:

1. **Tests exist for the new behaviour.** At minimum one test for the happy path and
   one for each way the operation is supposed to be refused.
2. **`npm run verify` passes** in `backend/` — this runs the TypeScript check and the
   whole test suite.
3. **No test was weakened to make it pass.** If an existing test now fails, either the
   change is wrong, or the test encoded a bug. If it encoded a bug, fix the test *and
   say so in the commit message*. (Example: `user.test.ts` asserted `500` for a
   permission failure; that was the bug, not the spec.)
4. **New endpoints are listed in the authorization checklist below**, and each item is
   either satisfied or explicitly not applicable.

### Running the suite

```bash
cd backend
cp .env.example .env          # first time only, then fill in real values
docker compose up -d          # starts Postgres
npm run test:db               # applies migrations to the test database
npm run verify                # typecheck + all tests
```

Faster loops while working:

```bash
npm run test:unit             # pure unit tests, no database, ~1s
npm run test:security         # authorization + disclosure regression suite
npm run test:watch            # re-runs on save
npm run test:coverage         # coverage report
```

### Where tests go

| Kind | Location | Needs a database | Use it for |
|---|---|---|---|
| Unit | `backend/tests/unit/*.unit.test.ts` | No | Pure functions, middleware, token and env handling |
| Feature | `backend/tests/<resource>.test.ts` | Yes | An endpoint's behaviour end to end |
| Security regression | `backend/tests/security.test.ts` | Yes | Anything someone must *not* be able to do |

Shared fixtures live in `backend/tests/helpers.ts` (`registerUser`, `createBand`,
`createVenue`, `resetDatabase`, `auth`). Use them rather than hand-rolling
registration payloads — when a required field is added to `POST /auth/register`, one
helper changes instead of thirty call sites.

Suites share one database and run serially (`fileParallelism: false` in
`vitest.config.ts`). Each suite must call `resetDatabase()` in `beforeAll`.

---

## The authorization checklist

Backline profiles are polymorphic: a request acts as a **USER**, a **BAND**, or a
**VENUE**. The auth token proves *which user* is calling — it proves nothing about
which band or venue they may speak for.

So any endpoint that accepts a profile id from the caller (`senderId`, `ownerId`,
`followerId`, `reposterBandId`, `creatorVenueId`, `likerId`, …) **must** verify that
the authenticated user may act as that profile:

```ts
import { canActAs } from "../lib/authorization";

if (!(await canActAs(userId, senderType, senderId))) {
  return res.status(403).json({ error: "You cannot act as this profile" });
}
```

Never re-implement this inline. Every place it was hand-rolled, a variant was
eventually missed.

For each new or changed endpoint, confirm:

- [ ] **Authentication** — is it behind `authenticate`? If deliberately public, is
      that written down, and does it return only public fields?
- [ ] **Acting-as** — every caller-supplied profile id passes through `canActAs`.
- [ ] **Ownership** — for edit/delete, does the caller own or manage the target?
      (`canManageShow`, `canManageTour`, `canManageListing`.)
- [ ] **Roster changes are manager-only** — adding, removing, or re-roling a band
      member or venue rep requires `MANAGER`, not merely membership.
- [ ] **The inverse operation is checked too.** This is the single most common bug in
      this codebase: `follow` checked membership and `unfollow` did not; `rsvp` checked
      and `unrsvp` did not; `repost` checked and `unrepost` did not. **If you add a
      "do X" endpoint, the "undo X" endpoint needs the same check.**
- [ ] **Enum/type inputs are validated** before they reach a query. An unvalidated
      `senderType` once left a filter as `{ conversationId }`, which updated every
      participant instead of one.
- [ ] **Pagination is bounded** — clamp `limit` to a maximum. An unbounded `limit`
      turns a list endpoint into a bulk export.
- [ ] **Response fields are chosen with `select`, not `include`.** `include` on a User
      returns the password hash and relies on someone remembering to delete it. Use
      `userPublicSelect` / `userPrivateSelect` from `lib/prismaSelects.ts`.

### Errors

Return `fail(res, error, "context")` from `middlewares/error.middleware.ts` rather than
`res.status(500).json({ error: error.message })`. Prisma error messages contain table
names, column names, and sometimes the connection string.

Use the right status code: `400` for malformed input, `401` for missing or bad
credentials, `403` for "authenticated but not allowed", `404` for missing, `409` for a
conflict. A permission failure is not a `500`.

### File uploads

`file.mimetype` is whatever the client typed in the multipart header — it is not
evidence. Uploads are gated on an **extension allowlist** in `config/multer.ts`, and
stored under a server-generated random name. Do not add an extension to that allowlist
without checking whether a browser will execute it (`.html`, `.svg`, `.xhtml` will).

### Secrets

No credentials in tracked files — not in `package.json` scripts, not in
`docker-compose.yml`, not in test fixtures. Everything reads from `.env`, and
`.env.example` documents the required keys. `backend/uploads/` is user data and is
gitignored; never `git add -f` it.

---

## Commits

Conventional commits, as before:

```
feat(messages): attach inline listing preview to messages
fix(shows): require membership before cancelling a band RSVP
test(security): cover profile impersonation on conversation create
```

When a commit changes an existing test's expectation, say why in the body.
