import { useEffect, useRef } from "react";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  value: string;
  column: string;
  dataType?: string;
  onClose: () => void;
}

export function CellExpandModal({ value, column, dataType, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Try to pretty-print JSON
  let displayValue = value;
  let isJson = false;
  if (dataType === "json" || dataType === "jsonb") {
    try {
      displayValue = JSON.stringify(JSON.parse(value), null, 2);
      isJson = true;
    } catch {
      // not valid JSON, show as-is
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>{column}</span>
            {dataType && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {dataType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Copy value"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <pre
            className={`text-xs font-mono whitespace-pre-wrap break-all ${
              isJson ? "text-pink-500" : "text-foreground"
            }`}
          >
            {displayValue}
          </pre>
        </div>
      </div>
    </div>
  );
}
