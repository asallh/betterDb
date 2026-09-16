import { describe, expect, it, vi } from "vitest";
import { checkLatestRelease } from "../../electron/updater/checkLatest";
import type { FetchLike } from "../../electron/updater/checkLatest";

const mixedReleases = [
  {
    tag_name: "v0.1.0-beta.2",
    html_url: "https://github.com/asallh/betterDb/releases/tag/v0.1.0-beta.2",
    draft: false,
    prerelease: true,
  },
  {
    tag_name: "v0.1.0-nightly.20250917.bbbbbbb",
    html_url:
      "https://github.com/asallh/betterDb/releases/tag/v0.1.0-nightly.20250917.bbbbbbb",
    draft: false,
    prerelease: true,
  },
];

describe("checkLatestRelease", () => {
  it("returns force when a newer release exists", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          tag_name: "v0.1.0-beta.2",
          html_url:
            "https://github.com/asallh/betterDb/releases/tag/v0.1.0-beta.2",
          draft: false,
          prerelease: true,
        },
      ],
    }));

    const decision = await checkLatestRelease("0.1.0-beta.1", { fetchImpl });
    expect(decision.kind).toBe("force");
    if (decision.kind === "force") {
      expect(decision.remoteVersion).toBe("0.1.0-beta.2");
    }
  });

  it("ignores newer nightlies for non-nightly installs", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mixedReleases,
    }));

    const decision = await checkLatestRelease("0.1.0-beta.2", { fetchImpl });
    expect(decision.kind).toBe("ok");
    if (decision.kind === "ok") {
      expect(decision.remoteVersion).toBe("0.1.0-beta.2");
    }
  });

  it("forces nightly installs only against newer nightlies", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mixedReleases,
    }));

    const decision = await checkLatestRelease(
      "0.1.0-nightly.20250916.aaaaaaa",
      { fetchImpl }
    );
    expect(decision.kind).toBe("force");
    if (decision.kind === "force") {
      expect(decision.remoteVersion).toBe("0.1.0-nightly.20250917.bbbbbbb");
    }
  });

  it("does not force nightly installs when only newer non-nightlies exist", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          tag_name: "v0.2.0",
          html_url: "https://github.com/asallh/betterDb/releases/tag/v0.2.0",
          draft: false,
          prerelease: false,
        },
        {
          tag_name: "v0.1.0-nightly.20250916.aaaaaaa",
          html_url:
            "https://github.com/asallh/betterDb/releases/tag/v0.1.0-nightly.20250916.aaaaaaa",
          draft: false,
          prerelease: true,
        },
      ],
    }));

    const decision = await checkLatestRelease(
      "0.1.0-nightly.20250916.aaaaaaa",
      { fetchImpl }
    );
    expect(decision.kind).toBe("ok");
  });

  it("fail-opens on network error", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const decision = await checkLatestRelease("0.1.0-beta.1", { fetchImpl });
    expect(decision).toMatchObject({
      kind: "error",
      reason: "network",
    });
  });

  it("fail-opens on timeout", async () => {
    const fetchImpl = ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<{
        ok: boolean;
        status: number;
        json: () => Promise<unknown>;
      }>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as FetchLike;

    const decision = await checkLatestRelease("0.1.0-beta.1", {
      fetchImpl,
      timeoutMs: 20,
    });
    expect(decision).toMatchObject({
      kind: "error",
      reason: "timeout",
    });
  });

  it("fail-opens on HTTP error", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));

    const decision = await checkLatestRelease("0.1.0-beta.1", { fetchImpl });
    expect(decision).toMatchObject({
      kind: "error",
      reason: "http",
    });
  });
});
