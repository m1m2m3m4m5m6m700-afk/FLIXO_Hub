import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md",
  "docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md",
  "docs/FLIXO-LAUNCH-DAY-RUNBOOK.md",
  "docs/FLIXO-ANALYTICS-CONTRACT.md",
  "docs/FLIXO-TRUST-AND-OPERATIONS.md",
  "docs/FLIXO-LAUNCH-DISTRIBUTION-PACK.md",
  "docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md",
  "docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "CHANGELOG.md",
];

export function runLaunchReadinessCheck(root = process.cwd()) {
  const missing = required.filter((path) => !existsSync(resolve(root, path)));
  if (missing.length) {
    const error = new Error("[launch-readiness] BLOCKED: missing required files");
    error.missing = missing;
    throw error;
  }

  const manifest = readFileSync(resolve(root, "docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md"), "utf8");
  const certificate = readFileSync(resolve(root, "docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md"), "utf8");
  const blockers = readFileSync(resolve(root, "docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md"), "utf8");

  if (!/Candidate SHA: `(?:REQUIRED|[a-f0-9]{40})`/.test(manifest)) {
    throw new Error("[launch-readiness] BLOCKED: release manifest candidate SHA field is malformed.");
  }
  if (!/Status: NOT CERTIFIED/.test(certificate)) {
    throw new Error("[launch-readiness] BLOCKED: certificate template state is invalid.");
  }
  if (!/No repository code license has been selected/.test(blockers)) {
    throw new Error("[launch-readiness] BLOCKED: legal blocker ledger changed unexpectedly.");
  }

  console.log("[launch-readiness] PASS: launch program structure is present and fail-closed placeholders remain explicit.");
  console.log("[launch-readiness] NOTE: external account/legal actions and exact-SHA evidence are still required for certification.");
}
