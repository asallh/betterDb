import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { QueryTab } from "@/stores/queryStore";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  tab: QueryTab;
}

export function QueryResults({ tab }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { result, isExecuting } = tab;

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
            {result.columns.map((col) => (
              <th
                key={col}
                className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
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
                          }`}
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
