import { describe, expect, it } from "vitest";
import {
  compareVersions,
  appDisplayNameForVersion,
  isNightlyVersion,
  isVersionBehind,
  normalizeVersion,
  parseSemVer,
  parseVersion,
  pickNewestRelease,
  resolveVersionInfo,
  updateChannelForVersion,
} from "./version";

describe("normalizeVersion", () => {
  it("strips leading v and whitespace", () => {
    expect(normalizeVersion(" v1.2.3 ")).toBe("1.2.3");
    expect(normalizeVersion("V0.1.0-beta.1")).toBe("0.1.0-beta.1");
  });
});

describe("parseSemVer", () => {
  it("parses core and prerelease", () => {
    expect(parseSemVer("0.1.0-beta.1")).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      prerelease: ["beta", 1],
    });
  });

  it("returns null for invalid versions", () => {
    expect(parseSemVer("not-a-version")).toBeNull();
  });
});

describe("parseVersion / resolveVersionInfo", () => {
  it("maps prerelease ids to stages", () => {
    expect(parseVersion("0.1.0-nightly.20250916.abc1234").stage).toBe("nightly");
    expect(parseVersion("0.1.0-beta.1").stage).toBe("beta");
    expect(parseVersion("1.0.0").stage).toBe("stable");
  });

  it("forces Dev when channel is dev", () => {
    expect(resolveVersionInfo("0.1.0-beta.1", "dev")).toEqual({
      version: "0.1.0-beta.1",
      stage: "dev",
      label: "Dev",
    });
  });

  it("falls back to parseVersion for auto channel", () => {
    expect(resolveVersionInfo("0.1.0-rc.1", "auto").stage).toBe("rc");
    expect(resolveVersionInfo("0.1.0-rc.1").label).toBe("RC");
  });
});

describe("isNightlyVersion / updateChannelForVersion", () => {
  it("detects nightly prerelease ids", () => {
    expect(isNightlyVersion("0.1.0-nightly.1")).toBe(true);
    expect(isNightlyVersion("v0.1.0-nightly.20250916.deadbee")).toBe(true);
    expect(isNightlyVersion("0.1.0-beta.1")).toBe(false);
    expect(isNightlyVersion("1.0.0")).toBe(false);
  });

  it("maps versions onto update channels", () => {
    expect(updateChannelForVersion("0.1.0-nightly.1")).toBe("nightly");
    expect(updateChannelForVersion("0.1.0-beta.1")).toBe("default");
  });
});

describe("appDisplayNameForVersion", () => {
  it("names nightlies distinctly for side-by-side installs", () => {
    expect(appDisplayNameForVersion("0.1.0-nightly.20250916.abc1234")).toBe(
      "BetterDB Nightly",
    );
    expect(appDisplayNameForVersion("0.1.0-beta.1")).toBe("BetterDB");
    expect(appDisplayNameForVersion("1.0.0")).toBe("BetterDB");
  });
});

describe("compareVersions", () => {
  it("compares core versions", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("treats prerelease as behind the same stable", () => {
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
  });

  it("orders prerelease identifiers", () => {
    expect(compareVersions("0.1.0-beta.1", "0.1.0-beta.2")).toBeLessThan(0);
    expect(compareVersions("0.1.0-alpha.1", "0.1.0-beta.1")).toBeLessThan(0);
    expect(compareVersions("0.1.0-beta.1", "0.1.0-rc.1")).toBeLessThan(0);
  });

  it("handles leading v", () => {
    expect(compareVersions("v0.1.0-beta.1", "0.1.0-beta.2")).toBeLessThan(0);
  });
});

describe("isVersionBehind", () => {
  it("is true only when local is older", () => {
    expect(isVersionBehind("0.1.0-beta.1", "0.1.0-beta.2")).toBe(true);
    expect(isVersionBehind("0.1.0-beta.2", "0.1.0-beta.1")).toBe(false);
    expect(isVersionBehind("0.1.0-beta.1", "0.1.0-beta.1")).toBe(false);
  });
});

describe("pickNewestRelease", () => {
  const releases = [
    {
      tag_name: "v0.1.0-beta.1",
      html_url: "https://example.com/b1",
      draft: false,
      prerelease: true,
    },
    {
      tag_name: "v0.1.0-beta.2",
      html_url: "https://example.com/b2",
      draft: false,
      prerelease: true,
    },
    {
      tag_name: "v0.1.0-nightly.20250916.aaa1111",
      html_url: "https://example.com/n1",
      draft: false,
      prerelease: true,
    },
    {
      tag_name: "v0.1.0-nightly.20250917.bbb2222",
      html_url: "https://example.com/n2",
      draft: false,
      prerelease: true,
    },
    {
      tag_name: "v9.9.9",
      html_url: "https://example.com/draft",
      draft: true,
      prerelease: false,
    },
  ];

  it("ignores drafts and picks highest semver including prereleases (default channel)", () => {
    const newest = pickNewestRelease(releases);
    expect(newest?.tag_name).toBe("v0.1.0-beta.2");
    expect(newest?.html_url).toBe("https://example.com/b2");
  });

  it("excludes nightlies on the default channel", () => {
    const newest = pickNewestRelease(releases, { channel: "default" });
    expect(newest?.tag_name).toBe("v0.1.0-beta.2");
  });

  it("only considers nightlies on the nightly channel", () => {
    const newest = pickNewestRelease(releases, { channel: "nightly" });
    expect(newest?.tag_name).toBe("v0.1.0-nightly.20250917.bbb2222");
    expect(newest?.html_url).toBe("https://example.com/n2");
  });

  it("returns null when empty", () => {
    expect(pickNewestRelease([])).toBeNull();
  });

  it("returns null when channel has no candidates", () => {
    expect(
      pickNewestRelease(
        [
          {
            tag_name: "v0.1.0-beta.1",
            html_url: "https://example.com/b1",
            draft: false,
            prerelease: true,
          },
        ],
        { channel: "nightly" }
      )
    ).toBeNull();
  });
});
