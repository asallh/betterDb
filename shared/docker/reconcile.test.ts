import { describe, expect, it } from "vitest";
import type { ConnectionConfig } from "../types";
import { findOrphanedDockerConnectionIds } from "./reconcile";

function conn(
  partial: Partial<ConnectionConfig> & Pick<ConnectionConfig, "id" | "name">
): ConnectionConfig {
  return {
    engine: "postgres",
    host: "localhost",
    port: 5432,
    database: "db",
    user: "u",
    password: "p",
    ...partial,
  };
}

describe("findOrphanedDockerConnectionIds", () => {
  it("returns docker-managed connections whose containers are missing", () => {
    const connections = [
      conn({
        id: "a",
        name: "Gone",
        docker: { managed: true, containerName: "betterdb-gone" },
      }),
      conn({
        id: "b",
        name: "Still here",
        docker: { managed: true, containerName: "betterdb-alive" },
      }),
      conn({ id: "c", name: "Manual" }),
    ];
    expect(
      findOrphanedDockerConnectionIds(connections, ["betterdb-alive"])
    ).toEqual(["a"]);
  });

  it("ignores non-docker connections", () => {
    expect(
      findOrphanedDockerConnectionIds(
        [conn({ id: "m", name: "Manual", host: "db.example.com" })],
        []
      )
    ).toEqual([]);
  });
});
