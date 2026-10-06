-- Red Team RT-18: restore database-enforced evidence/audit referential integrity.
-- The integrity hash in application code now includes generated IDs and timestamps;
-- this FK additionally prevents an audit record from naming a nonexistent evidence row.

alter table public.flix_admin_audit_events
  add constraint flix_admin_audit_events_evidence_fk
  foreign key (evidence_id)
  references public.flix_admin_evidence(evidence_id)
  on delete set null;
