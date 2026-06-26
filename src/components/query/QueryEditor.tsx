import { useRef, useEffect, useCallback } from "react";
import { useQueryStore } from "@/stores/queryStore";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { useIsDark } from "@/hooks/useIsDark";

interface Props {
  tabId: string;
}

// CodeMirror ships a light theme by default via basicSetup, so light mode only
// needs the dark theme removed.
function themeExtension(isDark: boolean): Extension {
  return isDark ? oneDark : [];
}

export function QueryEditor({ tabId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const updateSQL = useQueryStore((s) => s.updateSQL);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const tab = useQueryStore((s) => s.tabs.find((t) => t.id === tabId));
  const isDark = useIsDark();

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
        sql({ dialect: PostgreSQL }),
        themeCompartment.current.of(themeExtension(isDark)),
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
    // Only recreate editor when tabId changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  // Swap the editor theme in place when the system color scheme changes.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.current.reconfigure(themeExtension(isDark)),
    });
  }, [isDark]);

  return <div ref={containerRef} className="h-full w-full" />;
}
