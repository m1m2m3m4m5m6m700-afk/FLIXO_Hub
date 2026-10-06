#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const REPORT_DIR = '0(التقارير)';

export function sh(command, args = []) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();
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
      });
      continue;
    }

    const contentText = buffer.toString('utf8').replace(/\r\n/g, '\n');
    const generated = isGeneratedKnowledgeArtifact(path);
    const lines = contentText.endsWith('\n') ? contentText.slice(0, -1).split('\n') : contentText.split('\n');
    const symbols = generated ? [] : extractSymbols(path, contentText);
    const imports = generated ? [] : extractImports(path, contentText);
    const signals = generated ? {} : detectSignals(path, contentText);
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
    });
  }

  const model = buildKnowledgeModel(entries);
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
    '## Repository knowledge map',
    '- Task authority: المهام.md',
    '- Knowledge authority: 0(التقارير)/<EXACT-SHA>.md',
    '- This report is knowledge, not task authority and not certification evidence.',
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
    '- Generated knowledge artifacts under 0(التقارير)/ are excluded from recursive analysis to prevent report self-growth.',
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
    reportPath,
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

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(process.argv[1])) {
  main();
}
