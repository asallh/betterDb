# Changelog

All notable changes to BetterDB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Soft in-app OTA via `electron-updater`: packaged builds download updates in the background and show an **Update available** status-bar control (restart to install). Fail-open on errors; never hard-blocks the app.
- Scheduled **Nightly** GitHub Actions workflow from `dev` (06:00 UTC + manual dispatch). Skips when `dev` has no new commits since the last `v*-nightly*` tag; publishes an ephemeral `{base}-nightly.{YYYYMMDD}.{sha}` prerelease without committing to `dev`.
- Channel-aware UI pills: local Vite/Electron serve shows **Dev**; packaged nightlies show **Nightly**; alpha/beta/rc keep their labels; stable has no pill.
- Channel-specific app icons: local serve uses a blueprint/white cylinder icon; nightlies ship a night-sky/purple cylinder icon; production keeps the existing dark/coral art.
- Channel-aware update feeds: nightly installs only consider newer nightlies; non-nightly installs ignore nightly releases.
- Local channel packaging commands: `npm run build:nightly` and `npm run build:prod` for side-by-side test installers.
- **Databricks Lakebase Autoscaling** connection-string support: paste a Lakebase URI (including OAuth email roles), JDBC URI, or libpq `host=…` string to connect; regional Autoscaling hostnames are auto-detected as the Databricks Lakebase engine with SSL and `databricks_postgres` defaults.

### Changed

- Replaced the launch-time hard update gate (blocking “Update required” screen + withheld DB IPC) with soft status-bar OTA.
- Release uploads now include electron-updater metadata (`latest*.yml`, blockmaps) and a Mac zip alongside the three public installers (dmg / exe / AppImage).
- Nightly uploads now include the same OTA set on the `nightly` channel (`nightly*.yml`, blockmaps, Mac zip) so packaged nightlies can silent-update instead of failing the launch update check.
- Reworked release CI for reliability: shared composite actions for Mac signing/verify, installer staging, and sequential `gh` asset uploads with retries; **Release** now runs on push to `main` from a merged `dev` → `main` PR (with `workflow_dispatch` recovery); Nightly drops softprops parallel uploads; incomplete releases can be repaired; Mac builds require `stapler validate` after notarization.
- Nightly packages install as **BetterDB Nightly** (`com.betterdb.app.nightly`) with a separate user-data directory so they can run beside production.
- macOS Nightly and Release CI **Developer ID–sign and notarize** DMGs (fails closed if signing secrets are missing) so Chrome downloads no longer show Gatekeeper’s “damaged” dialog. Signing uses a temporary keychain import to work around electron-builder’s CSC_LINK bug on macOS 26 runners.

## [0.1.0-beta.1] - 2026-06-24

### Added

- Cross-platform Electron desktop client (macOS, Windows, Linux).
- Adapters for PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, SQLite, DuckDB, DB2, Snowflake, ClickHouse, BigQuery, MongoDB, and Redis.
- Query editor, schema explorer, virtualized results, and connection manager.

[Unreleased]: https://github.com/asallh/betterDb/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/asallh/betterDb/releases/tag/v0.1.0-beta.1
