#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const REPORT_DIR = 'الوكلاء/المستكشف AI/تقارير المستكشف';

export function sh(command, args = []) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function looksText(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

export function isGeneratedKnowledgeArtifact(path) {
  return path.startsWith(REPORT_DIR + '/');
}

export function classifyPath(path) {
  if (path.startsWith('src/')) return 'runtime';
  if (path.startsWith('tests/')) return 'test';
  if (path.startsWith('.github/workflows/')) return 'ci-workflow';
  if (path.startsWith('.github/agents/')) return 'agent-profile';
  if (path.startsWith('.github/')) return 'github-config';
  if (path.startsWith('docs/')) return 'documentation';
  if (path.startsWith('scripts/')) return 'automation-script';
  if (path.startsWith('api/')) return 'api';
  if (path.startsWith('supabase/')) return 'persistence';
  if (path.startsWith('public/')) return 'public-asset';
  if (path.startsWith('packages/')) return 'package';
  if (path === 'المهام.md') return 'canonical-task-ledger';
  if (isGeneratedKnowledgeArtifact(path)) return 'generated-knowledge-artifact';
  if (/\.(json|jsonc|yaml|yml|toml|ini)$/i.test(path)) return 'configuration';
  if (/\.(md|mdx|txt)$/i.test(path)) return 'documentation';
  return 'repository-root/config';
}

function sourceLanguage(path) {
  const ext = extname(path).toLowerCase();
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript-family';
  if (['.json', '.jsonc'].includes(ext)) return 'json';
  if (['.yaml', '.yml'].includes(ext)) return 'yaml';
  if (['.md', '.mdx', '.txt'].includes(ext)) return 'prose';
  return 'other';
}

export function lineDescription(line, context = {}) {
  const s = line.trim();
  if (!s) return 'blank/separator line';
  if (/^\/\/|^\/\*|^\*|^<!--|^#/.test(s)) return 'comment/documentation/heading line';
  if (/^(import|export)\b/.test(s)) return 'module dependency or public export declaration';
  if (/^(type|interface|enum|namespace)\b/.test(s)) return 'type/module contract declaration';
  if (/^(class|abstract class)\b/.test(s)) return 'class declaration';
  if (/^(function|async function)\b/.test(s)) return 'function declaration';
  if (/^(const|let|var)\b/.test(s)) return 'constant/variable declaration';
  if (/^(if|else if|else|switch|case|default)\b/.test(s)) return 'control-flow branch';
  if (/^(for|while|do)\b/.test(s)) return 'iteration/control-flow statement';
  if (/^(try|catch|finally|throw)\b/.test(s)) return 'error-handling statement';
  if (/^(return|yield|break|continue)\b/.test(s)) return 'control-transfer statement';
  if (/\b(test|describe|it|assert|expect)\b/.test(s)) return 'test/verification statement';
  if (/^[-*+]\s*\[[ xX]\]/.test(s)) return 'checkbox/task state line';
  if (/^[-*+]\s+/.test(s) || /^\d+\.\s+/.test(s)) return 'list/checklist/task-like content';
  if (/\b(className|aria-|role=|on[A-Z])\b/.test(s)) return 'UI/rendering/accessibility/event behavior';
  if (/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|FormData)\b/.test(s)) return 'network/data-transfer signal';
  if (/\b(File|Blob|ArrayBuffer|createObjectURL)\b/.test(s)) return 'browser-local binary-data signal';
  if (/\b(supabase|localStorage|indexedDB|sessionStorage)\b/i.test(s)) return 'persistence/state boundary signal';
  if (/\b(crypto|CSP|HSTS|nonce|secret|credential|token|permission)\b/i.test(s)) return 'security/trust-boundary signal';
  if (/\b(registry|manifest|executor|verifier|contract|capability|scope|canonical)\b/i.test(s)) return 'FLIXO authority/contract-related line';
  if (context.symbol) return 'line associated with symbol ' + context.symbol.name + ' (' + context.symbol.kind + ')';
  return 'code/content statement; semantic review required for this line';
}

export function extractSymbols(path, content) {
  if (sourceLanguage(path) !== 'javascript-family') return [];
  const symbols = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const patterns = [
    { re: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, kind: 'function' },
    { re: /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: 'class' },
    { re: /^(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/, kind: 'interface' },
    { re: /^(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)/, kind: 'type' },
    { re: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=|:)/, kind: 'variable' },
    { re: /^(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/, kind: 'enum' },
    { re: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, kind: 'arrow-function' },
  ];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    for (const pattern of patterns) {
      const match = trimmed.match(pattern.re);
      if (!match) continue;
      symbols.push({
        name: match[1],
        kind: pattern.kind,
        line: index + 1,
        exported: /^export\b/.test(trimmed),
      });
      break;
    }
  });
  return symbols;
}

export function extractImports(path, content) {
  if (sourceLanguage(path) !== 'javascript-family') return [];
  const imports = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/,
    /\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/,
  ];
  lines.forEach((line, index) => {
    for (const re of patterns) {
      const match = line.match(re);
      if (!match) continue;
      imports.push({ specifier: match[1], line: index + 1 });
      break;
    }
  });
  return imports;
}

export function resolveLocalImport(fromPath, specifier, fileSet) {
  if (!specifier.startsWith('.')) return null;
  const base = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].map(ext => base + ext),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs', 'index.json'].map(name => base + '/' + name),
  ];
  return candidates.find(candidate => fileSet.has(candidate)) || null;
}

export function detectSignals(path, content) {
  const lower = content.toLowerCase();
  return {
    browserLocalBinary: /\b(file|blob|arraybuffer|createobjecturl)\b/.test(lower),
    networkBoundary: /\b(fetch|xmlhttprequest|sendbeacon|websocket|formdata)\b/.test(lower),
    persistenceBoundary: /\b(supabase|indexeddb|localstorage|sessionstorage)\b/.test(lower),
    securityBoundary: /\b(csp|hsts|nonce|secret|credential|token|crypto|permission)\b/.test(lower),
    canonicalAuthority: /\b(canonical|registry|manifest|authoritative|source of truth)\b/.test(lower),
    verification: /\b(test|assert|expect|verify|verification|proof|gate)\b/.test(lower),
    agentRuntime: /\b(agent|planner|intent|memory|orchestrator|copilot)\b/.test(lower),
  };
}

export function classifyTaskSignal(line) {
  if (/TODO|FIXME|HACK|ACTION ITEM|\[ \]/i.test(line)) return 'genuine-plan-task-candidate';
  if (/required|must|shall|should|policy|contract/i.test(line)) return 'policy-or-contract-candidate';
  if (/historical|deprecated|superseded|legacy|former/i.test(line)) return 'stale-or-historical-candidate';
  if (/next|remaining|pending|deferred|planned|roadmap|backlog/i.test(line)) return 'future-work-candidate';
  return null;
}

function scriptKindForPath(path) {
  switch (extname(path).toLowerCase()) {
    case '.tsx': return ts.ScriptKind.TSX;
    case '.jsx': return ts.ScriptKind.JSX;
    case '.ts': return ts.ScriptKind.TS;
    case '.js':
    case '.mjs':
    case '.cjs': return ts.ScriptKind.JS;
    default: return ts.ScriptKind.Unknown;
  }
}

function declarationName(node) {
  return node.name?.getText?.() || null;
}

function addCallTarget(node, callTargets) {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) { callTargets.add(expression.text); return; }
  if (ts.isPropertyAccessExpression(expression)) callTargets.add(expression.getText());
}

export function extractAstFacts(path, content) {
  if (sourceLanguage(path) !== 'javascript-family') return null;
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKindForPath(path));
  const declarations = [];
  const imports = [];
  const exports = [];
  const callTargets = new Set();
  const controlFlow = { if: 0, switch: 0, loops: 0, try: 0, conditional: 0 };
  let callExpressions = 0;

  function visit(node) {
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
      const name = declarationName(node);
      if (name) declarations.push({ name, kind: ts.SyntaxKind[node.kind], line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 });
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        declarations.push({ name: declaration.name.getText(sourceFile), kind: 'VariableDeclaration', line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile)).line + 1 });
      }
    }
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) imports.push(node.getText(sourceFile).split('\n')[0].slice(0, 300));
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) exports.push(node.getText(sourceFile).split('\n')[0].slice(0, 300));
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) { callExpressions++; addCallTarget(node, callTargets); }
    if (ts.isIfStatement(node)) controlFlow.if++;
    if (ts.isSwitchStatement(node)) controlFlow.switch++;
    if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) controlFlow.loops++;
    if (ts.isTryStatement(node) || ts.isCatchClause(node)) controlFlow.try++;
    if (ts.isConditionalExpression(node)) controlFlow.conditional++;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { parser: 'typescript-compiler-api', parseDiagnostics: sourceFile.parseDiagnostics.length, declarations, imports, exports, callExpressions, callTargets: Array.from(callTargets).sort(), controlFlow };
}

function collectGitRefIndex(ref) {
  const resolvedRef = sh('git', ['rev-parse', ref]);
  const rows = sh('git', ['ls-tree', '-r', '-z', resolvedRef]).split('\0').filter(Boolean);
  const files = new Map();
  for (const row of rows) {
    const match = row.match(/^(\d+) (blob|tree) ([0-9a-f]{40})\t(.+)$/);
    if (!match || match[2] !== 'blob') continue;
    files.set(match[4], { mode: match[1], type: match[2], blobSha: match[3] });
  }
  return { ref, resolvedRef, files };
}

function setDiff(before, after) {
  const a = new Set(before);
  const b = new Set(after);
  return { added: Array.from(b).filter(value => !a.has(value)).sort(), removed: Array.from(a).filter(value => !b.has(value)).sort() };
}

export function collectSemanticDiff(mainRef = 'refs/remotes/origin/main', executionRef = 'HEAD') {
  try {
    const main = collectGitRefIndex(mainRef);
    const execution = collectGitRefIndex(executionRef);
    const paths = new Set([...main.files.keys(), ...execution.files.keys()]);
    const changedFiles = [];
    const sourceChanges = [];
    let added = 0; let removed = 0; let modified = 0;
    for (const path of Array.from(paths).sort()) {
      const before = main.files.get(path);
      const after = execution.files.get(path);
      if (!before && after) { added++; changedFiles.push({ path, status: 'ADDED' }); continue; }
      if (before && !after) { removed++; changedFiles.push({ path, status: 'REMOVED' }); continue; }
      if (!before || !after || before.blobSha === after.blobSha) continue;
      modified++; changedFiles.push({ path, status: 'MODIFIED' });
      if (sourceLanguage(path) !== 'javascript-family') continue;
      const beforeContent = sh('git', ['show', main.resolvedRef + ':' + path]);
      const afterContent = sh('git', ['show', execution.resolvedRef + ':' + path]);
      const beforeFacts = extractAstFacts(path, beforeContent);
      const afterFacts = extractAstFacts(path, afterContent);
      const declarationDelta = setDiff((beforeFacts?.declarations || []).map(item => [item.kind, item.name].join(':')), (afterFacts?.declarations || []).map(item => [item.kind, item.name].join(':')));
      const callTargetDelta = setDiff(beforeFacts?.callTargets || [], afterFacts?.callTargets || []);
      const importDelta = setDiff(beforeFacts?.imports || [], afterFacts?.imports || []);
      const exportDelta = setDiff(beforeFacts?.exports || [], afterFacts?.exports || []);
      sourceChanges.push({
        path,
        parseDiagnostics: { main: beforeFacts?.parseDiagnostics ?? null, execution: afterFacts?.parseDiagnostics ?? null },
        declarationDelta, callTargetDelta, importDelta, exportDelta,
        controlFlow: { main: beforeFacts?.controlFlow ?? null, execution: afterFacts?.controlFlow ?? null },
        shapeChanged: JSON.stringify(beforeFacts) !== JSON.stringify(afterFacts),
      });
    }
    return { readable: true, mainSha: main.resolvedRef, executionSha: execution.resolvedRef, changedFiles, sourceChanges, summary: { added, removed, modified, semanticSourceChanges: sourceChanges.length } };
  } catch (error) {
    return { readable: false, mainSha: null, executionSha: null, changedFiles: [], sourceChanges: [], summary: { added: 0, removed: 0, modified: 0, semanticSourceChanges: 0 }, error: String(error) };
  }
}
export function collectGitRefSnapshot(
  ref = process.env.GITHUB_REF === 'refs/heads/main' ? 'HEAD' : 'refs/remotes/origin/main',
) {
  try {
    let resolvedRef;
    try {
      resolvedRef = sh('git', ['rev-parse', ref]);
    } catch {
      const configuredMainSha = process.env.FLIXO_KNOWLEDGE_MAIN_SHA;
      if (configuredMainSha && /^[0-9a-f]{40}$/.test(configuredMainSha)) {
        resolvedRef = configuredMainSha;
      } else if (ref !== 'refs/heads/main') {
        try {
          resolvedRef = sh('git', ['rev-parse', 'FETCH_HEAD']);
        } catch {
          if (process.env.GITHUB_REF === 'refs/heads/main') {
            resolvedRef = sh('git', ['rev-parse', 'HEAD']);
          } else {
            resolvedRef = sh('git', ['rev-parse', 'refs/heads/main']);
          }
        }
      } else {
        throw new Error('main branch reference is unavailable');
      }
    }
    const paths = sh('git', ['ls-tree', '-r', '-z', '--name-only', resolvedRef]).split('\0').filter(Boolean);
    let textFiles = 0;
    let binaryFiles = 0;
    let textLines = 0;
    let bytes = 0;

    for (const path of paths) {
      const buffer = Buffer.from(sh('git', ['show', `${resolvedRef}:${path}`]), 'utf8');
      bytes += buffer.length;
      if (!looksText(buffer)) {
        binaryFiles++;
        continue;
      }
      textFiles++;
      const normalized = buffer.toString('utf8').replace(/\r\n/g, '\n');
      textLines += normalized === '' ? 0 : (normalized.endsWith('\n') ? normalized.slice(0, -1).split('\n').length : normalized.split('\n').length);
    }

    return {
      ref,
      resolvedRef,
      sha: resolvedRef,
      trackedFiles: paths.length,
      textFiles,
      binaryFiles,
      textLines,
      bytes,
      readable: true,
    };
  } catch (error) {
    return {
      ref,
      resolvedRef: null,
      sha: null,
      trackedFiles: 0,
      textFiles: 0,
      binaryFiles: 0,
      textLines: 0,
      bytes: 0,
      readable: false,
      error: String(error),
    };
  }
}

export function collectChangedFiles() {
  try {
    const parent = sh('git', ['rev-parse', 'HEAD^']);
    const output = sh('git', ['diff', '--name-status', parent, 'HEAD']);
    return {
      base: parent,
      files: output ? output.split('\n').map(line => {
        const parts = line.split('\t');
        return { status: parts[0], path: parts.slice(1).join('\t') };
      }) : [],
    };
  } catch {
    return { base: null, files: [] };
  }
}

export function buildKnowledgeModel(entries) {
  const sourceEntries = entries.filter(entry => !entry.generated && !entry.binary);
  const dependencyEdges = sourceEntries.flatMap(entry =>
    entry.imports.map(item => ({
      from: entry.path,
      line: item.line,
      specifier: item.specifier,
      target: item.target || null,
      resolution: item.resolution,
    })),
  );
  const symbolIndex = sourceEntries.flatMap(entry =>
    entry.symbols.map(symbol => ({
      path: entry.path,
      line: symbol.line,
      name: symbol.name,
      kind: symbol.kind,
      exported: symbol.exported,
    })),
  );
  const signalMap = sourceEntries
    .filter(entry => Object.values(entry.signals || {}).some(Boolean))
    .map(entry => ({
      path: entry.path,
      signals: Object.entries(entry.signals).filter(([, value]) => value).map(([key]) => key),
    }));
  return { sourceEntries, dependencyEdges, symbolIndex, signalMap };
}

export function collect() {
  const sha = sh('git', ['rev-parse', 'HEAD']);
  const branch = sh('git', ['branch', '--show-current']) || 'detached';
  const files = sh('git', ['ls-files', '-z']).split('\0').filter(Boolean);
  const fileSet = new Set(files);
  const entries = [];
  let sourceTextFiles = 0;
  let generatedTextFiles = 0;
  let binaryFiles = 0;
  let sourceTextLines = 0;
  let describedSourceLines = 0;
  let unknownSourceLines = 0;
  let taskSignals = 0;

  for (const path of files) {
    const abs = join(root, path);
    const buffer = readFileSync(abs);
    const binary = !looksText(buffer);
    const file = statSync(abs);
    const hash = sha256(buffer);

    if (binary) {
      binaryFiles++;
      entries.push({
        path,
        category: classifyPath(path),
        bytes: file.size,
        sha256: hash,
        binary: true,
        generated: false,
        lineCount: 0,
        description: 'Binary/non-text file; metadata recorded without semantic text claims.',
        lineLedger: [],
      ast: null,
      });
      continue;
    }

    const contentText = buffer.toString('utf8').replace(/\r\n/g, '\n');
    const generated = isGeneratedKnowledgeArtifact(path);
    const lines = contentText.endsWith('\n') ? contentText.slice(0, -1).split('\n') : contentText.split('\n');
    const symbols = generated ? [] : extractSymbols(path, contentText);
    const imports = generated ? [] : extractImports(path, contentText);
    const signals = generated ? {} : detectSignals(path, contentText);
    const ast = generated ? null : extractAstFacts(path, contentText);
    const symbolByLine = new Map(symbols.map(symbol => [symbol.line, symbol]));
    const lineLedger = [];

    if (generated) {
      generatedTextFiles++;
    } else {
      sourceTextFiles++;
      sourceTextLines += lines.length;
      for (let index = 0; index < lines.length; index++) {
        const description = lineDescription(lines[index], { symbol: symbolByLine.get(index + 1) });
        lineLedger.push('- L' + (index + 1) + ': ' + description);
        describedSourceLines++;
        if (description.includes('semantic review required')) unknownSourceLines++;
        if (classifyTaskSignal(lines[index])) taskSignals++;
      }
    }

    const resolvedImports = imports.map(item => {
      const target = resolveLocalImport(path, item.specifier, fileSet);
      return {
        line: item.line,
        specifier: item.specifier,
        target,
        resolution: target ? 'RESOLVED' : item.specifier.startsWith('.') ? 'UNRESOLVED_LOCAL' : 'EXTERNAL',
      };
    });

    entries.push({
      path,
      category: classifyPath(path),
      bytes: file.size,
      sha256: hash,
      binary: false,
      generated,
      language: sourceLanguage(path),
      lineCount: lines.length,
      description: generated
        ? 'Generated knowledge artifact; inventoried but excluded from recursive semantic corpus.'
        : 'Repository-authored file with structural symbol/import analysis and static evidence signals.',
      symbols,
      imports: resolvedImports,
      signals,
      lineLedger,
      ast,
    });
  }

  const model = buildKnowledgeModel(entries);
  const mainSnapshot = collectGitRefSnapshot();
  const semanticDiff = collectSemanticDiff();
  const changed = collectChangedFiles();
  const unresolved = model.dependencyEdges.filter(edge => edge.resolution === 'UNRESOLVED_LOCAL');
  const status = unknownSourceLines === 0 && unresolved.length === 0
    ? 'CAN_COMPLETE'
    : 'CAN_COMPLETE_WITH_LIMITATIONS';

  const reportDir = join(root, REPORT_DIR);
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, sha + '.md');

  const taskFindings = [];
  for (const entry of model.sourceEntries) {
    const sourceLines = readFileSync(join(root, entry.path), 'utf8').replace(/\r\n/g, '\n').split('\n');
    sourceLines.forEach((line, index) => {
      const kind = classifyTaskSignal(line);
      if (kind) taskFindings.push('- ' + entry.path + ':L' + (index + 1) + ' — ' + kind + ' — ' + line.trim().slice(0, 240));
    });
  }

  const architectureSignals = model.signalMap
    .map(item => '- ' + item.path + ': ' + item.signals.join(', '))
    .slice(0, 1000);

  const dependencyLines = model.dependencyEdges
    .slice(0, 4000)
    .map(edge => '- ' + edge.from + ':L' + edge.line + ' -> ' + (edge.target || edge.resolution) + ' [' + edge.specifier + ']');

  const symbolLines = model.symbolIndex
    .slice(0, 6000)
    .map(symbol => '- ' + symbol.path + ':L' + symbol.line + ' — ' + symbol.kind + ' ' + symbol.name + ' — exported=' + symbol.exported);

  const sections = [
    '# FLIXO Repository Knowledge Report — ' + sha,
    '',
    '## Knowledge session status',
    '- Status: ' + status,
    '- Evidence class: STATIC_ANALYSIS. Runtime behavior, browser behavior, deployment health, and certification require separate evidence.',
    '- Exact SHA: ' + sha,
    '- Branch: ' + branch,
    '',
    '## Coverage and capability',
    '- Tracked files: ' + files.length,
    '- Repository-authored text files analyzed: ' + sourceTextFiles,
    '- Generated knowledge text files inventoried/excluded from recursive corpus: ' + generatedTextFiles,
    '- Binary/non-text files: ' + binaryFiles,
    '- Repository-authored text lines: ' + sourceTextLines,
    '- Described repository-authored text lines: ' + describedSourceLines,
    '- Uncovered repository-authored text lines: ' + (sourceTextLines - describedSourceLines),
    '- Lines requiring semantic review: ' + unknownSourceLines,
    '- Symbols extracted: ' + model.symbolIndex.length,
    '- Local dependency edges: ' + model.dependencyEdges.length,
    '- Unresolved local imports: ' + unresolved.length,
    '- Task-like signal lines: ' + taskSignals,
    '',
    '## Capability boundary',
    '- CAN_COMPLETE applies only to the configured static analysis contract.',
    '- CAN_COMPLETE_WITH_LIMITATIONS is mandatory when unresolved or semantic-review items remain.',
    '- STATIC_ANALYSIS must never be presented as TESTED or VERIFIED.',
    '',
    '## Main branch read snapshot',
    '- Main ref requested: refs/remotes/origin/main',
    '- Main SHA: ' + (mainSnapshot.sha || 'UNAVAILABLE'),
    '- Main read status: ' + (mainSnapshot.readable ? 'READ_COMPLETE' : 'READ_UNAVAILABLE'),
    '- Main tracked files read: ' + mainSnapshot.trackedFiles,
    '- Main text files read: ' + mainSnapshot.textFiles,
    '- Main binary/non-text files: ' + mainSnapshot.binaryFiles,
    '- Main text lines read: ' + mainSnapshot.textLines,
    ...(mainSnapshot.readable ? [] : ['- Main read error: ' + mainSnapshot.error]),
    '',
    '## Repository knowledge map',
    '- Task authority: المهام.md',
    '- Knowledge authority: الوكلاء/المستكشف AI/تقارير المستكشف/<EXACT-SHA>.md',
    '- This report is knowledge, not task authority and not certification evidence.',
    '',
    '## Semantic comparison: main vs execution',
    '- Comparison status: ' + (semanticDiff.readable ? 'READ_COMPLETE' : 'READ_UNAVAILABLE'),
    '- Main SHA: ' + (semanticDiff.mainSha || 'UNAVAILABLE'),
    '- Execution SHA: ' + (semanticDiff.executionSha || sha),
    '- Files added: ' + semanticDiff.summary.added,
    '- Files removed: ' + semanticDiff.summary.removed,
    '- Files modified: ' + semanticDiff.summary.modified,
    '- Source files with AST semantic comparison: ' + semanticDiff.summary.semanticSourceChanges,
    ...(semanticDiff.readable ? [] : ['- Semantic comparison error: ' + semanticDiff.error]),
    ...semanticDiff.sourceChanges.slice(0, 2000).flatMap(change => [
      '- ' + change.path + ': shapeChanged=' + change.shapeChanged + ', mainDiagnostics=' + change.parseDiagnostics.main + ', executionDiagnostics=' + change.parseDiagnostics.execution,
      '  - Declarations added: ' + change.declarationDelta.added.join(', '),
      '  - Declarations removed: ' + change.declarationDelta.removed.join(', '),
      '  - Call targets added: ' + change.callTargetDelta.added.join(', '),
      '  - Call targets removed: ' + change.callTargetDelta.removed.join(', '),
      '  - Imports added/removed: +' + change.importDelta.added.length + '/-' + change.importDelta.removed.length,
      '  - Exports added/removed: +' + change.exportDelta.added.length + '/-' + change.exportDelta.removed.length,
      '  - Control flow main/execution: ' + JSON.stringify(change.controlFlow.main) + ' -> ' + JSON.stringify(change.controlFlow.execution),
    ]),
    '',
    '## Change delta',
    '- Comparison base: ' + (changed.base || 'UNKNOWN'),
    '- Changed files since base: ' + changed.files.length,
    ...(changed.files.length ? changed.files.slice(0, 500).map(item => '- ' + item.status + ': ' + item.path) : ['- No commit delta available.']),
    '',
    '## Dependency graph',
    ...(dependencyLines.length ? dependencyLines : ['- No import relationships detected by configured static rules.']),
    '',
    '## Symbol index',
    ...(symbolLines.length ? symbolLines : ['- No JavaScript-family symbols detected.']),
    '',
    '## Architecture, security, and data-flow signals',
    ...(architectureSignals.length ? architectureSignals : ['- No configured static signals detected.']),
    '',
    '## Planning/task discovery',
    ...(taskFindings.length ? taskFindings.slice(0, 4000) : ['- No configured task-like signals detected.']),
    '',
    '## Conflict/authority candidates',
    ...(architectureSignals.filter(line => /canonical|registry|manifest/i.test(line)).length
      ? architectureSignals.filter(line => /canonical|registry|manifest/i.test(line))
      : ['- No configured authority candidates detected.']),
    '',
    '## Unknowns / limitations',
    ...(unknownSourceLines ? ['- ' + unknownSourceLines + ' repository-authored lines require semantic review under the classifier.'] : ['- No line-level semantic-review markers under the classifier.']),
    ...(unresolved.length ? ['- ' + unresolved.length + ' local imports could not be resolved.'] : ['- No unresolved local imports detected.']),
    '- Generated knowledge artifacts under الوكلاء/المستكشف AI/تقارير المستكشف/ are excluded from recursive analysis to prevent report self-growth.',
    '',
    '## Complete file inventory',
  ];

  for (const entry of entries) {
    sections.push(
      '',
      '### ' + entry.path,
      '- Category: ' + entry.category,
      '- Size: ' + entry.bytes + ' bytes',
      '- SHA-256: ' + entry.sha256,
      '- Type: ' + (entry.binary ? 'binary/non-text' : 'text'),
      '- Generated knowledge artifact: ' + entry.generated,
      '- Description: ' + entry.description,
    );

    if (!entry.binary && !entry.generated) {
      sections.push('- Line coverage: 1-' + entry.lineCount + ' (all repository-authored lines classified)');
      sections.push(...entry.lineLedger);
      if (entry.ast) {
        sections.push('- AST facts: parser=' + entry.ast.parser + ', parseDiagnostics=' + entry.ast.parseDiagnostics + ', callExpressions=' + entry.ast.callExpressions);
        sections.push('  - Control flow: ' + JSON.stringify(entry.ast.controlFlow));
        sections.push('  - Call targets: ' + (entry.ast.callTargets.length ? entry.ast.callTargets.join(', ') : 'none detected'));
      }
      if (entry.symbols.length) {
        sections.push('- Symbols:');
        sections.push(...entry.symbols.map(symbol => '  - L' + symbol.line + ' ' + symbol.kind + ' ' + symbol.name + ' exported=' + symbol.exported));
      }
      if (entry.imports.length) {
        sections.push('- Imports:');
        sections.push(...entry.imports.map(item => '  - L' + item.line + ' ' + item.specifier + ' => ' + (item.target || item.resolution)));
      }
      const activeSignals = Object.entries(entry.signals).filter(([, value]) => value);
      if (activeSignals.length) {
        sections.push('- Static signals:');
        sections.push(...activeSignals.map(([key]) => '  - ' + key));
      }
    }
  }

  writeFileSync(reportPath, sections.join('\n') + '\n', 'utf8');
  return {
    sha,
    branch,
    trackedFiles: files.length,
    sourceTextFiles,
    generatedTextFiles,
    binaryFiles,
    sourceTextLines,
    describedSourceLines,
    uncoveredSourceLines: sourceTextLines - describedSourceLines,
    unknownSourceLines,
    symbolCount: model.symbolIndex.length,
    dependencyEdgeCount: model.dependencyEdges.length,
    unresolvedLocalImports: unresolved.length,
    taskSignals,
    changedFiles: changed.files.length,
    status,
    reportPath: REPORT_DIR + '/' + sha + '.md',
  };
}

function main() {
  const result = collect();
  if (process.argv.includes('--verify') &&
      (result.uncoveredSourceLines !== 0 || !result.reportPath || !result.sha) &&
      process.env.ALLOW_KNOWLEDGE_LIMITATIONS !== '1') {
    process.exitCode = 2;
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
