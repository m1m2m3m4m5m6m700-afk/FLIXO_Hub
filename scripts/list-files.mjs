import { readdirSync, lstatSync } from 'fs';
const all = readdirSync('.');
for (const f of all) {
  const isDir = lstatSync(f).isDirectory();
  console.log((isDir ? '[DIR] ' : '      ') + f);
}
