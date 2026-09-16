import { Download, ExternalLink } from "lucide-react";
import { updater } from "@/lib/updater";
import type { UpdateGateDecision } from "../../../shared/version";

type ForceDecision = Extract<UpdateGateDecision, { kind: "force" }>;

interface ForceUpdateScreenProps {
  decision: ForceDecision;
}

export function ForceUpdateScreen({ decision }: ForceUpdateScreenProps) {
  async function openRelease() {
    try {
      await updater.openRelease();
    } catch {
      window.open(decision.releaseUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="app-shell flex h-screen flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
        <div className="relative flex w-full max-w-[24rem] flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.05rem] border border-destructive/30 bg-destructive/[0.08] shadow-[0_0_36px_hsl(var(--destructive)/0.18),inset_0_1px_0_0_hsl(0_0%_100%/0.1)]">
            <Download
              className="h-7 w-7 text-destructive"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>

          <h1 className="mt-7 text-[1.5rem] font-semibold tracking-[-0.04em] text-foreground text-balance">
            Update required
          </h1>

          <p className="mt-3 text-[14px] leading-relaxed tracking-[-0.01em] text-muted-foreground text-pretty">
            BetterDB{" "}
            <span className="font-medium text-foreground tabular-nums">
              {decision.remoteVersion}
            </span>{" "}
            is required to run. You have{" "}
            <span className="font-medium text-foreground tabular-nums">
              {decision.localVersion}
            </span>
            . Older builds are no longer supported.
          </p>

          <button
            type="button"
            onClick={() => void openRelease()}
            className="btn-premium mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-medium tracking-[-0.01em]"
          >
            <Download className="h-4 w-4" strokeWidth={2.25} />
            Open download
          </button>

          <button
            type="button"
            onClick={() => void openRelease()}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            View release notes
          </button>
        </div>
      </div>
    </div>
  );
}
