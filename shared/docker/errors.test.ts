import { describe, expect, it } from "vitest";
import { mapDockerError } from "./errors";

describe("mapDockerError", () => {
  it("does not treat readiness timeouts as Docker-not-running", () => {
    const msg =
      "Database container started but did not accept connections on port 5432 in time.";
    const mapped = mapDockerError(new Error(msg));
    expect(mapped.message).toBe(msg);
    expect(mapped.message).not.toMatch(/Docker is not running/);
  });

  it("still maps real socket failures", () => {
    const enoent = Object.assign(new Error("connect ENOENT /var/run/docker.sock"), {
      code: "ENOENT",
    });
    expect(mapDockerError(enoent).message).toMatch(/Docker is not running/);
    expect(
      mapDockerError(
        new Error(
          "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?"
        )
      ).message
    ).toMatch(/Docker is not running/);
  });
});
