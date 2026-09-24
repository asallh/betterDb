import { describe, expect, it } from "vitest";
import { buildDockerConnectionConfig } from "./buildConnection";

describe("buildDockerConnectionConfig", () => {
  it("wires localhost + managed docker metadata for create → save", () => {
    const config = buildDockerConnectionConfig({
      connectionId: "uuid-1",
      name: "My App",
      engine: "postgres",
      port: 5433,
      user: "postgres",
      password: "betterdb",
      database: "postgres",
    });

    expect(config).toEqual({
      id: "uuid-1",
      name: "My App",
      engine: "postgres",
      host: "localhost",
      port: 5433,
      database: "postgres",
      user: "postgres",
      password: "betterdb",
      docker: {
        managed: true,
        containerName: "betterdb-my-app",
        volumeName: "betterdb-my-app-data",
      },
    });
  });
});
