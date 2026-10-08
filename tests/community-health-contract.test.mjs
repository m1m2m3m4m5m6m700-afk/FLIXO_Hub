import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "SUPPORT.md",
  "ACCESSIBILITY.md",
  "CITATION.cff",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/contribution.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing community file: ${relativePath}`);
  assert.ok(fs.statSync(absolutePath).size > 0, `Empty community file: ${relativePath}`);
}

const citation = fs.readFileSync(path.join(root, "CITATION.cff"), "utf8");
assert.match(citation, /^cff-version:\s*1\.2\.0/m);
assert.match(citation, /^title:\s*"FLIXO Hub"$/m);
assert.match(citation, /^license:\s*"Apache-2\.0"$/m);

for (const issueForm of ["bug_report.yml", "feature_request.yml", "contribution.yml"]) {
  const text = fs.readFileSync(path.join(root, ".github/ISSUE_TEMPLATE", issueForm), "utf8");
  assert.match(text, /^name:\s*.+$/m);
  assert.match(text, /^description:\s*.+$/m);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
assert.match(readme, /good first issue/);
assert.match(readme, /help wanted/);
assert.match(readme, /SUPPORT\.md/);
assert.match(readme, /ACCESSIBILITY\.md/);
assert.match(readme, /CITATION\.cff/);

console.log("COMMUNITY_HEALTH_CONTRACT=PASS");
