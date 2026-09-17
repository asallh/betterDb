<p align="center">
  <img src="build/betterDB.png" alt="BetterDB" width="128" />
</p>

<h1 align="center">BetterDB</h1>

<p align="center">
  A modern, cross-platform database client built with Electron, React, and TypeScript.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/shadcn/ui-%23000000.svg?style=for-the-badge&logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="LICENSE" />
</p>

---

## About

BetterDB is a lightweight desktop application for managing SQL warehouses, document stores, and key-value databases. It provides an intuitive interface for browsing schemas, writing queries, and editing data — without the bloat of traditional database GUIs.

## Supported engines

| Engine | Kind | Notes |
| ------ | ---- | ----- |
| PostgreSQL | SQL | Also Supabase, AWS/RDS Postgres, Databricks, CockroachDB |
| MySQL / MariaDB | SQL | |
| SQL Server | SQL | |
| Oracle | SQL | Requires Oracle Instant Client locally |
| SQLite | SQL | File-based |
| DuckDB | SQL | File-based |
| IBM DB2 | SQL | Requires IBM Data Server Driver locally |
| Snowflake | SQL | Account / warehouse / role |
| ClickHouse | SQL | |
| BigQuery | SQL | Project ID + ADC or service-account key path |
| MongoDB | Document | Collections map to tables |
| Redis | Key-value | DB indexes + key-type browser |

## Features

- **Connection Manager** — Save and organize connections with encryption/SSL support where applicable.
- **Schema Explorer** — Browse databases, schemas, tables, collections, and key spaces in a collapsible tree sidebar.
- **Query Editor** — Write and execute SQL, MongoDB commands, or Redis commands with a CodeMirror-powered editor.
- **Query Results** — View results in a fast, virtualized table with column type awareness and execution time metrics.
- **Inline Data Editing** — Edit cell values, insert rows, and delete records where the engine supports it.
- **Paginated Table Viewer** — Navigate large tables with server-side pagination and sortable columns.
- **Foreign Key Introspection** — View column-level foreign key references across SQL schemas.
- **Query history & saved queries** — Re-run recent queries and keep favorites.
- **Export** — Export result sets to CSV or JSON.

## Architecture

```
electron/
  ├── db/
  │   ├── DatabaseAdapter.ts      # Abstract adapter (SQL / document / key-value)
  │   ├── *Adapter.ts             # Engine implementations
  │   └── ConnectionManager.ts    # Singleton connection factory
  ├── ipc/
  │   └── handlers.ts             # IPC bridge between main & renderer
  └── storage/
      └── connections.ts           # Encrypted connection persistence
src/
  ├── components/
  │   ├── connections/             # Connection form & panel
  │   ├── query/                   # Query editor & results
  │   ├── schema/                  # Schema tree browser
  │   └── table/                   # Virtualized table viewer
  ├── stores/                      # Zustand state management
  └── lib/
      ├── databaseEngines.ts       # Engine registry & defaults
      ├── engineCapabilities.ts    # Per-engine UI capabilities
      └── ipc.ts                   # Typed IPC wrapper for renderer
shared/
  └── types.ts                     # Shared types across processes
```

## Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Framework | Electron 30                        |
| Frontend  | React 18, TypeScript               |
| Bundler   | Vite 5 with `vite-plugin-electron` |
| Styling   | Tailwind CSS, shadcn/ui            |
| State     | Zustand                            |
| Editor    | CodeMirror 6                       |
| Tables    | @tanstack/react-virtual            |
| Database  | `pg`, `mssql`, `mysql2`, `oracledb`, `better-sqlite3`, `duckdb`, `ibm_db`, `snowflake-sdk`, `@clickhouse/client`, `@google-cloud/bigquery`, `mongodb`, `ioredis` |

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Development

```bash
npm install
npm run dev
```

This launches the Electron app in development mode with hot module replacement.

### Production Build

```bash
npm run build
```

Generates a distributable package in the `release/` directory for your platform.

### Local channel test releases

Build a proper channel-branded installer on your machine (identity, icons, and version). Mutated files are restored afterward so your working tree stays clean:

```bash
npm run build:nightly   # BetterDB Nightly — night-sky icon, com.betterdb.app.nightly
npm run build:prod      # BetterDB — production icon + identity
```

Artifacts land in `release/<version>/`. Pass a platform flag through if needed:

```bash
npm run build:nightly -- --mac
npm run build:prod -- --dir   # unpacked app only (faster smoke test)
```

### Lint

```bash
npm run lint
```

## Releasing

Releases follow [semver](https://semver.org/) via labels on a `dev` → `main` pull request.

1. Land feature work on `dev` through normal PRs.
2. Open a PR from `dev` into `main`.
3. Add **exactly one** bump label:
   - `release:patch` — bug fixes
   - `release:minor` — new features (backward compatible)
   - `release:major` — breaking changes
4. Optionally add one stage label: `release:alpha`, `release:beta`, or `release:rc`. Omit for a stable release.
5. The **Release PR** workflow bumps `package.json` on `dev` and posts a checklist comment.
6. Update [CHANGELOG.md](CHANGELOG.md) with user-facing notes, wait for CI green, then merge.
7. The **Release** workflow builds macOS / Windows / Linux installers and publishes them to [GitHub Releases](https://github.com/asallh/betterDb/releases).

Use `release:skip` only when the `dev` → `main` PR must not cut a version (rare).

### macOS code signing (required for CI)

Mac Nightly and Release jobs **fail closed** unless these GitHub Actions secrets are set. Without them, downloaded DMGs hit Gatekeeper’s “damaged and can’t be opened” dialog.

| Secret | Value |
| --- | --- |
| `CSC_LINK` | Base64-encoded Developer ID Application `.p12` |
| `CSC_KEY_PASSWORD` | Password for that `.p12` |
| `APPLE_API_KEY` | App Store Connect API `.p8` (raw PEM **or** base64) |
| `APPLE_API_KEY_ID` | 10-character key id |
| `APPLE_API_ISSUER` | Issuer UUID |
| `APPLE_TEAM_ID` | 10-character Apple Team ID |

Setup outline:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. Create a **Developer ID Application** certificate in Xcode / developer.apple.com, export it as `.p12`, then:
   `base64 -i YourCert.p12 | tr -d '\n' | pbcopy` → paste into `CSC_LINK` (must be the `.p12`, not the `.cer`).
   Put the exact export password in `CSC_KEY_PASSWORD`.
3. In [App Store Connect → Users and Access → Integrations → Team Keys](https://appstoreconnect.apple.com/access/integrations/api), create a Team API key with App Manager access. Download `AuthKey_<KEYID>.p8` once; store Key ID, Issuer ID, and the `.p8` contents (or `base64 -i AuthKey_….p8`) as the secrets above.

Local `npm run build:nightly` / `npm run build:prod` stay **unsigned** on purpose. If Gatekeeper blocks a copied local `.app`:

```bash
xattr -cr "/Applications/BetterDB-Nightly.app"   # or BetterDB.app for prod
```

### Nightly builds

The **Nightly** workflow (`.github/workflows/nightly.yml`) runs daily at 06:00 UTC (and on manual `workflow_dispatch`) from `dev`:

1. Skips successfully when `dev` HEAD matches the commit of the latest `v*-nightly*` tag.
2. Otherwise sets an ephemeral version `{base}-nightly.{YYYYMMDD}.{shortsha}` (does not push to `dev`).
3. Builds macOS / Windows / Linux installers and publishes a GitHub prerelease (Mac is Developer ID–signed and notarized).

Force-update checks keep channels separate: stable/alpha/beta/rc installs never consider nightlies; nightly installs only update to newer nightlies.

Local `npm` / Vite serve shows a **Dev** pill and uses the blueprint app icon; packaged nightlies install as **BetterDB Nightly** (separate app id / data dir from production), show the **Nightly** pill, and ship the night-sky icon; stable releases show no stage pill and keep the production icon.

## Roadmap

- [x] MySQL / MariaDB / SQLite / Oracle adapters
- [x] Query history and saved queries
- [x] Export results to CSV / JSON
- [x] Multiple query tabs
- [x] Warehouse + NoSQL coverage (DuckDB, DB2, Snowflake, ClickHouse, BigQuery, MongoDB, Redis)
- [ ] Table structure editor (DDL)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and how to add a new database adapter.

## License

MIT © [asallh](https://github.com/asallh). See [LICENSE](LICENSE) for the full text.
