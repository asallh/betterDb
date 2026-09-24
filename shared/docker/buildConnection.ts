import type { ConnectionConfig, DockerLocalEngine } from "../types";
import {
  containerNameFromDisplay,
  volumeNameFromContainer,
} from "./naming";

/** Build the saved ConnectionConfig produced after a successful Docker create. */
export function buildDockerConnectionConfig(opts: {
  connectionId: string;
  name: string;
  engine: DockerLocalEngine;
  port: number;
  user: string;
  password: string;
  database: string;
}): ConnectionConfig {
  const containerName = containerNameFromDisplay(opts.name);
  return {
    id: opts.connectionId,
    name: opts.name,
    engine: opts.engine,
    host: "localhost",
    port: opts.port,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    docker: {
      managed: true,
      containerName,
      volumeName: volumeNameFromContainer(containerName),
    },
  };
}
