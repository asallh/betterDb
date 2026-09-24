import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { TAB_COLORS, tabColorHex, type TabColorId } from "@/lib/tabColors";

interface Props {
  label: string;
  color: TabColorId | null;
  isActive: boolean;
  icon?: ReactNode;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
  onSetColor: (color: TabColorId | null) => void;
  closeLabel: string;
  /** Allow empty rename to clear custom title (table tabs) */
  allowEmptyRename?: boolean;
}

export function WorkspaceTab({
  label,
  color,
  isActive,
  icon,
  onSelect,
  onClose,
  onRename,
  onSetColor,
  closeLabel,
  allowEmptyRename = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const accent = tabColorHex(color);

  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!menu) return;
    function handleClick(e: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!menu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [menu]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed || allowEmptyRename) {
      onRename(trimmed);
    } else {
      setDraft(label);
    }
    setEditing(false);
  }

  function startRename() {
    setDraft(label);
    setEditing(true);
    setMenu(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(label);
      setEditing(false);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div
        role="tab"
        tabIndex={0}
        aria-selected={isActive}
        title={`${label} — double-click to rename, right-click for color`}
        className={`app-no-drag group relative flex cursor-pointer items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? "bg-background text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={
          accent
            ? {
                boxShadow: isActive
                  ? `inset 0 -2px 0 ${accent}`
                  : `inset 3px 0 0 ${accent}`,
              }
            : undefined
        }
        onClick={() => {
          if (!editing) onSelect();
        }}
        onDoubleClick={(e) => {
          if (editing) return;
          e.preventDefault();
          startRename();
        }}
        onKeyDown={(e) => {
          if (editing) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-24 min-w-0 bg-transparent outline-none border-b border-foreground/40 px-0 py-0 text-xs font-medium text-foreground"
            aria-label="Rename tab"
          />
        ) : (
          <span className="flex max-w-[10rem] items-center gap-1.5 truncate pointer-events-none">
            {icon}
            <span className="truncate">{label}</span>
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
          title="Close tab"
          aria-label={closeLabel}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[160px] rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-md"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
              onClick={startRename}
            >
              Rename…
            </button>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Color
            </div>
            <div className="flex flex-wrap gap-1.5 px-2 pb-1.5 pt-0.5">
              <button
                type="button"
                title="No color"
                aria-label="No color"
                onClick={() => {
                  onSetColor(null);
                  setMenu(null);
                }}
                className={`h-5 w-5 rounded-full border border-border bg-background ${
                  color === null ? "ring-2 ring-foreground ring-offset-1 ring-offset-popover" : ""
                }`}
              />
              {TAB_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => {
                    onSetColor(c.id);
                    setMenu(null);
                  }}
                  className={`h-5 w-5 rounded-full ${
                    color === c.id
                      ? "ring-2 ring-foreground ring-offset-1 ring-offset-popover"
                      : ""
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
