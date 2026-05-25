import { useState } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import type { ConnectionConfig } from "../../../shared/types";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  connection: ConnectionConfig | null;
  onClose: () => void;
}

export function ConnectionForm({ connection, onClose }: Props) {
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const testConnection = useConnectionStore((s) => s.testConnection);
  const connect = useConnectionStore((s) => s.connect);

  const [form, setForm] = useState({
    name: connection?.name ?? "",
    host: connection?.host ?? "localhost",
    port: String(connection?.port ?? 5432),
    database: connection?.database ?? "",
    user: connection?.user ?? "postgres",
    password: connection?.password ?? "",
    ssl: connection?.ssl ?? false,
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function buildConfig(): ConnectionConfig {
    return {
      id: connection?.id ?? crypto.randomUUID(),
      engine: "postgres",
      name: form.name || `${form.host}/${form.database}`,
      host: form.host,
      port: parseInt(form.port, 10) || 5432,
      database: form.database,
      user: form.user,
      password: form.password,
      ssl: form.ssl,
    };
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection(buildConfig());
    setTestResult(result);
    setIsTesting(false);
  }

  async function handleSave() {
    setIsSaving(true);
    const config = buildConfig();
    await saveConnection(config);
    setIsSaving(false);
    onClose();
  }

  async function handleSaveAndConnect() {
    setIsSaving(true);
    const config = buildConfig();
    await saveConnection(config);
    await connect(config.id);
    setIsSaving(false);
    onClose();
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">
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
          <label className="mb-1 block text-xs text-muted-foreground">
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
          <label className="mb-1 block text-xs text-muted-foreground">
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
          <label className="mb-1 block text-xs text-muted-foreground">
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
          <label className="mb-1 block text-xs text-muted-foreground">
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
          <label className="mb-1 block text-xs text-muted-foreground">
            Password
          </label>
          <input
            className={inputClass}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="ssl"
            checked={form.ssl}
            onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
            className="rounded border-input"
          />
          <label htmlFor="ssl" className="text-xs text-muted-foreground">
            Use SSL
          </label>
        </div>
      </div>

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            testResult.success
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Connection successful
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              {testResult.error}
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={isTesting || !form.host || !form.database}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {isTesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Test"
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !form.host || !form.database}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50 transition-colors"
        >
          Save
        </button>
        <button
          onClick={handleSaveAndConnect}
          disabled={isSaving || !form.host || !form.database}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Connecting..." : "Save & Connect"}
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
