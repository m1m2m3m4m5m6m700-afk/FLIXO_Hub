#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".agent-intelligence" / "scripts"))
from validate import StrictYaml, ValidationError

def main():
    if len(sys.argv) != 2:
        raise SystemExit(2)
    path = Path(sys.argv[1]).resolve(strict=True)
    report_root = (ROOT / "الوكلاء" / "التقارير").resolve(strict=True)
    path.relative_to(report_root)
    if path.is_symlink() or not path.is_file():
        raise ValidationError("candidate report must be a regular file")
    proposal = StrictYaml(path.read_text(encoding="utf-8")).parse()
    if not isinstance(proposal, dict):
        raise ValidationError("candidate report must be an object")
    print(json.dumps(proposal, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PARSE_FAIL_CLOSED: " + str(exc), file=sys.stderr)
        raise SystemExit(1)
