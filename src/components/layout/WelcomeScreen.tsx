import { Database, Terminal, Table2 } from "lucide-react";

export function WelcomeScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-sm text-center">
        <Database className="mx-auto h-16 w-16 text-foreground" strokeWidth={1.5} />
        <h2 className="mt-6 text-lg font-medium text-foreground">
          Welcome to BetterDB
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect to a database to get started.
        </p>
        <div className="mt-8 space-y-3 text-left">
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <span>
              Add a connection from the sidebar panel below
            </span>
          </div>
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <span>
              Write and execute SQL queries with{" "}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
                Cmd+Enter
              </kbd>
            </span>
          </div>
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <span>
              Double-click any table to browse and edit data inline
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
