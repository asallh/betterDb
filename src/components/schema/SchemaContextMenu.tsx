import { useEffect, useRef, useCallback, useState } from "react";
import { db } from "@/lib/ipc";
import { useSchemaStore } from "@/stores/schemaStore";
import { useTableViewStore } from "@/stores/tableViewStore";
import { useQueryStore } from "@/stores/queryStore";
import type { ColumnInfo } from "../../../shared/types";

export type ContextTarget =
  | { type: "schema"; schema: string }
  | { type: "table"; schema: string; table: string; tableType: "table" | "view" }
  | { type: "column"; schema: string; table: string; column: ColumnInfo };

interface Props {
  target: ContextTarget;
  position: { x: number; y: number };
  onClose: () => void;
}

interface MenuItem {
  label: string;
  danger?: boolean;
  separator?: boolean;
  action: () => void | Promise<void>;
}

export function SchemaContextMenu({ target, position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; body: string } | null>(null);
  const refreshAll = useSchemaStore((s) => s.refreshAll);
  const loadTables = useSchemaStore((s) => s.loadTables);
  const openTable = useTableViewStore((s) => s.openTable);
  const { addTab, updateSQL } = useQueryStore();

  const close = useCallback(() => {
    setConfirmAction(null);
    setInfoDialog(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [close]);

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [confirmAction, infoDialog]);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    close();
  }

  function openInEditor(sql: string) {
    addTab();
    const newTabs = useQueryStore.getState().tabs;
    const newTab = newTabs[newTabs.length - 1];
    updateSQL(newTab.id, sql);
    close();
  }

  function withConfirm(label: string, action: () => Promise<void>) {
    return () => setConfirmAction({ label, action });
  }

  function buildItems(): MenuItem[] {
    switch (target.type) {
      case "schema":
        return [
          {
            label: "Refresh Tables",
            action: async () => { await loadTables(target.schema); close(); },
          },
          {
            label: "Copy Schema Name",
            action: () => copyToClipboard(target.schema),
          },
          { label: "", separator: true, action: () => {} },
          {
            label: "Generate SELECT All Tables",
            action: () => {
              const tables = useSchemaStore.getState().tables.filter(t => t.schema === target.schema);
              const sql = tables.map(t => `SELECT * FROM "${target.schema}"."${t.name}" LIMIT 100;`).join("\n");
              openInEditor(sql);
            },
          },
          {
            label: "Generate CREATE SCHEMA",
            action: () => openInEditor(`CREATE SCHEMA "${target.schema}";`),
          },
          { label: "", separator: true, action: () => {} },
          {
            label: "Drop Schema",
            danger: true,
            action: withConfirm(`Drop schema "${target.schema}"? This will fail if the schema is not empty.`, async () => {
              const result = await db.dropSchema(target.schema, false);
              if (result.error) { setInfoDialog({ title: "Error", body: result.error }); } else { await refreshAll(); close(); }
            }),
          },
          {
            label: "Drop Schema (CASCADE)",
            danger: true,
            action: withConfirm(`Drop schema "${target.schema}" CASCADE? This will delete ALL tables, views, and data in this schema.`, async () => {
              const result = await db.dropSchema(target.schema, true);
              if (result.error) { setInfoDialog({ title: "Error", body: result.error }); } else { await refreshAll(); close(); }
            }),
          },
        ];

      case "table": {
        const isView = target.tableType === "view";
        const items: MenuItem[] = [
          {
            label: "View Data",
            action: () => { openTable(target.schema, target.table); close(); },
          },
          {
            label: "Count Rows",
            action: async () => {
              const count = await db.getTableRowCount(target.schema, target.table);
              setInfoDialog({
                title: `${target.schema}.${target.table}`,
                body: `${count.toLocaleString()} rows`,
              });
            },
          },
          {
            label: "Table Size",
            action: async () => {
              try {
                const size = await db.getTableSize(target.schema, target.table);
                setInfoDialog({
                  title: `${target.schema}.${target.table}`,
                  body: `Total: ${size.totalSize}\nData: ${size.dataSize}\nIndexes: ${size.indexSize}`,
                });
              } catch {
                setInfoDialog({
                  title: "Table Size",
                  body: "Could not get table size (may not be supported for views).",
                });
              }
            },
          },
          { label: "", separator: true, action: () => {} },
          {
            label: "Copy Table Name",
            action: () => copyToClipboard(`"${target.schema}"."${target.table}"`),
          },
          {
            label: "Generate SELECT",
            action: () => openInEditor(`SELECT *\nFROM "${target.schema}"."${target.table}"\nLIMIT 100;`),
          },
          {
            label: "Generate SELECT (columns)",
            action: async () => {
              const cols = await db.getColumns(target.schema, target.table);
              const colNames = cols.map(c => `  "${c.name}"`).join(",\n");
              openInEditor(`SELECT\n${colNames}\nFROM "${target.schema}"."${target.table}"\nLIMIT 100;`);
            },
          },
          {
            label: "Generate INSERT Template",
            action: async () => {
              const cols = await db.getColumns(target.schema, target.table);
              const colNames = cols.map(c => `"${c.name}"`).join(", ");
              const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
              openInEditor(`INSERT INTO "${target.schema}"."${target.table}" (${colNames})\nVALUES (${placeholders});`);
            },
          },
          {
            label: "Generate UPDATE Template",
            action: async () => {
              const cols = await db.getColumns(target.schema, target.table);
              const pkCols = cols.filter(c => c.isPrimaryKey);
              const nonPkCols = cols.filter(c => !c.isPrimaryKey);
              const setClauses = nonPkCols.map(c => `  "${c.name}" = ?`).join(",\n");
              const whereClauses = pkCols.length > 0
                ? pkCols.map(c => `"${c.name}" = ?`).join(" AND ")
                : "/* add WHERE condition */";
              openInEditor(`UPDATE "${target.schema}"."${target.table}"\nSET\n${setClauses}\nWHERE ${whereClauses};`);
            },
          },
          {
            label: "Generate DELETE Template",
            action: async () => {
              const cols = await db.getColumns(target.schema, target.table);
              const pkCols = cols.filter(c => c.isPrimaryKey);
              const whereClauses = pkCols.length > 0
                ? pkCols.map(c => `"${c.name}" = ?`).join(" AND ")
                : "/* add WHERE condition */";
              openInEditor(`DELETE FROM "${target.schema}"."${target.table}"\nWHERE ${whereClauses};`);
            },
          },
          {
            label: "Generate CREATE TABLE (DDL)",
            action: async () => {
              const cols = await db.getColumns(target.schema, target.table);
              const colDefs = cols.map(c => {
                let def = `  "${c.name}" ${c.dataType}`;
                if (!c.nullable) def += " NOT NULL";
                if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
                return def;
              });
              const pkCols = cols.filter(c => c.isPrimaryKey);
              if (pkCols.length > 0) {
                colDefs.push(`  PRIMARY KEY (${pkCols.map(c => `"${c.name}"`).join(", ")})`);
              }
              openInEditor(`CREATE TABLE "${target.schema}"."${target.table}" (\n${colDefs.join(",\n")}\n);`);
            },
          },
        ];

        if (!isView) {
          items.push(
            { label: "", separator: true, action: () => {} },
            {
              label: "View Indexes",
              action: async () => {
                const indexes = await db.getIndexes(target.schema, target.table);
                if (indexes.length === 0) {
                  setInfoDialog({
                    title: `Indexes on ${target.schema}.${target.table}`,
                    body: "No indexes found.",
                  });
                } else {
                  const lines = indexes.map(idx =>
                    `${idx.isPrimary ? "[PK] " : idx.isUnique ? "[UQ] " : ""}${idx.name}\n  ${idx.columns}`
                  );
                  setInfoDialog({
                    title: `Indexes on ${target.schema}.${target.table}`,
                    body: lines.join("\n\n"),
                  });
                }
              },
            },
          );
        }

        items.push(
          { label: "", separator: true, action: () => {} },
          ...(isView
            ? [{
                label: "Drop View",
                danger: true,
                action: withConfirm(`Drop view "${target.schema}"."${target.table}"?`, async () => {
                  const result = await db.dropTable(target.schema, target.table, "view");
                  if (result.error) { setInfoDialog({ title: "Error", body: result.error }); } else { await loadTables(target.schema); close(); }
                }),
              }]
            : [
                {
                  label: "Truncate Table",
                  danger: true,
                  action: withConfirm(`Truncate "${target.schema}"."${target.table}"? All data will be deleted.`, async () => {
                    const result = await db.truncateTable(target.schema, target.table);
                    if (result.error) { setInfoDialog({ title: "Error", body: result.error }); } else { close(); }
                  }),
                },
                {
                  label: "Drop Table",
                  danger: true,
                  action: withConfirm(`Drop table "${target.schema}"."${target.table}"? This cannot be undone.`, async () => {
                    const result = await db.dropTable(target.schema, target.table, "table");
                    if (result.error) { setInfoDialog({ title: "Error", body: result.error }); } else { await loadTables(target.schema); close(); }
                  }),
                },
              ]
          ),
        );

        return items;
      }

      case "column":
        return [
          {
            label: "Copy Column Name",
            action: () => copyToClipboard(target.column.name),
          },
          {
            label: "Copy Qualified Name",
            action: () => copyToClipboard(`"${target.schema}"."${target.table}"."${target.column.name}"`),
          },
          { label: "", separator: true, action: () => {} },
          {
            label: "Generate SELECT with WHERE",
            action: () => openInEditor(`SELECT *\nFROM "${target.schema}"."${target.table}"\nWHERE "${target.column.name}" = ?;`),
          },
          {
            label: "Generate SELECT DISTINCT",
            action: () => openInEditor(`SELECT DISTINCT "${target.column.name}"\nFROM "${target.schema}"."${target.table}"\nORDER BY "${target.column.name}";`),
          },
          {
            label: "Generate GROUP BY",
            action: () => openInEditor(`SELECT "${target.column.name}", COUNT(*)\nFROM "${target.schema}"."${target.table}"\nGROUP BY "${target.column.name}"\nORDER BY COUNT(*) DESC;`),
          },
          { label: "", separator: true, action: () => {} },
          {
            label: `Type: ${target.column.dataType}`,
            action: () => copyToClipboard(target.column.dataType),
          },
          ...(target.column.nullable ? [{ label: "Nullable: YES", action: () => {} }] : []),
          ...(target.column.defaultValue ? [{ label: `Default: ${target.column.defaultValue}`, action: () => copyToClipboard(target.column.defaultValue!) }] : []),
          ...(target.column.isForeignKey && target.column.references
            ? [{
                label: `FK → ${target.column.references.table}.${target.column.references.column}`,
                action: () => copyToClipboard(`${target.column.references!.table}.${target.column.references!.column}`),
              }]
            : []),
        ];
    }
  }

  const items = buildItems();

  if (infoDialog) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[240px] max-w-[360px] rounded-md border border-border bg-popover shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-foreground">
          {infoDialog.title}
        </div>
        <div className="max-h-[320px] overflow-auto px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
            {infoDialog.body}
          </pre>
        </div>
        <div className="flex justify-end border-t border-border px-3 py-2">
          <button
            onClick={close}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (confirmAction) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[220px] max-w-[320px] rounded-md border border-border bg-popover p-3 shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <p className="mb-3 text-xs text-foreground">{confirmAction.label}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={close}
            className="rounded px-2 py-1 text-xs hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={confirmAction.action}
            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] max-w-[280px] rounded-md border border-border bg-popover py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-accent ${
              item.danger ? "text-red-500 hover:text-red-400" : "text-foreground"
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
