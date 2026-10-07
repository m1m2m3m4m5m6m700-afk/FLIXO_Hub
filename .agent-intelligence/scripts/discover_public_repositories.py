#!/usr/bin/env python3
"""FLIXO public-repository acquisition layer.

Discovers licensed public GitHub repositories, captures bounded source evidence as
immutable snapshots, extracts deterministic engineering signals, and emits
FLIXO-native research proposals. Source code is data only and is never executed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fetch_snapshot import SnapshotError, SnapshotStore
from run_scouts import PREFIX, build_proposal, dump_yaml, write_append_only

API_ROOT = "https://api.github.com"
USER_AGENT = "FLIXO-Public-Repository-Acquisition/1.0"
MAX_RESPONSE_BYTES = 2_000_000
MAX_REPO_FILES = 4
ALLOWED_LICENSES = {"mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "isc", "zlib", "mpl-2.0"}
SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rs", ".go", ".java",
    ".kt", ".cpp", ".c", ".h", ".hpp", ".wasm", ".md", ".mdx", ".json", ".yaml",
    ".yml", ".toml", ".xml", ".txt",
}
TEST_NAMES = {"test", "tests", "__tests__", "spec", "specs"}
ROLE_NAMES = {"ARCHITECTURE": "AGENT-08 — Architecture Scout",
              "TECHNOLOGY": "AGENT-09 — Technology Scout",
              "ECOSYSTEM": "AGENT-10 — Ecosystem Scout"}


class DiscoveryError(RuntimeError):
    pass


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def safe_slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return cleaned[:120] or "unknown"


def json_request(opener, url: str, token: str | None = None) -> dict[str, Any]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, headers=headers)
    try:
        response = opener(request, timeout=20)
        body = response.read(MAX_RESPONSE_BYTES + 1)
    except Exception as exc:
        raise DiscoveryError("GitHub API request failed") from exc
    if len(body) > MAX_RESPONSE_BYTES:
        raise DiscoveryError("GitHub API response exceeded safety limit")
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DiscoveryError("GitHub API returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise DiscoveryError("GitHub API response root must be an object")
    return payload


def api_get(opener, endpoint: str, token: str | None = None) -> dict[str, Any]:
    return json_request(opener, API_ROOT + endpoint, token)


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DiscoveryError("invalid public repository manifest") from exc
    if data.get("format") != "flixo-public-repo-discovery-v1" or data.get("version") != 1:
        raise DiscoveryError("unsupported public repository manifest")
    queries = data.get("queries")
    if not isinstance(queries, list) or not queries:
        raise DiscoveryError("public repository discovery queries are required")
    for item in queries:
        if not isinstance(item, dict):
            raise DiscoveryError("discovery query entry must be an object")
        if item.get("role") not in ROLE_NAMES:
            raise DiscoveryError("invalid discovery role")
        if not isinstance(item.get("query"), str) or not item["query"].strip():
            raise DiscoveryError("discovery query text is required")
        refs = item.get("repo_refs")
        if not isinstance(refs, list) or not refs:
            raise DiscoveryError("discovery repo_refs are required")
    return data


def query_words(query: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9+._-]{2,}", query)
        if token.lower() not in {"open", "source", "library", "processing"}
    }


def repo_candidate_score(item: dict[str, Any], words: set[str]) -> tuple[int, list[str]]:
    name = str(item.get("name") or "")
    description = str(item.get("description") or "")
    text = (name + " " + description).lower()
    overlap = len({w for w in words if w in text})
    stars = max(0, int(item.get("stargazers_count") or 0))
    pushed = item.get("pushed_at")
    freshness = 0
    if isinstance(pushed, str):
        try:
            age_days = max(0, (now_utc() - datetime.fromisoformat(pushed.replace("Z", "+00:00"))).days)
            freshness = 15 if age_days <= 365 else 8 if age_days <= 730 else 0
        except ValueError:
            freshness = 0
    evidence = []
    if (item.get("license") or {}).get("spdx_id"):
        evidence.append("license")
    if item.get("has_wiki"):
        evidence.append("documentation")
    score = min(30, overlap * 8) + min(25, round(math.log10(stars + 1) * 8)) + freshness
    if item.get("license", {}).get("spdx_id"):
        score += 20
    if not item.get("archived") and not item.get("disabled"):
        score += 10
    if not item.get("fork"):
        score += 10
    return min(100, score), evidence


def is_eligible_repo(item: dict[str, Any], current_repo: str) -> bool:
    full_name = str(item.get("full_name") or "")
    return bool(
        full_name
        and full_name.lower() != current_repo.lower()
        and not item.get("archived")
        and not item.get("disabled")
        and not item.get("fork")
        and item.get("license", {}).get("spdx_id")
        and item.get("default_branch")
    )


def tree_items(client_get, full_name: str, branch: str, token: str | None) -> list[dict[str, Any]]:
    encoded = urllib.parse.quote(branch, safe="")
    data = client_get(f"/repos/{full_name}/git/trees/{encoded}?recursive=1", token)
    items = data.get("tree")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict) and item.get("type") == "blob"]


def file_score(path: str, query: str) -> int:
    lower = path.lower()
    name = Path(path).name.lower()
    suffix = Path(path).suffix.lower()
    if suffix not in SOURCE_EXTENSIONS:
        return -100
    if any(part in {"node_modules", "vendor", "dist", "build", ".git"} for part in Path(path).parts):
        return -100
    if name.endswith(".min.js") or name.endswith(".min.css"):
        return -100
    words = query_words(query)
    score = 0
    if name in {"readme.md", "readme"}:
        score += 100
    if name in {"package.json", "pyproject.toml", "cargo.toml", "go.mod", "pom.xml", "build.gradle"}:
        score += 90
    if any(part in TEST_NAMES for part in Path(path).parts):
        score += 65
    if "/src/" in "/" + lower or lower.startswith("src/") or "/lib/" in "/" + lower:
        score += 45
    overlap = sum(1 for word in words if word in lower)
    score += overlap * 10
    if lower.endswith((".md", ".mdx")):
        score += 20
    return score


def select_files(items: list[dict[str, Any]], query: str, limit: int) -> list[dict[str, Any]]:
    scored = []
    for item in items:
        path = str(item.get("path") or "")
        size = int(item.get("size") or 0)
        if size > 400_000:
            continue
        score = file_score(path, query)
        if score < 0:
            continue
        scored.append((score, path, item))
    scored.sort(key=lambda row: (-row[0], row[1]))
    selected = []
    seen = set()
    for score, path, item in scored:
        if path in seen:
            continue
        seen.add(path)
        selected.append({**item, "_score": score})
        if len(selected) >= max(1, min(limit, MAX_REPO_FILES)):
            break
    return selected


def extract_signals(text: str, paths: list[str]) -> list[str]:
    haystack = (text + "\n" + "\n".join(paths)).lower()
    patterns = [
        ("web-workers", r"web\s*worker|worker\("),
        ("webassembly", r"webassembly|\bwasm\b"),
        ("webcodecs", r"webcodecs|videoframe|audiodecoder"),
        ("ffmpeg", r"ffmpeg"),
        ("canvas", r"offscreen\s*canvas|\bcanvas\b"),
        ("browser-local-file", r"arraybuffer|createobjecturl|file\b|blob\b"),
        ("pipeline", r"pipeline|processor|transform|adapter"),
        ("testing", r"\btest\b|describe\(|it\(|assert"),
        ("security", r"csp|csrf|nonce|permission|sandbox|signature"),
        ("architecture-contract", r"registry|manifest|canonical|contract|verifier"),
        ("queue-worker", r"queue|job|worker|consumer|producer"),
        ("observability", r"metric|trace|telemetry|logging"),
    ]
    return [name for name, pattern in patterns if re.search(pattern, haystack, re.I)]


def license_mode(spdx: str) -> str:
    value = (spdx or "").lower()
    return "PERMISSIVE_REFERENCE_ADAPTABLE" if value in ALLOWED_LICENSES else "REFERENCE_ONLY_REVIEW_REQUIRED"


def read_existing_keys(index_root: Path) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    if not index_root.exists():
        return keys
    for path in index_root.rglob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            repo = data.get("repository", {})
            key = (str(repo.get("full_name") or "").lower(), str(repo.get("head_sha") or "").lower())
            if key[0] and key[1]:
                keys.add(key)
        except (OSError, json.JSONDecodeError):
            continue
    return keys


def immutable_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    try:
        with path.open("x", encoding="utf-8") as handle:
            handle.write(data)
    except FileExistsError:
        existing = path.read_text(encoding="utf-8")
        if existing != data:
            raise DiscoveryError("public repository index collision")


def run(root: Path, manifest_path: Path, index_root: Path, snapshots_dir: Path, report_root: Path, opener=None) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    token = os.environ.get("GITHUB_TOKEN")
    current_repo = os.environ.get("GITHUB_REPOSITORY", "m1m2m3m4m5m6m700-afk/FLIXO_Hub")
    api_opener = opener or urllib.request.urlopen
    snapshot_store = SnapshotStore(snapshots_dir, opener=opener)
    seen = read_existing_keys(index_root)
    run_seen: set[tuple[str, str]] = set()
    discoveries = []
    errors = []

    max_per_query = int(manifest.get("max_repositories_per_query", 8))
    max_selected = int(manifest.get("max_selected_repositories", 6))
    max_files = int(manifest.get("max_files_per_repository", 4))

    for query_cfg in manifest["queries"]:
        role = query_cfg["role"]
        query = query_cfg["query"].strip()
        refs = query_cfg["repo_refs"]
        try:
            search_url = API_ROOT + "/search/repositories?" + urllib.parse.urlencode({
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": max(1, min(20, max_per_query)),
            })
            data = json_request(api_opener, search_url, token)
        except DiscoveryError as exc:
            errors.append({"role": role, "query": query, "error": str(exc)})
            continue

        items = data.get("items")
        if not isinstance(items, list):
            errors.append({"role": role, "query": query, "error": "search response missing items"})
            continue

        ranked = []
        words = query_words(query)
        for item in items:
            if not isinstance(item, dict) or not is_eligible_repo(item, current_repo):
                continue
            score, score_evidence = repo_candidate_score(item, words)
            ranked.append((score, str(item["full_name"]), item, score_evidence))
        ranked.sort(key=lambda row: (-row[0], row[1]))

        selected = 0
        for score, full_name, item, score_evidence in ranked:
            if selected >= max_selected:
                break
            owner, name = full_name.split("/", 1)
            try:
                branch_name = str(item["default_branch"])
                branch_data = api_get(api_opener, f"/repos/{urllib.parse.quote(full_name, safe='/')}/branches/{urllib.parse.quote(branch_name, safe='')}", token)
                head_sha = str(branch_data.get("commit", {}).get("sha") or "")
                if not re.fullmatch(r"[0-9a-f]{40}", head_sha, re.I):
                    raise DiscoveryError("repository head SHA unavailable")
                key = (full_name.lower(), head_sha.lower())
                if key in seen or key in run_seen:
                    continue
                files = select_files(tree_items(lambda endpoint, tok: api_get(api_opener, endpoint, tok), full_name, branch_name, token), query, max_files)
                if not files:
                    continue

                captured = []
                combined_content = []
                for file in files:
                    path = str(file["path"])
                    raw_url = "https://raw.githubusercontent.com/" + full_name + "/" + urllib.parse.quote(branch_name, safe="") + "/" + urllib.parse.quote(path, safe="/")
                    try:
                        snapshot = snapshot_store.fetch_and_store(
                            raw_url,
                            source_type="repository",
                            stability="stable",
                            vendor_affiliated=False,
                            evidence_kind="fact",
                        )
                    except SnapshotError as exc:
                        errors.append({"role": role, "repository": full_name, "path": path, "error": str(exc)})
                        continue
                    raw_bytes = Path(snapshot.raw_path).read_bytes()
                    combined_content.append(Path(snapshot.text_path).read_text(encoding="utf-8"))
                    captured.append({
                        "path": path,
                        "url": raw_url,
                        "snapshot_id": snapshot.snapshot_id,
                        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
                        "selection_score": int(file["_score"]),
                    })

                if not captured:
                    continue

                signals = extract_signals("\n".join(combined_content), [x["path"] for x in captured])
                spdx = str(item.get("license", {}).get("spdx_id") or "")
                mode = license_mode(spdx)
                title = f"Public repository pattern: {full_name} — {captured[0]['path']}"[:200]
                proposal = {
                    "url": captured[0]["url"],
                    "source_type": "repository",
                    "stability": "stable",
                    "evidence_kind": "fact",
                    "vendor_affiliated": False,
                    "title": title,
                    "entity_key": f"public-repo:{owner.lower()}/{name.lower()}::{captured[0]['path'].lower()}",
                    "repo_refs": refs,
                    "proposal": (
                        f"Study the repository pattern from {full_name} at {captured[0]['path']} and adapt only "
                        f"the underlying engineering idea to FLIXO. Signals: {', '.join(signals) or 'general implementation'}. "
                        f"License: {spdx or 'unknown'}; adaptation mode: {mode}. Preserve FLIXO canonical registry, "
                        "executor, output contracts, verification gates, and local-data boundary."
                    ),
                    "rollback": "Revert the FLIXO-native adapter or contract change and restore the prior canonical execution path.",
                }

                source_for_build = dict(proposal)
                snapshot_obj = type("SnapshotRef", (), {"snapshot_id": captured[0]["snapshot_id"], "text_path": str(snapshots_dir / (captured[0]["snapshot_id"] + ".txt"))})
                synthetic_manifest = {
                    "role": role,
                    "ttl_days": 14,
                    "default_repo_refs": refs,
                }
                raw_proposal = build_proposal(root, synthetic_manifest, source_for_build, snapshot_obj)
                role_dir = report_root / ROLE_NAMES[role]
                role_dir.mkdir(parents=True, exist_ok=True)
                out = role_dir / f"اقتراح-{raw_proposal['id']}.yaml"
                if out.exists():
                    continue
                write_append_only(out, dump_yaml(raw_proposal))

                index_payload = {
                    "schema": "flixo-public-repository-intelligence-v1",
                    "discovered_at": now_utc().isoformat().replace("+00:00", "Z"),
                    "role": role,
                    "query": query,
                    "repository": {
                        "full_name": full_name,
                        "owner": owner,
                        "name": name,
                        "html_url": item.get("html_url"),
                        "default_branch": branch_name,
                        "head_sha": head_sha,
                        "stars": int(item.get("stargazers_count") or 0),
                        "fork": bool(item.get("fork")),
                        "archived": bool(item.get("archived")),
                        "pushed_at": item.get("pushed_at"),
                        "license_spdx": spdx,
                    },
                    "discovery_score": score,
                    "score_evidence": score_evidence,
                    "license_mode": mode,
                    "selected_files": captured,
                    "pattern_signals": signals,
                    "adaptation": {
                        "mode": "REFERENCE_AND_ADAPT" if mode == "PERMISSIVE_REFERENCE_ADAPTABLE" else "REFERENCE_ONLY",
                        "copy_source_code": False,
                        "target_repo_refs": refs,
                        "proposal_id": raw_proposal["id"],
                    },
                    "status": "DISCOVERED",
                }
                digest = hashlib.sha256((full_name + "@" + head_sha).encode("utf-8")).hexdigest()[:24]
                immutable_json(index_root / role / (safe_slug(full_name) + "-" + digest + ".json"), index_payload)
                seen.add(key)
                run_seen.add(key)
                discoveries.append(index_payload)
                selected += 1
            except (DiscoveryError, SnapshotError, OSError, ValueError) as exc:
                errors.append({"role": role, "repository": full_name, "error": str(exc)})

    if discoveries == [] and errors:
        raise DiscoveryError("all public repository discovery attempts failed")
    return {
        "status": "PASS",
        "discovered": len(discoveries),
        "errors": errors,
        "repositories": [item["repository"]["full_name"] for item in discoveries],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--manifest", default=".agent-intelligence/scouts/public-repositories.yaml")
    parser.add_argument("--index-root", default=".agent-intelligence/public-repositories")
    parser.add_argument("--snapshots-dir", default=".agent-intelligence/snapshots")
    parser.add_argument("--report-root", default="الوكلاء/التقارير")
    args = parser.parse_args()
    root = Path(args.repo_root).resolve()
    try:
        result = run(root, root / args.manifest, root / args.index_root, root / args.snapshots_dir, root / args.report_root)
    except (DiscoveryError, SnapshotError, OSError, ValueError) as exc:
        print("PUBLIC_REPO_DISCOVERY_FAIL_CLOSED: " + str(exc), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
