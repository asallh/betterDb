import { describe, expect, it } from "vitest";
import { isTransientStartupError } from "./startupErrors";

describe("isTransientStartupError", () => {
  it("recognizes postgres startup disconnects", () => {
    expect(
      isTransientStartupError(new Error("Connection terminated unexpectedly"))
    ).toBe(true);
    expect(
      isTransientStartupError(new Error("the database system is starting up"))
    ).toBe(true);
    expect(isTransientStartupError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isTransientStartupError(new Error("syntax error at or near"))).toBe(
      false
    );
  });
});
