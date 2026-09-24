import type { ConnectionConfig, DatabaseEngine } from "../../shared/types";
import {
  DATABASE_ENGINES,
  engineFromScheme,
  getDefaultDatabase,
  getDefaultPort,
  getDefaultUser,
  supportsSsl,
} from "./databaseEngines";

/** Parsed URI fields plus the original scheme when present (e.g. mongodb+srv). */
export type ParsedConnectionString = Partial<ConnectionConfig> & {
  uriScheme?: string;
};

/**
 * Primary URI scheme for an engine. Prefers an explicit pasted scheme when it
 * is valid for the engine; otherwise prefers postgresql over postgres, and
 * rediss when Redis SSL is enabled.
 */
export function getPrimaryUriScheme(
  engine: DatabaseEngine,
  options?: { ssl?: boolean; preferredScheme?: string }
): string {
  const schemes = DATABASE_ENGINES[engine].uriSchemes;
  const preferred = options?.preferredScheme?.toLowerCase();
  if (preferred && schemes.includes(preferred)) {
    return preferred;
  }
  if (engine === "redis" && options?.ssl && schemes.includes("rediss")) {
    return "rediss";
  }
  if (schemes.includes("postgresql")) return "postgresql";
  return schemes[0];
}

/** Placeholder / help-text example URI for the connection form. */
export function getExampleConnectionUri(engine: DatabaseEngine): string {
  switch (engine) {
    case "databricks":
      return "postgresql://you@company.com@ep-….database.us-east-1.cloud.databricks.com/databricks_postgres?sslmode=require";
    case "sqlite":
      return "sqlite:///path/to/db.sqlite";
    case "duckdb":
      return "duckdb:///path/to/db.duckdb";
    case "redis":
      return "redis://:pass@localhost:6379/0";
    case "mongodb":
      return "mongodb://user:pass@localhost:27017/mydb";
    case "mysql":
      return "mysql://user:pass@localhost:3306/mydb";
    case "mariadb":
      return "mariadb://user:pass@localhost:3306/mydb";
    case "sqlserver":
      return "sqlserver://sa:pass@localhost:1433/mydb";
    case "cockroach":
      return "postgresql://root@localhost:26257/defaultdb";
    case "oracle":
      return "oracle://system:pass@localhost:1521/FREEPDB1";
    case "db2":
      return "db2://db2inst1:pass@localhost:50000/SAMPLE";
    case "snowflake":
      return "snowflake://user@account/db";
    case "clickhouse":
      return "clickhouse://default@localhost:8123/default";
    case "bigquery":
      return "bigquery://project-id";
    case "supabase":
    case "aws":
    case "postgres":
    default:
      return "postgresql://user:pass@localhost:5432/mydb";
  }
}

/**
 * Lakebase Autoscaling hosts look like:
 *   ep-<id>.database.<region>.cloud.databricks.com
 * Legacy / provisioned hosts look like:
 *   instance-<uuid>.database.cloud.databricks.com
 * Docs also show short forms:
 *   ep-abc-123.databricks.com
 */
export function isLakebaseHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("databricks.com") ||
    h.endsWith(".databricks.com") ||
    (h.includes("databricks") && h.includes("database"))
  );
}

export function isCloudHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    isLakebaseHost(h) ||
    h.includes("supabase") ||
    h.includes("rds.amazonaws.com") ||
    h.includes("redshift.amazonaws.com") ||
    h.includes("neon.tech") ||
    h.includes("aivencloud.com") ||
    h.includes("planetscale") ||
    h.includes("oraclecloud")
  );
}

export function detectEngineFromHost(host: string): DatabaseEngine {
  const h = host.toLowerCase();
  if (h.includes("database.windows.net")) return "sqlserver";
  if (h.includes("oraclecloud")) return "oracle";
  if (h.includes("mariadb")) return "mariadb";
  if (h.includes("mysql") || h.includes("planetscale")) return "mysql";
  if (h.includes("supabase")) return "supabase";
  if (
    h.includes("rds.amazonaws.com") ||
    h.includes("redshift.amazonaws.com") ||
    h.includes("aws")
  ) {
    return "aws";
  }
  if (isLakebaseHost(h) || h.includes("databricks")) return "databricks";
  return "postgres";
}

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Strip an optional jdbc: prefix used by some Databricks copy buttons. */
function normalizeUriInput(raw: string): string {
  const trimmed = raw.trim();
  if (/^jdbc:/i.test(trimmed)) {
    return trimmed.replace(/^jdbc:/i, "");
  }
  return trimmed;
}

/**
 * Parse libpq keyword/value connection strings, e.g.
 *   host=ep-….database.us-east-1.cloud.databricks.com port=5432 user=role
 *   password=… dbname=databricks_postgres sslmode=require
 */
function parseLibpqConnectionString(input: string): ParsedConnectionString | null {
  const trimmed = input.trim();
  if (!trimmed || /:\/\//.test(trimmed) || !/=/.test(trimmed)) return null;

  // Match key=value pairs; values may be single-quoted.
  const pairs = trimmed.matchAll(
    /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:'([^']*)'|(\S+))/g
  );
  const params: Record<string, string> = {};
  for (const match of pairs) {
    params[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }

  const host = params.host ?? params.hostname;
  if (!host) return null;

  const engine = detectEngineFromHost(host);
  const portRaw = params.port;
  const database =
    params.dbname ?? params.database ?? getDefaultDatabase(engine);
  const user = params.user ?? params.username ?? getDefaultUser(engine);
  const password = params.password ?? "";
  const sslmode = (params.sslmode ?? "").toLowerCase();
  const ssl =
    sslmode === "require" ||
    sslmode === "verify-ca" ||
    sslmode === "verify-full" ||
    params.ssl === "true" ||
    params.ssl === "1";

  return {
    engine,
    host,
    port: portRaw ? parseInt(portRaw, 10) || getDefaultPort(engine) : getDefaultPort(engine),
    database,
    user,
    password,
    ssl: supportsSsl(engine) ? ssl || isCloudHost(host) : false,
  };
}

/**
 * Parse a database URI / connection string into discrete connection fields.
 * Handles Lakebase OAuth URIs where the role is an email (contains `@`):
 *   postgresql://you@company.com@ep-….databricks.com/databricks_postgres?sslmode=require
 */
export function parseConnectionString(
  raw: string
): ParsedConnectionString | null {
  const uri = normalizeUriInput(raw);
  if (!uri) return null;

  const libpq = parseLibpqConnectionString(uri);
  if (libpq) return libpq;

  try {
    const scheme = uri.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
    if (!scheme) return null;

    let engine = engineFromScheme(scheme);
    if (!engine) return null;

    if (engine === "sqlite" || engine === "duckdb") {
      const database =
        scheme === "file"
          ? decodeUriComponentSafe(new URL(uri).pathname)
          : decodeUriComponentSafe(
              uri.replace(new RegExp(`^${scheme}:\\/\\/`, "i"), "")
            );
      return {
        engine,
        uriScheme: scheme,
        host: "",
        port: 0,
        database,
        user: "",
        password: "",
        ssl: false,
      };
    }

    // Use http:// for parsing since database URL schemes are not all "special"
    // URL schemes and can otherwise parse credentials/host inconsistently.
    // Email usernames (Lakebase OAuth) produce username with %40 — decode below.
    const url = new URL(uri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "http://"));
    const host = url.hostname || "localhost";

    // Prefer host-based engine detection so postgresql://…@*.databricks.com
    // becomes the Databricks Lakebase engine rather than plain Postgres.
    if (["postgres", "supabase", "aws", "databricks"].includes(engine)) {
      engine = detectEngineFromHost(host);
    }

    const defaultPort = getDefaultPort(engine);
    const defaultUser = getDefaultUser(engine);
    const sslFromScheme = scheme === "rediss" || scheme === "mongodb+srv";

    return {
      engine,
      uriScheme: scheme,
      host,
      port: parseInt(url.port, 10) || defaultPort,
      database: decodeUriComponentSafe(url.pathname.replace(/^\//, "")) ||
        getDefaultDatabase(engine),
      user: decodeUriComponentSafe(url.username) || defaultUser,
      password: decodeUriComponentSafe(url.password || ""),
      ssl:
        sslFromScheme ||
        url.searchParams.get("sslmode") === "require" ||
        url.searchParams.get("sslmode") === "verify-ca" ||
        url.searchParams.get("sslmode") === "verify-full" ||
        url.searchParams.get("ssl") === "true" ||
        url.searchParams.get("encrypt") === "true" ||
        (supportsSsl(engine) && isCloudHost(host)),
      trustServerCertificate:
        url.searchParams.get("trustServerCertificate") === "true" ||
        url.searchParams.get("trustServerCertificate") === "1",
    };
  } catch {
    return null;
  }
}

/**
 * Remove sslmode from a URI or libpq string so callers can apply SSL via an
 * explicit driver option (avoids node-pg escalating require → verify-full).
 */
export function stripSslMode(connectionString: string): string {
  return connectionString
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?")
    .replace(/\bsslmode=\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildConnectionString(form: {
  host: string;
  port: string | number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  trustServerCertificate?: boolean;
  engine: DatabaseEngine;
  /** Preserve pasted scheme when valid (e.g. mongodb+srv, rediss, cockroach). */
  scheme?: string;
}): string {
  const scheme = getPrimaryUriScheme(form.engine, {
    ssl: form.ssl,
    preferredScheme: form.scheme,
  });

  if (form.engine === "sqlite" || form.engine === "duckdb") {
    return form.database ? `${scheme}://${form.database}` : "";
  }

  // Encode `@` in roles (email OAuth users) so the URI stays unambiguous.
  const user = form.user ? encodeURIComponent(form.user) : "";
  const pass = form.password ? `:${encodeURIComponent(form.password)}` : "";
  const auth =
    user || form.password ? `${user}${pass}@` : "";

  const params = new URLSearchParams();
  if (form.engine === "sqlserver") {
    if (form.ssl) params.set("encrypt", "true");
    if (form.trustServerCertificate) params.set("trustServerCertificate", "true");
  } else if (
    supportsSsl(form.engine) &&
    form.ssl &&
    form.engine !== "redis" &&
    form.engine !== "mongodb" &&
    scheme !== "rediss" &&
    scheme !== "mongodb+srv"
  ) {
    params.set("sslmode", "require");
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const port =
    scheme === "mongodb+srv" ? "" : `:${form.port}`;
  return `${scheme}://${auth}${form.host}${port}/${form.database}${query}`;
}
