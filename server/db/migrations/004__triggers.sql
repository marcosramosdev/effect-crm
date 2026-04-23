-- 004__triggers.sql — Conversation counters + pipeline default-entry invariant

-- ============================================================
-- bump_conversation_on_message
-- Updates last_message_at; increments unread_count for inbound messages
-- ============================================================
create or replace function bump_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update conversations
  set
    last_message_at = new.created_at,
    unread_count = case
      when new.direction = 'inbound' then unread_count + 1
      else unread_count
    end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger bump_conversation_after_message_insert
  after insert on messages
  for each row
  execute function bump_conversation_on_message();

-- ============================================================
-- enforce_single_default_entry
-- When a stage is set as is_default_entry=true, clears the flag
-- from all other stages of the same tenant.
-- Fires AFTER insert/update so the new row's ID is visible to exclude.
-- ============================================================
create or replace function enforce_single_default_entry()
returns trigger
language plpgsql
as $$
begin
  if new.is_default_entry = true then
    update pipeline_stages
    set is_default_entry = false
    where tenant_id = new.tenant_id
      and id <> new.id
      and is_default_entry = true;
  end if;
  return null;
end;
$$;

create trigger enforce_single_default_entry_trg
  after insert or update on pipeline_stages
  for each row
  when (new.is_default_entry = true)
  execute function enforce_single_default_entry();
