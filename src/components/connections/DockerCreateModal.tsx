import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DockerLocalEngine } from "../../../shared/types";
import {
  DOCKER_LOCAL_ENGINES,
  DOCKER_PRESETS,
} from "../../../shared/docker/presets";
import { containerNameFromDisplay } from "../../../shared/docker/naming";
import { docker } from "@/lib/ipc";
import { useConnectionStore } from "@/stores/connectionStore";
import { DatabaseEngineIcon } from "@/components/icons/DatabaseIcons";

interface Props {
  onClose: () => void;
}

export function DockerCreateModal({ onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const connect = useConnectionStore((s) => s.connect);
  const loadConnections = useConnectionStore((s) => s.loadConnections);

  const [engine, setEngine] = useState<DockerLocalEngine>("postgres");
  const preset = DOCKER_PRESETS[engine];

  const [name, setName] = useState("");
  const [port, setPort] = useState(String(preset.containerPort));
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState(preset.defaultDatabase);

  const [dockerError, setDockerError] = useState<string | null>(null);
  const [checkingDocker, setCheckingDocker] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  useEffect(() => {
    let cancelled = false;
    setCheckingDocker(true);
    docker
      .status()
      .then((status) => {
        if (cancelled) return;
        setDockerError(status.available ? null : status.error ?? "Docker is unavailable");
      })
      .catch((e) => {
        if (cancelled) return;
        setDockerError(e instanceof Error ? e.message : "Docker is unavailable");
      })
      .finally(() => {
        if (!cancelled) setCheckingDocker(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyEngine(next: DockerLocalEngine) {
    const p = DOCKER_PRESETS[next];
    setEngine(next);
    setPort(String(p.containerPort));
    setUser("");
    setPassword("");
    setDatabase(p.defaultDatabase);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    const portNum = port.trim() ? Number(port) : undefined;
    if (port.trim() && (!Number.isInteger(portNum) || (portNum ?? 0) < 1 || (portNum ?? 0) > 65535)) {
      setFormError("Port must be between 1 and 65535");
      return;
    }

    setSubmitting(true);
    try {
      const result = await docker.create({
        engine,
        name: name.trim(),
        port: portNum,
        // Blank fields → engine preset defaults in DockerManager
        user: user.trim() || undefined,
        password: password.trim() || undefined,
        database: database.trim() || undefined,
      });
      await loadConnections();
      await connect(result.connectionId);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create container");
    } finally {
      setSubmitting(false);
    }
  }

  const previewName = containerNameFromDisplay(name || "db");
  const showUser = engine !== "redis";
  const showDatabase = engine !== "redis";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current && !submitting) onClose();
      }}
    >
      <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/80 bg-card p-6 shadow-[0_16px_48px_hsl(0_0%_0%/0.28)]">
        <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
          New local database
        </h2>
        <p className="mb-5 text-[12px] text-muted-foreground">
          Spin up a Docker container managed by BetterDB and connect automatically.
        </p>

        {checkingDocker ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking Docker…
          </div>
        ) : dockerError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-xs text-destructive">
            {dockerError}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                Engine
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {DOCKER_LOCAL_ENGINES.map((eng) => {
                  const selected = eng === engine;
                  return (
                    <button
                      key={eng}
                      type="button"
                      onClick={() => applyEngine(eng)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                        selected
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <DatabaseEngineIcon
                        engine={eng}
                        colored
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="font-medium">{DOCKER_PRESETS[eng].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground" htmlFor="docker-name">
                Name
              </label>
              <input
                id="docker-name"
                name="docker-db-name"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                placeholder="my-app"
                autoFocus
              />
              <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                Container: <span className="font-mono text-foreground/80">{previewName}</span>
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground" htmlFor="docker-port">
                Host port
              </label>
              <input
                id="docker-port"
                name="docker-db-port"
                autoComplete="off"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                placeholder={String(preset.containerPort)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                If busy, the next free port is chosen automatically.
              </p>
            </div>

            {showUser && (
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground" htmlFor="docker-user">
                  User
                </label>
                <input
                  id="docker-user"
                  name="docker-db-user"
                  autoComplete="off"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder={preset.defaultUser || undefined}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground" htmlFor="docker-password">
                Password
              </label>
              <input
                id="docker-password"
                name="docker-db-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={preset.defaultPassword}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>

            {showDatabase && (
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground" htmlFor="docker-database">
                  Database
                </label>
                <input
                  id="docker-database"
                  name="docker-db-database"
                  autoComplete="off"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </div>
            )}

            {formError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-premium inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {submitting ? "Creating…" : "Create & connect"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
