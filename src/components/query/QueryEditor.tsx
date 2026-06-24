import { useRef, useEffect, useCallback } from "react";
import { useQueryStore } from "@/stores/queryStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL, MSSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";

interface Props {
  tabId: string;
}

export function QueryEditor({ tabId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const updateSQL = useQueryStore((s) => s.updateSQL);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const tab = useQueryStore((s) => s.tabs.find((t) => t.id === tabId));
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const activeEngine =
    connections.find((connection) => connection.id === activeConnectionId)?.engine ??
    "postgres";

  const handleExecute = useCallback(() => {
    executeQuery(tabId);
    return true;
  }, [executeQuery, tabId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: tab?.sql ?? "",
      extensions: [
        basicSetup,
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Enter",
            run: () => {
              handleExecute();
              return true;
            },
          },
        ]),
        sql({ dialect: activeEngine === "sqlserver" ? MSSQL : PostgreSQL }),
        oneDark,
        placeholder("Write your SQL query here... (Cmd+Enter to run)"),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            updateSQL(tabId, update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { padding: "8px 0" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // Only recreate editor when tabId or SQL dialect changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, activeEngine]);

  return <div ref={containerRef} className="h-full w-full" />;
}
