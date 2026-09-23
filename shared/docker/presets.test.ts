import { describe, expect, it } from "vitest";
import {
  DOCKER_LOCAL_ENGINES,
  DOCKER_PRESETS,
  getDockerPreset,
  isDockerLocalEngine,
} from "./presets";

describe("docker presets", () => {
  it("covers the v1 local engines", () => {
    expect(DOCKER_LOCAL_ENGINES).toEqual([
      "postgres",
      "mysql",
      "redis",
      "mongodb",
    ]);
    for (const engine of DOCKER_LOCAL_ENGINES) {
      expect(DOCKER_PRESETS[engine]).toBeDefined();
      expect(isDockerLocalEngine(engine)).toBe(true);
    }
    expect(isDockerLocalEngine("sqlserver")).toBe(false);
  });

  it("maps credentials into engine env vars", () => {
    const creds = {
      user: "app",
      password: "secret",
      database: "appdb",
    };
    expect(getDockerPreset("postgres").env(creds)).toEqual({
      POSTGRES_USER: "app",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DB: "appdb",
    });
    expect(getDockerPreset("mysql").env(creds)).toMatchObject({
      MYSQL_USER: "app",
      MYSQL_PASSWORD: "secret",
      MYSQL_DATABASE: "appdb",
      MYSQL_ROOT_PASSWORD: "secret",
    });
    expect(getDockerPreset("mongodb").env(creds)).toEqual({
      MONGO_INITDB_ROOT_USERNAME: "app",
      MONGO_INITDB_ROOT_PASSWORD: "secret",
      MONGO_INITDB_DATABASE: "appdb",
    });
    expect(getDockerPreset("redis").env(creds)).toEqual({});
    expect(getDockerPreset("redis").cmd?.(creds)).toEqual([
      "redis-server",
      "--requirepass",
      "secret",
    ]);
  });

  it("pins official images and data paths", () => {
    expect(DOCKER_PRESETS.postgres.image).toContain("postgres:");
    expect(DOCKER_PRESETS.postgres.dataPath).toBe("/var/lib/postgresql/data");
    expect(DOCKER_PRESETS.mysql.containerPort).toBe(3306);
    expect(DOCKER_PRESETS.redis.containerPort).toBe(6379);
    expect(DOCKER_PRESETS.mongodb.containerPort).toBe(27017);
  });
});
