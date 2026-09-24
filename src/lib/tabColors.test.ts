import { describe, expect, it } from "vitest";
import { TAB_COLORS, tabColorHex } from "./tabColors";

describe("tabColors", () => {
  it("resolves known color ids to hex", () => {
    expect(tabColorHex("teal")).toBe("#0d9488");
    expect(tabColorHex(TAB_COLORS[0].id)).toBe(TAB_COLORS[0].hex);
  });

  it("returns null for missing colors", () => {
    expect(tabColorHex(null)).toBeNull();
    expect(tabColorHex(undefined)).toBeNull();
  });
});
