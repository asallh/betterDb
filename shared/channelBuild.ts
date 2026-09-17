export type BuildChannel = "nightly" | "prod";

export interface ChannelIdentity {
  packageName: string;
  appId: string;
  productName: string;
  executableName: string;
}

export const CHANNEL_IDENTITIES: Record<BuildChannel, ChannelIdentity> = {
  prod: {
    packageName: "betterdb",
    appId: "com.betterdb.app",
    productName: "BetterDB",
    executableName: "BetterDB",
  },
  nightly: {
    packageName: "betterdb-nightly",
    appId: "com.betterdb.app.nightly",
    productName: "BetterDB Nightly",
    executableName: "BetterDB-Nightly",
  },
};

/** Ephemeral nightly version: `{base}-nightly.{YYYYMMDD}.{shortsha}`. */
export function makeNightlyVersion(
  baseVersion: string,
  dateUtc: string,
  shortSha: string
): string {
  const base = baseVersion.split("-")[0];
  return `${base}-nightly.${dateUtc}.${shortSha}`;
}

/** Patch electron-builder.json5 identity fields for a channel. */
export function patchElectronBuilderConfig(
  source: string,
  identity: ChannelIdentity
): string {
  let text = source.replace(/appId:\s*"[^"]+"/, `appId: "${identity.appId}"`);
  text = text.replace(
    /productName:\s*"[^"]+"/,
    `productName: "${identity.productName}"`
  );
  if (/executableName\s*:/.test(text)) {
    text = text.replace(
      /executableName:\s*"[^"]+"/,
      `executableName: "${identity.executableName}"`
    );
  } else {
    text = text.replace(
      /productName:\s*"[^"]+",/,
      `productName: "${identity.productName}",\n  executableName: "${identity.executableName}",`
    );
  }
  return text;
}

export function builderTargetForPlatform(
  platform: NodeJS.Platform = process.platform
): "mac" | "win" | "linux" {
  if (platform === "darwin") return "mac";
  if (platform === "win32") return "win";
  return "linux";
}

export function isBuildChannel(value: string): value is BuildChannel {
  return value === "nightly" || value === "prod";
}
