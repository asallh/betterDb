import { isMac } from "@/lib/utils";

/**
 * An invisible, full-width draggable strip at the very top of the window.
 * On macOS this gives the native "no visible title bar, but the whole top
 * edge is draggable" feel, and provides clearance for the traffic lights.
 */
export function TitleBar() {
  if (!isMac) return null;
  return <div className="app-drag h-7 w-full shrink-0 bg-background" />;
}
