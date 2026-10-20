import { readFileSync, writeFileSync } from 'fs';
const path = '/c/Users/Co Re/source/FLIXO_Hub/scripts/task-dispatch-plan.mjs';
const content = readFileSync(path, 'utf8');

// Replace the CLOSED TASK REGISTER section marker
const oldLine = 'sectionBetween(ledger, "## CLOSED TASK REGISTER", "## HERMES EXECUTION CONTRACT")';
const newLine = 'sectionBetween(ledger, "## CLOSED TASK REGISTER", "# ACTIVE DISPATCH QUEUE")';

if (!content.includes(oldLine)) {
  console.error('OLD LINE NOT FOUND');
  process.exit(1);
}

const newContent = content.replace(oldLine, newLine);
writeFileSync(path, newContent, 'utf8');
console.log('Updated successfully');
console.log('---');
console.log(newContent.split('\n').slice(48, 54).join('\n'));
