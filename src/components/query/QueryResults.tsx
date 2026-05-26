import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { QueryTab } from "@/stores/queryStore";
import { Loader2, AlertCircle } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  int2: "text-blue-500", int4: "text-blue-500", int8: "text-blue-500",
  float4: "text-blue-500", float8: "text-blue-500", numeric: "text-blue-500",
  money: "text-blue-500", bool: "text-amber-500",
  text: "text-green-600 dark:text-green-400",
  varchar: "text-green-600 dark:text-green-400",
  bpchar: "text-green-600 dark:text-green-400",
  char: "text-green-600 dark:text-green-400",
  name: "text-green-600 dark:text-green-400",
  date: "text-purple-500", time: "text-purple-500", timetz: "text-purple-500",
  timestamp: "text-purple-500", timestamptz: "text-purple-500",
  interval: "text-purple-500", uuid: "text-orange-500",
  json: "text-pink-500", jsonb: "text-pink-500",
  bytea: "text-red-500", inet: "text-cyan-500", cidr: "text-cyan-500",
  macaddr: "text-cyan-500",
};

function getTypeColor(dataType: string): string {
  return TYPE_COLORS[dataType] ?? "text-muted-foreground";
}

interface Props {
  tab: QueryTab;
}

export function QueryResults({ tab }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { result, isExecuting } = tab;
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  // Build a map of column name -> data type from columnTypes
  const typeMap = new Map(
    result?.columnTypes?.map((ct) => [ct.name, ct.dataType]) ?? []
  );

  const rowVirtualizer = useVirtualizer({
    count: result?.rows.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20,
  });

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
        <span className="text-sm">
          Run a query to see results (Cmd+Enter)
        </span>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex h-full items-start p-4">
        <div className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <pre className="whitespace-pre-wrap font-mono text-xs">
            {result.error}
          </pre>
        </div>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">
          Query executed successfully. {result.rowCount} rows affected.
          ({result.durationMs}ms)
        </span>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            <th className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground w-10">
              #
            </th>
            {result.columns.map((col) => {
              const dataType = typeMap.get(col);
              return (
                <th
                  key={col}
                  className={`border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap cursor-default select-none ${
                    hoveredCol === col ? "bg-accent" : ""
                  }`}
                  onMouseEnter={() => setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col}</span>
                    {dataType && (
                      <span
                        className={`text-[10px] font-normal opacity-75 ${getTypeColor(dataType)}`}
                      >
                        {dataType}
                      </span>
                    )}
                  </div>
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
                  <td
                    style={{
                      height: rowVirtualizer.getVirtualItems()[0].start,
                    }}
                  />
                </tr>
              )}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = result.rows[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.index}
                    className="hover:bg-accent/50 transition-colors"
                  >
                    <td className="border-b border-r border-border px-2 py-1 text-muted-foreground">
                      {virtualRow.index + 1}
                    </td>
                    {result.columns.map((col) => {
                      const value = row[col];
                      const isNull = value === null || value === undefined;
                      return (
                        <td
                          key={col}
                          className={`border-b border-r border-border px-2 py-1 whitespace-nowrap ${
                            isNull
                              ? "italic text-muted-foreground/50"
                              : typeof value === "number"
                              ? "text-right font-mono"
                              : ""
                          } ${hoveredCol === col ? "bg-primary/[0.03]" : ""}`}
                          onMouseEnter={() => setHoveredCol(col)}
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          {isNull ? "NULL" : String(value)}
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
  );
}
