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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-popover p-5 shadow-lg">
        <h2 className="mb-4 text-sm font-semibold">
          {connectionId ? "Edit Connection" : "New Connection"}
        </h2>
        <ConnectionForm connectionId={connectionId} onClose={onClose} />
      </div>
    </div>
  );
}
