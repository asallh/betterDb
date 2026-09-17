import { describe, expect, it } from "vitest";
import {
  builderTargetForPlatform,
  CHANNEL_IDENTITIES,
  isBuildChannel,
  makeNightlyVersion,
  patchElectronBuilderConfig,
} from "./channelBuild";

describe("makeNightlyVersion", () => {
  it("builds ephemeral nightly versions from the stable base", () => {
    expect(makeNightlyVersion("0.1.0", "20260916", "1d41844")).toBe(
      "0.1.0-nightly.20260916.1d41844",
    );
    expect(makeNightlyVersion("0.1.0-beta.1", "20260916", "abc1234")).toBe(
      "0.1.0-nightly.20260916.abc1234",
    );
  });
});

describe("patchElectronBuilderConfig", () => {
  const sample = `{
  appId: "com.betterdb.app",
  productName: "BetterDB",
  directories: {
    output: "release/\${version}",
  },
}`;

  it("applies nightly identity and inserts executableName", () => {
    const patched = patchElectronBuilderConfig(
      sample,
      CHANNEL_IDENTITIES.nightly,
      { updateChannel: "nightly" },
    );
    expect(patched).toContain('appId: "com.betterdb.app.nightly"');
    expect(patched).toContain('productName: "BetterDB Nightly"');
    expect(patched).toContain('executableName: "BetterDB-Nightly"');
  });

  it("sets the nightly publish channel when provided", () => {
    const withPublish = `${sample.slice(0, -1)},
  publish: {
    provider: "github",
    owner: "asallh",
    repo: "betterDb",
  },
}`;
    const patched = patchElectronBuilderConfig(
      withPublish,
      CHANNEL_IDENTITIES.nightly,
      { updateChannel: "nightly" },
    );
    expect(patched).toContain('channel: "nightly"');
  });

  it("updates an existing executableName", () => {
    const withExe = sample.replace(
      'productName: "BetterDB",',
      'productName: "BetterDB",\n  executableName: "BetterDB",',
    );
    const patched = patchElectronBuilderConfig(
      withExe,
      CHANNEL_IDENTITIES.nightly,
    );
    expect(patched).toContain('executableName: "BetterDB-Nightly"');
    expect(patched.match(/executableName:/g)).toHaveLength(1);
  });
});

describe("builderTargetForPlatform / isBuildChannel", () => {
  it("maps node platforms to electron-builder targets", () => {
    expect(builderTargetForPlatform("darwin")).toBe("mac");
    expect(builderTargetForPlatform("win32")).toBe("win");
    expect(builderTargetForPlatform("linux")).toBe("linux");
  });

  it("validates channel names", () => {
    expect(isBuildChannel("nightly")).toBe(true);
    expect(isBuildChannel("prod")).toBe(true);
    expect(isBuildChannel("dev")).toBe(false);
  });
});
