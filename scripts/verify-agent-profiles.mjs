import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".github", "agents");
const required = [
  "flixo-qa-agent.md",
  "flixo-i18n-agent.md",
  "flixo-maintainer-agent.md",
  "المستكشف-ai.md",
  "المستكشف-2.md",
  "المطور-ai.md",
  "red-team-1.md",
  "red-team-2.md",
];

const files = new Set(readdirSync(dir));
const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) throw new Error(`Missing agent profiles: ${missing.join(", ")}`);

for (const file of required) {
  const content = readFileSync(join(dir, file), "utf8");
  if (!/^---\r?\n/u.test(content)) throw new Error(`${file}: invalid frontmatter`);
  if (!/100\/100/u.test(content)) throw new Error(`${file}: missing 100/100 training contract`);
  if (/git push origin main|force[- ]push|write directly to main|declare PASS\/GREEN\/CERTIFIED/iu.test(content)) {
    throw new Error(`${file}: forbidden authority language detected`);
  }
}

console.log(`AGENT_PROFILES_OK=${required.length}`);