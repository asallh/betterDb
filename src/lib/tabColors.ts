/** Preset tab accent colors for organizing the workspace. */
export const TAB_COLORS = [
  { id: "rose", label: "Rose", hex: "#e11d48" },
  { id: "orange", label: "Orange", hex: "#ea580c" },
  { id: "amber", label: "Amber", hex: "#d97706" },
  { id: "lime", label: "Lime", hex: "#65a30d" },
  { id: "teal", label: "Teal", hex: "#0d9488" },
  { id: "sky", label: "Sky", hex: "#0284c7" },
  { id: "violet", label: "Violet", hex: "#7c3aed" },
  { id: "fuchsia", label: "Fuchsia", hex: "#c026d3" },
] as const;

export type TabColorId = (typeof TAB_COLORS)[number]["id"];

export function tabColorHex(color: TabColorId | null | undefined): string | null {
  if (!color) return null;
  return TAB_COLORS.find((c) => c.id === color)?.hex ?? null;
}
