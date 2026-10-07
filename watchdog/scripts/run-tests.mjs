import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root=resolve(import.meta.dirname,"..");
const testRoot=join(root,"test");
function collect(dir){const out=[];const suffixes=['.test.ts','.test.js','.test.mjs','.test.cjs'];for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())out.push(...collect(p));else if(entry.isFile()&&suffixes.some(suffix=>entry.name.endsWith(suffix)))out.push(p);}return out;}
const files=collect(testRoot);if(files.length===0){console.error("WATCHDOG_TESTS=NO_TEST_FILES");process.exit(1);}
const result=spawnSync(process.execPath,["--test","--experimental-strip-types",...files],{cwd:root,stdio:"inherit"});process.exit(result.status??1);
