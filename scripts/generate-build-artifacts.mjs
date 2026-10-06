import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const env = {
  ...process.env,
  FLIXO_GENERATED_OUTPUT_DIR: "dist",
};

const commands = [
  ["scripts/generate-robots.mjs"],
  [
    "--import=./scripts/register-node-resolver.mjs",
    "--experimental-strip-types",
    "scripts/generate-sitemap.mjs",
  ],
  [
    "--import=./scripts/register-node-resolver.mjs",
    "--experimental-strip-types",
    "scripts/generate-static-route-entries.mjs",
  ],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

const buildSha = (
  process.env.FLIXO_BUILD_SHA?.trim()
  || process.env.GITHUB_SHA?.trim()
  || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  || gitHead()
);

const generatedAt = new Date().toISOString();
const attestationsDir = join(root, "dist", "attestations");
mkdirSync(attestationsDir, { recursive: true });

const runtimeCertification = {
  schemaVersion: 1,
  generatedAt,
  commitSha: buildSha,
  source: process.env.GITHUB_ACTIONS === "true"
    ? "github-actions"
    : process.env.VERCEL === "1"
      ? "vercel"
      : "local-build",
  trackedAttestations: [
    "docs/attestations/FLIXO-EXACT-SHA-CERTIFICATION.md",
    "docs/attestations/FLIXO-FINAL-CERTIFICATION-ATTESTATION.md",
    "docs/attestations/THREE-CRITIC-REVIEW.md",
  ],
  runtimeArtifacts: [
    "dist/flixo-head-sha.txt",
    `dist/__flixo-identity-${buildSha}.txt`,
    "dist/__flixo-identity.txt",
    `dist/__flixo/identity/${buildSha}/index.txt`,
  ],
};

writeFileSync(
  join(attestationsDir, "build-certification.json"),
  JSON.stringify(runtimeCertification, null, 2) + "\n",
  "utf8",
);

writeFileSync(
  join(attestationsDir, "build-certification.md"),
  [
    "# FLIXO Runtime Build Certification",
    "",
    `- Generated at: ${generatedAt}`,
    `- Commit SHA: ${buildSha}`,
    `- Source: ${runtimeCertification.source}`,
    "- Status: GENERATED AT BUILD TIME",
    "",
    "This runtime attestation is generated from the exact build identity and is not tracked as a manually maintained certification file.",
    "",
  ].join("\n"),
  "utf8",
);

console.log("Generated build artifacts into dist/ using a cross-platform Node wrapper.");
console.log(`Generated runtime certification artifacts for SHA ${buildSha}.`);
