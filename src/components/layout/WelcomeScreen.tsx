import { Database, Plus } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

export function WelcomeScreen() {
  const openConnectionsPanel = useUiStore((s) => s.openConnectionsPanel);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="relative w-full max-w-[26rem] animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <div className="glass-strong rounded-[1.25rem] border px-9 py-11 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.05rem] border border-primary/15 bg-gradient-to-b from-primary/[0.08] to-transparent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65),0_1px_2px_rgba(0,0,0,0.04)]">
            <Database className="h-7 w-7 text-primary" strokeWidth={1.35} />
          </div>
          <h2 className="mt-7 text-[1.35rem] font-semibold tracking-[-0.03em] text-foreground text-balance">
            Connect a database
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed tracking-[-0.01em] text-muted-foreground text-pretty">
            Browse schemas, run queries, and edit rows — start with a connection.
          </p>
          <button
            type="button"
            onClick={openConnectionsPanel}
            className="btn-premium mt-8 inline-flex items-center gap-2 rounded-[0.7rem] px-5 py-2.5 text-[13px] font-medium tracking-[-0.01em]"
          >
            <Plus className="relative z-[1] h-4 w-4" strokeWidth={2.25} />
            <span className="relative z-[1]">Add connection</span>
          </button>
          <p className="mt-3.5 text-[11px] tracking-wide text-muted-foreground/80">
            Or open Connections in the sidebar
          </p>
        </div>
      </div>
    </div>
  );
}
