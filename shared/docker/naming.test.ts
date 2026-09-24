import { describe, expect, it } from "vitest";
import {
  assertManagedContainer,
  containerNameFromDisplay,
  isManagedContainer,
  MANAGED_LABEL,
  MANAGED_LABEL_VALUE,
  slugifyName,
  volumeNameFromContainer,
} from "./naming";

describe("docker naming", () => {
  it("slugifies display names", () => {
    expect(slugifyName("My App DB")).toBe("my-app-db");
    expect(slugifyName("  Postgres!!  ")).toBe("postgres");
    expect(slugifyName("")).toBe("db");
    expect(slugifyName("---")).toBe("db");
  });

  it("prefixes container names with betterdb-", () => {
    expect(containerNameFromDisplay("Local Dev")).toBe("betterdb-local-dev");
    expect(volumeNameFromContainer("betterdb-local-dev")).toBe(
      "betterdb-local-dev-data"
    );
  });

  it("recognizes only managed containers", () => {
    expect(
      isManagedContainer("betterdb-foo", { [MANAGED_LABEL]: MANAGED_LABEL_VALUE })
    ).toBe(true);
    expect(
      isManagedContainer("/betterdb-foo", {
        [MANAGED_LABEL]: MANAGED_LABEL_VALUE,
      })
    ).toBe(true);
    expect(isManagedContainer("betterdb-foo", {})).toBe(false);
    expect(
      isManagedContainer("other-db", { [MANAGED_LABEL]: MANAGED_LABEL_VALUE })
    ).toBe(false);
  });

  it("refuses non-managed containers in assertManagedContainer", () => {
    expect(() =>
      assertManagedContainer("nginx", { [MANAGED_LABEL]: MANAGED_LABEL_VALUE })
    ).toThrow(/not created by BetterDB/);
    expect(() =>
      assertManagedContainer("betterdb-ok", {
        [MANAGED_LABEL]: MANAGED_LABEL_VALUE,
      })
    ).not.toThrow();
  });
});
