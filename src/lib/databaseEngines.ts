import type { DatabaseEngine } from "../../shared/types";

interface EngineMetadata {
  label: string;
  defaultPort: number;
  defaultUser: string;
  defaultDatabase: string;
  uriSchemes: string[];
  requiresHost: boolean;
  supportsSsl: boolean;
  supportsSslRejectUnauthorized: boolean;
  supportsTrustServerCertificate: boolean;
}

export const DATABASE_ENGINES: Record<DatabaseEngine, EngineMetadata> = {
  postgres: {
    label: "PostgreSQL",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  supabase: {
    label: "Supabase",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  aws: {
    label: "AWS/RDS PostgreSQL",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  databricks: {
    label: "Databricks",
    defaultPort: 5432,
    defaultUser: "postgres",
    defaultDatabase: "postgres",
    uriSchemes: ["postgres", "postgresql"],
    requiresHost: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  sqlserver: {
    label: "SQL Server",
    defaultPort: 1433,
    defaultUser: "sa",
    defaultDatabase: "",
    uriSchemes: ["sqlserver", "mssql"],
    requiresHost: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: true,
  },
  oracle: {
    label: "Oracle",
    defaultPort: 1521,
    defaultUser: "system",
    defaultDatabase: "FREEPDB1",
    uriSchemes: ["oracle"],
    requiresHost: true,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
  },
  mysql: {
    label: "MySQL",
    defaultPort: 3306,
    defaultUser: "root",
    defaultDatabase: "",
    uriSchemes: ["mysql"],
    requiresHost: true,
    supportsSsl: true,
    supportsSslRejectUnauthorized: true,
    supportsTrustServerCertificate: false,
  },
  sqlite: {
    label: "SQLite",
    defaultPort: 0,
    defaultUser: "",
    defaultDatabase: "",
    uriSchemes: ["sqlite", "file"],
    requiresHost: false,
    supportsSsl: false,
    supportsSslRejectUnauthorized: false,
    supportsTrustServerCertificate: false,
  },
  mariadb: {
    label: "MariaDB",
    defaultPort: 3306,
    defaultUser: "root",
    defaultDatabase: "",
    uriSchemes: ["mariadb"],
    requiresHost: true,
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
  "sqlserver",
  "mysql",
  "mariadb",
  "oracle",
  "sqlite",
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

export function supportsSsl(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].supportsSsl;
}

export function supportsSslRejectUnauthorized(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].supportsSslRejectUnauthorized;
}

export function supportsTrustServerCertificate(engine: DatabaseEngine): boolean {
  return DATABASE_ENGINES[engine].supportsTrustServerCertificate;
}

export function engineFromScheme(scheme: string): DatabaseEngine | null {
  const normalized = scheme.toLowerCase();
  const found = DATABASE_ENGINE_ORDER.find((engine) =>
    DATABASE_ENGINES[engine].uriSchemes.includes(normalized)
  );
  return found ?? null;
}
