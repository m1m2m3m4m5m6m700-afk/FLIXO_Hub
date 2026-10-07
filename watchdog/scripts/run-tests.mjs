import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root=resolve(import.meta.dirname,"..");
const testRoot=join(root,"test");
function collect(dir){const out=[];for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())out.push(...collect(p));else if(entry.isFile()&&/\.test\.(?:ts|js|mjs|cjs)$/u.test(entry.name))out.push(p);}return out;}
const files=collect(testRoot);if(files.length===0){console.error("WATCHDOG_TESTS=NO_TEST_FILES");process.exit(1);}
const result=spawnSync(process.execPath,["--test","--experimental-strip-types",...files],{cwd:root,stdio:"inherit"});process.exit(result.status??1);
