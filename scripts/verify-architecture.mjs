import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const workspace = pkg.workspaces;

const requiredWorkspaces = ["packages/contracts"];

if (!Array.isArray(workspace) || !requiredWorkspaces.every((entry) => workspace.includes(entry))) {
  console.error("Architecture gate: canonical npm workspaces are incomplete.");
  process.exit(1);
}

if (!existsSync("package-lock.json") || lock.lockfileVersion !== 3) {
  console.error("Architecture gate: canonical npm lockfile is missing or invalid.");
  process.exit(1);
}

for (const entry of requiredWorkspaces) {
  const packageKey = entry;
  if (!lock.packages?.[packageKey]) {
    console.error(`Architecture gate: workspace is missing from lockfile: ${entry}`);
    process.exit(1);
  }
}

if (!pkg.scripts["typecheck:contracts"]) {
  console.error("Architecture gate: canonical package typecheck is missing.");
  process.exit(1);
}

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

const sourceRoots = ["src", "apps", "packages"];
const importViolations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path)) {
      const source = readFileSync(path, "utf8");
      for (const legacyImport of migratedLegacyImports) {
        if (source.includes(legacyImport)) importViolations.push(path + " -> " + legacyImport);
      }
    }
  }
}

for (const root of sourceRoots) {
  if (existsSync(root)) walk(root);
}

const codeownersPath = '.github/CODEOWNERS';
const requiredOwnerPaths = [
  '/.github/workflows/',
  '/scripts/ci/',
  '/src/lib/contracts/',
  '/src/lib/execution/',
  '/src/config/registry.ts',
  '/src/server/admin/',
  '/api/admin/',
  '/src/worker.ts',
  '/wrangler.jsonc',
  '/vercel.json',
];

const codeownersViolations = [];
if (!existsSync(codeownersPath)) {
  codeownersViolations.push('missing .github/CODEOWNERS');
} else {
  const codeowners = readFileSync(codeownersPath, 'utf8');
  for (const ownerPath of requiredOwnerPaths) {
    if (!codeowners.split(/\r?\n/u).some((line) => line.trim().startsWith(ownerPath))) {
      codeownersViolations.push('CODEOWNERS missing explicit protected path: ' + ownerPath);
    }
  }
}

const authorityChecks = [
  {
    path: 'src/config/registry.ts',
    pattern: /export const TOOL_REGISTRY\b/gu,
    expected: 1,
    label: 'canonical TOOL_REGISTRY definition',
  },
  {
    path: 'src/config/canonical-tool-definition.ts',
    pattern: /export const TOOL_DEFINITIONS\b/gu,
    expected: 1,
    label: 'canonical TOOL_DEFINITIONS definition',
  },
  {
    path: 'src/lib/execution/canonical-executor.ts',
    pattern: /export async function executeCanonicalTool\b/gu,
    expected: 1,
    label: 'canonical execution entrypoint',
  },
];

const authorityViolations = [];
for (const check of authorityChecks) {
  const source = readFileSync(check.path, 'utf8');
  const matches = source.match(check.pattern) ?? [];
  if (matches.length !== check.expected) {
    authorityViolations.push(
      check.path + ' -> ' + check.label + ' expected=' + check.expected + ' actual=' + matches.length,
    );
  }
}

if (!existsSync('src/lib/cell/index.ts') || !existsSync('src/lib/cell/hard-control.ts') || !existsSync('src/lib/cell/types.ts')) {
  authorityViolations.push('CELL control-plane modules are incomplete');
}

if (existsSync('src/lib/media/media-safety.ts')) {
  authorityViolations.push('src/lib/media/media-safety.ts -> duplicate media safety authority must remain removed');
}

if (importViolations.length) {
  console.error("Architecture gate: migrated Agent runtime compatibility imports are forbidden.");
  for (const violation of importViolations) console.error(violation);
  process.exit(1);
}

if (codeownersViolations.length) {
  console.error("Architecture gate: CODEOWNERS coverage is incomplete.");
  for (const violation of codeownersViolations) console.error(violation);
  process.exit(1);
}

if (authorityViolations.length) {
  console.error("Architecture gate: canonical authority invariants failed.");
  for (const violation of authorityViolations) console.error(violation);
  process.exit(1);
}

console.log("ARCHITECTURE_BOUNDARY_GATE=PASS");
