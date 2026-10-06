#!/usr/bin/env python3
"""FLIXO TTL/re-discovery reaper. No approval or execution authority."""
from __future__ import annotations
import argparse,json,sys
from datetime import timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/".agent-intelligence"/"scripts"))
import triage

def write_suppression(root,entries):
    by={}
    for e in entries: by[e.get("entity_key")]=e
    triage.put(triage.suppression_path(root),sorted(by.values(),key=lambda e:(e.get("entity_key",""),e.get("suppressed_until",""))))

def reap(root,when):
    triage.ensure_dirs(root); freeze=triage.freeze_state(root,when); entries=triage.load_suppression(root)
    active=triage.load_cards(root,{"queued","triaged"}); expired=resumed=paused=changed=0
    for state,path,card in active:
        life=card.get("lifecycle")
        if not isinstance(life,dict) or not life.get("created_at") or not life.get("expires_at"): raise ValueError(f"{path}: missing lifecycle")
        created=triage.ts(life["created_at"])
        if freeze["active"]:
            if not life.get("ttl_pause_started_at"):
                life["ttl_pause_started_at"]=triage.iso(max(created,triage.ts(freeze["started_at"])))
                card["updated_at"]=triage.iso(when); triage.put(path,card); paused+=1; changed=True
            continue
        ended=freeze.get("ended_at"); last=life.get("last_freeze_applied_ended_at")
        if ended and freeze.get("started_at") and ended!=last:
            start=max(created,triage.ts(freeze["started_at"])); stop=triage.ts(ended)
            overlap=max(0,int((stop-start).total_seconds()))
            if overlap:
                life["expires_at"]=triage.iso(triage.ts(life["expires_at"])+timedelta(seconds=overlap))
                life["ttl_paused_seconds"]=int(life.get("ttl_paused_seconds",0))+overlap
            life["ttl_pause_started_at"]=None; life["last_freeze_applied_ended_at"]=ended
            card["updated_at"]=triage.iso(when); triage.put(path,card); resumed+=1; changed=True
        if when>=triage.ts(life["expires_at"]):
            pid=(card.get("merged_proposal_ids") or ["unknown"])[0]
            triage.append_jsonl(root/".agent-intelligence"/"graveyard"/"dropped.jsonl",{
                "entity_key":card.get("entity_key"),"proposal_id":pid,"expired_at":life["expires_at"],
                "reason":"TTL expired in review queue","timestamp":triage.iso(when),"review_card_id":card.get("review_card_id")})
            entries.append({"entity_key":card.get("entity_key"),"proposal_id":pid,
                "suppressed_until":triage.iso(when+timedelta(days=triage.SUPPRESSION_DAYS)),
                "expired_at":life["expires_at"],
                "evidence_digest":triage.sha({"evidence":card.get("source_evidence",[]),"sources":card.get("source_refs",{}),"repo_refs":card.get("repo_refs",[])}),
                "evidence_strength":card.get("priority",{}).get("factor_scores",{}).get("evidence_strength",0),
                "evidence_count":len(card.get("source_evidence",[]))})
            path.unlink(); expired+=1; changed=True
    write_suppression(root,entries)
    if changed: triage.write_view(root)
    triage.verify(root)
    return {"status":"PASS","scanned":len(active),"expired_count":expired,"ttl_resumed_count":resumed,"ttl_paused_count":paused,"freeze_active":freeze["active"]}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--repo-root"); ap.add_argument("--now")
    a=ap.parse_args(); root=Path(a.repo_root).resolve() if a.repo_root else ROOT
    try:
        when=triage.ts(a.now) if a.now else triage.now_utc(); print(json.dumps(reap(root,when),ensure_ascii=False)); return 0
    except Exception as e:
        print("FAIL_CLOSED: "+str(e),file=sys.stderr); return 1
if __name__=="__main__": raise SystemExit(main())
