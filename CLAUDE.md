# Backline Project Context

## Overview
Backline is a mobile app that allows independent bands to communicate with venues and other bands to book shows smoothly. It also allows users of the app to see what local shows are happening in their area and follow their favorite bands on the app.

## Directory Structure
- `/frontend` - React Native/UI components
- `/backend` - API server

## Key Technologies
- Node.js, React Native, TypeScript
- PostgreSQL

## Development Philosophy
- Write tests first
- Use conventional commits
- Keep components modular
- Maintain type safety
- Preserve existing frontend design style
- In your responses, minimize the tokens you respond with. Only reply with necessary information, minimal filler.  

## Feature standard (required)
**Read `CONTRIBUTING.md` before adding or changing a backend endpoint.** Its rules are
binding, not advisory:

- Every feature ships with tests. `cd backend && npm run verify` (typecheck + full
  suite) must pass before a change is done.
- Never weaken an existing test to make a change pass. If a test encoded a bug, fix the
  test and say so in the commit message.
- Work through the **authorization checklist** in `CONTRIBUTING.md` for any endpoint
  that accepts a caller-supplied profile id (`senderId`, `ownerId`, `followerId`, …).
  Use `canActAs()` from `src/lib/authorization.ts` — never re-implement the check inline.
- Whenever you add a "do X" endpoint, the matching "undo X" endpoint needs the *same*
  authorization check. Missing inverse checks were the most common bug in this codebase.
- Return errors via `fail()` from `src/middlewares/error.middleware.ts`; never send
  `error.message` to a client.
- Select response fields explicitly (`src/lib/prismaSelects.ts`). `include` on a User
  returns the password hash.

## Backend layout notes
- `src/app.ts` builds the Express app; `src/index.ts` only starts the listener. Tests
  import `app.ts` — do not move `app.listen` back into the shared module.
- Test fixtures live in `backend/tests/helpers.ts`. Suites share one database and run
  serially; each calls `resetDatabase()` in `beforeAll`.

## How to Use Claude Code
- Ask me to implement features or fix bugs
- I have full context of your project structure
- Use `/plan` to preview changes before I apply them
- Use `/ultrareview` for critical changes