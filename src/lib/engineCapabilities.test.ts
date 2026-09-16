import { describe, expect, it } from "vitest";
import { getEngineCapabilities } from "./engineCapabilities";

describe("getEngineCapabilities", () => {
  it("defaults to postgres capabilities when engine is undefined", () => {
    const caps = getEngineCapabilities(undefined);
    expect(caps.kind).toBe("sql");
    expect(caps.queryLanguage).toBe("sql");
    expect(caps.supportsInlineEdit).toBe(true);
    expect(caps.schemaLabel).toBe("Schema");
    expect(caps.tablesLabel).toBe("Tables");
  });

  it("disables drop-schema for file databases", () => {
    for (const engine of ["sqlite", "duckdb"] as const) {
      const caps = getEngineCapabilities(engine);
      expect(caps.supportsDropSchema).toBe(false);
      expect(caps.supportsDropSchemaCascade).toBe(false);
    }
  });

  it("marks warehouse engines as read-heavy with warehouse labels", () => {
    const snowflake = getEngineCapabilities("snowflake");
    expect(snowflake.supportsInlineEdit).toBe(false);
    expect(snowflake.supportsTruncate).toBe(false);
    expect(snowflake.supportsIndexes).toBe(false);
    expect(snowflake.schemaLabel).toBe("Schema");

    const bigquery = getEngineCapabilities("bigquery");
    expect(bigquery.supportsInlineEdit).toBe(false);
    expect(bigquery.schemaLabel).toBe("Dataset");
    expect(bigquery.supportsTableSize).toBe(false);
  });

  it("uses collection vocabulary for MongoDB", () => {
    const caps = getEngineCapabilities("mongodb");
    expect(caps.kind).toBe("document");
    expect(caps.tableLabel).toBe("Collection");
    expect(caps.tablesLabel).toBe("Collections");
    expect(caps.schemaLabel).toBe("Database");
    expect(caps.editorPlaceholder).toContain("MongoDB");
  });

  it("uses key-type vocabulary for Redis", () => {
    const caps = getEngineCapabilities("redis");
    expect(caps.kind).toBe("keyvalue");
    expect(caps.tableLabel).toBe("Key type");
    expect(caps.tablesLabel).toBe("Key types");
    expect(caps.supportsDropSchema).toBe(false);
    expect(caps.supportsIndexes).toBe(false);
    expect(caps.editorPlaceholder).toContain("Redis");
  });
});
