import test from "node:test";
import assert from "node:assert/strict";
import {
  createRankRecord, awardXp, rankForXp, routeAfterFailure,
  nextCouncilSize, electSovereign, assertSovereignScope,
} from "../../packages/contracts/src/call-ranks.ts";

test("XP determines rank deterministically", () => {
  assert.equal(rankForXp(0), "INITIATE");
  assert.equal(rankForXp(300), "SPECIALIST");
  assert.equal(rankForXp(3000), "SOVEREIGN");
});
test("XP requires evidence and promotes rank", () => {
  const a = createRankRecord("builder");
  assert.throws(() => awardXp(a, 100, false), /XP_EVIDENCE_REQUIRED/);
  assert.equal(awardXp(a, 300, true).rank, "SPECIALIST");
});
test("first failure hands work to the next ranked agent without competition", () => {
  const result = routeAfterFailure("task-1", "a", 1, [
    { ...createRankRecord("a"), xp: 900, rank: "SENIOR" },
    { ...createRankRecord("b"), xp: 700, rank: "SENIOR" },
    { ...createRankRecord("c"), xp: 300, rank: "SPECIALIST" },
  ]);
  assert.equal(result.selectedAgentId, "b");
  assert.equal(result.council, false);
  assert.deepEqual(result.participants, ["b"]);
});
test("repeated failure expands the council", () => {
  assert.equal(nextCouncilSize(1), 1);
  assert.equal(nextCouncilSize(2), 2);
  assert.equal(nextCouncilSize(3), 3);
  const result = routeAfterFailure("task-2", "a", 2, [
    { ...createRankRecord("a"), xp: 900, rank: "SENIOR" },
    { ...createRankRecord("b"), xp: 700, rank: "SENIOR" },
    { ...createRankRecord("c"), xp: 600, rank: "SPECIALIST" },
  ]);
  assert.equal(result.council, true);
  assert.deepEqual(result.participants, ["a", "b"]);
});
test("highest proven XP becomes sovereign for execution leadership", () => {
  const s = electSovereign([
    { ...createRankRecord("a"), xp: 3100, rank: "SOVEREIGN", successfulRuns: 2 },
    { ...createRankRecord("b"), xp: 5000, rank: "SOVEREIGN", successfulRuns: 1 },
  ]);
  assert.equal(s.agentId, "b");
});
test("sovereign cannot override policy or certification", () => {
  assert.doesNotThrow(() => assertSovereignScope("EXECUTION"));
  assert.throws(() => assertSovereignScope("POLICY"), /SOVEREIGN_CANNOT_OVERRIDE_GOVERNANCE/);
  assert.throws(() => assertSovereignScope("CERTIFICATION"), /SOVEREIGN_CANNOT_OVERRIDE_GOVERNANCE/);
});
