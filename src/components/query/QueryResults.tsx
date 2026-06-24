import { useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { QueryTab } from "@/stores/queryStore";
import { db } from "@/lib/ipc";
import { CellExpandModal } from "@/components/shared/CellExpandModal";
import { Loader2, AlertCircle, Download, Maximize2 } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  int2: "text-blue-500", int4: "text-blue-500", int8: "text-blue-500",
  smallint: "text-blue-500", int: "text-blue-500", bigint: "text-blue-500",
  tinyint: "text-blue-500",
  float4: "text-blue-500", float8: "text-blue-500", numeric: "text-blue-500",
  real: "text-blue-500", float: "text-blue-500", decimal: "text-blue-500",
  money: "text-blue-500", bool: "text-amber-500",
  bit: "text-amber-500",
  text: "text-green-600 dark:text-green-400",
  varchar: "text-green-600 dark:text-green-400",
  nvarchar: "text-green-600 dark:text-green-400",
  bpchar: "text-green-600 dark:text-green-400",
  char: "text-green-600 dark:text-green-400",
  nchar: "text-green-600 dark:text-green-400",
  name: "text-green-600 dark:text-green-400",
  date: "text-purple-500", time: "text-purple-500", timetz: "text-purple-500",
  timestamp: "text-purple-500", timestamptz: "text-purple-500",
  datetime: "text-purple-500", datetime2: "text-purple-500",
  datetimeoffset: "text-purple-500", smalldatetime: "text-purple-500",
  interval: "text-purple-500", uuid: "text-orange-500",
  uniqueidentifier: "text-orange-500",
  json: "text-pink-500", jsonb: "text-pink-500",
  bytea: "text-red-500", binary: "text-red-500", varbinary: "text-red-500",
  image: "text-red-500", inet: "text-cyan-500", cidr: "text-cyan-500",
  macaddr: "text-cyan-500",
};

function getTypeColor(dataType: string): string {
  const normalized = dataType.toLowerCase().replace(/\(.*/, "");
  return TYPE_COLORS[normalized] ?? "text-muted-foreground";
}

const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 60;

interface Props {
  tab: QueryTab;
}

interface ExpandedCell {
  value: string;
  column: string;
  dataType?: string;
}

export function QueryResults({ tab }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { result, isExecuting } = tab;
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [expandedCell, setExpandedCell] = useState<ExpandedCell | null>(null);
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  const typeMap = new Map(
    result?.columnTypes?.map((ct) => [ct.name, ct.dataType]) ?? []
  );

  const rowVirtualizer = useVirtualizer({
    count: result?.rows.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20,
  });

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, col: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = colWidths[col] ?? DEFAULT_COL_WIDTH;
      resizingRef.current = { col, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const diff = ev.clientX - resizingRef.current.startX;
        const newWidth = Math.max(MIN_COL_WIDTH, resizingRef.current.startWidth + diff);
        setColWidths((prev) => ({ ...prev, [resizingRef.current!.col]: newWidth }));
      };

      const onMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [colWidths]
  );

  if (isExecuting) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Executing query...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">Run a query to see results (Cmd+Enter)</span>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex h-full items-start p-4">
        <div className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <pre className="whitespace-pre-wrap font-mono text-xs">{result.error}</pre>
        </div>
      </div>
    );
  }

  function handleExport(format: "csv" | "json") {
    if (!result || result.rows.length === 0) return;
    db.exportData({
      format,
      columns: result.columns,
      rows: result.rows,
      suggestedName: "query-results",
    });
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">
          Query executed successfully. {result.rowCount} rows affected. ({result.durationMs}ms)
        </span>
      </div>
    );
  }

  function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    return String(value);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Results toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1 text-xs shrink-0">
        <span className="text-muted-foreground">
          {result.rowCount} rows — {result.durationMs}ms
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Export as CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Export as JSON"
          >
            <Download className="h-3 w-3" />
            JSON
          </button>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="text-xs" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 40 }} />
            {result.columns.map((col) => (
              <col key={col} style={{ width: colWidths[col] ?? DEFAULT_COL_WIDTH }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground">
                #
              </th>
              {result.columns.map((col) => {
                const dataType = typeMap.get(col);
                return (
                  <th
                    key={col}
                    className={`relative border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground select-none ${
                      hoveredCol === col ? "bg-accent" : ""
                    }`}
                    onMouseEnter={() => setHoveredCol(col)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="truncate">{col}</span>
                      {dataType && (
                        <span className={`text-[10px] font-normal opacity-75 shrink-0 ${getTypeColor(dataType)}`}>
                          {dataType}
                        </span>
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col)}
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <>
                {rowVirtualizer.getVirtualItems()[0].start > 0 && (
                  <tr>
                    <td style={{ height: rowVirtualizer.getVirtualItems()[0].start }} />
                  </tr>
                )}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = result.rows[virtualRow.index];
                  return (
                    <tr key={virtualRow.index} className="hover:bg-accent/50 transition-colors group">
                      <td className="border-b border-r border-border px-2 py-1 text-muted-foreground">
                        {virtualRow.index + 1}
                      </td>
                      {result.columns.map((col) => {
                        const value = row[col];
                        const isNull = value === null || value === undefined;
                        const strValue = formatCellValue(value);
                        const isLong = strValue.length > 50;
                        return (
                          <td
                            key={col}
                            className={`border-b border-r border-border px-2 py-1 overflow-hidden text-ellipsis whitespace-nowrap ${
                              isNull
                                ? "italic text-muted-foreground/50"
                                : typeof value === "number"
                                ? "text-right font-mono"
                                : ""
                            } ${hoveredCol === col ? "bg-primary/[0.03]" : ""}`}
                            onMouseEnter={() => setHoveredCol(col)}
                            onMouseLeave={() => setHoveredCol(null)}
                            title={isLong ? strValue : undefined}
                          >
                            <div className="flex items-center gap-1">
                              <span className="truncate flex-1">{strValue}</span>
                              {isLong && (
                                <button
                                  onClick={() =>
                                    setExpandedCell({
                                      value: strValue,
                                      column: col,
                                      dataType: typeMap.get(col),
                                    })
                                  }
                                  className="shrink-0 rounded p-0.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground transition-all"
                                >
                                  <Maximize2 className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
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

      {/* Cell expand modal */}
      {expandedCell && (
        <CellExpandModal
          value={expandedCell.value}
          column={expandedCell.column}
          dataType={expandedCell.dataType}
          onClose={() => setExpandedCell(null)}
        />
      )}
    </div>
  );
}
