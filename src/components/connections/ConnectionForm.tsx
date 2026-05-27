import { useState, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { db } from "@/lib/ipc";
import type { ConnectionConfig } from "../../../shared/types";
import { CheckCircle, XCircle, Loader2, Link } from "lucide-react";

interface Props {
  connectionId: string | null;
  onClose: () => void;
}

type FormMode = "fields" | "uri";

function parseConnectionString(uri: string): Partial<ConnectionConfig> | null {
  try {
    // Handle postgres:// and postgresql://
    const normalized = uri.replace(/^postgresql:\/\//, "postgres://");
    if (!normalized.startsWith("postgres://")) return null;

    const url = new URL(normalized);
    return {
      host: url.hostname || "localhost",
      port: parseInt(url.port, 10) || 5432,
      database: url.pathname.replace(/^\//, "") || "postgres",
      user: url.username || "postgres",
      password: decodeURIComponent(url.password || ""),
      ssl: url.searchParams.get("sslmode") === "require" ||
        url.searchParams.get("ssl") === "true",
    };
  } catch {
    return null;
  }
}

function buildConnectionString(form: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}): string {
  const pass = form.password ? `:${encodeURIComponent(form.password)}` : "";
  const ssl = form.ssl ? "?sslmode=require" : "";
  return `postgresql://${form.user}${pass}@${form.host}:${form.port}/${form.database}${ssl}`;
}

export function ConnectionForm({ connectionId, onClose }: Props) {
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const testConnection = useConnectionStore((s) => s.testConnection);
  const connect = useConnectionStore((s) => s.connect);

  const [mode, setMode] = useState<FormMode>("fields");
  const [connectionString, setConnectionString] = useState("");
  const [isLoading, setIsLoading] = useState(!!connectionId);

  const [form, setForm] = useState({
    name: "",
    host: "localhost",
    port: "5432",
    database: "",
    user: "postgres",
    password: "",
    ssl: false,
    sslRejectUnauthorized: true,
  });

  // Fetch full connection config (with password) from main process when editing
  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    db.getConnection(connectionId).then((conn) => {
      if (cancelled) return;
      setForm({
        name: conn.name,
        host: conn.host,
        port: String(conn.port),
        database: conn.database,
        user: conn.user,
        password: conn.password,
        ssl: conn.ssl ?? false,
        sslRejectUnauthorized: conn.sslRejectUnauthorized !== false,
      });
      setConnectionString(
        buildConnectionString({
          host: conn.host,
          port: String(conn.port),
          database: conn.database,
          user: conn.user,
          password: conn.password,
          ssl: conn.ssl ?? false,
        })
      );
      setIsLoading(false);
    });
    return () => { cancelled = true; };
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
      setForm((f) => ({
        ...f,
        host: parsed.host ?? f.host,
        port: String(parsed.port ?? f.port),
        database: parsed.database ?? f.database,
        user: parsed.user ?? f.user,
        password: parsed.password ?? f.password,
        ssl: parsed.ssl ?? f.ssl,
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
      engine: "postgres",
      name: form.name || `${form.host}/${form.database}`,
      host: form.host,
      port: parseInt(form.port, 10) || 5432,
      database: form.database,
      user: form.user,
      password: form.password,
      ssl: form.ssl,
      sslRejectUnauthorized: form.sslRejectUnauthorized,
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
              placeholder="postgresql://user:password@host:5432/dbname?sslmode=require"
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
              onChange={(e) => setForm({ ...form, host: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-muted-foreground">
              Port
            </label>
            <input
              className={inputClass}
              placeholder="5432"
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
              placeholder="postgres"
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
              placeholder="postgres"
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
              Use SSL
            </label>
          </div>
          {form.ssl && (
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
