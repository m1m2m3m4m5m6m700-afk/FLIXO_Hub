#!/usr/bin/env python3
"""FLIXO AGENT-2 deterministic proposal validator.

The validator is fail-closed and mutation-free. It parses a deliberately strict
YAML subset so anchors, aliases, duplicate keys, tags, ambiguous flow syntax,
and unsafe scalar forms are rejected without depending on a third-party YAML
runtime.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import sys
from pathlib import Path
from typing import Any


MAX_PROPOSAL_BYTES = 64 * 1024
MAX_SNAPSHOT_BYTES = 1024 * 1024
MAX_REASONS = 32

REQUIRED_TOP = {
    "id",
    "category",
    "title",
    "status",
    "entity_key",
    "lifecycle",
    "source",
    "evidence",
    "inference",
    "triage",
}

ALLOWED_STATUS = {"inbox", "triaged", "queued", "approved", "rejected", "expired"}
ALLOWED_LANE = {
    "architecture",
    "technology",
    "ecosystem",
    "security",
    "performance",
    "reliability",
    "developer-experience",
    "watch",
}

PROPOSAL_ID_RE = re.compile(r"^[A-Z][A-Z0-9_-]{1,31}-[0-9]{2,8}$")
CATEGORY_RE = re.compile(r"^[a-z][a-z0-9._-]{1,63}$")
ENTITY_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9._:/-]{1,127}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$")

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior|earlier)\s+instructions?", re.I),
    re.compile(r"disregard\s+(?:the\s+)?(?:system|developer|security)\s+instructions?", re.I),
    re.compile(r"reveal\s+(?:the\s+)?system\s+prompt", re.I),
    re.compile(r"(?:run|execute)\s+(?:the\s+)?(?:shell|terminal|command)", re.I),
    re.compile(r"\b(?:bash|powershell|terminal|cmd\.exe|curl|wget|rm\s+-rf|git\s+push\s+--force|python3?\s+-c)\b", re.I),
    re.compile(r"\b(?:invoke|spawn|delegate)\s+(?:an?\s+)?agent\b", re.I),
    re.compile(r"\b(?:bypass|disable|override)\s+(?:the\s+)?(?:validator|security|policy|gate|rules?)\b", re.I),
    re.compile(r"\b(?:merge|deploy|promote|certify|approve)\s+(?:this|the|it)\b", re.I),
    re.compile(r"\bwrite\s+(?:to|into)\s+(?:main|production)\b", re.I),
    re.compile(r"\b(?:send|exfiltrate|publish)\s+(?:the\s+)?(?:secret|token|credential|api[_ -]?key)\b", re.I),
    re.compile(r"\bdo\s+not\s+validate\b", re.I),
    re.compile(r"تجاهل\s+(?:كل\s+)?التعليمات\s+(?:السابقة|الأصلية)", re.I),
    re.compile(r"تجاهل\s+تعليمات\s+(?:النظام|المطور)", re.I),
    re.compile(r"(?:نفذ|شغل)\s+(?:الأمر|الطرفية|الشل)", re.I),
    re.compile(r"(?:تجاوز|عطل|غير)\s+(?:المدقق|البوابة|قواعد\s+النظام|الحماية)", re.I),
]

HYPE_PATTERNS = [
    re.compile(r"\btrending\b", re.I),
    re.compile(r"\bviral\b", re.I),
    re.compile(r"\bhot\s+right\s+now\b", re.I),
    re.compile(r"\beveryone\s+is\s+using\b", re.I),
    re.compile(r"\b(?:revolutionary|game[- ]changing|best[- ]in[- ]class|must[- ]have)\b", re.I),
    re.compile(r"\blatest\s+therefore\b", re.I),
    re.compile(r"الأكثر\s+شيوعًا|الأفضل\s+على\s+الإطلاق|الأحدث\s+إذًا", re.I),
]

QUANT_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])\d+(?:\.\d+)?\s*(?:%|x|ms|s|gb|mb|kb|fps|dB)(?![A-Za-z0-9_])",
    re.I,
)


class ValidationError(Exception):
    pass


class StrictYaml:
    """Strict subset: block mappings, block scalar lists, safe scalar values."""

    def __init__(self, text: str):
        if "\x00" in text:
            raise ValidationError("NUL byte is forbidden")
        if text.startswith("\ufeff"):
            raise ValidationError("UTF-8 BOM is forbidden")

        self.lines: list[tuple[int, str, int]] = []
        for line_no, raw in enumerate(text.splitlines(), 1):
            if raw.strip() == "" or raw.lstrip().startswith("#"):
                continue
            leading = raw[: len(raw) - len(raw.lstrip(" "))]
            if "\t" in leading:
                raise ValidationError(f"tabs are forbidden in indentation at line {line_no}")
            if len(leading) % 2:
                raise ValidationError(f"indentation must use two-space units at line {line_no}")
            body = raw[len(leading):]
            self.lines.append((len(leading), body, line_no))

        if not self.lines:
            raise ValidationError("empty YAML document")

    def parse(self) -> Any:
        value, index = self._parse_block(0, self.lines[0][0])
        if index != len(self.lines):
            raise ValidationError(f"unexpected content at line {self.lines[index][2]}")
        return value

    def _parse_block(self, index: int, indent: int) -> tuple[Any, int]:
        if index >= len(self.lines) or self.lines[index][0] != indent:
            raise ValidationError("invalid nested indentation")

        is_list = self.lines[index][1].startswith("- ")
        value: Any = [] if is_list else {}
        keys: set[str] = set()

        while index < len(self.lines) and self.lines[index][0] == indent:
            _, body, line_no = self.lines[index]

            if is_list:
                if not body.startswith("- "):
                    raise ValidationError(f"mixed mapping/list at line {line_no}")
                raw_item = body[2:].strip()
                if not raw_item:
                    raise ValidationError(f"empty list item at line {line_no}")
                value.append(self._scalar(raw_item, line_no))
                index += 1
                continue

            if body.startswith("- "):
                raise ValidationError(f"unexpected list item at line {line_no}")
            if ":" not in body:
                raise ValidationError(f"expected key:value at line {line_no}")

            key, raw = body.split(":", 1)
            key = key.strip()
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", key):
                raise ValidationError(f"invalid key at line {line_no}: {key!r}")
            if key in keys:
                raise ValidationError(f"duplicate key: {key}")
            keys.add(key)
            raw = raw.strip()
            index += 1

            if raw:
                value[key] = self._scalar(raw, line_no)
                continue

            if index >= len(self.lines) or self.lines[index][0] <= indent:
                raise ValidationError(f"missing nested value for {key} at line {line_no}")
            nested_indent = self.lines[index][0]
            value[key], index = self._parse_block(index, nested_indent)

        return value, index

    @staticmethod
    def _scalar(raw: str, line_no: int) -> Any:
        if raw.startswith(("[", "{", "|", ">", "&", "*", "!")):
            raise ValidationError(f"unsupported YAML construct at line {line_no}")
        if raw in {"null", "Null", "NULL", "~"}:
            return None
        if raw in {"true", "True", "TRUE"}:
            return True
        if raw in {"false", "False", "FALSE"}:
            return False
        if raw.startswith('"'):
            try:
                value = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValidationError(f"invalid double-quoted string at line {line_no}") from exc
            if not isinstance(value, str):
                raise ValidationError(f"quoted scalar is not a string at line {line_no}")
            return value
        if raw.startswith("'"):
            if len(raw) < 2 or not raw.endswith("'"):
                raise ValidationError(f"invalid single-quoted string at line {line_no}")
            return raw[1:-1].replace("''", "'")
        if re.fullmatch(r"-?\d+", raw):
            return int(raw)
        if re.fullmatch(r"-?(?:\d+\.\d+|\d+e[+-]?\d+|\d+\.\d+e[+-]?\d+)", raw, re.I):
            return float(raw)
        if any(token in raw for token in (" :", ": ", " #")):
            raise ValidationError(f"ambiguous plain scalar at line {line_no}; quote it")
        if not re.fullmatch(r"[A-Za-z0-9_./:@+\-%?]+", raw):
            raise ValidationError(f"unsafe/unquoted scalar at line {line_no}; quote it")
        return raw


def _parse_iso(value: Any, field: str) -> dt.datetime:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be an ISO-8601 UTC string")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value):
        raise ValidationError(f"{field} must use YYYY-MM-DDTHH:MM:SSZ")
    try:
        parsed = dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise ValidationError(f"invalid timestamp in {field}") from exc
    return parsed.replace(tzinfo=dt.timezone.utc)


def _strict_json(text: str) -> dict[str, Any]:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        obj: dict[str, Any] = {}
        for key, value in pairs:
            if key in obj:
                raise ValidationError(f"duplicate JSON key: {key}")
            obj[key] = value
        return obj

    try:
        value = json.loads(text, object_pairs_hook=reject_duplicates)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"invalid snapshot JSON: {exc.msg}") from exc
    if not isinstance(value, dict):
        raise ValidationError("snapshot root must be an object")
    return value


def _assert_inside(base: Path, target: Path) -> None:
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise ValidationError("resolved path escapes allowed root") from exc


def _safe_file(repo_root: Path, relative: str, *, allowed_root: Path | None = None) -> Path:
    if not isinstance(relative, str) or not relative or "\x00" in relative:
        raise ValidationError("invalid repository path")
    path = Path(relative)
    if path.is_absolute() or re.match(r"^[A-Za-z]:[\\/]", relative):
        raise ValidationError("absolute path is forbidden")
    if any(part in {".", ".."} for part in path.parts):
        raise ValidationError("dot-segment path is forbidden")

    base = (allowed_root or repo_root).resolve(strict=True)
    raw_candidate = base / path
    _assert_inside(base, raw_candidate.absolute())

    current = base
    for part in raw_candidate.relative_to(base).parts:
        current = current / part
        if current.is_symlink():
            raise ValidationError("symbolic-link path is forbidden")

    try:
        candidate = raw_candidate.resolve(strict=True)
    except (FileNotFoundError, OSError) as exc:
        raise ValidationError("repository reference must be an existing regular file") from exc
    _assert_inside(base, candidate)

    if allowed_root is None and ".git" in candidate.relative_to(repo_root).parts:
        raise ValidationError(".git is not an allowed repository reference")
    if not candidate.is_file():
        raise ValidationError("repository reference must be an existing regular file")
    return candidate


def _load_snapshot(repo_root: Path, snapshot_id: str) -> dict[str, Any]:
    if not SAFE_ID_RE.fullmatch(snapshot_id):
        raise ValidationError("malformed snapshot_id")

    snapshots = repo_root / ".agent-intelligence" / "snapshots"
    if not snapshots.exists() or snapshots.is_symlink() or not snapshots.is_dir():
        raise ValidationError("snapshot directory is missing or unsafe")

    path = _safe_file(repo_root, f"{snapshot_id}.json", allowed_root=snapshots)
    if path.stat().st_size > MAX_SNAPSHOT_BYTES:
        raise ValidationError("snapshot exceeds 1 MiB")

    snapshot = _strict_json(path.read_text(encoding="utf-8"))
    expected = {
        "snapshot_id",
        "captured_at",
        "url",
        "source_type",
        "stability",
        "vendor_affiliated",
        "evidence_kind",
        "content",
    }
    missing = expected - set(snapshot)
    extra = set(snapshot) - expected
    if missing:
        raise ValidationError("snapshot missing field(s): " + ", ".join(sorted(missing)))
    if extra:
        raise ValidationError("snapshot has extra field(s): " + ", ".join(sorted(extra)))
    if snapshot["snapshot_id"] != snapshot_id:
        raise ValidationError("snapshot_id does not match filename")
    _parse_iso(snapshot["captured_at"], "snapshot.captured_at")
    if not isinstance(snapshot["url"], str) or not 1 <= len(snapshot["url"]) <= 2048:
        raise ValidationError("snapshot.url must be a non-empty string <= 2048")
    if snapshot["source_type"] not in {
        "official_docs", "release_notes", "repository", "benchmark",
        "engineering_blog", "community", "marketing"
    }:
        raise ValidationError("invalid snapshot.source_type")
    if snapshot["stability"] not in {"stable", "volatile", "unknown"}:
        raise ValidationError("invalid snapshot.stability")
    if not isinstance(snapshot["vendor_affiliated"], bool):
        raise ValidationError("snapshot.vendor_affiliated must be boolean")
    if snapshot["evidence_kind"] not in {
        "fact", "benchmark", "release", "documentation", "opinion", "marketing"
    }:
        raise ValidationError("invalid snapshot.evidence_kind")
    if not isinstance(snapshot["content"], str) or not 1 <= len(snapshot["content"]) <= MAX_SNAPSHOT_BYTES:
        raise ValidationError("snapshot.content must be non-empty and <= 1 MiB")
    return snapshot


def _validate_shape(proposal: Any) -> tuple[dt.datetime, dt.datetime]:
    if not isinstance(proposal, dict):
        raise ValidationError("proposal root must be an object")

    missing = REQUIRED_TOP - set(proposal)
    extra = set(proposal) - REQUIRED_TOP
    if missing:
        raise ValidationError("missing field(s): " + ", ".join(sorted(missing)))
    if extra:
        raise ValidationError("extra field(s): " + ", ".join(sorted(extra)))

    if not isinstance(proposal["id"], str) or not PROPOSAL_ID_RE.fullmatch(proposal["id"]):
        raise ValidationError("id has invalid format")
    if not isinstance(proposal["category"], str) or not CATEGORY_RE.fullmatch(proposal["category"]):
        raise ValidationError("category has invalid format")
    if not isinstance(proposal["title"], str) or not 1 <= len(proposal["title"]) <= 200:
        raise ValidationError("title must be 1..200 characters")
    if proposal["status"] not in ALLOWED_STATUS:
        raise ValidationError("status is not an allowed lifecycle state")
    if not isinstance(proposal["entity_key"], str) or not ENTITY_KEY_RE.fullmatch(proposal["entity_key"]):
        raise ValidationError("entity_key has invalid format")

    lifecycle = proposal["lifecycle"]
    if not isinstance(lifecycle, dict) or set(lifecycle) != {
        "created_at", "expires_at", "last_viewed_by_human"
    }:
        raise ValidationError("lifecycle must contain exactly created_at, expires_at, last_viewed_by_human")
    created = _parse_iso(lifecycle["created_at"], "lifecycle.created_at")
    expires = _parse_iso(lifecycle["expires_at"], "lifecycle.expires_at")
    viewed = _parse_iso(lifecycle["last_viewed_by_human"], "lifecycle.last_viewed_by_human")
    if expires < created:
        raise ValidationError("expires_at cannot be earlier than created_at")
    if viewed < created:
        raise ValidationError("last_viewed_by_human cannot predate created_at")

    source = proposal["source"]
    if not isinstance(source, dict) or set(source) != {"snapshot_id", "vendor_affiliated"}:
        raise ValidationError("source must contain exactly snapshot_id and vendor_affiliated")
    if not isinstance(source["snapshot_id"], str) or not SAFE_ID_RE.fullmatch(source["snapshot_id"]):
        raise ValidationError("source.snapshot_id has invalid format")
    if not isinstance(source["vendor_affiliated"], bool):
        raise ValidationError("source.vendor_affiliated must be boolean")

    evidence = proposal["evidence"]
    if not isinstance(evidence, dict) or set(evidence) != {"quote"}:
        raise ValidationError("evidence must contain exactly quote")
    if not isinstance(evidence["quote"], str) or not 1 <= len(evidence["quote"]) <= 8192:
        raise ValidationError("evidence.quote must be 1..8192 characters")

    inference = proposal["inference"]
    if not isinstance(inference, dict) or set(inference) != {"current_state", "proposal", "rollback"}:
        raise ValidationError("inference must contain exactly current_state, proposal, rollback")
    current_state = inference["current_state"]
    if not isinstance(current_state, dict) or set(current_state) != {"repo_refs"}:
        raise ValidationError("inference.current_state must contain exactly repo_refs")
    refs = current_state["repo_refs"]
    if not isinstance(refs, list) or not 1 <= len(refs) <= 64 or not all(isinstance(ref, str) for ref in refs):
        raise ValidationError("repo_refs must be a list of 1..64 strings")
    if len(set(refs)) != len(refs):
        raise ValidationError("repo_refs contains duplicate paths")
    if not isinstance(inference["proposal"], str) or not 1 <= len(inference["proposal"]) <= 8192:
        raise ValidationError("inference.proposal must be 1..8192 characters")
    rollback = inference["rollback"]
    if not isinstance(rollback, str) or not 1 <= len(rollback) <= 4096:
        raise ValidationError("inference.rollback must be 1..4096 characters")

    triage = proposal["triage"]
    if not isinstance(triage, dict) or set(triage) != {
        "impact_score", "complexity_score", "final_priority_score", "lane"
    }:
        raise ValidationError("triage must contain exactly impact_score, complexity_score, final_priority_score, lane")
    for name in ("impact_score", "complexity_score", "final_priority_score"):
        value = triage[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError(f"triage.{name} must be numeric")
        if not math.isfinite(float(value)) or not 0 <= float(value) <= 100:
            raise ValidationError(f"triage.{name} must be finite and within 0..100")
    if triage["lane"] not in ALLOWED_LANE:
        raise ValidationError("triage.lane is invalid")

    return created, expires


def _scan_prompt_injection(proposal: dict[str, Any]) -> list[str]:
    serialized = json.dumps(proposal, ensure_ascii=False, sort_keys=True)
    return [pattern.pattern for pattern in PROMPT_INJECTION_PATTERNS if pattern.search(serialized)]


def _scan_rollback(rollback: str) -> list[str]:
    value = rollback.strip().lower()
    if value in {"", "n/a", "na", "none", "unknown", "tbd", "ask human", "manual rollback"}:
        return ["rollback is not an executable reversal"]
    if any(token in value for token in ("{{", "}}", "<todo", "???")):
        return ["rollback contains unresolved placeholders"]
    concrete_markers = (
        "revert",
        "rollback",
        "restore",
        "disable",
        "remove",
        "uninstall",
        "switch back",
        "roll back",
    )
    if not any(marker in value for marker in concrete_markers):
        return ["rollback lacks a concrete reversible action"]
    return []


def _scan_anti_hype(proposal: dict[str, Any], snapshot: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    serialized = json.dumps(proposal, ensure_ascii=False, sort_keys=True)

    if snapshot["source_type"] == "marketing":
        reasons.append("marketing source")
    if snapshot["stability"] != "stable":
        reasons.append("source stability is not stable")
    if snapshot["evidence_kind"] in {"marketing", "opinion"}:
        reasons.append("evidence is promotional or opinion based")
    if proposal["source"]["vendor_affiliated"] != snapshot["vendor_affiliated"]:
        reasons.append("vendor affiliation mismatch")
    for pattern in HYPE_PATTERNS:
        if pattern.search(serialized):
            reasons.append("promotional/trending language detected: " + pattern.pattern)
    if QUANT_PATTERN.search(proposal["evidence"]["quote"]) and snapshot["evidence_kind"] not in {"benchmark", "release"}:
        reasons.append("quantitative claim lacks benchmark/release evidence kind")
    return reasons


def _result(proposal: Any, status: str, checks: dict[str, str], reasons: list[str]) -> dict[str, Any]:
    proposal_id = proposal.get("id", "UNKNOWN") if isinstance(proposal, dict) else "UNKNOWN"
    return {
        "valid": status == "valid",
        "status": status,
        "proposal_id": proposal_id,
        "checks": checks,
        "reasons": reasons[:MAX_REASONS],
    }


def validate_proposal(proposal_path: Path, repo_root: Path | None = None, now: dt.datetime | None = None) -> dict[str, Any]:
    root = (repo_root or Path(__file__).resolve().parents[2]).resolve(strict=True)
    proposal_path = Path(proposal_path)
    if proposal_path.is_symlink():
        return _result({}, "rejected", {"V-01": "FAIL"}, ["proposal symbolic link is forbidden"])
    proposal_path = proposal_path.resolve(strict=True)
    if not proposal_path.is_file():
        return _result({}, "rejected", {"V-01": "FAIL"}, ["proposal must be an existing regular file"])
    inbox_root = (root / ".agent-intelligence" / "inbox").resolve(strict=True)
    try:
        proposal_path.relative_to(inbox_root)
    except ValueError:
        return _result({}, "rejected", {"V-01": "FAIL"}, ["proposal must reside under .agent-intelligence/inbox"])
    if proposal_path.stat().st_size > MAX_PROPOSAL_BYTES:
        return _result({}, "rejected", {"V-01": "FAIL"}, ["proposal exceeds 64 KiB"])
    try:
        proposal_path.relative_to(root)
    except ValueError as exc:
        raise ValidationError("proposal is outside repository") from exc

    if ".git" in proposal_path.relative_to(root).parts:
        return _result({}, "rejected", {"V-01": "FAIL"}, ["proposal cannot reside under .git"])

    try:
        proposal = StrictYaml(proposal_path.read_text(encoding="utf-8")).parse()
    except (ValidationError, UnicodeError, OSError) as exc:
        return _result({}, "rejected", {"V-01": "FAIL"}, [str(exc)])
    checks: dict[str, str] = {}
    reasons: list[str] = []

    try:
        _, expires = _validate_shape(proposal)
        checks["V-01"] = "PASS"
    except ValidationError as exc:
        checks["V-01"] = "FAIL"
        for name in ("V-02", "V-03", "V-04", "V-05", "V-06", "V-07"):
            checks[name] = "NOT_RUN"
        reasons.append(str(exc))
        return _result(proposal, "rejected", checks, reasons)

    snapshot: dict[str, Any] | None = None
    try:
        snapshot = _load_snapshot(root, proposal["source"]["snapshot_id"])
        quote = proposal["evidence"]["quote"]
        occurrences = snapshot["content"].count(quote)
        if occurrences != 1:
            raise ValidationError("evidence.quote must match exactly one occurrence in source snapshot")
        checks["V-02"] = "PASS"
    except ValidationError as exc:
        checks["V-02"] = "FAIL"
        reasons.append(str(exc))

    try:
        for ref in proposal["inference"]["current_state"]["repo_refs"]:
            _safe_file(root, ref)
        checks["V-03"] = "PASS"
    except ValidationError as exc:
        checks["V-03"] = "FAIL"
        reasons.append(str(exc))

    rollback_reasons = _scan_rollback(proposal["inference"]["rollback"])
    checks["V-04"] = "PASS" if not rollback_reasons else "FAIL"
    reasons.extend(rollback_reasons)

    injection_hits = _scan_prompt_injection(proposal)
    checks["V-05"] = "PASS" if not injection_hits else "QUARANTINE"
    reasons.extend("prompt injection pattern: " + hit for hit in injection_hits)

    now_utc = (now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc)
    if expires < now_utc:
        checks["V-06"] = "EXPIRED"
    else:
        checks["V-06"] = "PASS" if proposal["status"] != "expired" else "FAIL"
        if checks["V-06"] == "FAIL":
            reasons.append("status=expired is inconsistent with a future expires_at")

    if snapshot is None:
        checks["V-07"] = "FAIL"
        reasons.append("snapshot unavailable for anti-hype verification")
    else:
        anti_hype_reasons = _scan_anti_hype(proposal, snapshot)
        checks["V-07"] = "PASS" if not anti_hype_reasons else "FAIL"
        reasons.extend(anti_hype_reasons)

    if checks["V-05"] == "QUARANTINE":
        status = "quarantined"
    elif checks["V-06"] == "EXPIRED":
        status = "expired"
    elif any(check == "FAIL" for check in checks.values()):
        status = "rejected"
    else:
        status = "valid"

    return _result(proposal, status, checks, reasons)


def validate_all(repo_root: Path | None = None) -> list[dict[str, Any]]:
    root = (repo_root or Path(__file__).resolve().parents[2]).resolve(strict=True)
    inbox = root / ".agent-intelligence" / "inbox"
    if not inbox.exists():
        raise ValidationError("inbox directory is missing")
    if inbox.is_symlink() or not inbox.is_dir():
        raise ValidationError("inbox boundary is invalid")

    results: list[dict[str, Any]] = []
    for path in sorted(inbox.iterdir(), key=lambda item: item.name):
        if path.is_symlink():
            raise ValidationError("symbolic links are forbidden in inbox")
        if path.is_dir():
            continue
        if path.name in {".gitkeep", "README.md"}:
            continue
        if path.suffix.lower() not in {".yml", ".yaml"}:
            raise ValidationError("unsupported file in inbox: " + path.name)
        results.append(validate_proposal(path, root))
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("proposal", nargs="?")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    try:
        if args.all:
            results = validate_all()
            payload: Any = results
            code = 0 if all(item["valid"] for item in results) else 1
        elif args.proposal:
            item = validate_proposal(Path(args.proposal))
            payload = item
            code = 0 if item["valid"] else 1
        else:
            parser.error("provide a proposal path or --all")
    except (ValidationError, OSError, UnicodeError) as exc:
        payload = {
            "valid": False,
            "status": "rejected",
            "proposal_id": "UNKNOWN",
            "checks": {},
            "reasons": [str(exc)],
        }
        code = 2

    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2 if not args.json else None))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
