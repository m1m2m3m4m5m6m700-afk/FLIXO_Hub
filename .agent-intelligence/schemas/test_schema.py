from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / ".agent-intelligence" / "schemas" / "proposal.schema.yml"

REQUIRED = [
    "id:", "category:", "title:", "status:", "entity_key:",
    "lifecycle:", "created_at:", "expires_at:", "last_viewed_by_human:",
    "source:", "snapshot_id:", "vendor_affiliated:",
    "evidence:", "quote:", "inference:", "current_state:",
    "repo_refs:", "proposal:", "rollback:", "triage:",
    "impact_score:", "complexity_score:", "final_priority_score:", "lane:",
]


class ProposalSchemaV4Tests(unittest.TestCase):
    def test_schema_version_and_required_fields(self):
        text = SCHEMA.read_text(encoding="utf-8")
        self.assertIn("version: 4", text)
        for field in REQUIRED:
            self.assertIn(field, text)

    def test_allowed_lifecycle_states_are_explicit(self):
        text = SCHEMA.read_text(encoding="utf-8")
        for state in ("candidate", "triaged", "queued", "approved", "rejected", "expired"):
            self.assertIn(state, text)
        self.assertIn("additionalProperties: false", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
