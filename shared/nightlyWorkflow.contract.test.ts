import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nightlyWorkflow = fs.readFileSync(
  path.join(repoRoot, ".github/workflows/nightly.yml"),
  "utf8"
);

describe("Nightly workflow OTA contract", () => {
  it("stages and uploads electron-updater feeds for silent nightly updates", () => {
    expect(nightlyWorkflow).toMatch(/include_ota:\s*"true"/);
    expect(nightlyWorkflow).not.toMatch(/include_ota:\s*"false"/);
    expect(nightlyWorkflow).toContain("Collect installers and update metadata");
    expect(nightlyWorkflow).toMatch(/yml_count/);
  });

  it("keeps the Mac zip target so electron-updater has an OTA payload", () => {
    // Regression: previously Nightly rewrote mac targets to dmg-only, which
    // left packaged nightlies failing update checks (missing nightly-mac.yml).
    expect(nightlyWorkflow).not.toMatch(
      /target:\s*\["dmg"\]/
    );
    expect(nightlyWorkflow).toMatch(/channel:\s*"nightly"/);
  });

  it("supports workflow_dispatch force rebuild for broken OTA publishes", () => {
    expect(nightlyWorkflow).toMatch(/inputs:\s*\n\s*force:/);
    expect(nightlyWorkflow).toMatch(/FORCE:\s*\$\{\{\s*github\.event_name == 'workflow_dispatch' && inputs\.force == true\s*\}\}/);
  });
});