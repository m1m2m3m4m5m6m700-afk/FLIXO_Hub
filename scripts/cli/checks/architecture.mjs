import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const migratedLegacyImports = [
  "@/lib/agent/agent-profile",
  "@/lib/agent/agent-discovery",
  "@/lib/agent/task-state",
  "@/lib/agent/agent-task-manager",
  "@/lib/agent/reasoning",
  "@/lib/agent/task-decomposer",
  "@/lib/agent/evaluation",
  "@/lib/agent/execution-budget",
  "@/lib/agent/goal-controller",
  "@/lib/agent/stuck-detector",
  "@/lib/agent/universal/math-engine",
];

function walk(dir, violations) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, violations);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path)) {
      const source = readFileSync(path, "utf8");
      for (const legacyImport of migratedLegacyImports) {
        if (source.includes(legacyImport)) violations.push(path + " -> " + legacyImport);
      }
    }
  }
}

export function runArchitectureCheck(root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const lockPath = resolve(root, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const requiredWorkspaces = ["packages/contracts"];

  if (!Array.isArray(pkg.workspaces) || !requiredWorkspaces.every((entry) => pkg.workspaces.includes(entry))) {
    throw new Error("Architecture gate: canonical npm workspaces are incomplete.");
  }
  if (!existsSync(lockPath) || lock.lockfileVersion !== 3) {
    throw new Error("Architecture gate: canonical npm lockfile is missing or invalid.");
  }
  for (const entry of requiredWorkspaces) {
    if (!lock.packages?.[entry]) throw new Error(`Architecture gate: workspace is missing from lockfile: ${entry}`);
  }
  if (!pkg.scripts["typecheck:contracts"]) {
    throw new Error("Architecture gate: canonical package typecheck is missing.");
  }

  const violations = [];
  for (const rootName of ["src", "apps", "packages"]) walk(resolve(root, rootName), violations);
  if (violations.length) {
    const error = new Error("Architecture gate: migrated Agent runtime compatibility imports are forbidden.");
    error.violations = violations;
    throw error;
  }

  console.log("ARCHITECTURE_BOUNDARY_GATE=PASS");
}
