import { useState, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { db } from "@/lib/ipc";
import {
  DATABASE_ENGINE_ORDER,
  DATABASE_ENGINES,
  getDefaultDatabase,
  getDefaultPort,
  getDefaultUser,
  requiresHost,
  supportsSsl,
  supportsSslRejectUnauthorized,
  supportsTrustServerCertificate,
} from "@/lib/databaseEngines";
import {
  buildConnectionString,
  detectEngineFromHost,
  isCloudHost,
  parseConnectionString,
} from "@/lib/connectionString";
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
    database: getDefaultDatabase("postgres"),
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
          c.connectionString?.trim() ||
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
      const nextEngine = parsed.engine ?? detectEngineFromHost(newHost);
      setForm((f) => ({
        ...f,
        host: newHost,
        port: String(parsed.port ?? f.port),
        database: parsed.database ?? f.database,
        user: parsed.user ?? f.user,
        // Keep a manually entered OAuth token when the pasted URI omits one
        // (Lakebase OAuth copy buttons often leave the password empty).
        password: parsed.password || f.password,
        ssl: supportsSsl(nextEngine)
          ? nextEngine === "sqlserver"
            ? (parsed.ssl ?? f.ssl)
            : cloud ? true : (parsed.ssl ?? f.ssl)
          : false,
        sslRejectUnauthorized:
          supportsSslRejectUnauthorized(nextEngine) && cloud
            ? false
            : f.sslRejectUnauthorized,
        trustServerCertificate:
          parsed.trustServerCertificate ?? f.trustServerCertificate,
        engine: nextEngine,
      }));
    }
  }

  const uriValid =
    !connectionString || parseConnectionString(connectionString) !== null;
  const hasRequiredFields =
    (requiresHost(form.engine) ? Boolean(form.host) : true) &&
    Boolean(form.database);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function buildConfig(): ConnectionConfig {
    const ssl = supportsSsl(form.engine) ? form.ssl : false;
    const config: ConnectionConfig = {
      id: connectionId ?? crypto.randomUUID(),
      engine: form.engine,
      name: form.name || `${form.host}/${form.database}`,
      host: form.host,
      port: parseInt(form.port, 10) || getDefaultPort(form.engine),
      database: form.database,
      user: form.user,
      password: form.password,
      ssl,
      ...(supportsSslRejectUnauthorized(form.engine) && ssl && {
        sslRejectUnauthorized: form.sslRejectUnauthorized,
      }),
      ...(supportsTrustServerCertificate(form.engine) && {
        trustServerCertificate: form.trustServerCertificate,
      }),
    };

    // When connecting via a pasted Lakebase / Postgres URI, also store a
    // rebuilt connection string (with any OAuth token filled in) so node-pg
    // can use the URI path directly.
    if (mode === "uri" && connectionString.trim() && uriValid) {
      config.connectionString = buildConnectionString({
        host: form.host,
        port: form.port,
        database: form.database,
        user: form.user,
        password: form.password,
        ssl,
        trustServerCertificate: form.trustServerCertificate,
        engine: form.engine,
      });
    }

    return config;
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
    "w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none transition-shadow focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 border-b border-border text-[12px]">
        <button
          onClick={() => setMode("fields")}
          className={`relative -mb-px px-3 py-2 transition-colors ${
            mode === "fields"
              ? "font-medium text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Fields
        </button>
        <button
          onClick={() => setMode("uri")}
          className={`relative -mb-px px-3 py-2 transition-colors ${
            mode === "uri"
              ? "font-medium text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
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
              rows={3}
              placeholder="postgresql://you@company.com@ep-….database.us-east-1.cloud.databricks.com/databricks_postgres?sslmode=require"
              value={connectionString}
              onChange={(e) => applyUri(e.target.value)}
              spellCheck={false}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Paste a Databricks Lakebase Autoscaling URI, JDBC URI, or libpq{" "}
              <span className="font-mono">host=…</span> string. Databricks hosts
              are detected automatically with SSL enabled.
            </p>
            {connectionString && !uriValid && (
              <p className="mt-1 text-[10px] text-destructive">
                Invalid connection string format
              </p>
            )}
          </div>
          {form.engine !== "sqlite" && (
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Password / OAuth token
              </label>
              <input
                className={inputClass}
                type="password"
                placeholder={
                  form.engine === "databricks"
                    ? "Postgres password or Lakebase OAuth token"
                    : "Password (if not in the URI)"
                }
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {form.engine === "databricks" && !form.password && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Lakebase OAuth URIs often omit the token — paste it here.
                </p>
              )}
            </div>
          )}
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
                  host: requiresHost(engine) ? form.host || "localhost" : "",
                  port:
                    form.port === previousDefaultPort
                      ? String(getDefaultPort(engine))
                      : form.port,
                  database:
                    form.database === getDefaultDatabase(form.engine)
                      ? getDefaultDatabase(engine)
                      : form.database,
                  user:
                    form.user === previousDefaultUser
                      ? getDefaultUser(engine)
                      : form.user,
                  ssl: supportsSsl(engine) ? form.ssl : false,
                });
              }}
            >
              {DATABASE_ENGINE_ORDER.map((engine) => (
                <option key={engine} value={engine}>
                  {DATABASE_ENGINES[engine].label}
                </option>
              ))}
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
          {requiresHost(form.engine) && (
            <>
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
                    const detectedEngine = detectEngineFromHost(host);
                    const shouldAutoDetect = ["postgres", "supabase", "aws", "databricks"].includes(form.engine);
                    const engine = shouldAutoDetect ? detectedEngine : form.engine;
                    setForm({
                      ...form,
                      host,
                      engine,
                      ssl: supportsSsl(engine)
                        ? engine === "sqlserver"
                          ? form.ssl
                          : cloud ? true : form.ssl
                        : false,
                      sslRejectUnauthorized:
                        supportsSslRejectUnauthorized(engine) && cloud
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
            </>
          )}
          <div className="col-span-2">
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              {form.engine === "sqlite" ? "Database File Path" : "Database"}
            </label>
            <input
              className={inputClass}
              placeholder={
                form.engine === "sqlite"
                  ? "/path/to/database.sqlite"
                  : getDefaultDatabase(form.engine) || "database"
              }
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
            />
          </div>
          {form.engine !== "sqlite" && (
            <>
              <div>
                <label className="mb-0.5 block text-[11px] text-muted-foreground">
                  User
                </label>
                <input
                  className={inputClass}
                  placeholder={
                    form.engine === "databricks"
                      ? "role or you@company.com"
                      : getDefaultUser(form.engine)
                  }
                  value={form.user}
                  onChange={(e) => setForm({ ...form, user: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] text-muted-foreground">
                  {form.engine === "databricks" ? "Password / OAuth token" : "Password"}
                </label>
                <input
                  className={inputClass}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </>
          )}
          {supportsSsl(form.engine) && (
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
          )}
          {form.ssl && supportsSslRejectUnauthorized(form.engine) && (
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
          {supportsTrustServerCertificate(form.engine) && (
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
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleTest}
          disabled={isTesting || !hasRequiredFields || (mode === "uri" && !uriValid)}
          className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          {isTesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Test"
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !hasRequiredFields}
          className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          Save
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveAndConnect}
          disabled={isSaving || !hasRequiredFields || (mode === "uri" && !uriValid)}
          className="btn-premium rounded-lg px-3.5 py-1.5 text-[12px] font-medium disabled:opacity-40"
        >
          {isSaving ? "Connecting…" : "Save & Connect"}
        </button>
      </div>
    </div>
  );
}
