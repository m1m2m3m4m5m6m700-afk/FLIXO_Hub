import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const packages={
  architecture:["flixo-scout-architecture.agent.md","الوكلاء/المستكشفين/Architecture Scout/المستكشف.md",".agent-intelligence/scouts/architecture.yaml"],
  technology:["flixo-scout-technology.agent.md","الوكلاء/المستكشفين/Technology Scout/المستكشف.md",".agent-intelligence/scouts/technology.yaml"],
  ecosystem:["flixo-scout-ecosystem.agent.md","الوكلاء/المستكشفين/Ecosystem Scout/المستكشف.md",".agent-intelligence/scouts/ecosystem.yaml"],
};

test("all three Scouts have canonical packages under الوكلاء/المستكشفين",()=>{
  for(const [role,[registration,canonical,manifest]] of Object.entries(packages)){
    assert.equal(existsSync(join(root,canonical)),true,role+" canonical package missing");
    assert.equal(existsSync(join(root,manifest)),true,role+" machine manifest missing");
    const r=readFileSync(join(root,".github/agents",registration),"utf8");
    assert.match(r,new RegExp(canonical.replace(/[.*+?^()|[]{}\\]/g,"\\$&").replace("/المستكشف.md","/")));
  }
});

test("canonical package explicitly denies runtime authority",()=>{
  for(const [,canonical] of Object.values(packages)){
    const c=readFileSync(join(root,canonical),"utf8");
    assert.match(c,/لا.*(?:تنفذ|execution)|لا.*(?:تمنح|approval|certification)/iu);
  }
});
