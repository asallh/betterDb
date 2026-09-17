# Changelog

All notable changes to BetterDB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Scheduled **Nightly** GitHub Actions workflow from `dev` (06:00 UTC + manual dispatch). Skips when `dev` has no new commits since the last `v*-nightly*` tag; publishes an ephemeral `{base}-nightly.{YYYYMMDD}.{sha}` prerelease without committing to `dev`.
- Channel-aware UI pills: local Vite/Electron serve shows **Dev**; packaged nightlies show **Nightly**; alpha/beta/rc keep their labels; stable has no pill.
- Channel-specific app icons: local serve uses a blueprint/white cylinder icon; nightlies ship a night-sky/purple cylinder icon; production keeps the existing dark/coral art.
- Channel-aware force-update gate: nightly installs only consider newer nightlies; non-nightly installs ignore nightly releases.
- Launch-time hard update gate: builds behind the newest GitHub Release (including prereleases) show a blocking update screen and open the release page. Offline / API failures fail open so the app still runs.
- **Note:** Only builds that include this checker can be forced to update. Shipping the gate cannot remotely kill older installers that never call GitHub; after the first gated release, each newer release can refuse older gated builds.
- Local channel packaging commands: `npm run build:nightly` and `npm run build:prod` for side-by-side test installers.

### Changed

- Hardened the release pipeline so GitHub Releases publish only the three platform installers.
- Nightly packages install as **BetterDB Nightly** (`com.betterdb.app.nightly`) with a separate user-data directory so they can run beside production.
- macOS Nightly and Release CI now **Developer ID–sign and notarize** DMGs (fails closed if signing secrets are missing) so Chrome downloads no longer show Gatekeeper’s “damaged” dialog. Signing uses a temporary keychain import to work around electron-builder’s CSC_LINK bug on macOS 26 runners.

## [0.1.0-beta.1] - 2026-06-24

### Added

- Cross-platform Electron desktop client (macOS, Windows, Linux).
- Adapters for PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, SQLite, DuckDB, DB2, Snowflake, ClickHouse, BigQuery, MongoDB, and Redis.
- Query editor, schema explorer, virtualized results, and connection manager.

[Unreleased]: https://github.com/asallh/betterDb/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/asallh/betterDb/releases/tag/v0.1.0-beta.1
