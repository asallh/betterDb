import type { ConnectionConfig, DatabaseEngine } from "../../shared/types";
import {
  engineFromScheme,
  getDefaultDatabase,
  getDefaultPort,
  getDefaultUser,
  supportsSsl,
} from "./databaseEngines";

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
function parseLibpqConnectionString(input: string): Partial<ConnectionConfig> | null {
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
): Partial<ConnectionConfig> | null {
  const uri = normalizeUriInput(raw);
  if (!uri) return null;

  const libpq = parseLibpqConnectionString(uri);
  if (libpq) return libpq;

  try {
    const scheme = uri.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
    if (!scheme) return null;

    let engine = engineFromScheme(scheme);
    if (!engine) return null;

    if (engine === "sqlite") {
      const database =
        scheme === "file"
          ? decodeUriComponentSafe(new URL(uri).pathname)
          : decodeUriComponentSafe(uri.replace(/^sqlite:\/\//i, ""));
      return {
        engine,
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

    return {
      engine,
      host,
      port: parseInt(url.port, 10) || defaultPort,
      database: decodeUriComponentSafe(url.pathname.replace(/^\//, "")) ||
        getDefaultDatabase(engine),
      user: decodeUriComponentSafe(url.username) || defaultUser,
      password: decodeUriComponentSafe(url.password || ""),
      ssl:
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
}): string {
  if (form.engine === "sqlite") {
    return form.database ? `sqlite://${form.database}` : "";
  }
  const pass = form.password ? `:${encodeURIComponent(form.password)}` : "";
  // Encode `@` in roles (email OAuth users) so the URI stays unambiguous.
  const user = form.user ? encodeURIComponent(form.user) : "";
  const scheme =
    form.engine === "sqlserver"
      ? "sqlserver"
      : form.engine === "mysql" ||
          form.engine === "mariadb" ||
          form.engine === "oracle"
        ? form.engine
        : "postgresql";
  const params = new URLSearchParams();
  if (form.engine === "sqlserver") {
    if (form.ssl) params.set("encrypt", "true");
    if (form.trustServerCertificate) params.set("trustServerCertificate", "true");
  } else if (supportsSsl(form.engine) && form.ssl) {
    params.set("sslmode", "require");
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return `${scheme}://${user}${pass}@${form.host}:${form.port}/${form.database}${query}`;
}
