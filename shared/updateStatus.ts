import { isNightlyVersion, parseVersion } from "./version";

/** IPC push event for soft update status (main → renderer). */
export const UPDATER_STATUS_EVENT = "updater:status";

/** electron-updater publish channel for this install. */
export type UpdaterPublishChannel = "latest" | "nightly";

export function updaterChannelForVersion(
  version: string
): UpdaterPublishChannel {
  return isNightlyVersion(version) ? "nightly" : "latest";
}

/**
 * Whether electron-updater may treat GitHub prereleases as eligible updates.
 * Stable installs stay on stable-only; alpha/beta/rc/nightly may follow newer
 * prereleases on their channel.
 */
export function allowPrereleaseForVersion(version: string): boolean {
  return parseVersion(version).stage !== "stable";
}

/**
 * Soft in-app update status pushed to the renderer.
 * The app never hard-blocks; errors fail open.
 */
export type AppUpdateStatus =
  | {
      state: "idle";
      localVersion: string;
    }
  | {
      state: "checking";
      localVersion: string;
    }
  | {
      state: "available";
      localVersion: string;
      remoteVersion: string;
    }
  | {
      state: "downloading";
      localVersion: string;
      remoteVersion: string;
      percent: number;
    }
  | {
      state: "ready";
      localVersion: string;
      remoteVersion: string;
    }
  | {
      state: "error";
      localVersion: string;
      message: string;
    };

export function githubReleaseUrl(ownerRepo: string, version: string): string {
  const tag = version.startsWith("v") ? version : `v${version}`;
  return `https://github.com/${ownerRepo}/releases/tag/${tag}`;
}
