import type { DatabaseEngine } from "../../shared/types";
import { DATABASE_ENGINES, getEngineKind, getQueryLanguage } from "./databaseEngines";

export interface EngineCapabilities {
  kind: ReturnType<typeof getEngineKind>;
  queryLanguage: ReturnType<typeof getQueryLanguage>;
  supportsInlineEdit: boolean;
  supportsDropSchema: boolean;
  supportsDropSchemaCascade: boolean;
  supportsIndexes: boolean;
  supportsTableSize: boolean;
  supportsTruncate: boolean;
  /** Schema tree labels */
  schemaLabel: string;
  tableLabel: string;
  tablesLabel: string;
  editorPlaceholder: string;
}

const READ_HEAVY: Partial<EngineCapabilities> = {
  supportsInlineEdit: false,
  supportsDropSchema: false,
  supportsDropSchemaCascade: false,
  supportsTruncate: false,
};

export function getEngineCapabilities(engine: DatabaseEngine | undefined): EngineCapabilities {
  const resolved: DatabaseEngine = engine ?? "postgres";
  const meta = DATABASE_ENGINES[resolved];
  const kind = meta.kind;
  const queryLanguage = meta.queryLanguage;

  const base: EngineCapabilities = {
    kind,
    queryLanguage,
    supportsInlineEdit: true,
    supportsDropSchema: true,
    supportsDropSchemaCascade: true,
    supportsIndexes: true,
    supportsTableSize: true,
    supportsTruncate: true,
    schemaLabel: "Schema",
    tableLabel: "Table",
    tablesLabel: "Tables",
    editorPlaceholder: "Write your SQL query here... (Cmd+Enter to run)",
  };

  switch (resolved) {
    case "sqlite":
    case "duckdb":
      return {
        ...base,
        supportsDropSchema: false,
        supportsDropSchemaCascade: false,
      };
    case "mysql":
    case "mariadb":
    case "sqlserver":
      return {
        ...base,
        supportsDropSchemaCascade: false,
        schemaLabel: resolved === "sqlserver" ? "Schema" : "Database",
      };
    case "snowflake":
    case "bigquery":
      return {
        ...base,
        ...READ_HEAVY,
        supportsIndexes: false,
        supportsTableSize: resolved === "snowflake",
        schemaLabel: resolved === "bigquery" ? "Dataset" : "Schema",
        editorPlaceholder:
          "Write a SQL query... Inline edits are limited for this warehouse. (Cmd+Enter)",
      };
    case "clickhouse":
      return {
        ...base,
        supportsInlineEdit: false,
        supportsDropSchemaCascade: false,
        supportsIndexes: false,
      };
    case "db2":
      return {
        ...base,
        supportsDropSchemaCascade: false,
      };
    case "mongodb":
      return {
        ...base,
        supportsDropSchemaCascade: false,
        supportsIndexes: true,
        supportsTableSize: false,
        schemaLabel: "Database",
        tableLabel: "Collection",
        tablesLabel: "Collections",
        editorPlaceholder:
          'MongoDB command, e.g. {"find":"users","filter":{},"limit":100} (Cmd+Enter)',
      };
    case "redis":
      return {
        ...base,
        supportsDropSchema: false,
        supportsDropSchemaCascade: false,
        supportsIndexes: false,
        supportsTableSize: false,
        supportsTruncate: true,
        schemaLabel: "Database",
        tableLabel: "Key type",
        tablesLabel: "Key types",
        editorPlaceholder: "Redis command, e.g. GET mykey or HGETALL user:1 (Cmd+Enter)",
      };
    default:
      return base;
  }
}
