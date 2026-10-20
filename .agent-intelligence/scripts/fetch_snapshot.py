#!/usr/bin/env python3
"""FLIXO immutable source snapshot writer; source content is never executed."""
from __future__ import annotations
import argparse, hashlib, json, sys, urllib.error, urllib.parse, urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

MAX_BYTES=1_500_000
MAX_TEXT_BYTES=1_048_576
USER_AGENT="FLIXO-Engineering-Intelligence-Snapshot/1.0"

class SnapshotError(RuntimeError): pass

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts=[]; self.ignored=0
    def handle_starttag(self,tag,attrs):
        tag=tag.lower()
        if tag in {"script","style","noscript","template"}: self.ignored+=1
        elif self.ignored==0 and tag in {"p","div","li","pre","blockquote","h1","h2","h3","h4"}: self.parts.append("\n")
    def handle_endtag(self,tag):
        tag=tag.lower()
        if tag in {"script","style","noscript","template"} and self.ignored: self.ignored-=1
        elif self.ignored==0 and tag in {"p","div","li","pre","blockquote","h1","h2","h3","h4"}: self.parts.append("\n")
    def handle_data(self,data):
        if self.ignored==0 and data.strip(): self.parts.append(data)

def _validate_url(url):
    p=urllib.parse.urlparse(url)
    if p.scheme not in {"http","https"} or not p.netloc or p.username or p.password:
        raise SnapshotError("source URL must be http/https without embedded credentials")
    return url

def _decode(raw,content_type):
    charset="utf-8"
    for part in content_type.split(";")[1:]:
        part=part.strip()
        if part.lower().startswith("charset="):
            charset=part.split("=",1)[1].strip().strip("\"'"); break
    try: return raw.decode(charset,errors="strict")
    except (LookupError,UnicodeDecodeError): return raw.decode("utf-8",errors="replace")

def normalize_text(body,content_type):
    if "html" in content_type.lower() or "<html" in body[:512].lower():
        parser=TextExtractor(); parser.feed(body); body="\n".join(parser.parts)
    lines=[" ".join(line.split()) for line in body.splitlines() if line.strip()]
    text="\n".join(lines).strip()
    if not text: raise SnapshotError("source produced no text")
    encoded=text.encode("utf-8")
    if len(encoded)>MAX_TEXT_BYTES: raise SnapshotError("normalized snapshot text exceeds 1 MiB")
    return text

@dataclass(frozen=True)
class Snapshot:
    snapshot_id:str
    source_url:str
    captured_at:str
    raw_path:str
    text_path:str
    json_path:str
    raw_sha256:str
    byte_count:int

class SnapshotStore:
    def __init__(self,root,opener=None,timeout=20):
        self.root=Path(root); self.opener=opener or urllib.request.urlopen; self.timeout=timeout
    def fetch_and_store(self,source_url,source_type="official_docs",stability="stable",vendor_affiliated=False,evidence_kind="documentation"):
        _validate_url(source_url)
        if source_type not in {"official_docs","release_notes","repository","benchmark","engineering_blog","community","marketing"}: raise SnapshotError("invalid source_type")
        if stability not in {"stable","volatile","unknown"}: raise SnapshotError("invalid stability")
        if evidence_kind not in {"fact","benchmark","release","documentation","opinion","marketing"}: raise SnapshotError("invalid evidence_kind")
        req=urllib.request.Request(source_url,headers={"User-Agent":USER_AGENT,"Accept":"text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1"})
        try:
            response=self.opener(req,timeout=self.timeout)
            raw=response.read(MAX_BYTES+1); content_type=response.headers.get("Content-Type","text/plain")
        except (urllib.error.URLError,TimeoutError,OSError) as exc:
            raise SnapshotError(f"source fetch failed: {exc}") from exc
        if len(raw)>MAX_BYTES: raise SnapshotError("source exceeds 1.5 MiB")
        if not raw: raise SnapshotError("source returned an empty body")
        captured=datetime.now(timezone.utc); digest=hashlib.sha256(raw).hexdigest()
        sid=f"snap-{captured.strftime('%Y%m%dT%H%M%S%fZ')}-{digest[:16]}"
        content=normalize_text(_decode(raw,content_type),content_type)
        self.root.mkdir(parents=True,exist_ok=True)
        json_path=self.root/f"{sid}.json"; raw_path=self.root/f"{sid}.raw"; text_path=self.root/f"{sid}.txt"
        record={"snapshot_id":sid,"captured_at":captured.strftime("%Y-%m-%dT%H:%M:%SZ"),"url":source_url,"source_type":source_type,"stability":stability,"vendor_affiliated":bool(vendor_affiliated),"evidence_kind":evidence_kind,"content":content}
        created=[]
        try:
            with raw_path.open("xb") as f: f.write(raw)
            created.append(raw_path)
            with text_path.open("x",encoding="utf-8") as f: f.write(content+"\n")
            created.append(text_path)
            with json_path.open("x",encoding="utf-8") as f: json.dump(record,f,ensure_ascii=False,indent=2); f.write("\n")
            created.append(json_path)
        except FileExistsError as exc:
            for p in created:
                try: p.unlink()
                except FileNotFoundError: pass
            raise SnapshotError(f"immutable snapshot collision: {sid}") from exc
        return Snapshot(sid,source_url,record["captured_at"],str(raw_path),str(text_path),str(json_path),digest,len(raw))

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--url",required=True); parser.add_argument("--output-dir",default=".agent-intelligence/snapshots")
    parser.add_argument("--source-type",default="official_docs"); parser.add_argument("--stability",default="stable")
    parser.add_argument("--vendor-affiliated",action="store_true"); parser.add_argument("--evidence-kind",default="documentation")
    a=parser.parse_args()
    try: print(json.dumps(SnapshotStore(a.output_dir).fetch_and_store(a.url,a.source_type,a.stability,a.vendor_affiliated,a.evidence_kind).__dict__,ensure_ascii=False))
    except SnapshotError as exc: print(f"SNAPSHOT_FAIL: {exc}",file=sys.stderr); raise SystemExit(1)
