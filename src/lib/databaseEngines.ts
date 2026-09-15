import type { DatabaseEngine, EngineKind, QueryLanguage } from "../../shared/types";

interface EngineMetadata {
  label: string;
  kind: EngineKind;
  queryLanguage: QueryLanguage;
  defaultPort: number;
  defaultUser: string;
  defaultDatabase: string;
  uriSchemes: string[];
  requiresHost: boolean;
  requiresUser: boolean;
  supportsSsl: boolean;
  supportsSslRejectUnauthorized: boolean;
  supportsTrustServerCertificate: boolean;
  /** Extra optional connection fields shown in the form. */
  extraFields?: Array<
    "account" | "warehouse" | "role" | "projectId" | "filePath" | "authMethod"
  >;
}

export const DATABASE_ENGINES: Record<DatabaseEngine, EngineMetadata> = {
  postgres: {
    label: "PostgreSQL",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  supabase: {
    label: "Supabase",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  aws: {
    label: "AWS/RDS PostgreSQL",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  databricks: {
    label: "Databricks",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  cockroach: {
    label: "CockroachDB",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 26257,
    defaultUser: "root",
    defaultDatabase: "defaultdb",
    uriSchemes: ["postgresql", "postgres", "cockroach"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  sqlserver: {
    label: "SQL Server",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 1433,
    defaultUser: "sa",
    defaultDatabase: "",
    uriSchemes: ["sqlserver", "mssql"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: true,
  },
  oracle: {
    label: "Oracle",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 1521,
    defaultUser: "system",
    defaultDatabase: "FREEPDB1",
    uriSchemes: ["oracle"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
  },
  mysql: {
    label: "MySQL",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 3306,
    defaultUser: "root",
    defaultDatabase: "",
    uriSchemes: ["mysql"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  sqlite: {
    label: "SQLite",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 0,
    defaultUser: "",
    defaultDatabase: "",
    uriSchemes: ["sqlite", "file"],
    requiresHost: false,
    requiresUser: false,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
  },
  mariadb: {
    label: "MariaDB",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 3306,
    defaultUser: "root",
    defaultDatabase: "",
    uriSchemes: ["mariadb"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  duckdb: {
    label: "DuckDB",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 0,
    defaultUser: "",
    defaultDatabase: "",
    uriSchemes: ["duckdb"],
    requiresHost: false,
    requiresUser: false,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
  },
  db2: {
    label: "IBM DB2",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 50000,
    defaultUser: "db2inst1",
    defaultDatabase: "SAMPLE",
    uriSchemes: ["db2"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  snowflake: {
    label: "Snowflake",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 443,
    defaultUser: "",
    defaultDatabase: "",
    uriSchemes: ["snowflake"],
    requiresHost: false,
    requiresUser: true,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
    extraFields: ["account", "warehouse", "role"],
  },
  clickhouse: {
    label: "ClickHouse",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 8123,
    defaultUser: "default",
    defaultDatabase: "default",
    uriSchemes: ["clickhouse"],
    requiresHost: true,
    requiresUser: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  bigquery: {
    label: "BigQuery",
    kind: "sql",
    queryLanguage: "sql",
    defaultPort: 443,
    defaultUser: "",
    defaultDatabase: "",
    uriSchemes: ["bigquery"],
    requiresHost: false,
    requiresUser: false,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
    extraFields: ["projectId", "filePath", "authMethod"],
  },
  mongodb: {
    label: "MongoDB",
    kind: "document",
    queryLanguage: "mongodb",
    defaultPort: 27017,
    defaultUser: "",
    defaultDatabase: "test",
    uriSchemes: ["mongodb", "mongodb+srv"],
    requiresHost: true,
    requiresUser: false,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  redis: {
    label: "Redis",
    kind: "keyvalue",
    queryLanguage: "redis",
    defaultPort: 6379,
    defaultUser: "",
    defaultDatabase: "0",
    uriSchemes: ["redis", "rediss"],
    requiresHost: true,
    requiresUser: false,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
};

export const DATABASE_ENGINE_ORDER: DatabaseEngine[] = [
  "postgres",
  "supabase",
  "aws",
  "databricks",
  "cockroach",
  "sqlserver",
  "mysql",
  "mariadb",
  "oracle",
  "sqlite",
  "duckdb",
  "db2",
  "snowflake",
  "clickhouse",
  "bigquery",
  "mongodb",
  "redis",
];

export function isDatabaseEngine(value: string): value is DatabaseEngine {
  return value in DATABASE_ENGINES;
}

export function getDefaultPort(engine: DatabaseEngine): number {
  return DATABASE_ENGINES[engine].defaultPort;
}

export function getDefaultUser(engine: DatabaseEngine): string {
  return DATABASE_ENGINES[engine].defaultUser;
}

export function getDefaultDatabase(engine: DatabaseEngine): string {
  return DATABASE_ENGINES[engine].defaultDatabase;
}

export function requiresHost(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].requiresHost;
}

export function requiresUser(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].requiresUser;
}

export function supportsSsl(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].supportsSsl;
}

export function supportsSslRejectUnauthorized(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].supportsSslRejectUnauthorized;
}

export function supportsTrustServerCertificate(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].supportsTrustServerCertificate;
}

export function getEngineKind(engine: DatabaseEngine): EngineKind {
  return DATABASE_ENGINES[engine].kind;
}

export function getQueryLanguage(engine: DatabaseEngine): QueryLanguage {
  return DATABASE_ENGINES[engine].queryLanguage;
}

export function engineFromScheme(scheme: string): DatabaseEngine | null {
  const normalized = scheme.toLowerCase();
  const found = DATABASE_ENGINE_ORDER.find((engine) =>
    DATABASE_ENGINES[engine].uriSchemes.includes(normalized)
  );
  return found ?? null;
}
