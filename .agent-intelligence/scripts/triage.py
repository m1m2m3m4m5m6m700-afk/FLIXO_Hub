#!/usr/bin/env python3
"""FLIXO Agent-3 triage/control-plane engine. Stdlib only, fail-closed."""
from __future__ import annotations
import argparse,hashlib,json,math,re,sys
from datetime import datetime,timedelta,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; BASE=ROOT/".agent-intelligence"; QUEUE=BASE/"review-queue"; GRAVE=BASE/"graveyard"; HANDOFF=BASE/"handoffs"
SCHEMA="flixo.review-card/v1"; TTL_DAYS=14; SUPPRESSION_DAYS=30; HUMAN_LIMIT=10
START,END="<!-- FLIXO_TRIAGE_VIEW:START -->","<!-- FLIXO_TRIAGE_VIEW:END -->"
VALIDATED={"PASS","PASSED","SUCCESS","VALIDATED","VALID"}; DIRS=("inbox","validated","triaged","queued","approved","rejected","deferred")
ALIASES={"redis":"cache","caching":"cache","cache-aside":"cache","cachelayer":"cache","metrics":"observability","logging":"observability","tracing":"observability","auth":"authentication","oauth":"authentication","login":"authentication","xss":"security","csrf":"security","injection":"security","hardening":"security","perf":"performance","latency":"performance","optimization":"performance","webgpu":"acceleration","gpu":"acceleration","wasm":"acceleration"}
STOP=set("""the a an and or to of for in on with from by is are this that new use using system feature support implement add fix improve proposal flixo current repository repo و في من على مع عن الى إلى هذا هذه نظام تحسين إضافة مقترح المستودع يجب يمكن""".split())
GENERIC={"gap","current","repository","measurable","proposal","engineering","system"}

def now_utc(): return datetime.now(timezone.utc).replace(microsecond=0)
def ts(v):
    if not isinstance(v,str) or not v.strip(): raise ValueError("invalid timestamp")
    d=datetime.fromisoformat(v.strip().replace("Z","+00:00")); return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).replace(microsecond=0)
def iso(d): return d.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
def canon(x): return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"))
def sha(x): return hashlib.sha256(canon(x).encode()).hexdigest()
def put(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+".tmp"); tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); tmp.replace(path)
def append_jsonl(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("a",encoding="utf-8") as f:f.write(canon(obj)+"\n")
def norm(v):
    s=str(v or "").lower().replace("_"," ").replace("-"," "); s=re.sub(r"[^\w\u0600-\u06ff]+"," ",s,flags=re.UNICODE); return re.sub(r"\s+"," ",s).strip()
def toks(v): return {ALIASES.get(x,x) for x in norm(v).split() if x not in STOP and len(x)>1}
def concepts(p): return toks(" ".join(str(p.get(k,"")) for k in ("entity_key","title","proposed_change","current_gap","repository_gap","category","scope","lane")))&set(ALIASES.values())
def entity_key(p):
    x=norm(p.get("entity_key"))
    if x:return "explicit:"+re.sub(r"[^a-z0-9\u0600-\u06ff:.]+","-",x).strip("-")[:120]
    t=sorted(toks(p.get("title",""))); return "title:"+"-".join(t[:6] or ["unclassified"])
def safe_id(v):
    s=str(v or "").strip()
    if not s or len(s)>120 or not re.fullmatch(r"[A-Za-z0-9._:-]+",s): raise ValueError("proposal_id must be a safe bounded identifier")
    return s
def validator_ok(p):
    if p.get("validated") is True:return True
    vals=[p.get("validation_status"),p.get("status")]
    for k in ("validation","validator"):
        if isinstance(p.get(k),dict): vals.append(p[k].get("status"))
    return any(isinstance(v,str) and v.upper() in VALIDATED for v in vals)
def required(p):
    pid=safe_id(p.get("proposal_id"))
    if not isinstance(p.get("title"),str) or not p["title"].strip():raise ValueError(f"{pid}: title required")
    if not validator_ok(p):raise ValueError(f"{pid}: validator admission failed")
    return pid
def read_records(path):
    raw=path.read_text(encoding="utf-8")
    if not raw.strip():return []
    if path.suffix.lower()==".jsonl":
        out=[]
        for n,line in enumerate(raw.splitlines(),1):
            if not line.strip():continue
            try:x=json.loads(line)
            except json.JSONDecodeError as e:raise ValueError(f"{path}:{n}: corrupted JSONL") from e
            if not isinstance(x,dict):raise ValueError(f"{path}:{n}: object required")
            out.append(x)
        return out
    try:data=json.loads(raw)
    except json.JSONDecodeError as e:raise ValueError(f"{path}: corrupted JSON") from e
    if isinstance(data,list):return data
    if isinstance(data,dict) and isinstance(data.get("proposals"),list):return data["proposals"]
    if isinstance(data,dict):return [data]
    raise ValueError(f"{path}: unsupported shape")
def load_validated(root):
    base=root/".agent-intelligence"; results_path=base/"validated"/"validator-results.json"; inbox=base/"inbox"; out=[]; refs={}; seen=set()
    if results_path.exists():
        try: results=json.loads(results_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e: raise ValueError("corrupted validator-results.json") from e
        if not isinstance(results,list): raise ValueError("validator-results.json must be a list")
        if not inbox.exists() or not inbox.is_dir(): raise ValueError("validator inbox missing")
        yaml_by_id={}; validator_dir=base/"scripts"; sys.path.insert(0,str(validator_dir))
        try:
            import validate as agent2_validator
            for path in sorted(inbox.iterdir()):
                if not path.is_file() or path.suffix.lower() not in {".yml",".yaml"}: continue
                try: parsed=agent2_validator.StrictYaml(path.read_text(encoding="utf-8")).parse()
                except Exception as e: raise ValueError(f"cannot parse validator input {path.name}") from e
                pid=parsed.get("id") if isinstance(parsed,dict) else None
                if pid:
                    if pid in yaml_by_id: raise ValueError(f"duplicate validator inbox proposal id: {pid}")
                    parsed=dict(parsed); parsed["proposal_id"]=pid; yaml_by_id[pid]=parsed; refs[pid]=path.relative_to(root).as_posix()
        finally:
            if sys.path and sys.path[0]==str(validator_dir): sys.path.pop(0)
        for result in results:
            if not isinstance(result,dict): raise ValueError("validator result entry must be an object")
            pid=result.get("proposal_id")
            if not result.get("valid") or result.get("status")!="valid": raise ValueError(f"validator admission failed for {pid or 'UNKNOWN'}")
            if not isinstance(pid,str) or pid not in yaml_by_id: raise ValueError(f"validator result has no matching inbox proposal: {pid}")
            p=yaml_by_id[pid]; p["_validator_result"]=result
            if pid in seen: raise ValueError(f"duplicate proposal_id: {pid}")
            seen.add(pid); out.append(p)
        return out,refs
    d=base/"validated"
    if not d.exists(): return out,refs
    for path in sorted(d.iterdir()):
        if not path.is_file() or path.name=="validator-results.json" or path.suffix.lower() not in {".json",".jsonl"}: continue
        for p in read_records(path):
            pid=required(p)
            if pid in seen: raise ValueError(f"duplicate proposal_id: {pid}")
            seen.add(pid); out.append(p); refs[pid]=path.relative_to(root).as_posix()
    return out,refs

def ensure_dirs(root):
    for d in DIRS:(root/".agent-intelligence"/"review-queue"/d).mkdir(parents=True,exist_ok=True)
    (root/".agent-intelligence"/"graveyard").mkdir(parents=True,exist_ok=True); (root/".agent-intelligence"/"handoffs").mkdir(parents=True,exist_ok=True)
def evidence(p):
    out=[]
    for k in ("raw_evidence","evidence","sources","source_evidence"):
        v=p.get(k); out+=v if isinstance(v,list) else ([v] if isinstance(v,str) and v.strip() else [])
    if isinstance(p.get("evidence"),dict) and isinstance(p["evidence"].get("quote"),str): out.append(p["evidence"]["quote"])
    return out
def num(v,maps,default):
    if isinstance(v,bool):return 100 if v else 0
    if isinstance(v,(int,float)) and math.isfinite(float(v)):return max(0,min(100,round(v)))
    if isinstance(v,str):
        for k,x in maps.items():
            if k in norm(v):return x
    return default
def impact(p):
    direct=p.get("impact_score",p.get("impact"))
    if direct is None and isinstance(p.get("triage"),dict): direct=p["triage"].get("impact_score")
    base=num(direct,{"critical":95,"high":85,"medium":65,"low":35},55)
    return max(base,88 if concepts(p)&{"security","privacy"} else 0)
def complexity(p):
    direct=p.get("complexity_score",p.get("complexity"))
    if direct is None and isinstance(p.get("triage"),dict): direct=p["triage"].get("complexity_score")
    return num(direct,{"low":25,"medium":55,"high":85},55)
def ev_score(p):
    if isinstance(p.get("evidence_strength"),(int,float)):return num(p["evidence_strength"],{},50)
    return min(100,round(30+7*min(10,len(evidence(p)))+0.5*num(p.get("confidence"),{},0)))
def repo_score(p,root,backlog):
    raw=p.get("repository_relevance")
    if isinstance(raw,(int,float)):return num(raw,{},50)
    refs=p.get("repo_refs",p.get("repository_refs"))
    if refs is None and isinstance(p.get("inference"),dict) and isinstance(p["inference"].get("current_state"),dict): refs=p["inference"]["current_state"].get("repo_refs",[])
    refs=[refs] if isinstance(refs,str) else refs if isinstance(refs,list) else []
    existing=sum(1 for r in refs if (root/str(r)).exists()); overlap=len(toks(p.get("title",""))&toks(backlog))
    return min(100,40+existing*10+min(20,overlap*2)+(15 if entity_key(p) in norm(backlog) else 0))
def strategic(p,backlog):
    raw=p.get("strategic_alignment_score",p.get("strategic_alignment"))
    if isinstance(raw,(int,float)):return num(raw,{},50)
    return min(100,50+min(30,3*len((toks(p.get("title",""))|toks(p.get("proposed_change","")))&toks(backlog)))+(10 if "p0" in norm(p.get("priority")) or "p1" in norm(p.get("priority")) else 0))
def risk(p):return num(p.get("risk"),{"critical":95,"high":80,"medium":55,"low":20},30)
def lane(p):
    direct=(p.get("triage") or {}).get("lane") if isinstance(p.get("triage"),dict) else None
    if isinstance(direct,str) and direct.strip(): return direct.strip()
    s=norm(" ".join(str(p.get(k,"")) for k in ("scope","lane","repo_refs")))
    if ".github/workflows" in s or "workflow" in s:return "A1 — CI/Workflows"
    if "governance" in s or "ruleset" in s or "codeowners" in s:return "A2 — CI/Governance"
    if "src/" in s or "runtime" in s or "media" in s or "tool" in s:return "B — Runtime/Media"
    if "docs/" in s or "i18n" in s or "locale" in s or ".md" in s:return "C — Docs/i18n"
    return "G — Global/Compliance"
def similarity(a,b):
    at,bt=toks(a.get("title")),toks(b.get("title")); aa=at|toks(a.get("proposed_change"))|toks(a.get("repository_gap"))|concepts(a); bb=bt|toks(b.get("proposed_change"))|toks(b.get("repository_gap"))|concepts(b)
    tc=len(at&bt)/max(1,len(at|bt)); bc=len(aa&bb)/max(1,len(aa|bb)); cc=len(concepts(a)&concepts(b))/max(1,len(concepts(a)|concepts(b)))
    ar=set(map(str,a.get("repo_refs",[]) if isinstance(a.get("repo_refs",[]),list) else [])); br=set(map(str,b.get("repo_refs",[]) if isinstance(b.get("repo_refs",[]),list) else []))
    base=min(1,0.55*tc+0.30*bc+0.15*cc+(0.10 if ar&br else 0))
    shared=(aa&bb)-set(concepts(a))-GENERIC
    if concepts(a)&concepts(b) and bc>=0.45 and shared:return max(base,0.82)
    return base
def blocks(p):
    t=sorted(toks(" ".join(str(p.get(k,"")) for k in ("title","proposed_change")))); c=sorted(concepts(p)); k=set()
    if p.get("entity_key"):k.add("entity:"+entity_key(p))
    if c:k.add("concept:"+c[0])
    if t:k.add("token:"+t[0])
    if len(t)>1:k.add("pair:"+t[0]+":"+t[1])
    return k
def dedup(ps):
    groups=[]; reps=[]; index={}
    for p in sorted(ps,key=lambda x:x["proposal_id"]):
        cand=set()
        for k in blocks(p):cand.update(index.get(k,[]))
        best=None; score=0
        for i in sorted(cand):
            z=similarity(p,reps[i])
            if z>=0.78 and z>score:best,score=i,z
        if best is None:best=len(groups);groups.append([]);reps.append(p)
        groups[best].append(p)
        for k in blocks(p):index.setdefault(k,[]).append(best)
    return groups
def threshold(n):return min(90,45+round(7*math.log10(max(1,n)+1)))
def priority(group,root,backlog):
    im=max(impact(p) for p in group);cx=min(complexity(p) for p in group);ev=max(ev_score(p) for p in group);rr=max(repo_score(p,root,backlog) for p in group);sa=max(strategic(p,backlog) for p in group);rs=max(risk(p) for p in group)
    adj=-5 if rs>=80 else -2 if rs>=60 else 0; final=max(0,min(100,round(im*.30+(100-cx)*.15+ev*.20+rr*.20+sa*.15+adj)))
    fs=[("impact",im),("evidence_strength",ev),("repository_relevance",rr),("strategic_alignment",sa),("complexity_inverse",100-cx)];fs.sort(key=lambda z:(-z[1],z[0]))
    return {"final_priority_score":int(final),"factor_scores":{"impact_score":im,"complexity_score":cx,"evidence_strength":ev,"repository_relevance":rr,"strategic_alignment":sa,"risk_score":rs},"risk_adjustment":adj,"rationale":f"Priority {final}/100: {fs[0][0]}={fs[0][1]}, then {fs[1][0]}={fs[1][1]}; complexity={cx}"+(f"; risk adjustment={adj}." if adj else ".")}
def make_card(group,root,backlog,refs,created,flow):
    group=sorted(group,key=lambda p:p["proposal_id"]);ek=entity_key(group[0]);rid="RQ-"+sha(ek+"|"+"|".join(p["proposal_id"] for p in group))[:12].upper();pr=priority(group,root,backlog);src=[];rr=[]
    for p in group:
        for x in evidence(p):
            if str(x) not in src:src.append(str(x))
        vals=p.get("repo_refs",p.get("repository_refs"))
        if vals is None and isinstance(p.get("inference"),dict) and isinstance(p["inference"].get("current_state"),dict): vals=p["inference"]["current_state"].get("repo_refs",[])
        vals=[vals] if isinstance(vals,str) else vals if isinstance(vals,list) else []
        for x in vals:
            if str(x) not in rr:rr.append(str(x))
    life={"created_at":iso(created),"expires_at":iso(created+timedelta(days=TTL_DAYS)),"last_viewed_by_human":None,"ttl_days":TTL_DAYS,"ttl_paused_seconds":0,"ttl_pause_started_at":None,"last_freeze_applied_ended_at":None}
    return {"schema":SCHEMA,"review_card_id":rid,"entity_key":ek,"status":"QUEUED","created_at":iso(created),"updated_at":iso(created),"lifecycle":life,"merged_proposal_ids":[p["proposal_id"] for p in group],"all_proposals":group,"source_refs":{p["proposal_id"]:refs.get(p["proposal_id"]) for p in group},"source_evidence":src,
      "combined_rationale":"\n".join(f"{p['proposal_id']}: {p.get('rationale') or p.get('proposed_change','')}" for p in group),"repo_refs":sorted(rr),"proposed_change":group[0].get("proposed_change",((group[0].get("inference") or {}).get("proposal",""))),"repository_gap":group[0].get("repository_gap",group[0].get("current_gap","No explicit gap field; independently verify current repository state." ) ),"impact":pr["factor_scores"]["impact_score"],"complexity":pr["factor_scores"]["complexity_score"],"priority":pr,"lane":lane(group[0]),
      "rollback":str(group[0].get("rollback",group[0].get("rollback_plan",(group[0].get("inference") or {}).get("rollback","")))) or "Verify independently before execution; Triage executes no code changes.","threshold":{"flow_size_basis":flow,"acceptance_threshold":threshold(flow),"threshold_met":pr["final_priority_score"]>=threshold(flow),"human_view_limit":HUMAN_LIMIT},
      "audit":{"input_proposal_ids":[p["proposal_id"] for p in group],"merged_ids":[p["proposal_id"] for p in group] if len(group)>1 else [],"reason":"semantic-dedup + weighted priority model","timestamp":iso(now_utc()),"agent":"AGENT-3","version":"2026-10-07","result":"QUEUED"}}
def suppression_path(root):return root/".agent-intelligence"/"graveyard"/"suppression-index.json"
def load_suppression(root):
    p=suppression_path(root)
    if not p.exists():return []
    try:d=json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:raise ValueError("corrupted suppression index") from e
    if not isinstance(d,list):raise ValueError("suppression index must be a list")
    return d
def ev_digest(p):return sha({"evidence":evidence(p),"sources":p.get("sources",[]),"repo_refs":p.get("repo_refs",[]),"evidence_strength":p.get("evidence_strength")})
def allowed_by_suppression(p,entries,now):
    k=entity_key(p);inc=ev_digest(p)
    for e in entries:
        if e.get("entity_key")!=k:continue
        try:until=ts(e["suppressed_until"])
        except Exception:continue
        if now>=until:continue
        if e.get("evidence_digest")!=inc and (ev_score(p)>=int(e.get("evidence_strength",0))+10 or len(evidence(p))>int(e.get("evidence_count",0))):return True,None
        return False,"30-day re-discovery suppression"
    return True,None
def freeze_state(root,at):
    p=root/".agent-intelligence"/"feature-freeze.json"
    if not p.exists():return {"active":False,"started_at":None,"ended_at":None}
    try:d=json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:raise ValueError("corrupted feature-freeze.json") from e
    if not isinstance(d,dict) or not isinstance(d.get("active"),bool):raise ValueError("invalid feature-freeze.json")
    if d["active"]:
        if not d.get("started_at"):raise ValueError("active feature freeze requires started_at")
        return {"active":True,"started_at":iso(ts(d["started_at"])),"ended_at":None}
    return {"active":False,"started_at":d.get("started_at"),"ended_at":iso(ts(d["ended_at"])) if d.get("ended_at") else iso(at)}
def load_cards(root,states=None):
    states=states or set(DIRS);q=root/".agent-intelligence"/"review-queue";out=[]
    for s in sorted(states):
        d=q/s
        if not d.exists():continue
        for p in sorted(d.glob("*.json")):
            try:o=json.loads(p.read_text(encoding="utf-8"))
            except Exception as e:raise ValueError(f"corrupted queue entry {p}") from e
            if not isinstance(o,dict):raise ValueError(f"{p}: queue entry must be object")
            out.append((s,p,o))
    return out
def render_view(root):
    cards=[o for _,_,o in load_cards(root,{"queued"})];cards.sort(key=lambda o:(-o["priority"]["final_priority_score"],o["review_card_id"]));vis=cards[:HUMAN_LIMIT]
    lines=[START,"## Human Review View — GENERATED","",
      "<!-- AGENT-3 generated view; queue storage is .agent-intelligence/review-queue/. -->",
      "<!-- Human decisions are accepted only by .github/workflows/human-gate.yml. -->","",f"Current queued proposals: {len(cards)}",f"Human view limit: {HUMAN_LIMIT}",""]
    if not vis:lines+=["_No currently queued validated proposals._",""]
    for i,c in enumerate(vis,1):
        raw=" | ".join(x[:280].replace("\n"," ") for x in c.get("source_evidence",[])[:3]) or "none"
        lines += [f"### {i}. {c['all_proposals'][0].get('title','Untitled')} — \u0060{c['review_card_id']}\u0060",f"- Title: {c['all_proposals'][0].get('title','Untitled')}",f"- Raw Evidence: {raw}",f"- Repository Gap: {str(c.get('repository_gap','')).replace(chr(10),' ')[:500] or 'none'}",f"- Impact: {c['impact']}/100",f"- Complexity: {c['complexity']}/100",f"- Priority: {c['priority']['final_priority_score']}/100 — {c['priority']['rationale']}",f"- Lane: {c.get('lane','G — Global/Compliance')}",f"- Rollback: {str(c.get('rollback','')).replace(chr(10),' ')[:500]}",f"- Expires At: {c['lifecycle']['expires_at']}",""]
    return "\n".join(lines+[END,""])
def write_view(root):
    p=root/"التطوير.md";original=p.read_text(encoding="utf-8") if p.exists() else "# FLIXO\n\n";generated=render_view(root);a,b=original.find(START),original.find(END)
    if a>=0 and b>=a:original=original[:a].rstrip()+"\n\n"+original[b+len(END):].lstrip()
    p.write_text(original.rstrip()+"\n\n"+generated,encoding="utf-8")
def run(root):
    ensure_dirs(root);n=now_utc();queue=root/".agent-intelligence"/"review-queue";grave=root/".agent-intelligence"/"graveyard";proposals,refs=load_validated(root);backlog=(root/"المهام.md").read_text(encoding="utf-8") if (root/"المهام.md").exists() else ""
    backlog+="\n"+((root/"التطوير.md").read_text(encoding="utf-8") if (root/"التطوير.md").exists() else "")
    old={c["review_card_id"]:c for _,_,c in load_cards(root,{"triaged","queued"})}
    if not proposals:
        write_view(root)
        return {"status":"PASS","validated_input_count":0,"admitted_count":0,"suppressed_count":0,"triaged_card_count":len(old),"human_view_count":min(HUMAN_LIMIT,len(old)),"dynamic_threshold":threshold(1)}
    terminal={pid for _,_,c in load_cards(root,{"approved","rejected","deferred"}) for pid in c.get("merged_proposal_ids",[])};sup=load_suppression(root);admitted=[];suppressed=0
    for p in proposals:
        pid=p["proposal_id"];put(queue/"inbox"/f"{pid}.json",p);ok,reason=allowed_by_suppression(p,sup,n)
        if pid in terminal:continue
        if not ok:append_jsonl(grave/"dropped.jsonl",{"entity_key":entity_key(p),"proposal_id":pid,"expired_at":None,"reason":reason,"timestamp":iso(n)});suppressed+=1
        else:put(queue/"validated"/f"{pid}.json",p);admitted.append(p)
    for s in ("triaged","queued"):
        for p in (queue/s).glob("*.json"):p.unlink()
    cards=[]
    for g in dedup(admitted):
        rid="RQ-"+sha(entity_key(g[0])+"|"+"|".join(p["proposal_id"] for p in g))[:12].upper();created=ts(old[rid]["lifecycle"]["created_at"]) if rid in old else n
        c=make_card(g,root,backlog,refs,created,len(admitted));put(queue/"triaged"/f"{c['review_card_id']}.json",c)
        (queue/"triaged"/f"{c['review_card_id']}.json").replace(queue/"queued"/f"{c['review_card_id']}.json");cards.append(c)
    write_view(root)
    return {"status":"PASS","validated_input_count":len(proposals),"admitted_count":len(admitted),"suppressed_count":suppressed,"triaged_card_count":len(cards),"human_view_count":min(HUMAN_LIMIT,len(cards)),"dynamic_threshold":threshold(len(admitted) or 1)}
def verify(root):
    freeze=freeze_state(root,now_utc());counts={s:0 for s in DIRS};seen=set()
    for state,path,c in load_cards(root,{"triaged","queued","approved","rejected","deferred"}):
        counts[state]+=1
        if c.get("schema")!=SCHEMA or not isinstance(c.get("review_card_id"),str) or c["review_card_id"] in seen:raise ValueError(f"{path}: invalid/duplicate card")
        seen.add(c["review_card_id"])
        if c.get("status")!=state.upper():raise ValueError(f"{path}: status/directory mismatch")
        life=c.get("lifecycle")
        if not isinstance(life,dict) or not life.get("created_at") or not life.get("expires_at") or "last_viewed_by_human" not in life:raise ValueError(f"{path}: missing lifecycle")
        ts(life["created_at"]);ts(life["expires_at"]);pr=c.get("priority",{}).get("final_priority_score")
        if not isinstance(pr,int) or not 0<=pr<=100:raise ValueError(f"{path}: invalid priority")
        if state=="approved" and not str(c.get("handoff",{}).get("dev_id","")).startswith("DEV-"):raise ValueError(f"{path}: missing handoff")
        if not freeze["active"] and state in {"queued","triaged"} and now_utc()>=ts(life["expires_at"]):raise ValueError(f"{path}: expired card remains queued")
    p=root/"التطوير.md"
    if not p.exists():raise ValueError("missing التطوير.md")
    text=p.read_text(encoding="utf-8");a,b=text.find(START),text.find(END)
    if a<0 or b<a or text[a:b+len(END)].strip()!=render_view(root).strip():raise ValueError("generated view stale/missing")
    dropped=GRAVE/"dropped.jsonl"
    if dropped.exists():
        for i,line in enumerate(dropped.read_text(encoding="utf-8").splitlines(),1):
            if not line.strip():continue
            e=json.loads(line)
            for k in ("entity_key","proposal_id","reason","timestamp"):
                if k not in e:raise ValueError(f"{dropped}:{i}: missing audit field {k}")
    return {"status":"PASS","counts":counts,"freeze_active":freeze["active"],"human_view_count":min(HUMAN_LIMIT,counts["queued"])}
def gate(root,ref,decision,actor,note):
    queue=root/".agent-intelligence"/"review-queue";handoff=root/".agent-intelligence"/"handoffs"
    if not actor or actor.lower().endswith("[bot]") or actor.lower() in {"github-actions","dependabot"}:raise ValueError("human gate requires non-bot actor")
    if decision not in {"approved","rejected","deferred"}:raise ValueError("invalid decision")
    found=[(p,c) for _,p,c in load_cards(root,{"queued"}) if c.get("review_card_id")==ref or ref in c.get("merged_proposal_ids",[])]
    if len(found)!=1:raise ValueError(f"queued match count={len(found)}")
    path,c=found[0];n=now_utc();c["status"]=decision.upper();c["updated_at"]=iso(n);c["lifecycle"]["last_viewed_by_human"]=iso(n);c["approval"]={"decision":decision.upper(),"actor":actor,"timestamp":iso(n),"note":note}
    if decision=="approved":
        dev="DEV-"+sha(c["review_card_id"]+"|"+actor)[:8].upper()
        h={"schema":"flixo.execution-handoff/v1","dev_id":dev,"proposal_id":c["merged_proposal_ids"][0],"review_card_id":c["review_card_id"],"entity_key":c["entity_key"],"evidence":c["source_evidence"],"repo_refs":c["repo_refs"],"proposed_change":c["proposed_change"],"rollback":c["rollback"],"priority":c["priority"],"triage_rationale":c["priority"]["rationale"],"approval_metadata":c["approval"],"certificate_linkage":{"mechanism":"docs/FLIXO-FINAL-CERTIFICATION-ATTESTATION.md","record":"PENDING exact-SHA evidence; hand-off is not certification."}}
        c["handoff"]=h;put(handoff/f"{dev}.json",h)
    target=queue/decision/path.name;put(target,c);path.unlink();return {"status":"PASS","decision":decision.upper(),"review_card_id":c["review_card_id"],"dev_id":c.get("handoff",{}).get("dev_id")}
run_triage=run;verify_state=verify;human_gate=gate;dynamic_threshold=threshold;semantic_dedup=dedup
def main():
    ap=argparse.ArgumentParser();ap.add_argument("command",choices=["validate","run","verify","gate"]);ap.add_argument("--repo-root");ap.add_argument("--proposal");ap.add_argument("--decision");ap.add_argument("--actor");ap.add_argument("--note",default="")
    a=ap.parse_args();root=Path(a.repo_root).resolve() if a.repo_root else ROOT
    try:
        if a.command=="validate":r={"status":"PASS","validated_input_count":len(load_validated(root)[0])}
        elif a.command=="run":r=run(root)
        elif a.command=="verify":r=verify(root)
        else:r=gate(root,a.proposal,a.decision,a.actor,a.note)
        print(json.dumps(r,ensure_ascii=False));return 0
    except Exception as e:print("FAIL_CLOSED: "+str(e),file=sys.stderr);return 1
if __name__=="__main__":raise SystemExit(main())
