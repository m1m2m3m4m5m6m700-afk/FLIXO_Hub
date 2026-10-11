import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".agent-intelligence" / "scripts"))
from run_scouts import scout_manifest_paths


class ScoutManifestDiscoveryTests(unittest.TestCase):
    def test_public_repository_query_config_is_not_loaded_as_a_scout_manifest(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "public-repositories.yaml").write_text(
                json.dumps({"format": "flixo-public-repo-discovery-v1", "queries": []}),
                encoding="utf-8",
            )
            (root / "architecture.yaml").write_text(
                json.dumps({"format": "flixo-scout-manifest-v1", "role": "ARCHITECTURE", "sources": []}),
                encoding="utf-8",
            )
            self.assertEqual([path.name for path in scout_manifest_paths(root)], ["architecture.yaml"])


if __name__ == "__main__":
    unittest.main()
