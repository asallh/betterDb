import {
  decideUpdateGate,
  pickNewestRelease,
  updateChannelForVersion,
  type GitHubReleaseLike,
  type UpdateGateDecision,
} from "../../shared/version";

export const GITHUB_REPO = "asallh/betterDb";
export const CHECK_TIMEOUT_MS = 5_000;

const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`;

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function isReleaseArray(value: unknown): value is GitHubReleaseLike[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as GitHubReleaseLike).tag_name === "string" &&
        typeof (item as GitHubReleaseLike).html_url === "string" &&
        typeof (item as GitHubReleaseLike).draft === "boolean"
    )
  );
}

/**
 * Fetch newest non-draft GitHub release for this build's update channel and decide gate.
 * Nightly installs only see nightlies; everyone else ignores nightlies.
 * Fail-open on network/timeout/parse errors.
 */
export async function checkLatestRelease(
  localVersion: string,
  options: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  } = {}
): Promise<UpdateGateDecision> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const channel = updateChannelForVersion(localVersion);

  try {
    const response = await fetchImpl(RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "BetterDB-UpdateCheck",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return decideUpdateGate(localVersion, null, {
        reason: "http",
        message: `GitHub releases HTTP ${response.status}`,
      });
    }

    const body = await response.json();
    if (!isReleaseArray(body)) {
      return decideUpdateGate(localVersion, null, {
        reason: "parse",
        message: "Unexpected GitHub releases payload",
      });
    }

    const newest = pickNewestRelease(body, { channel });
    if (!newest) {
      return decideUpdateGate(localVersion, null);
    }

    return decideUpdateGate(localVersion, {
      version: newest.tag_name,
      htmlUrl: newest.html_url,
    });
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      controller.signal.aborted;
    return decideUpdateGate(localVersion, null, {
      reason: aborted ? "timeout" : "network",
      message: err instanceof Error ? err.message : "Update check failed",
    });
  } finally {
    clearTimeout(timer);
  }
}
