/**
 * electron-builder afterSign hook — notarize the signed .app with notarytool.
 * Skips locally when Apple API credentials are absent; fails on CI if missing.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status ?? "null"}`,
    );
  }
  return result;
}

/**
 * @param {import("electron-builder").AfterPackContext} context
 */
exports.default = async function notarizeMacApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  const keyPath = process.env.APPLE_API_KEY_PATH;
  const keyId = process.env.APPLE_API_KEY_ID;
  const issuer = process.env.APPLE_API_ISSUER;

  if (!keyPath || !keyId || !issuer) {
    if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
      throw new Error(
        "Mac notarization credentials missing on CI. Set APPLE_API_KEY_PATH, APPLE_API_KEY_ID, and APPLE_API_ISSUER.",
      );
    }
    console.log(
      "Skipping notarization (APPLE_API_KEY_PATH / APPLE_API_KEY_ID / APPLE_API_ISSUER not set).",
    );
    return;
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error(`APPLE_API_KEY_PATH does not exist: ${keyPath}`);
  }

  const productFilename = packager.appInfo.productFilename;
  let appPath = path.join(appOutDir, `${productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    const apps = fs
      .readdirSync(appOutDir)
      .filter((name) => name.endsWith(".app"));
    if (apps.length !== 1) {
      throw new Error(
        `Could not locate .app in ${appOutDir} (productFilename=${productFilename}, found=${apps.join(",")})`,
      );
    }
    appPath = path.join(appOutDir, apps[0]);
  }

  const zipPath = path.join(
    os.tmpdir(),
    `${path.basename(appPath, ".app")}-notarize.zip`,
  );
  fs.rmSync(zipPath, { force: true });

  console.log(`Zipping ${appPath} for notarization…`);
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath]);

  console.log(`Submitting to notarytool (wait up to 30m)…`);
  const submit = run("xcrun", [
    "notarytool",
    "submit",
    zipPath,
    "--key",
    keyPath,
    "--key-id",
    keyId,
    "--issuer",
    issuer,
    "--wait",
    "--timeout",
    "30m",
    "--output-format",
    "json",
  ]);

  let status = "Unknown";
  try {
    const parsed = JSON.parse(submit.stdout || "{}");
    status = String(parsed.status || status);
  } catch {
    // keep Unknown
  }
  fs.rmSync(zipPath, { force: true });

  if (status !== "Accepted") {
    throw new Error(
      `Notarization finished with status=${status} (expected Accepted)`,
    );
  }

  console.log(`Stapling notarization ticket to ${path.basename(appPath)}…`);
  run("xcrun", ["stapler", "staple", "-v", appPath]);
  console.log(`Notarization complete for ${path.basename(appPath)}`);
};
