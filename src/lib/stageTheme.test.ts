import { afterEach, describe, expect, it } from "vitest";
import { applyStageTheme } from "./stageTheme";

describe("applyStageTheme", () => {
  afterEach(() => {
    delete document.documentElement.dataset.stage;
  });

  it("sets data-stage on the document element", () => {
    applyStageTheme("dev");
    expect(document.documentElement.dataset.stage).toBe("dev");
  });

  it("overwrites a previous stage", () => {
    applyStageTheme("dev");
    applyStageTheme("nightly");
    expect(document.documentElement.dataset.stage).toBe("nightly");
  });

  it("supports stable / prod glow default stage", () => {
    applyStageTheme("stable");
    expect(document.documentElement.dataset.stage).toBe("stable");
  });
});
