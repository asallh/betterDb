import { useState, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { db } from "@/lib/ipc";
import type { ConnectionConfig } from "../../../shared/types";
import { CheckCircle, XCircle, Loader2, Link } from "lucide-react";

function defaultFormState(): {
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
    trustServerCertificate: boolean;
  engine: ConnectionConfig["engine"];
} {
  return {
    name: "",
    host: "localhost",
    port: "5432",
    database: "",
    user: "postgres",
    password: "",
    ssl: false,
    sslRejectUnauthorized: true,
    trustServerCertificate: false,
    engine: "postgres",
  };
}

interface Props {
  connectionId: string | null;
  onClose: () => void;
}

type FormMode = "fields" | "uri";

function isPostgresEngine(engine: ConnectionConfig["engine"]): boolean {
  return engine !== "sqlserver";
}

function getDefaultPort(engine: ConnectionConfig["engine"]): number {
  return engine === "sqlserver" ? 1433 : 5432;
}

function getDefaultUser(engine: ConnectionConfig["engine"]): string {
  return engine === "sqlserver" ? "sa" : "postgres";
}

function parseConnectionString(uri: string): Partial<ConnectionConfig> | null {
  try {
    const scheme = uri.match(/^([a-z]+):\/\//i)?.[1]?.toLowerCase();
    const engine =
      scheme === "sqlserver" || scheme === "mssql"
        ? "sqlserver"
        : scheme === "postgres" || scheme === "postgresql"
          ? "postgres"
          : null;

    if (!engine) return null;

    // Use http:// for parsing since database URL schemes are not all "special"
    // URL schemes and can otherwise parse credentials/host inconsistently.
    const url = new URL(uri.replace(/^[a-z]+:\/\//i, "http://"));
    const defaultPort = getDefaultPort(engine);
    const defaultUser = getDefaultUser(engine);

    return {
      engine,
      host: url.hostname || "localhost",
      port: parseInt(url.port, 10) || defaultPort,
      database: url.pathname.replace(/^\//, "") || (engine === "sqlserver" ? "" : "postgres"),
      user: url.username || defaultUser,
      password: decodeURIComponent(url.password || ""),
      ssl: url.searchParams.get("sslmode") === "require" ||
        url.searchParams.get("ssl") === "true" ||
        url.searchParams.get("encrypt") === "true",
      trustServerCertificate:
        url.searchParams.get("trustServerCertificate") === "true" ||
        url.searchParams.get("trustServerCertificate") === "1",
    };
  } catch {
    return null;
  }
}

function isCloudHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes("supabase") || h.includes("rds.amazonaws.com") || h.includes("redshift.amazonaws.com") || h.includes("neon.tech") || h.includes("aivencloud.com") || h.includes("databricks");
}

function detectEngine(host: string): ConnectionConfig["engine"] {
  const h = host.toLowerCase();
  if (h.includes("database.windows.net")) return "sqlserver";
  if (h.includes("supabase")) return "supabase";
  if (h.includes("rds.amazonaws.com") || h.includes("redshift.amazonaws.com") || h.includes("aws")) return "aws";
  if (h.includes("databricks")) return "databricks";
  return "postgres";
}

function buildConnectionString(form: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  trustServerCertificate?: boolean;
  engine: ConnectionConfig["engine"];
}): string {
  const pass = form.password ? `:${encodeURIComponent(form.password)}` : "";
  const scheme = form.engine === "sqlserver" ? "sqlserver" : "postgresql";
  const params = new URLSearchParams();
  if (form.engine === "sqlserver") {
    if (form.ssl) params.set("encrypt", "true");
    if (form.trustServerCertificate) params.set("trustServerCertificate", "true");
  } else if (form.ssl) {
    params.set("sslmode", "require");
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return `${scheme}://${form.user}${pass}@${form.host}:${form.port}/${form.database}${query}`;
}

export function ConnectionForm({ connectionId, onClose }: Props) {
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const testConnection = useConnectionStore((s) => s.testConnection);
  const connect = useConnectionStore((s) => s.connect);

  const [mode, setMode] = useState<FormMode>("fields");
  const [connectionString, setConnectionString] = useState("");
  const [isLoading, setIsLoading] = useState(!!connectionId);

  const [form, setForm] = useState(defaultFormState);

  useEffect(() => {
    if (!connectionId) {
      setForm(defaultFormState());
      setConnectionString("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    db.getConnection(connectionId)
      .then((c) => {
        if (cancelled) return;
        const next = {
          name: c.name,
          host: c.host,
          port: String(c.port),
          database: c.database,
          user: c.user,
          password: c.password,
          ssl: c.ssl ?? false,
          sslRejectUnauthorized: c.sslRejectUnauthorized !== false,
          trustServerCertificate:
            c.trustServerCertificate ?? c.sslRejectUnauthorized === false,
          engine: c.engine,
        };
        setForm(next);
        setConnectionString(
          buildConnectionString({
            host: c.host,
            port: String(c.port),
            database: c.database,
            user: c.user,
            password: c.password,
            ssl: c.ssl ?? false,
            trustServerCertificate: c.trustServerCertificate,
            engine: c.engine,
          })
        );
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function applyUri(uri: string) {
    setConnectionString(uri);
    const parsed = parseConnectionString(uri);
    if (parsed) {
      const newHost = parsed.host ?? form.host;
      const cloud = isCloudHost(newHost);
      const nextEngine = parsed.engine ?? detectEngine(newHost);
      setForm((f) => ({
        ...f,
        host: newHost,
        port: String(parsed.port ?? f.port),
        database: parsed.database ?? f.database,
        user: parsed.user ?? f.user,
        password: parsed.password ?? f.password,
        ssl: nextEngine === "sqlserver" ? (parsed.ssl ?? f.ssl) : cloud ? true : (parsed.ssl ?? f.ssl),
        sslRejectUnauthorized:
          nextEngine === "sqlserver" ? f.sslRejectUnauthorized : cloud ? false : f.sslRejectUnauthorized,
        trustServerCertificate:
          parsed.trustServerCertificate ?? f.trustServerCertificate,
        engine: nextEngine,
      }));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function buildConfig(): ConnectionConfig {
    return {
      id: connectionId ?? crypto.randomUUID(),
      engine: form.engine,
      name: form.name || `${form.host}/${form.database}`,
      host: form.host,
      port: parseInt(form.port, 10) || getDefaultPort(form.engine),
      database: form.database,
      user: form.user,
      password: form.password,
      ssl: form.ssl,
      ...(isPostgresEngine(form.engine) && form.ssl && {
        sslRejectUnauthorized: form.sslRejectUnauthorized,
      }),
      ...(form.engine === "sqlserver" && {
        trustServerCertificate: form.trustServerCertificate,
      }),
    };
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection(buildConfig());
    setTestResult(result);
    setIsTesting(false);
  }

  async function handleSaveAndConnect() {
    setIsSaving(true);
    const config = buildConfig();
    await saveConnection(config);
    await connect(config.id);
    setIsSaving(false);
    onClose();
  }

  async function handleSave() {
    setIsSaving(true);
    await saveConnection(buildConfig());
    setIsSaving(false);
    onClose();
  }

  const inputClass =
    "w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring";
  const uriValid = !connectionString || parseConnectionString(connectionString) !== null;

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex rounded border border-border text-[11px]">
        <button
          onClick={() => setMode("fields")}
          className={`flex-1 px-2 py-1 transition-colors ${
            mode === "fields"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
        >
          Fields
        </button>
        <button
          onClick={() => setMode("uri")}
          className={`flex-1 px-2 py-1 border-l border-border transition-colors ${
            mode === "uri"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Link className="h-3 w-3" />
            URI
          </span>
        </button>
      </div>

      {mode === "uri" ? (
        /* Connection string mode */
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Connection String
            </label>
            <textarea
              className={`${inputClass} resize-none font-mono`}
              rows={2}
              placeholder="postgresql://user:password@host:5432/dbname?sslmode=require or sqlserver://user:password@host:1433/dbname?encrypt=true"
              value={connectionString}
              onChange={(e) => applyUri(e.target.value)}
              spellCheck={false}
            />
            {connectionString && !uriValid && (
              <p className="mt-1 text-[10px] text-destructive">
                Invalid connection string format
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Connection Name
            </label>
            <input
              className={inputClass}
              placeholder="My Database"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
        </div>
      ) : (
        /* Individual fields mode */
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Database Engine
            </label>
            <select
              className={inputClass}
              value={form.engine}
              onChange={(e) => {
                const engine = e.target.value as ConnectionConfig["engine"];
                const previousDefaultPort = String(getDefaultPort(form.engine));
                const previousDefaultUser = getDefaultUser(form.engine);
                setForm({
                  ...form,
                  engine,
                  port:
                    form.port === previousDefaultPort
                      ? String(getDefaultPort(engine))
                      : form.port,
                  user:
                    form.user === previousDefaultUser
                      ? getDefaultUser(engine)
                      : form.user,
                });
              }}
            >
              <option value="postgres">PostgreSQL</option>
              <option value="supabase">Supabase</option>
              <option value="aws">AWS/RDS PostgreSQL</option>
              <option value="databricks">Databricks</option>
              <option value="sqlserver">SQL Server</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Connection Name
            </label>
            <input
              className={inputClass}
              placeholder="My Database"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Host
            </label>
            <input
              className={inputClass}
              placeholder="localhost"
              value={form.host}
              onChange={(e) => {
                const host = e.target.value;
                const cloud = isCloudHost(host);
                const detectedEngine = detectEngine(host);
                const engine =
                  form.engine === "sqlserver" && detectedEngine !== "sqlserver"
                    ? form.engine
                    : detectedEngine;
                setForm({
                  ...form,
                  host,
                  engine,
                  ssl: engine === "sqlserver" ? form.ssl : cloud ? true : form.ssl,
                  sslRejectUnauthorized:
                    engine === "sqlserver"
                      ? form.sslRejectUnauthorized
                      : cloud
                        ? false
                        : form.sslRejectUnauthorized,
                });
              }}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Port
            </label>
            <input
              className={inputClass}
              placeholder={String(getDefaultPort(form.engine))}
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Database
            </label>
            <input
              className={inputClass}
              placeholder={form.engine === "sqlserver" ? "database" : "postgres"}
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              User
            </label>
            <input
              className={inputClass}
              placeholder={getDefaultUser(form.engine)}
              value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Password
            </label>
            <input
              className={inputClass}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex items-center gap-1.5">
            <input
              type="checkbox"
              id="ssl-form"
              checked={form.ssl}
              onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
              className="rounded border-input"
            />
            <label htmlFor="ssl-form" className="text-[11px] text-muted-foreground">
              {form.engine === "sqlserver" ? "Encrypt connection" : "Use SSL"}
            </label>
          </div>
          {form.ssl && isPostgresEngine(form.engine) && (
            <div className="col-span-2 flex items-center gap-1.5 ml-4">
              <input
                type="checkbox"
                id="ssl-reject-unauth"
                checked={!form.sslRejectUnauthorized}
                onChange={(e) =>
                  setForm({ ...form, sslRejectUnauthorized: !e.target.checked })
                }
                className="rounded border-input"
              />
              <label htmlFor="ssl-reject-unauth" className="text-[11px] text-muted-foreground">
                Allow self-signed certificates (insecure)
              </label>
            </div>
          )}
          {form.engine === "sqlserver" && (
            <div className="col-span-2 flex items-center gap-1.5 ml-4">
              <input
                type="checkbox"
                id="trust-server-cert"
                checked={form.trustServerCertificate}
                onChange={(e) =>
                  setForm({ ...form, trustServerCertificate: e.target.checked })
                }
                className="rounded border-input"
              />
              <label htmlFor="trust-server-cert" className="text-[11px] text-muted-foreground">
                Trust server certificate
              </label>
            </div>
          )}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
            testResult.success
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Connection successful
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              <span className="truncate">{testResult.error}</span>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={handleTest}
          disabled={isTesting || !form.host || !form.database || (mode === "uri" && !uriValid)}
          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40 transition-colors"
        >
          {isTesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Test"
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !form.host || !form.database}
          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40 transition-colors"
        >
          Save
        </button>
        <button
          onClick={handleSaveAndConnect}
          disabled={isSaving || !form.host || !form.database || (mode === "uri" && !uriValid)}
          className="flex-1 rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {isSaving ? "Connecting..." : "Save & Connect"}
        </button>
        <button
          onClick={onClose}
          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
