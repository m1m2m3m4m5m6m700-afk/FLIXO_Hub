alter table public.flix_controller_push_queue
  drop constraint if exists flix_controller_push_queue_patch_text_size_check;
alter table public.flix_controller_push_queue
  add constraint flix_controller_push_queue_patch_text_size_check
  check (patch_text is null or octet_length(patch_text) <= 2000000);
alter table public.flix_controller_push_queue
  drop constraint if exists flix_controller_push_queue_reconciled_patch_text_size_check;
alter table public.flix_controller_push_queue
  add constraint flix_controller_push_queue_reconciled_patch_text_size_check
  check (reconciled_patch_text is null or octet_length(reconciled_patch_text) <= 2000000);
