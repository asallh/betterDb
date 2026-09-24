import { describe, expect, it } from "vitest";
import {
  allowPrereleaseForVersion,
  githubReleaseUrl,
  updaterChannelForVersion,
} from "./updateStatus";

describe("updaterChannelForVersion", () => {
  it("maps nightly versions to the nightly channel", () => {
    expect(updaterChannelForVersion("0.1.0-nightly.20260917.abc1234")).toBe(
      "nightly"
    );
  });

  it("maps non-nightly versions to latest", () => {
    expect(updaterChannelForVersion("0.1.0")).toBe("latest");
    expect(updaterChannelForVersion("0.1.0-beta.2")).toBe("latest");
  });
});

describe("allowPrereleaseForVersion", () => {
  it("disallows prereleases for stable installs", () => {
    expect(allowPrereleaseForVersion("0.2.0")).toBe(false);
    expect(allowPrereleaseForVersion("1.0.0")).toBe(false);
  });

  it("allows prereleases for alpha/beta/rc/nightly installs", () => {
    expect(allowPrereleaseForVersion("0.2.0-alpha.1")).toBe(true);
    expect(allowPrereleaseForVersion("0.2.0-beta.2")).toBe(true);
    expect(allowPrereleaseForVersion("0.2.0-rc.1")).toBe(true);
    expect(
      allowPrereleaseForVersion("0.2.0-nightly.20260917.abc1234")
    ).toBe(true);
  });
});

describe("githubReleaseUrl", () => {
  it("builds a tag URL and accepts versions with or without v", () => {
    expect(githubReleaseUrl("asallh/betterDb", "0.1.0-beta.2")).toBe(
      "https://github.com/asallh/betterDb/releases/tag/v0.1.0-beta.2"
    );
    expect(githubReleaseUrl("asallh/betterDb", "v0.1.0")).toBe(
      "https://github.com/asallh/betterDb/releases/tag/v0.1.0"
    );
  });
});
