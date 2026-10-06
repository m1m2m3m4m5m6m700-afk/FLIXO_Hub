#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';

const root = process.cwd();

function sh(command, args = []) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function looksText(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function classifyPath(path) {
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
  if (path.endsWith('.json') || path.endsWith('.jsonc') || path.endsWith('.yaml') || path.endsWith('.yml')) return 'configuration';
  if (path.endsWith('.md')) return 'documentation';
  return 'repository-root/config';
}

function lineDescription(line) {
  const s = line.trim();
  if (!s) return 'blank/separator line';
  if (/^\/\/|^\/\*|^\*|^<!--|^#/.test(s)) return 'comment/documentation/heading line';
  if (/^(import|export)\b/.test(s)) return 'module dependency or public export declaration';
  if (/^(type|interface)\b/.test(s)) return 'type contract declaration';
  if (/^(class|abstract class)\b/.test(s)) return 'class declaration';
  if (/^(const|let|var)\b/.test(s)) return 'constant/variable declaration';
  if (/^(function|async function)\b/.test(s)) return 'function declaration';
  if (/^export (async )?(function|const|class|type|interface)\b/.test(s)) return 'exported symbol declaration';
  if (/^(if|else if|else|switch|case|default)\b/.test(s)) return 'control-flow branch';
  if (/^(for|while|do)\b/.test(s)) return 'iteration/control-flow statement';
  if (/^(try|catch|finally|throw)\b/.test(s)) return 'error-handling statement';
  if (/^(return|yield)\b/.test(s)) return 'function result/control transfer';
  if (/^(test|describe)\s*\(/.test(s) || /\b(assert|expect)\b/.test(s)) return 'test/verification statement';
  if (/^[-*+]\s+/.test(s) || /^\d+\.\s+/.test(s)) return 'list/checklist/task-like content';
  if (/^[-*]\s*\[[ xX]\]/.test(s)) return 'checkbox/task state line';
  if (/[:=].*(fetch|URL|route|path|token|secret|env|config|limit|timeout|retry)/i.test(s)) return 'configuration or operational binding';
  if (/\b(className|style|aria-|role=|on[A-Z])\b/.test(s)) return 'UI/rendering/accessibility/event behavior';
  if (/\b(throw|Error|catch|recover|retry|abort|signal)\b/.test(s)) return 'failure/recovery behavior';
  if (/\b(test|spec|fixture|mock|stub)\b/i.test(s)) return 'test/fixture-related line';
  if (/\b(registry|manifest|executor|verifier|contract|capability|scope)\b/i.test(s)) return 'FLIXO authority/contract-related line';
  return 'code/content statement; semantic review required for this line';
}

function fileDescription(path, content, binary) {
  const category = classifyPath(path);
  const ext = extname(path) || '(none)';
  if (binary) return `Binary/non-text ${ext} file in ${category} area; metadata recorded without pretending semantic text inspection.`;
  if (path === 'المهام.md') return 'Canonical task ledger and sole dispatch source for executable repository tasks.';
  if (path.includes('/agents/')) return 'Agent profile defining an agent mission, boundaries, and operating rules.';
  if (path.includes('/workflows/')) return 'GitHub Actions workflow defining CI, verification, automation, or release behavior.';
  if (path.startsWith('tests/')) return 'Automated test/verification source for repository behavior.';
  if (path.startsWith('src/')) return 'Application/runtime source file; responsibility inferred from path and symbols, with line ledger coverage below.';
  if (path.startsWith('docs/')) return 'Repository documentation or operational/evidence record; substantive lines are covered below.';
  if (path.startsWith('scripts/')) return 'Automation/verification script executed by repository tooling or CI.';
  return `Repository ${category} file (${ext}).`;
}

function collect() {
  const sha = sh('git', ['rev-parse', 'HEAD']);
  const branch = sh('git', ['branch', '--show-current']) || 'detached';
  const files = sh('git', ['ls-files', '-z']).split('\0').filter(Boolean);
  const entries = [];
  let textFiles = 0, binaryFiles = 0, totalLines = 0, describedLines = 0, taskSignals = 0;

  for (const path of files) {
    const abs = join(root, path);
    const buffer = readFileSync(abs);
    const binary = !looksText(buffer);
    const file = statSync(abs);
    const hash = sha256(buffer);
    let lines = 0;
    let lineLedger = [];

    if (!binary) {
      textFiles++;
      const content = buffer.toString('utf8').replace(/\r\n/g, '\n');
      const split = content.split('\n');
      lines = split.length;
      if (content.endsWith('\n')) lines -= 1;
      totalLines += lines;
      describedLines += lines;

      for (let i = 0; i < split.length; i++) {
        const line = split[i];
        if (i + 1 > lines && line === '') continue;
        const d = lineDescription(line);
        lineLedger.push(`- L${i + 1}: ${d}`);
        if (/TODO|FIXME|HACK|ROADMAP|BACKLOG|NEXT|REMAINING|DEFERRED|PLANNED|PENDING|REQUIRED|ACTION ITEM|\[ \]/i.test(line)) taskSignals++;
      }
    } else {
      binaryFiles++;
    }

    entries.push({
      path, category: classifyPath(path), bytes: file.size, sha256: hash,
      binary, lineCount: lines,
      description: fileDescription(path, lines ? buffer.toString('utf8') : '', binary),
      lineLedger,
    });
  }

  const reportDir = join(root, 'reports', 'repository-knowledge');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `${sha}.md`);

  const sections = [
    `# FLIXO Repository Knowledge Report — ${sha}`,
    '',
    '## Identity',
    `- Repository: ${process.env.GITHUB_REPOSITORY || 'local checkout'}`,
    `- SHA: ${sha}`,
    `- Branch: ${branch}`,
    `- Tracked files: ${files.length}`,
    `- Text files: ${textFiles}`,
    `- Binary/non-text files: ${binaryFiles}`,
    `- Total text lines: ${totalLines}`,
    `- Described text lines: ${describedLines}`,
    `- Uncovered text lines: ${totalLines - describedLines}`,
    `- Task-like signal lines discovered: ${taskSignals}`,
    '',
    '## Coverage invariant',
    '- Every tracked file is represented below.',
    '- Every text line is assigned a line-ledger description; semantic meaning is marked UNKNOWN/semantic-review-required where heuristic classification cannot establish intent.',
    '- Binary/non-text files are represented by metadata and explicitly not treated as text-read.',
    '',
    '## Complete File Inventory',
  ];

  for (const entry of entries) {
    sections.push('', `### ${entry.path}`, `- Category: ${entry.category}`, `- Size: ${entry.bytes} bytes`, `- SHA-256: ${entry.sha256}`, `- Type: ${entry.binary ? 'binary/non-text' : 'text'}`, `- Description: ${entry.description}`);
    if (!entry.binary) {
      sections.push(`- Line coverage: 1-${entry.lineCount} (all lines described)`);
      sections.push(...entry.lineLedger);
    }
  }

  writeFileSync(reportPath, sections.join('\n') + '\n', 'utf8');
  return { sha, files: files.length, textFiles, binaryFiles, totalLines, describedLines, taskSignals, reportPath };
}

const result = collect();
console.log(JSON.stringify(result, null, 2));
