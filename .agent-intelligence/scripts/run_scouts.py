#!/usr/bin/env python3
"""Manifest-driven infinite FLIXO discovery intake.
Network content is data only; no source text reaches a command/evaluator."""
from __future__ import annotations
import argparse,hashlib,json,re,sys
from datetime import datetime,timedelta,timezone
from pathlib import Path
from fetch_snapshot import SnapshotError,SnapshotStore

CATEGORIES={"ARCHITECTURE":"architecture","TECHNOLOGY":"technology","ECOSYSTEM":"ecosystem"}
PREFIX={"ARCHITECTURE":"ARCH","TECHNOLOGY":"TECH","ECOSYSTEM":"ECO"}

def parse_manifest(path):
    try: data=json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc: raise ValueError(f"invalid Scout YAML/JSON-subset manifest: {path}") from exc
    if data.get("format")!="flixo-scout-manifest-v1" or data.get("role") not in CATEGORIES: raise ValueError(f"invalid Scout manifest: {path}")
    if not isinstance(data.get("sources"),list) or not data["sources"]: raise ValueError(f"Scout has no sources: {path}")
    return data

def quote_unique(content):
    raw=str(content)
    if not raw.strip():
        raise ValueError("snapshot content is empty")
    for size in (1200,1000,800,600,500,400,300,240,200,160,120,96,80,64,48,32):
        if len(raw) < size:
            continue
        for pos in range(0, len(raw) - size + 1, max(1, size // 4)):
            candidate=raw[pos:pos + size].strip()
            if candidate and raw.count(candidate)==1:
                return candidate
        candidate=raw[-size:].strip()
        if candidate and raw.count(candidate)==1:
            return candidate
    raise ValueError("could not select a unique evidence quote from raw snapshot")

def repo_ref_exists(root,ref):
    target=Path(root)/ref.split(":",1)[0]
    return target.exists() and not target.is_symlink()

def build_proposal(root,manifest,source,snapshot):
    refs=source.get("repo_refs",manifest.get("default_repo_refs",[]))
    if not refs or not all(repo_ref_exists(root,r) for r in refs): raise ValueError("all repo_refs must exist")
    now=datetime.now(timezone.utc)
    entity=source.get("entity_key") or f"{re.sub(r'[^a-z0-9]+','-',source['title'].lower()).strip('-')}::{CATEGORIES[manifest['role']]}"
    suffix=int(now.strftime("%H%M%S%f")[:8])
    proposal_id=f"{PREFIX[manifest['role']]}-{suffix:08d}"
    proposal={
      "id":proposal_id,"category":CATEGORIES[manifest["role"]],"title":source["title"],"status":"candidate","entity_key":entity,
      "lifecycle":{"created_at":now.strftime("%Y-%m-%dT%H:%M:%SZ"),"expires_at":(now+timedelta(days=int(manifest.get("ttl_days",14)))).strftime("%Y-%m-%dT%H:%M:%SZ"),"last_viewed_by_human":now.strftime("%Y-%m-%dT%H:%M:%SZ")},
      "source":{"snapshot_id":snapshot.snapshot_id,"vendor_affiliated":bool(source.get("vendor_affiliated",False))},
      "evidence":{"quote":quote_unique(Path(snapshot.text_path).read_text(encoding="utf-8"))},
      "inference":{"current_state":{"repo_refs":refs},"proposal":source["proposal"],"rollback":source["rollback"]},
      "triage":{"impact_score":0,"complexity_score":0,"final_priority_score":0,"lane":CATEGORIES[manifest["role"]]}
    }
    validate_proposal(proposal,root,snapshot)
    return proposal

def validate_proposal(p,root,snapshot):
    required={"id","category","title","status","entity_key","lifecycle","source","evidence","inference","triage"}
    if set(p)!=required or p["status"]!="candidate": raise ValueError("discovery emits candidate reports only with exact top-level schema")
    if not re.fullmatch(r"^[A-Z][A-Z0-9_-]{1,31}-[0-9]{2,8}$",p["id"]): raise ValueError("invalid proposal id")
    if not re.fullmatch(r"^[a-z][a-z0-9._-]{1,63}$",p["category"]): raise ValueError("invalid category")
    if not re.fullmatch(r"^[a-z0-9][a-z0-9._:/-]{1,127}$",p["entity_key"]): raise ValueError("invalid entity_key")
    l=p["lifecycle"]
    if set(l)!={"created_at","expires_at","last_viewed_by_human"} or datetime.strptime(l["created_at"],"%Y-%m-%dT%H:%M:%SZ")>datetime.strptime(l["expires_at"],"%Y-%m-%dT%H:%M:%SZ"): raise ValueError("invalid lifecycle")
    s=p["source"]
    if set(s)!={"snapshot_id","vendor_affiliated"}: raise ValueError("invalid source")
    if not p["evidence"]["quote"] or Path(snapshot.text_path).read_text(encoding="utf-8").count(p["evidence"]["quote"])!=1: raise ValueError("quote must match snapshot exactly once")
    refs=p["inference"]["current_state"]["repo_refs"]
    if set(p["inference"])!={"current_state","proposal","rollback"} or not refs or not all(repo_ref_exists(root,r) for r in refs) or not p["inference"]["rollback"].strip(): raise ValueError("invalid inference")
    if set(p["triage"])!={"impact_score","complexity_score","final_priority_score","lane"} or p["triage"]["lane"] not in CATEGORIES.values(): raise ValueError("invalid raw triage state")

def scalar(v):
    if v is None:return "null"
    if v is True:return "true"
    if v is False:return "false"
    return json.dumps(v,ensure_ascii=False)

def dump_yaml(p):
    lines=[f"id: {scalar(p['id'])}",f"category: {scalar(p['category'])}",f"title: {scalar(p['title'])}",f"status: {scalar(p['status'])}",f"entity_key: {scalar(p['entity_key'])}","lifecycle:",f"  created_at: {scalar(p['lifecycle']['created_at'])}",f"  expires_at: {scalar(p['lifecycle']['expires_at'])}",f"  last_viewed_by_human: {scalar(p['lifecycle']['last_viewed_by_human'])}","source:",f"  snapshot_id: {scalar(p['source']['snapshot_id'])}",f"  vendor_affiliated: {scalar(p['source']['vendor_affiliated'])}","evidence:",f"  quote: {scalar(p['evidence']['quote'])}","inference:","  current_state:","    repo_refs:"]
    lines += [f"      - {scalar(r)}" for r in p["inference"]["current_state"]["repo_refs"]]
    lines += [f"  proposal: {scalar(p['inference']['proposal'])}",f"  rollback: {scalar(p['inference']['rollback'])}","triage:",f"  impact_score: {scalar(p['triage']['impact_score'])}",f"  complexity_score: {scalar(p['triage']['complexity_score'])}",f"  final_priority_score: {scalar(p['triage']['final_priority_score'])}",f"  lane: {scalar(p['triage']['lane'])}"]
    return "\n".join(lines)+"\n"

def write_append_only(path,text):
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    try:
        with Path(path).open("x",encoding="utf-8") as f: f.write(text)
    except FileExistsError as exc: raise ValueError(f"append-only collision: {path}") from exc

def canonical_report_root(root, report_root):
    canonical=(Path(root)/"الوكلاء"/"التقارير").resolve()
    requested=Path(report_root)
    requested=(requested if requested.is_absolute() else Path(root)/requested).resolve()
    if requested != canonical:
        raise ValueError("discovery report_root must be the canonical الوكلاء/التقارير center")
    inbox=Path(root)/".agent-intelligence"/"inbox"
    if not inbox.exists() or not inbox.is_dir() or inbox.is_symlink():
        raise ValueError("discovery inbox deny-only sentinel is missing or unsafe")
    unexpected=[p.name for p in inbox.iterdir() if p.name not in {".gitkeep","README.md"}]
    if unexpected:
        raise ValueError("discovery inbox deny-only violation: "+",".join(sorted(unexpected)))
    return canonical

def run(root,manifest_dir,report_root,snapshots_dir,opener=None):
    canonical_root=canonical_report_root(Path(root),report_root)
    store=SnapshotStore(snapshots_dir,opener=opener); outputs=[]
    for mp in sorted(Path(manifest_dir).glob("*.yaml")):
        manifest=parse_manifest(mp)
        for source in manifest["sources"]:
            snapshot=store.fetch_and_store(source["url"],source.get("source_type","official_docs"),source.get("stability","stable"),source.get("vendor_affiliated",False),source.get("evidence_kind","documentation"))
            proposal=build_proposal(root,manifest,source,snapshot)
            role_dir = {
                "ARCHITECTURE":"AGENT-08 — Architecture Scout",
                "TECHNOLOGY":"AGENT-09 — Technology Scout",
                "ECOSYSTEM":"AGENT-10 — Ecosystem Scout",
            }[manifest["role"]]
            canonical_root = canonical_report_root(Path(root), report_root)
            out=canonical_root/role_dir/f"اقتراح-{proposal['id']}.yaml"
            while out.exists():
                old=int(proposal["id"].rsplit("-",1)[1]); new=(old+1)%100_000_000
                proposal["id"]=f"{PREFIX[manifest['role']]}-{new:08d}"; out=canonical_root/role_dir/f"اقتراح-{proposal['id']}.yaml"
            write_append_only(out,dump_yaml(proposal)); outputs.append(out)
    return outputs

if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--repo-root",default="."); parser.add_argument("--manifest-dir",default=".agent-intelligence/scouts"); parser.add_argument("--report-root",default="الوكلاء/التقارير"); parser.add_argument("--snapshots-dir",default=".agent-intelligence/snapshots")
    a=parser.parse_args()
    try: out=run(Path(a.repo_root),Path(a.manifest_dir),Path(a.report_root),Path(a.snapshots_dir))
    except (SnapshotError,ValueError,OSError) as exc: print(f"DISCOVERY_FAIL_CLOSED: {exc}",file=sys.stderr); raise SystemExit(1)
    print(json.dumps({"count":len(out),"outputs":[str(p) for p in out]},ensure_ascii=False))
