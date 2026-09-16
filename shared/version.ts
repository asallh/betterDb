export type ReleaseStage =
  | "dev"
  | "nightly"
  | "alpha"
  | "beta"
  | "rc"
  | "stable";

export type AppChannel = "dev" | "auto";

export type UpdateChannel = "nightly" | "default";

export interface VersionInfo {
  version: string;
  stage: ReleaseStage;
  label: string;
}

const STAGE_LABELS: Record<ReleaseStage, string> = {
  dev: "Dev",
  nightly: "Nightly",
  alpha: "Alpha",
  beta: "Beta",
  rc: "RC",
  stable: "Release",
};

export function parseVersion(version: string): VersionInfo {
  const prerelease = version.split("-")[1]?.split(".")[0];
  const stage: ReleaseStage =
    prerelease === "nightly"
      ? "nightly"
      : prerelease === "alpha"
        ? "alpha"
        : prerelease === "beta"
          ? "beta"
          : prerelease === "rc"
            ? "rc"
            : "stable";

  return {
    version,
    stage,
    label: STAGE_LABELS[stage],
  };
}

/** Resolve UI stage: local serve forces Dev; otherwise derive from version string. */
export function resolveVersionInfo(
  version: string,
  channel: AppChannel = "auto"
): VersionInfo {
  if (channel === "dev") {
    return {
      version,
      stage: "dev",
      label: STAGE_LABELS.dev,
    };
  }
  return parseVersion(version);
}

export function isNightlyVersion(version: string): boolean {
  return parseVersion(version).stage === "nightly";
}

export function updateChannelForVersion(version: string): UpdateChannel {
  return isNightlyVersion(version) ? "nightly" : "default";
}

/** Strip leading `v` / whitespace for comparison. */
export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export interface SemVerParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
}

export function parseSemVer(version: string): SemVerParts | null {
  const normalized = normalizeVersion(version);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(
    normalized
  );
  if (!match) return null;

  const prerelease = match[4]
    ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

function comparePrereleaseIds(a: string | number, b: string | number): number {
  const aNum = typeof a === "number";
  const bNum = typeof b === "number";
  if (aNum && bNum) return (a as number) - (b as number);
  if (aNum) return -1;
  if (bNum) return 1;
  return String(a).localeCompare(String(b));
}

/**
 * SemVer precedence compare.
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareVersions(a: string, b: string): number {
  const left = parseSemVer(a);
  const right = parseSemVer(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;

  const leftPre = left.prerelease;
  const rightPre = right.prerelease;
  if (leftPre.length === 0 && rightPre.length === 0) return 0;
  if (leftPre.length === 0) return 1;
  if (rightPre.length === 0) return -1;

  const len = Math.max(leftPre.length, rightPre.length);
  for (let i = 0; i < len; i++) {
    if (i >= leftPre.length) return -1;
    if (i >= rightPre.length) return 1;
    const cmp = comparePrereleaseIds(leftPre[i], rightPre[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export function isVersionBehind(local: string, remote: string): boolean {
  return compareVersions(local, remote) < 0;
}

export interface GitHubReleaseLike {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string | null;
}

/**
 * Newest non-draft release by SemVer (includes prereleases).
 * Channel filter keeps nightlies and non-nightlies on separate update tracks.
 */
export function pickNewestRelease(
  releases: GitHubReleaseLike[],
  options: { channel?: UpdateChannel } = {}
): GitHubReleaseLike | null {
  const channel = options.channel ?? "default";
  const candidates = releases.filter((r) => {
    if (r.draft || !r.tag_name) return false;
    const nightly = isNightlyVersion(r.tag_name);
    return channel === "nightly" ? nightly : !nightly;
  });
  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) =>
    compareVersions(current.tag_name, best.tag_name) > 0 ? current : best
  );
}

export type UpdateGateErrorReason =
  | "network"
  | "timeout"
  | "parse"
  | "empty"
  | "http";

export type UpdateGateDecision =
  | {
      kind: "ok";
      localVersion: string;
      remoteVersion: string;
      releaseUrl: string;
    }
  | {
      kind: "force";
      localVersion: string;
      remoteVersion: string;
      releaseUrl: string;
    }
  | {
      kind: "error";
      localVersion: string;
      reason: UpdateGateErrorReason;
      message: string;
    };

export function decideUpdateGate(
  localVersion: string,
  remote: { version: string; htmlUrl: string } | null,
  error?: { reason: UpdateGateErrorReason; message: string }
): UpdateGateDecision {
  if (error) {
    return {
      kind: "error",
      localVersion,
      reason: error.reason,
      message: error.message,
    };
  }

  if (!remote) {
    return {
      kind: "error",
      localVersion,
      reason: "empty",
      message: "No GitHub releases found",
    };
  }

  if (isVersionBehind(localVersion, remote.version)) {
    return {
      kind: "force",
      localVersion,
      remoteVersion: normalizeVersion(remote.version),
      releaseUrl: remote.htmlUrl,
    };
  }

  return {
    kind: "ok",
    localVersion,
    remoteVersion: normalizeVersion(remote.version),
    releaseUrl: remote.htmlUrl,
  };
}

/** Fail-open: only `force` blocks the main app. */
export function shouldBlockApp(decision: UpdateGateDecision): boolean {
  return decision.kind === "force";
}
