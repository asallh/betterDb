import type { DockerLocalEngine } from "../types";

export interface DockerEnginePreset {
  engine: DockerLocalEngine;
  label: string;
  image: string;
  containerPort: number;
  defaultUser: string;
  defaultPassword: string;
  defaultDatabase: string;
  /** Host path inside the container for the named volume. */
  dataPath: string;
  /** Build container env from credentials. */
  env: (creds: {
    user: string;
    password: string;
    database: string;
  }) => Record<string, string>;
  /** Optional override for docker create Cmd. */
  cmd?: (creds: {
    user: string;
    password: string;
    database: string;
  }) => string[];
}

export const DOCKER_LOCAL_ENGINES: DockerLocalEngine[] = [
  "postgres",
  "mysql",
  "redis",
  "mongodb",
];

export const DOCKER_PRESETS: Record<DockerLocalEngine, DockerEnginePreset> = {
  postgres: {
    engine: "postgres",
    label: "PostgreSQL",
    image: "postgres:16-alpine",
    containerPort: 5432,
    defaultUser: "postgres",
    defaultPassword: "betterdb",
    defaultDatabase: "postgres",
    dataPath: "/var/lib/postgresql/data",
    env: ({ user, password, database }) => ({
      POSTGRES_USER: user,
      POSTGRES_PASSWORD: password,
      POSTGRES_DB: database,
    }),
  },
  mysql: {
    engine: "mysql",
    label: "MySQL",
    image: "mysql:8.4",
    containerPort: 3306,
    defaultUser: "betterdb",
    defaultPassword: "betterdb",
    defaultDatabase: "betterdb",
    dataPath: "/var/lib/mysql",
    env: ({ user, password, database }) => ({
      MYSQL_USER: user,
      MYSQL_PASSWORD: password,
      MYSQL_DATABASE: database,
      MYSQL_ROOT_PASSWORD: password,
    }),
  },
  redis: {
    engine: "redis",
    label: "Redis",
    image: "redis:7-alpine",
    containerPort: 6379,
    defaultUser: "",
    defaultPassword: "betterdb",
    defaultDatabase: "0",
    dataPath: "/data",
    env: () => ({}),
    cmd: ({ password }) => ["redis-server", "--requirepass", password],
  },
  mongodb: {
    engine: "mongodb",
    label: "MongoDB",
    image: "mongo:7",
    containerPort: 27017,
    defaultUser: "betterdb",
    defaultPassword: "betterdb",
    defaultDatabase: "betterdb",
    dataPath: "/data/db",
    env: ({ user, password, database }) => ({
      MONGO_INITDB_ROOT_USERNAME: user,
      MONGO_INITDB_ROOT_PASSWORD: password,
      MONGO_INITDB_DATABASE: database,
    }),
  },
};

export function isDockerLocalEngine(
  value: string
): value is DockerLocalEngine {
  return (DOCKER_LOCAL_ENGINES as string[]).includes(value);
}

export function getDockerPreset(engine: DockerLocalEngine): DockerEnginePreset {
  return DOCKER_PRESETS[engine];
}
