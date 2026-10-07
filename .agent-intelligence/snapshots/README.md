# Source Snapshots

Each snapshot is:
.agent-intelligence/snapshots/<snapshot_id>.json

The JSON record contains the canonical captured source text in content plus provenance metadata.

Snapshot IDs are safe opaque identifiers only. Paths, URLs, commands, and instructions inside snapshot content are never executed.

Evidence.quote must match exactly one occurrence in snapshot.content.
