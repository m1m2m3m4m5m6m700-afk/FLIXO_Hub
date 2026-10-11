import test from "node:test";
import assert from "node:assert/strict";
import { compareGateAWaves } from "../../packages/contracts/src/call-gate-a.ts";

const a="0123456789abcdef0123456789abcdef01234567";
const b="fedcba9876543210fedcba9876543210fedcba98";
const wave=(sha:string)=>({sha,admitted:true,opponentStartedBeforeDisclosure:true,exactShaBound:true,reconciliationRecorded:true,redTeamSeparate:true,independentVerification:true,provenancePreserved:true,failureClosed:true});

test("Gate A requires two distinct SHAs with the same protocol invariants",()=>assert.equal(compareGateAWaves(wave(a),wave(b)).passed,true));
test("Gate A rejects repeated SHA",()=>assert.throws(()=>compareGateAWaves(wave(a),wave(a)),/GATE_A_REQUIRES_DISTINCT_SHAS/));
