import net from "node:net";
import fs from "node:fs";
import Docker from "dockerode";
import type {
  DockerCreateRequest,
  DockerCreateResult,
  DockerManagedContainer,
  DockerStatus,
  ConnectionConfig,
} from "../../shared/types";
import {
  assertManagedContainer,
  CONNECTION_ID_LABEL,
  containerNameFromDisplay,
  ENGINE_LABEL,
  isManagedContainer,
  MANAGED_LABEL,
  MANAGED_LABEL_VALUE,
  stripContainerSlash,
  volumeNameFromContainer,
} from "../../shared/docker/naming";
import {
  getDockerPreset,
  isDockerLocalEngine,
} from "../../shared/docker/presets";
import { buildDockerConnectionConfig } from "../../shared/docker/buildConnection";
import { mapDockerError } from "../../shared/docker/errors";
import { waitForDatabaseReady } from "./waitForReady";

function resolveDockerSocketPath(): string | undefined {
  if (process.env.DOCKER_HOST?.startsWith("unix://")) {
    return process.env.DOCKER_HOST.replace(/^unix:\/\//, "");
  }
  const home = process.env.HOME ?? process.env.USERPROFILE;
  const candidates = [
    home ? `${home}/.docker/run/docker.sock` : null,
    "/var/run/docker.sock",
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // continue
    }
  }
  return undefined;
}

function createDefaultDocker(): Docker {
  const socketPath = resolveDockerSocketPath();
  return socketPath ? new Docker({ socketPath }) : new Docker();
}

function normalizeState(status?: string): DockerManagedContainer["state"] {
  const s = (status ?? "").toLowerCase();
  if (
    s === "running" ||
    s === "exited" ||
    s === "created" ||
    s === "paused" ||
    s === "restarting" ||
    s === "removing" ||
    s === "dead"
  ) {
    return s;
  }
  return "unknown";
}

async function isHostPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(preferred: number): Promise<number> {
  for (let offset = 0; offset < 50; offset++) {
    const candidate = preferred + offset;
    if (candidate > 65535) break;
    if (await isHostPortFree(candidate)) return candidate;
  }
  throw new Error(
    `Could not find a free host port near ${preferred}. Specify a free port manually.`
  );
}

export class DockerManager {
  private docker: Docker;

  constructor(docker?: Docker) {
    this.docker = docker ?? createDefaultDocker();
  }

  private followPullProgress(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.docker.modem as any).followProgress(
        stream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private async containerExists(name: string): Promise<boolean> {
    try {
      await this.docker.getContainer(name).inspect();
      return true;
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) return false;
      throw mapDockerError(err);
    }
  }

  async status(): Promise<DockerStatus> {
    try {
      await this.docker.ping();
      return { available: true };
    } catch (err) {
      return {
        available: false,
        error: mapDockerError(err).message,
      };
    }
  }

  async listManaged(): Promise<DockerManagedContainer[]> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`${MANAGED_LABEL}=${MANAGED_LABEL_VALUE}`],
        },
      });

      return containers
        .filter((c) => isManagedContainer(c.Names?.[0] ?? "", c.Labels))
        .map((c) => {
          const containerName = stripContainerSlash(c.Names?.[0] ?? "");
          const ports = (c.Ports ?? [])
            .map((p) => p.PublicPort)
            .filter((p): p is number => typeof p === "number");
          return {
            containerName,
            containerId: c.Id,
            engine: c.Labels?.[ENGINE_LABEL] ?? "",
            connectionId: c.Labels?.[CONNECTION_ID_LABEL] ?? null,
            state: normalizeState(c.State),
            ports,
          };
        });
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  private async getInspected(containerName: string) {
    const container = this.docker.getContainer(containerName);
    const info = await container.inspect();
    assertManagedContainer(info.Name, info.Config?.Labels ?? null);
    return { container, info };
  }

  async start(containerName: string): Promise<void> {
    try {
      const { container } = await this.getInspected(containerName);
      await container.start();
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async stop(containerName: string): Promise<void> {
    try {
      const { container } = await this.getInspected(containerName);
      await container.stop({ t: 10 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Already stopped is fine
      if (message.toLowerCase().includes("not running")) return;
      throw mapDockerError(err);
    }
  }

  async destroy(containerName: string): Promise<{ connectionId: string | null }> {
    try {
      const { container, info } = await this.getInspected(containerName);
      const connectionId = info.Config?.Labels?.[CONNECTION_ID_LABEL] ?? null;
      const volumeName =
        info.Mounts?.find((m) => m.Type === "volume")?.Name ??
        volumeNameFromContainer(stripContainerSlash(info.Name));

      try {
        await container.stop({ t: 5 });
      } catch {
        // may already be stopped
      }
      await container.remove({ force: true });

      try {
        await this.docker.getVolume(volumeName).remove();
      } catch {
        // volume may already be gone
      }

      return { connectionId };
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async create(request: DockerCreateRequest): Promise<{
    result: DockerCreateResult;
    connection: ConnectionConfig;
  }> {
    if (!isDockerLocalEngine(request.engine)) {
      throw new Error(`Unsupported Docker engine: ${request.engine}`);
    }

    const name = request.name.trim();
    if (!name) throw new Error("Name is required");

    const preset = getDockerPreset(request.engine);
    const containerName = containerNameFromDisplay(name);
    const volumeName = volumeNameFromContainer(containerName);
    const connectionId = crypto.randomUUID();

    const user = request.user ?? preset.defaultUser;
    const password = request.password ?? preset.defaultPassword;
    const database = request.database ?? preset.defaultDatabase;
    const preferredPort = request.port ?? preset.containerPort;

    try {
      await this.docker.ping();
    } catch (err) {
      throw mapDockerError(err);
    }

    if (await this.containerExists(containerName)) {
      throw new Error(
        `Container "${containerName}" already exists. Choose a different name.`
      );
    }

    const hostPort = await findFreePort(preferredPort);
    const creds = { user, password, database };

    try {
      // Pull image (idempotent)
      const pullStream = await this.docker.pull(preset.image);
      await this.followPullProgress(pullStream);

      // Ensure volume
      try {
        await this.docker.createVolume({ Name: volumeName });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("already")) {
          throw err;
        }
      }

      const envMap = preset.env(creds);
      const Env = Object.entries(envMap).map(([k, v]) => `${k}=${v}`);
      const Cmd = preset.cmd?.(creds);

      const container = await this.docker.createContainer({
        name: containerName,
        Image: preset.image,
        Env,
        ...(Cmd ? { Cmd } : {}),
        Labels: {
          [MANAGED_LABEL]: MANAGED_LABEL_VALUE,
          [ENGINE_LABEL]: request.engine,
          [CONNECTION_ID_LABEL]: connectionId,
        },
        HostConfig: {
          PortBindings: {
            [`${preset.containerPort}/tcp`]: [
              { HostPort: String(hostPort), HostIp: "127.0.0.1" },
            ],
          },
          Binds: [`${volumeName}:${preset.dataPath}`],
          RestartPolicy: { Name: "unless-stopped" },
        },
        ExposedPorts: {
          [`${preset.containerPort}/tcp`]: {},
        },
      });

      await container.start();
      await waitForDatabaseReady({
        engine: request.engine,
        host: "127.0.0.1",
        port: hostPort,
        user,
        password,
        database,
      });

      const connection = buildDockerConnectionConfig({
        connectionId,
        name,
        engine: request.engine,
        port: hostPort,
        user,
        password,
        database,
      });

      return {
        result: {
          connectionId,
          containerName,
          port: hostPort,
        },
        connection,
      };
    } catch (err) {
      // Best-effort cleanup so a retry with the same name is not blocked
      // by a half-created container or a volume that never finished init.
      try {
        const c = this.docker.getContainer(containerName);
        await c.remove({ force: true });
      } catch {
        // ignore
      }
      try {
        await this.docker.getVolume(volumeName).remove();
      } catch {
        // ignore — may not have been created yet
      }
      throw mapDockerError(err);
    }
  }
}
