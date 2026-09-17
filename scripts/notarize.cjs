/**
 * electron-builder afterSign hook — notarize the signed .app with notarytool.
 * Skips locally when Apple API credentials are absent; fails on CI if missing.
 */
const fs = require("node:fs");
const path = require("node:path");

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

  console.log(`Notarizing ${appPath}…`);
  const { notarize } = require("@electron/notarize");
  await notarize({
    tool: "notarytool",
    appPath,
    appleApiKey: keyPath,
    appleApiKeyId: keyId,
    appleApiIssuer: issuer,
  });
  console.log(`Notarization complete for ${path.basename(appPath)}`);
};
