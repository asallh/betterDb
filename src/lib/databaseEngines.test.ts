import { describe, expect, it } from "vitest";
import {
  DATABASE_ENGINE_ORDER,
  DATABASE_ENGINES,
  engineFromScheme,
  getDefaultPort,
  getEngineKind,
  getQueryLanguage,
  isDatabaseEngine,
  requiresHost,
} from "./databaseEngines";

describe("databaseEngines", () => {
  it("lists every engine metadata entry exactly once in order", () => {
    expect(DATABASE_ENGINE_ORDER).toHaveLength(Object.keys(DATABASE_ENGINES).length);
    expect(new Set(DATABASE_ENGINE_ORDER).size).toBe(DATABASE_ENGINE_ORDER.length);
    for (const engine of DATABASE_ENGINE_ORDER) {
      expect(DATABASE_ENGINES[engine]).toBeDefined();
    }
  });

  it("identifies known engines and rejects unknown values", () => {
    expect(isDatabaseEngine("postgres")).toBe(true);
    expect(isDatabaseEngine("redis")).toBe(true);
    expect(isDatabaseEngine("not-a-real-engine")).toBe(false);
  });

  it("returns engine defaults used by the connection form", () => {
    expect(getDefaultPort("postgres")).toBe(5432);
    expect(getDefaultPort("redis")).toBe(6379);
    expect(getDefaultPort("sqlserver")).toBe(1433);
    expect(requiresHost("sqlite")).toBe(false);
    expect(requiresHost("mongodb")).toBe(true);
  });

  it("maps URI schemes to engines", () => {
    expect(engineFromScheme("postgresql")).toBe("postgres");
    expect(engineFromScheme("redis")).toBe("redis");
    expect(engineFromScheme("mongodb")).toBe("mongodb");
    expect(engineFromScheme("unknown")).toBeNull();
  });

  it("exposes kind and query language for mixed backends", () => {
    expect(getEngineKind("postgres")).toBe("sql");
    expect(getQueryLanguage("postgres")).toBe("sql");
    expect(getEngineKind("mongodb")).toBe("document");
    expect(getQueryLanguage("mongodb")).toBe("mongodb");
    expect(getEngineKind("redis")).toBe("keyvalue");
    expect(getQueryLanguage("redis")).toBe("redis");
  });
});
