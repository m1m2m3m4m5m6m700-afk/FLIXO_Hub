import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";

const root = "packages/contracts";
const forbiddenRoots = new Set(["apps", "src"]);
const violations = [];

function resolveImportTarget(specifier, sourcePath) {
  const normalized = specifier.replaceAll("\\", "/");
  if (normalized.startsWith("@/")) return "src/" + normalized.slice(2);
  if (/^(?:apps|src)\//u.test(normalized)) return normalized;
  if (!normalized.startsWith(".")) return null;

  const absolute = resolve(dirname(sourcePath), specifier);
  const projectPath = relative(process.cwd(), absolute).split(sep).join("/");
  return /^(?:apps|src)\//u.test(projectPath) ? projectPath : null;
}

function importedModuleSpecifiers(source, sourcePath) {
  const scriptKind = sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX
    : /\.(?:ts|mts|cts)$/u.test(sourcePath) ? ts.ScriptKind.TS
      : sourcePath.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const specifiers = [];

  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return specifiers;
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/u.test(path)) {
      const source = readFileSync(path, "utf8");
      for (const specifier of importedModuleSpecifiers(source, path)) {
        const target = resolveImportTarget(specifier, path);
        if (target && forbiddenRoots.has(target.split("/")[0])) {
          violations.push(path + " -> " + specifier + " resolves to forbidden " + target.split("/")[0] + "/");
        }
      }
    }
  }
}

walk(root);
if (violations.length) {
  console.error("CONTRACT_BOUNDARY_GATE=FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log("CONTRACT_BOUNDARY_GATE=PASS");
