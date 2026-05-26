import { useEffect, useState, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { db } from "@/lib/ipc";
import type { QueryResult, ColumnInfo } from "../../../shared/types";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

interface Props {
  schema: string;
  table: string;
}

interface EditingCell {
  rowIndex: number;
  column: string;
  value: string;
}

const TYPE_COLORS: Record<string, string> = {
  int2: "text-blue-500",
  int4: "text-blue-500",
  int8: "text-blue-500",
  float4: "text-blue-500",
  float8: "text-blue-500",
  numeric: "text-blue-500",
  money: "text-blue-500",
  bool: "text-amber-500",
  text: "text-green-600 dark:text-green-400",
  varchar: "text-green-600 dark:text-green-400",
  bpchar: "text-green-600 dark:text-green-400",
  char: "text-green-600 dark:text-green-400",
  name: "text-green-600 dark:text-green-400",
  date: "text-purple-500",
  time: "text-purple-500",
  timetz: "text-purple-500",
  timestamp: "text-purple-500",
  timestamptz: "text-purple-500",
  interval: "text-purple-500",
  uuid: "text-orange-500",
  json: "text-pink-500",
  jsonb: "text-pink-500",
  bytea: "text-red-500",
  inet: "text-cyan-500",
  cidr: "text-cyan-500",
  macaddr: "text-cyan-500",
};

function getTypeColor(dataType: string): string {
  return TYPE_COLORS[dataType] ?? "text-muted-foreground";
}

export function TableViewer({ schema, table }: Props) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [orderBy, setOrderBy] = useState<string | undefined>();
  const [orderDir, setOrderDir] = useState<"ASC" | "DESC">("ASC");
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [columnInfo, setColumnInfo] = useState<ColumnInfo[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savingCell, setSavingCell] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [insertingRow, setInsertingRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, count, pks, cols] = await Promise.all([
        db.getTableData(schema, table, {
          offset: page * pageSize,
          limit: pageSize,
          orderBy,
          orderDir,
        }),
        db.getTableRowCount(schema, table),
        db.getPrimaryKeys(schema, table),
        db.getColumns(schema, table),
      ]);
      setResult(data);
      setTotalRows(count);
      setPrimaryKeys(pks);
      setColumnInfo(cols);
    } finally {
      setIsLoading(false);
    }
  }, [schema, table, page, pageSize, orderBy, orderDir]);

  useEffect(() => {
    setPage(0);
    setOrderBy(undefined);
    setOrderDir("ASC");
    setEditingCell(null);
    setInsertingRow(false);
    setEditError(null);
  }, [schema, table]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const rowVirtualizer = useVirtualizer({
    count: result?.rows.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20,
  });

  // Build a lookup for column metadata
  const colInfoMap = new Map(columnInfo.map((c) => [c.name, c]));

  function getColType(colName: string): string {
    return colInfoMap.get(colName)?.dataType ?? "";
  }

  function handleSort(column: string) {
    if (orderBy === column) {
      setOrderDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    } else {
      setOrderBy(column);
      setOrderDir("ASC");
    }
    setPage(0);
  }

  function startEditing(rowIndex: number, column: string) {
    if (primaryKeys.length === 0) {
      setEditError("Table has no primary key — editing is read-only");
      return;
    }
    const row = result?.rows[rowIndex];
    if (!row) return;
    const currentValue = row[column];
    setEditingCell({
      rowIndex,
      column,
      value: currentValue === null || currentValue === undefined ? "" : String(currentValue),
    });
    setEditError(null);
  }

  async function commitEdit() {
    if (!editingCell || !result) return;
    const row = result.rows[editingCell.rowIndex];
    if (!row) return;

    const pkValues: Record<string, unknown> = {};
    for (const pk of primaryKeys) {
      pkValues[pk] = row[pk];
    }

    const oldValue = row[editingCell.column];
    const oldStr = oldValue === null || oldValue === undefined ? "" : String(oldValue);
    if (editingCell.value === oldStr) {
      setEditingCell(null);
      return;
    }

    setSavingCell(true);
    const res = await db.updateCell({
      schema,
      table,
      column: editingCell.column,
      value: editingCell.value === "" ? null : editingCell.value,
      primaryKeys: pkValues,
    });

    if (res.error) {
      setEditError(res.error);
      setSavingCell(false);
      return;
    }

    setResult((prev) => {
      if (!prev) return prev;
      const newRows = [...prev.rows];
      newRows[editingCell.rowIndex] = {
        ...newRows[editingCell.rowIndex],
        [editingCell.column]: editingCell.value === "" ? null : editingCell.value,
      };
      return { ...prev, rows: newRows };
    });

    setEditingCell(null);
    setSavingCell(false);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditError(null);
  }

  async function handleDeleteRow(rowIndex: number) {
    if (!result || primaryKeys.length === 0) return;
    const row = result.rows[rowIndex];
    const pkValues: Record<string, unknown> = {};
    for (const pk of primaryKeys) {
      pkValues[pk] = row[pk];
    }

    const res = await db.deleteRow({ schema, table, primaryKeys: pkValues });
    if (res.error) {
      setEditError(res.error);
      return;
    }
    await loadData();
    setEditError(null);
  }

  async function handleInsertRow() {
    setSavingRow(true);
    const res = await db.insertRow({ schema, table, values: newRowValues });
    setSavingRow(false);

    if (res.error) {
      setEditError(res.error);
      return;
    }

    setInsertingRow(false);
    setNewRowValues({});
    setEditError(null);
    await loadData();
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    } else if (e.key === "Tab" && editingCell && result) {
      e.preventDefault();
      commitEdit().then(() => {
        const cols = result.columns;
        const currentIdx = cols.indexOf(editingCell.column);
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + cols.length) % cols.length
          : (currentIdx + 1) % cols.length;
        const nextRowIndex = nextIdx === 0 && !e.shiftKey
          ? Math.min(editingCell.rowIndex + 1, result.rows.length - 1)
          : nextIdx === cols.length - 1 && e.shiftKey
          ? Math.max(editingCell.rowIndex - 1, 0)
          : editingCell.rowIndex;
        startEditing(nextRowIndex, cols[nextIdx]);
      });
    }
  }

  const totalPages = Math.ceil(totalRows / pageSize);
  const canEdit = primaryKeys.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {schema}.{table} — {totalRows.toLocaleString()} rows
          </span>
          {!canEdit && (
            <span className="text-muted-foreground/60 italic">
              (no primary key — read-only)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => {
                setInsertingRow(true);
                setNewRowValues({});
                setEditError(null);
              }}
              className="flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-accent transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Row
            </button>
          )}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="rounded border border-input bg-background px-1.5 py-0.5 text-xs"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              {page + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {editError && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate">{editError}</span>
          <button onClick={() => setEditError(null)} className="shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading && !result ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : result?.error ? (
        <div className="p-4 text-sm text-destructive">{result.error}</div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                {canEdit && (
                  <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-8" />
                )}
                <th className="border-b border-r border-border px-2 py-1 text-left font-medium text-muted-foreground w-10">
                  #
                </th>
                {result?.columns.map((col) => {
                  const colType = getColType(col);
                  const isPK = primaryKeys.includes(col);
                  const info = colInfoMap.get(col);
                  const isHovered = hoveredCol === col;

                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      onMouseEnter={() => setHoveredCol(col)}
                      onMouseLeave={() => setHoveredCol(null)}
                      className={`cursor-pointer select-none border-b border-r border-border px-2 py-1 text-left font-medium whitespace-nowrap transition-colors ${
                        isHovered
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            isPK
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-foreground"
                          }
                        >
                          {col}
                        </span>
                        <span
                          className={`text-[10px] font-normal ${getTypeColor(
                            colType
                          )}`}
                        >
                          {colType}
                        </span>
                        {isPK && (
                          <span className="text-[9px] font-normal rounded bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 px-1">
                            PK
                          </span>
                        )}
                        {info?.isForeignKey && (
                          <span className="text-[9px] font-normal rounded bg-blue-500/15 text-blue-500 px-1">
                            FK
                          </span>
                        )}
                        {info?.nullable === false && !isPK && (
                          <span className="text-[9px] font-normal rounded bg-red-500/10 text-red-400 px-1">
                            NN
                          </span>
                        )}
                        {orderBy === col &&
                          (orderDir === "ASC" ? (
                            <ArrowUp className="h-3 w-3 text-foreground" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-foreground" />
                          ))}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Insert row form */}
              {insertingRow && result && (
                <tr className="bg-green-500/5">
                  <td className="border-b border-r border-border px-1 py-1 text-center">
                    <div className="flex gap-0.5 justify-center">
                      <button
                        onClick={handleInsertRow}
                        disabled={savingRow}
                        className="rounded p-0.5 text-green-600 hover:bg-green-500/20"
                        title="Save row"
                      >
                        {savingRow ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => { setInsertingRow(false); setNewRowValues({}); }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="border-b border-r border-border px-2 py-1 text-muted-foreground italic">
                    new
                  </td>
                  {result.columns.map((col) => {
                    const colType = getColType(col);
                    return (
                      <td key={col} className="border-b border-r border-border p-0">
                        <input
                          className="w-full bg-transparent px-2 py-1 text-xs outline-none focus:bg-primary/5"
                          placeholder={`${col} (${colType})`}
                          value={newRowValues[col] ?? ""}
                          onChange={(e) =>
                            setNewRowValues((v) => ({ ...v, [col]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInsertRow();
                            if (e.key === "Escape") { setInsertingRow(false); setNewRowValues({}); }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Data rows */}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <>
                  {rowVirtualizer.getVirtualItems()[0].start > 0 && (
                    <tr>
                      <td
                        style={{
                          height: rowVirtualizer.getVirtualItems()[0].start,
                        }}
                      />
                    </tr>
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = result!.rows[virtualRow.index];
                    const rowNum = page * pageSize + virtualRow.index + 1;
                    return (
                      <tr
                        key={virtualRow.index}
                        className="group hover:bg-accent/50 transition-colors"
                      >
                        {canEdit && (
                          <td className="border-b border-r border-border px-1 py-1 text-center">
                            <button
                              onClick={() => handleDeleteRow(virtualRow.index)}
                              className="rounded p-0.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                              title="Delete row"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        )}
                        <td className="border-b border-r border-border px-2 py-1 text-muted-foreground">
                          {rowNum}
                        </td>
                        {result!.columns.map((col) => {
                          const value = row[col];
                          const isNull = value === null || value === undefined;
                          const isEditing =
                            editingCell?.rowIndex === virtualRow.index &&
                            editingCell?.column === col;
                          const isColHovered = hoveredCol === col;

                          if (isEditing) {
                            return (
                              <td
                                key={col}
                                className="border-b border-r border-border p-0"
                              >
                                <input
                                  ref={editInputRef}
                                  className="w-full bg-primary/5 px-2 py-1 text-xs outline-none ring-1 ring-inset ring-primary"
                                  value={editingCell.value}
                                  onChange={(e) =>
                                    setEditingCell({
                                      ...editingCell,
                                      value: e.target.value,
                                    })
                                  }
                                  onKeyDown={handleEditKeyDown}
                                  onBlur={() => commitEdit()}
                                  disabled={savingCell}
                                />
                              </td>
                            );
                          }

                          return (
                            <td
                              key={col}
                              onDoubleClick={() =>
                                canEdit && startEditing(virtualRow.index, col)
                              }
                              onMouseEnter={() => setHoveredCol(col)}
                              onMouseLeave={() => setHoveredCol(null)}
                              className={`border-b border-r border-border px-2 py-1 whitespace-nowrap transition-colors ${
                                canEdit ? "cursor-text" : ""
                              } ${
                                isColHovered ? "bg-primary/[0.03]" : ""
                              } ${
                                isNull
                                  ? "italic text-muted-foreground/50"
                                  : typeof value === "number"
                                  ? "text-right font-mono"
                                  : typeof value === "boolean"
                                  ? "font-mono"
                                  : ""
                              }`}
                            >
                              {isNull
                                ? "NULL"
                                : typeof value === "boolean"
                                ? value
                                  ? "true"
                                  : "false"
                                : String(value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        style={{
                          height:
                            rowVirtualizer.getTotalSize() -
                            (rowVirtualizer.getVirtualItems()[
                              rowVirtualizer.getVirtualItems().length - 1
                            ].end ?? 0),
                        }}
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
