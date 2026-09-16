import type { ReleaseStage } from "../../shared/version";

/** Apply release-stage ambient theme via `data-stage` on `<html>`. */
export function applyStageTheme(stage: ReleaseStage): void {
  document.documentElement.dataset.stage = stage;
}
