import { readFileSync } from 'fs';
const data = readFileSync('/c/Users/Co Re/source/FLIXO_Hub/FLIXO-Tasks.md', 'utf8');
const lines = data.split('\r\n');
let activeStart = -1, activeEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '# ACTIVE DISPATCH QUEUE') activeStart = i;
  if (lines[i] === '# END ACTIVE DISPATCH QUEUE') activeEnd = i;
}
for (let i = activeStart + 1; i < activeEnd; i++) {
  if (lines[i].startsWith('### EXEC-')) {
    const id = lines[i].match(/^### (EXEC-[A-Z0-9-]+)/)?.[1] ?? '?';
    const status = lines[i].match(/\*\*STATUS:\*\* (\w+)/)?.[1] ?? '?';
    const type = lines[i].match(/\*\*TYPE:\*\* (\w+)/)?.[1] ?? '?';
    const title = lines[i].replace(/^### EXEC-[A-Z0-9-]+ ? /u, '').trim();
    console.log(id + '|' + type + '|' + status + '|' + title);
  }
}
