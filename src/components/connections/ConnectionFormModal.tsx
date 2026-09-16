import { useEffect, useRef } from "react";
import { ConnectionForm } from "./ConnectionForm";

interface Props {
  connectionId: string | null;
  onClose: () => void;
}

export function ConnectionFormModal({ connectionId, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-[0_16px_48px_hsl(0_0%_0%/0.28)]">
        <h2 className="mb-5 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
          {connectionId ? "Edit connection" : "New connection"}
        </h2>
        <ConnectionForm connectionId={connectionId} onClose={onClose} />
      </div>
    </div>
  );
}
