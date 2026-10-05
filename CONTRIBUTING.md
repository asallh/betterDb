# Contributing to BetterDB

Thanks for contributing. Bug reports, feature ideas, and pull requests are welcome.

## How to contribute

1. **Issues** — If something is broken or unclear, [open an issue](https://github.com/asallh/betterDb/issues). Include steps to reproduce, OS, and BetterDB version when you can.
2. **Pull requests** — Prefer a focused PR with a short summary of user-facing impact. Use the PR template checklist when applicable.
3. **Questions / ideas** — Issues are fine for discussion too.

## Development setup

```bash
npm install
npm run dev
```

- **Node.js** >= 18, **npm** >= 9
- Lint: `npm run lint`
- Tests: `npm test`

See the [README](README.md) for build and release details.

## Branch & PR requirements

Work lands on **`dev`**. **`main`** is release-only.

| Branch | Pull request required | Required checks | Approvals | Notes |
| ------ | --------------------- | --------------- | --------- | ----- |
| `dev`  | Yes                   | `check`         | **1**     | Integration branch. Direct pushes are blocked (including for admins). |
| `main` | Yes                   | `check`, `validate` | **1** | Release branch. Linear history; conversations must be resolved. |

Shared rules on both branches:

- Force pushes and branch deletion are disabled
- Branch protection is enforced for administrators
- History must stay linear (squash merge)

### Feature / fix workflow

1. Branch from `dev` (or fork, then branch from `dev`).
2. Open a PR **into `dev`**.
3. Wait for CI (`check`) to pass and get **one approving review**.
4. Maintainers merge when ready.

Do **not** open feature PRs directly into `main`.

### Release workflow (`dev` → `main`)

Releases are cut only via a `dev` → `main` PR with the release labels described in the [README](README.md#releasing). That PR also needs:

- Green `check` and `validate`
- **One approving review** (required on `main`)
- Updated `CHANGELOG.md` for user-facing changes

## Adding a database adapter

1. Implement an adapter under `electron/db/` that follows the existing `DatabaseAdapter` contract.
2. Register the engine in `src/lib/databaseEngines.ts` and capability flags in `src/lib/engineCapabilities.ts`.
3. Add / extend shared types in `shared/types.ts` as needed.
4. Cover new behavior with tests next to the source (`*.test.ts` / `*.test.tsx`).
5. Document the engine in the README supported-engines table.

## Code style

- Match existing TypeScript / React patterns in the repo.
- Prefer small, focused changes over large drive-by refactors.
- Do not commit secrets, connection credentials, or local DB files.

## License

By contributing, you agree that your contributions are licensed under the MIT License (see [LICENSE](LICENSE)).
