import { useEffect, useState } from "react";
import { useSchemaStore } from "@/stores/schemaStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTableViewStore } from "@/stores/tableViewStore";
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Eye,
  Columns3,
  Key,
  Loader2,
} from "lucide-react";
import { SchemaContextMenu, type ContextTarget } from "./SchemaContextMenu";

export function SchemaTree() {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const {
    schemas,
    tables,
    columns,
    expandedNodes,
    isLoading,
    loadSchemas,
    loadTables,
    loadColumns,
    toggleNode,
  } = useSchemaStore();
  const openTable = useTableViewStore((s) => s.openTable);
  const [contextMenu, setContextMenu] = useState<{
    target: ContextTarget;
    position: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (activeConnectionId) {
      loadSchemas();
    }
  }, [activeConnectionId, loadSchemas]);

  async function handleSchemaToggle(schema: string) {
    toggleNode(schema);
    if (!expandedNodes.has(schema)) {
      await loadTables(schema);
    }
  }

  async function handleTableToggle(schema: string, table: string) {
    const key = `${schema}.${table}`;
    toggleNode(key);
    if (!expandedNodes.has(key)) {
      await loadColumns(schema, table);
    }
  }

  function handleContextMenu(e: React.MouseEvent, target: ContextTarget) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ target, position: { x: e.clientX, y: e.clientY } });
  }

  if (isLoading && schemas.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (schemas.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No schemas found
      </div>
    );
  }

  return (
    <div className="text-xs">
      {schemas.map((schema) => {
        const isSchemaExpanded = expandedNodes.has(schema);
        const schemaTables = tables.filter((t) => t.schema === schema);

        return (
          <div key={schema}>
            <button
              onClick={() => handleSchemaToggle(schema)}
              onContextMenu={(e) =>
                handleContextMenu(e, { type: "schema", schema })
              }
              className="flex w-full items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
            >
              {isSchemaExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )}
              <span className="font-medium">{schema}</span>
              {schemaTables.length > 0 && (
                <span className="ml-auto text-muted-foreground">
                  {schemaTables.length}
                </span>
              )}
            </button>

            {isSchemaExpanded &&
              schemaTables.map((table) => {
                const tableKey = `${schema}.${table.name}`;
                const isTableExpanded = expandedNodes.has(tableKey);
                const tableCols = columns[tableKey];

                return (
                  <div key={tableKey} className="ml-3">
                    <button
                      onClick={() => handleTableToggle(schema, table.name)}
                      onDoubleClick={() => openTable(schema, table.name)}
                      onContextMenu={(e) =>
                        handleContextMenu(e, {
                          type: "table",
                          schema,
                          table: table.name,
                          tableType: table.type,
                        })
                      }
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
                    >
                      {isTableExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      {table.type === "view" ? (
                        <Eye className="h-3 w-3 shrink-0 text-blue-500" />
                      ) : (
                        <Table2 className="h-3 w-3 shrink-0 text-orange-500" />
                      )}
                      <span className="truncate">{table.name}</span>
                    </button>

                    {isTableExpanded && tableCols && (
                      <div className="ml-5">
                        {tableCols.map((col) => (
                          <div
                            key={col.name}
                            onContextMenu={(e) =>
                              handleContextMenu(e, {
                                type: "column",
                                schema,
                                table: table.name,
                                column: col,
                              })
                            }
                            className="flex items-center gap-1 px-1 py-0.5 text-muted-foreground cursor-default"
                          >
                            {col.isPrimaryKey ? (
                              <Key className="h-3 w-3 shrink-0 text-yellow-500" />
                            ) : (
                              <Columns3 className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">{col.name}</span>
                            <span className="ml-auto shrink-0 text-[10px] opacity-60">
                              {col.dataType}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}

      {contextMenu && (
        <SchemaContextMenu
          target={contextMenu.target}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
