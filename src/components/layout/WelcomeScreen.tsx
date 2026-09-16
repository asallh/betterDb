import { Database, Plus } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

export function WelcomeScreen() {
  const openConnectionForm = useUiStore((s) => s.openConnectionForm);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="relative flex w-full max-w-[22rem] flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.05rem] border border-primary/25 bg-primary/[0.1] shadow-[0_0_36px_hsl(var(--primary)/0.28),inset_0_1px_0_0_hsl(0_0%_100%/0.1)]">
          <Database className="h-7 w-7 text-primary" strokeWidth={1.5} aria-hidden />
        </div>

        <h1 className="mt-7 text-[1.75rem] font-semibold tracking-[-0.04em] text-foreground text-balance">
          BetterDB
        </h1>

        <p className="mt-2.5 text-[14px] leading-relaxed tracking-[-0.01em] text-muted-foreground text-pretty">
          Connect a database to get started.
        </p>

        <button
          type="button"
          onClick={() => openConnectionForm()}
          className="btn-premium mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-medium tracking-[-0.01em]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Add connection
        </button>
      </div>
    </div>
  );
}
