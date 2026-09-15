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
