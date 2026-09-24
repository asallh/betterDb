import { describe, expect, it } from "vitest";
import type { ConnectionConfig } from "../../../shared/types";
import { buildDuplicatedConnection } from "./duplicateConnection";

const source: ConnectionConfig = {
  id: "conn-1",
  name: "Prod DB",
  engine: "postgres",
  host: "localhost",
  port: 5432,
  database: "app",
  user: "postgres",
  password: "secret",
  ssl: true,
};

describe("buildDuplicatedConnection", () => {
  it("copies fields with a new id and (copy) name", () => {
    const dup = buildDuplicatedConnection(source, "conn-2");
    expect(dup).toEqual({
      ...source,
      id: "conn-2",
      name: "Prod DB (copy)",
    });
  });

  it("preserves password and engine settings", () => {
    const dup = buildDuplicatedConnection(source, "conn-3");
    expect(dup.password).toBe("secret");
    expect(dup.ssl).toBe(true);
    expect(dup.engine).toBe("postgres");
  });

  it("generates an id when none is provided", () => {
    const dup = buildDuplicatedConnection(source);
    expect(dup.id).toBeTruthy();
    expect(dup.id).not.toBe(source.id);
    expect(dup.name).toBe("Prod DB (copy)");
  });

  it("strips docker metadata so copies do not share a managed container", () => {
    const managed: ConnectionConfig = {
      ...source,
      docker: {
        managed: true,
        containerName: "betterdb-prod-db",
        volumeName: "betterdb-prod-db-data",
      },
    };
    const dup = buildDuplicatedConnection(managed, "conn-4");
    expect(dup.docker).toBeUndefined();
    expect(dup.id).toBe("conn-4");
    expect(dup.name).toBe("Prod DB (copy)");
  });
});
