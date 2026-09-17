import { Plus } from "lucide-react";
import { AppBrandIcon } from "@/components/brand/AppBrandIcon";
import { useUiStore } from "@/stores/uiStore";

export function WelcomeScreen() {
  const openConnectionForm = useUiStore((s) => s.openConnectionForm);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="relative flex w-full max-w-[22rem] flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <AppBrandIcon className="h-14 w-14 rounded-[1.05rem] shadow-[0_0_36px_hsl(var(--glow)/0.28)]" />

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
