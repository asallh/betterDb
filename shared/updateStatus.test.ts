import { describe, expect, it } from "vitest";
import {
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
