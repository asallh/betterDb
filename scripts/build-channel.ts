#!/usr/bin/env node
/**
 * Local channel packaging: `npm run build:nightly` / `npm run build:prod`
 *
 * Applies channel identity + icons + (for nightly) an ephemeral version,
 * builds an installer for the current platform, then restores mutated files.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHANNEL_IDENTITIES,
  builderTargetForPlatform,
  isBuildChannel,
  makeNightlyVersion,
  patchElectronBuilderConfig,
  type BuildChannel,
} from "../shared/channelBuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ICON_FILES = [
  "build/betterDB.png",
  "build/betterDB.icns",
  "build/betterDB.ico",
] as const;

const MUTABLE_TEXT_FILES = ["package.json", "electron-builder.json5"] as const;

function read(rel: string): Buffer {
  return fs.readFileSync(path.join(ROOT, rel));
}

function write(rel: string, contents: string | Buffer): void {
  fs.writeFileSync(path.join(ROOT, rel), contents);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status ?? "null"}`,
    );
  }
}

function gitShortSha(): string {
  const result = spawnSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("Unable to resolve git short SHA for nightly version");
  }
  return result.stdout.trim();
}

function utcDateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function parseArgs(argv: string[]): {
  channel: BuildChannel;
  builderTargets: string[];
  passthrough: string[];
} {
  const channelArg = argv[0];
  const rest = argv.slice(1);
  if (!channelArg || !isBuildChannel(channelArg)) {
    console.error(
      "Usage: npm run build:nightly | npm run build:prod [-- --mac|--win|--linux]",
    );
    process.exit(1);
  }

  const targets = ["--mac", "--win", "--linux"].filter((t) => rest.includes(t));
  const passthrough = rest.filter(
    (a) => !["--mac", "--win", "--linux"].includes(a),
  );
  const builderTargets =
    targets.length > 0 ? targets : [`--${builderTargetForPlatform()}`];

  return { channel: channelArg, builderTargets, passthrough };
}

function applyChannel(channel: BuildChannel): {
  version: string;
  productName: string;
} {
  const identity = CHANNEL_IDENTITIES[channel];
  const pkg = JSON.parse(read("package.json").toString("utf8")) as {
    name: string;
    version: string;
    [key: string]: unknown;
  };

  if (channel === "nightly") {
    pkg.version = makeNightlyVersion(pkg.version, utcDateStamp(), gitShortSha());
    for (const ext of ["png", "icns", "ico"] as const) {
      fs.copyFileSync(
        path.join(ROOT, "build/icons/nightly", `betterDB.${ext}`),
        path.join(ROOT, "build", `betterDB.${ext}`),
      );
    }
  } else {
    for (const ext of ["png", "icns", "ico"] as const) {
      const fromGit = spawnSync("git", ["show", `HEAD:build/betterDB.${ext}`], {
        cwd: ROOT,
      });
      if (fromGit.status === 0 && fromGit.stdout && fromGit.stdout.length > 0) {
        write(`build/betterDB.${ext}`, fromGit.stdout);
      }
    }
    pkg.version = String(pkg.version).split("-")[0];
  }

  pkg.name = identity.packageName;
  write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

  const builder = read("electron-builder.json5").toString("utf8");
  write(
    "electron-builder.json5",
    patchElectronBuilderConfig(builder, identity),
  );

  return { version: pkg.version, productName: identity.productName };
}

function main(): void {
  const { channel, builderTargets, passthrough } = parseArgs(
    process.argv.slice(2),
  );
  const backups = Object.fromEntries(
    [...MUTABLE_TEXT_FILES, ...ICON_FILES].map((rel) => [rel, read(rel)]),
  );

  let builtVersion = "";
  let identityName = "";

  try {
    const applied = applyChannel(channel);
    builtVersion = applied.version;
    identityName = applied.productName;

    console.log(`\nPackaging ${identityName} v${builtVersion}`);
    console.log(`Targets: ${builderTargets.join(" ")}\n`);

    run("npx", ["--yes", "@electron/rebuild", "-f", "-w", "better-sqlite3"]);
    run(
      "npm",
      [
        "run",
        "build",
        "--",
        ...builderTargets,
        "--publish",
        "never",
        ...passthrough,
      ],
      { CSC_IDENTITY_AUTO_DISCOVERY: "false" },
    );

    const outDir = path.join(ROOT, "release", builtVersion);
    console.log(`\n✓ ${identityName} test release ready:`);
    console.log(`  ${outDir}`);
    if (fs.existsSync(outDir)) {
      for (const name of fs.readdirSync(outDir).sort()) {
        if (
          /\.(dmg|exe|AppImage)$/i.test(name) ||
          name.endsWith(".app") ||
          name.includes("unpacked") ||
          name.startsWith("mac")
        ) {
          console.log(`  - ${name}`);
        }
      }
    }
    if (process.platform === "darwin") {
      console.log("\nOpen unpacked app (bypasses DMG):");
      console.log(`  open "${outDir}"/mac-arm64/*.app`);
      console.log("  # or mac/ on Intel");
      console.log(
        `If Gatekeeper blocks a copied .app: xattr -cr "/Applications/${identityName}.app"`,
      );
    }
  } finally {
    for (const [rel, contents] of Object.entries(backups)) {
      write(rel, contents);
    }
    console.log(
      "\nRestored package.json, electron-builder.json5, and icons.",
    );
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
