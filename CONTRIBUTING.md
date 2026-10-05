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
| `dev`  | Preferred (not enforced) | `check` (on PRs) | — | Integration branch. Direct pushes allowed so the **Release PR** bot can bump `package.json` on version cut. Force-push / deletion still blocked. |
| `main` | Yes                   | `check`, `validate` | **1** | Release branch. Linear history; conversations must be resolved. Admins can bypass. |

Shared rules on both branches:

- Force pushes and branch deletion are disabled
- History must stay linear (squash merge on `main`)
- **Admins can bypass `main` protections** (so the maintainer can merge their own release PRs). Contributors targeting `main` still need PR + checks + approval.

> **Why `dev` allows pushes:** GitHub does not allow the Actions app as a ruleset bypass actor on personal repositories. The release workflow must push `chore(release): vX.Y.Z` to `dev`; requiring PRs on `dev` blocks that bump.

### Feature / fix workflow

1. Branch from `dev` (or fork, then branch from `dev`).
2. Open a PR **into `dev`** (preferred — keeps history reviewable).
3. Wait for CI (`check`) to pass.
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
