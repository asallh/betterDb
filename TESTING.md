# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

- **Runner:** Vitest 2.x (Vite 5–compatible)
- **Environment:** jsdom
- **UI helpers:** `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

## Commands

```bash
npm test          # single run (CI)
npm run test:watch
```

## Layers

| Layer | Where | When |
|-------|-------|------|
| Unit | `src/**/*.test.ts` | Pure helpers, engines, stores logic |
| Component | `src/**/*.test.tsx` | Connection form, schema labels, empty/error UI |
| Integration | later | IPC mocks + multi-module flows |
| E2E | later (Playwright Electron) | Critical journeys in the real app window |

## Conventions

- Colocate tests next to source: `foo.ts` → `foo.test.ts`
- Assert behavior, not implementation details
- Mock `window.electron` / IPC in renderer tests; never import real credentials
- When fixing a bug, add a regression test
- When adding a conditional, cover both branches

## OTA hard gate (manual QA)

Version check compares `app.getVersion()` to the newest non-draft GitHub Release for `asallh/betterDb` (prereleases included). Fail-open on network/timeout errors.

Checklist:

- [ ] Packaged build whose version is **behind** the latest GitHub tag shows the force-update screen (no sidebar / DB UI)
- [ ] **Open download** / **View release notes** opens the release URL in the browser
- [ ] Packaged build whose version **matches** (or is ahead of) latest opens the normal app
- [ ] With network blocked / GitHub unreachable, the app still opens (fail-open) and the status bar can show “Update check failed”
- [ ] Confirm DB IPC is unavailable while the force-update screen is showing (connections cannot load)

Release note reminder: only builds that ship this checker can be forced; pre-gate installers are unaffected until users manually upgrade once.
