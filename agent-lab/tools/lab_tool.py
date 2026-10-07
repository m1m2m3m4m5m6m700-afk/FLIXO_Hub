#!/usr/bin/env python3
import argparse, hashlib, hmac, json, os, pathlib, re, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG = ROOT / "agent-lab" / "config" / "lab.config.json"
LEDGER = ROOT / "agent-lab" / "ledger" / "events.jsonl"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")

def die(message):
    print(json.dumps({"ok": False, "error": message}, sort_keys=True))
    raise SystemExit(2)

def load_config():
    try:
        data=json.loads(CONFIG.read_text())
    except Exception as exc:
        die(f"CONFIG_INVALID:{exc}")
    if data.get("version") != 2: die("CONFIG_VERSION_INVALID")
    return data

def sha(value):
    if not isinstance(value,str) or not SHA_RE.fullmatch(value): die("SHA_INVALID")

def validate_card(card):
    for key in ("id","objective","startingSha","solverId","opponentId"):
        if not str(card.get(key,"")).strip(): die(f"CARD_{key.upper()}_REQUIRED")
    sha(card["startingSha"])
    if card["solverId"] == card["opponentId"]: die("INDEPENDENCE_BREACH")
    if not card.get("oppositionPlan"): die("OPPOSITION_PLAN_REQUIRED")
    if not card.get("acceptanceCriteria"): die("ACCEPTANCE_CRITERIA_REQUIRED")
    return True

def append_event(event):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    if LEDGER.exists() and LEDGER.read_text().endswith("\n") is False and LEDGER.read_text(): die("LEDGER_NOT_NEWLINE_TERMINATED")
    payload=json.dumps(event, sort_keys=True, separators=(",",":"))
    with LEDGER.open("a", encoding="utf-8") as fh: fh.write(payload+"\n")

def sign(payload, key):
    return hmac.new(key.encode(), payload.encode(), hashlib.sha256).hexdigest()

def cmd_validate(args):
    config=load_config()
    if args.templates:
        for path in (ROOT/"agent-lab"/"templates").glob("*.json"):
            json.loads(path.read_text())
    print(json.dumps({"ok": True, "configVersion": config["version"]}))

def cmd_gate(args):
    config=load_config()
    card=json.loads(pathlib.Path(args.card).read_text())
    validate_card(card)
    if config["attack"]["opponentRequired"] and not card.get("opponentStarted"): die("OPPONENT_NOT_STARTED")
    if config["attack"]["redTeamRequired"] and not card.get("redTeam"): die("RED_TEAM_REQUIRED")
    if config["attack"]["independentVerificationRequired"] and not card.get("verified"): die("VERIFICATION_REQUIRED")
    if card.get("candidateSha") and card["candidateSha"] != card["sourceSha"]: sha(card["candidateSha"])
    print(json.dumps({"ok": True, "gate": args.name}))

def cmd_attest(args):
    if os.environ.get("CI") != "true": die("ATTESTATION_CI_ONLY")
    key=os.environ.get("LAB_CI_KEY")
    if not key: die("LAB_CI_KEY_REQUIRED")
    payload=pathlib.Path(args.file).read_text()
    print(json.dumps({"ok": True, "sha256": hashlib.sha256(payload.encode()).hexdigest(), "attestation": sign(payload,key)}))

def cmd_calibrate(args):
    if args.runs < 2: die("CALIBRATION_REQUIRES_TWO_RUNS")
    if args.failure_rate < 0 or args.failure_rate > 1: die("FAILURE_RATE_INVALID")
    if args.failure_rate > load_config()["calibration"]["maxFailureRate"]: die("CALIBRATION_FAILED")
    print(json.dumps({"ok": True, "runs": args.runs, "failureRate": args.failure_rate}))

def cmd_ledger_verify(_):
    if not LEDGER.exists(): print(json.dumps({"ok": True, "events": 0})); return
    count=0
    for line in LEDGER.read_text().splitlines():
        json.loads(line); count+=1
    print(json.dumps({"ok": True, "events": count}))

def cmd_ledger_append(args):
    event=json.loads(pathlib.Path(args.file).read_text())
    if not event.get("eventId") or not event.get("sourceSha"): die("LEDGER_EVENT_INVALID")
    sha(event["sourceSha"]); append_event(event)
    print(json.dumps({"ok": True, "eventId": event["eventId"]}))

def cmd_paths(_):
    print(json.dumps({"ok": True, "root": str(ROOT), "config": str(CONFIG), "ledger": str(LEDGER)}))

def main():
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest="cmd",required=True)
    v=sub.add_parser("validate"); v.add_argument("--templates",action="store_true")
    g=sub.add_parser("gate"); g.add_argument("name"); g.add_argument("card")
    a=sub.add_parser("attest-run"); a.add_argument("file")
    c=sub.add_parser("calibrate"); c.add_argument("--runs",type=int,required=True); c.add_argument("--failure-rate",type=float,required=True)
    l=sub.add_parser("ledger-verify")
    la=sub.add_parser("ledger-append"); la.add_argument("file")
    sub.add_parser("paths")
    args=p.parse_args()
    {"validate":cmd_validate,"gate":cmd_gate,"attest-run":cmd_attest,"calibrate":cmd_calibrate,"ledger-verify":cmd_ledger_verify,"ledger-append":cmd_ledger_append,"paths":cmd_paths}[args.cmd](args)
if __name__=="__main__": main()
