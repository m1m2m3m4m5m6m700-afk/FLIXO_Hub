import json,sys,tempfile,time,unittest
from datetime import datetime,timezone,timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/".agent-intelligence"/"scripts"))
import triage,reaper
NOW=datetime(2026,10,7,tzinfo=timezone.utc)
def p(i,title,**kw):
    x={"proposal_id":f"P-{i}","status":"VALIDATED","title":title,"proposed_change":title,"repository_gap":"measurable gap","raw_evidence":["evidence"],"repo_refs":["src/example.ts"],"impact":"high","complexity":"low","confidence":90,"risk":"low","strategic_alignment":85,"rollback":"revert"};x.update(kw);return x
class Agent3Triage(unittest.TestCase):
  def setUp(self):
    self.t=tempfile.TemporaryDirectory();self.r=Path(self.t.name)
    (self.r/"المهام.md").write_text("### EXEC-1\n- PRIORITY: P1\n- SCOPE: src/example.ts\n",encoding="utf-8")
    (self.r/"التطوير.md").write_text("# FLIXO\n\n## Architecture Radar\n\n## Technology Radar\n\n## Ecosystem Radar\n",encoding="utf-8")
    (self.r/".agent-intelligence/validated").mkdir(parents=True)
    (self.r/".agent-intelligence/review-queue/queued").mkdir(parents=True)
    (self.r/"الوكلاء/التقارير").mkdir(parents=True,exist_ok=True)
  def tearDown(self):self.t.cleanup()
  def inp(self,x): (self.r/".agent-intelligence/validated/input.json").write_text(json.dumps(x),encoding="utf-8")
  def queued(self):return list((self.r/".agent-intelligence/review-queue/queued").glob("*.json"))
  def test_single(self):
    self.inp([p(1,"Cache diagnostics")]);self.assertEqual(triage.run(self.r)["triaged_card_count"],1);self.assertEqual(triage.verify(self.r)["status"],"PASS")
  def test_semantic_dedup(self):
    self.inp([p("A","Redis Cache",raw_evidence=["redis"]),p("B","Cache-Aside Pattern",proposed_change="Use cache-aside with Redis",raw_evidence=["pattern"])])
    triage.run(self.r);c=json.loads(self.queued()[0].read_text());self.assertEqual(c["merged_proposal_ids"],["P-A","P-B"]);self.assertEqual(set(c["source_evidence"]),{"redis","pattern"})
  def test_semantic_dedup_does_not_overmerge_related_but_distinct(self):
    self.inp([p("A","Redis Cache",entity_key="cache.redis",raw_evidence=["redis evidence"]),
              p("C","Cache Eviction Policy",entity_key="cache.eviction",proposed_change="Eviction policy")])
    triage.run(self.r)
    self.assertEqual(len(self.queued()),2)
  def test_priority(self):
    self.inp([p(2,"Security hardening",impact="critical",complexity="high")]);triage.run(self.r);c=json.loads(self.queued()[0].read_text());self.assertIn("factor_scores",c["priority"]);self.assertIn("rationale",c["priority"])
  def test_dynamic_threshold(self):self.assertEqual(sorted(triage.threshold(n) for n in (1,10,100,1000,10000)),[triage.threshold(n) for n in (1,10,100,1000,10000)])
  def test_scale_10k(self):
    data=[p(i,f"Unique proposal {i}") for i in range(10000)];s=time.monotonic();g=triage.semantic_dedup(data);self.assertEqual(sum(map(len,g)),10000);self.assertLess(time.monotonic()-s,15)
  def test_validation_fail(self):
    self.inp([p(3,"bad",status="DISCOVERED")])
    with self.assertRaises(ValueError):triage.load_validated(self.r)
  def test_queue_corruption_fail_closed(self):
    q=self.r/".agent-intelligence/review-queue/queued";q.mkdir(parents=True,exist_ok=True);(q/"bad.json").write_text("{bad",encoding="utf-8")
    with self.assertRaises(ValueError):triage.verify(self.r)
  def test_missing_lifecycle_fail_closed(self):
    q=self.r/".agent-intelligence/review-queue/queued";q.mkdir(parents=True,exist_ok=True);(q/"bad.json").write_text(json.dumps({"schema":triage.SCHEMA,"review_card_id":"BAD","status":"QUEUED","priority":{"final_priority_score":50}}),encoding="utf-8")
    with self.assertRaises(ValueError):triage.verify(self.r)
  def test_human_gate_and_handoff(self):
    self.inp([p(4,"Approval")]);triage.run(self.r);rid=json.loads(self.queued()[0].read_text())["review_card_id"]
    with self.assertRaises(ValueError):triage.gate(self.r,rid,"approved","github-actions[bot]","")
    out=triage.gate(self.r,rid,"approved","reviewer","ok");self.assertTrue(out["dev_id"].startswith("DEV-"));self.assertEqual(len(list((self.r/".agent-intelligence/handoffs").glob("DEV-*.json"))),1)
  def test_reject_defer(self):
    self.inp([p(5,"Reject"),p(6,"Defer")]);triage.run(self.r);ids=[json.loads(x.read_text())["merged_proposal_ids"][0] for x in self.queued()]
    triage.gate(self.r,ids[0],"rejected","reviewer","no");triage.gate(self.r,ids[1],"deferred","reviewer","later");self.assertTrue(list((self.r/".agent-intelligence/review-queue/rejected").glob("*.json")));self.assertTrue(list((self.r/".agent-intelligence/review-queue/deferred").glob("*.json")))
  def test_ttl_graveyard_suppression(self):
    self.inp([p(7,"Redis Cache")]);triage.run(self.r);q=self.queued()[0];d=json.loads(q.read_text());d["lifecycle"]["expires_at"]=(NOW-timedelta(days=1)).isoformat().replace("+00:00","Z");q.write_text(json.dumps(d),encoding="utf-8");self.assertEqual(reaper.reap(self.r,NOW)["expired_count"],1);self.assertTrue((self.r/".agent-intelligence/graveyard/dropped.jsonl").exists())
    self.inp([p(8,"Redis Cache")]);self.assertEqual(triage.run(self.r)["suppressed_count"],1)
  def test_new_evidence_bypasses_suppression(self):
    self.inp([p(9,"Redis Cache")]);triage.run(self.r);q=self.queued()[0];d=json.loads(q.read_text());d["lifecycle"]["expires_at"]=(NOW-timedelta(days=1)).isoformat().replace("+00:00","Z");q.write_text(json.dumps(d),encoding="utf-8");reaper.reap(self.r,NOW)
    self.inp([p(10,"Redis Cache",raw_evidence=["a","b","c"],evidence_strength=95)]);self.assertEqual(triage.run(self.r)["suppressed_count"],0)
  def test_freeze_resume(self):
    self.inp([p(11,"Freeze test")]);triage.run(self.r);f=self.r/".agent-intelligence/feature-freeze.json";f.write_text(json.dumps({"active":True,"started_at":(NOW-timedelta(days=9)).isoformat(),"ended_at":None}),encoding="utf-8");self.assertEqual(reaper.reap(self.r,NOW+timedelta(days=20))["expired_count"],0);d=json.loads(self.queued()[0].read_text());self.assertIsNotNone(d["lifecycle"]["ttl_pause_started_at"])
    f.write_text(json.dumps({"active":False,"started_at":(NOW-timedelta(days=9)).isoformat(),"ended_at":NOW.isoformat()}),encoding="utf-8");self.assertEqual(reaper.reap(self.r,NOW+timedelta(days=1))["ttl_resumed_count"],1);self.assertIsNone(json.loads(self.queued()[0].read_text())["lifecycle"]["ttl_pause_started_at"])
  def test_top10_and_zero_input_non_destructive(self):
    self.inp([p(i,f"Proposal {i}",impact=i) for i in range(20)]);triage.run(self.r);v=(self.r/"التطوير.md").read_text(encoding="utf-8");section=v[v.index(triage.START):v.index(triage.END)];self.assertEqual(section.count("### "),10);q=set(self.queued());(self.r/".agent-intelligence/validated/input.json").unlink();triage.run(self.r);self.assertEqual(set(self.queued()),q)
  def test_workflow_contracts(self):
    wf=(ROOT/".github/workflows/triage-and-clean.yml").read_text(encoding="utf-8");hg=(ROOT/".github/workflows/human-gate.yml").read_text(encoding="utf-8")
    for s in ("branches: [execution]","ValidatorAdmission","TriageDedupPriorityQueue","ReaperTTLSuppression","GeneratedViewAndStateAudit","FAIL_CLOSED","git -c \"http.extraheader=AUTHORIZATION: bearer $GITHUB_TOKEN\" push origin \"HEAD:execution\""):self.assertIn(s,wf)
    self.assertNotIn("pull_request_target",wf);self.assertIn("workflow_dispatch",hg);self.assertIn("Reject bot actors",hg);self.assertNotIn("HEAD:main",hg)
  def test_validator_result_adapter(self):
    results=self.r/".agent-intelligence/validated/validator-results.json"; inbox=self.r/".agent-intelligence/inbox"; inbox.mkdir(parents=True,exist_ok=True)
    canonical=(self.r/"الوكلاء/التقارير/AGENT-01 — المستكشف AI");canonical.mkdir(parents=True,exist_ok=True)
    (canonical/"P-12.yml").write_text('id: P-12\ntitle: "Validator Cache"\nentity_key: "cache.validator"\n',encoding="utf-8")
    (inbox/"P-12.yml").write_text('id: P-12\ntitle: "Validator Cache"\nentity_key: "cache.validator"\n',encoding="utf-8")
    results.write_text(json.dumps([{"valid":True,"status":"valid","proposal_id":"P-12","checks":{"V-01":"PASS"},"reasons":[]}]),encoding="utf-8")
    rows,_=triage.load_validated(self.r);self.assertEqual(rows[0]["proposal_id"],"P-12")
  def test_invalid_priority_fails_closed(self):
    self.inp([p(13,"Bad priority")]);triage.run(self.r);q=self.queued()[0];d=json.loads(q.read_text());d["priority"]["final_priority_score"]=101;q.write_text(json.dumps(d),encoding="utf-8")
    with self.assertRaises(ValueError):triage.verify(self.r)
if __name__=="__main__":unittest.main()
