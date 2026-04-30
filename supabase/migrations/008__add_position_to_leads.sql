-- 006__add_position_to_leads.sql — Add position column for drag-and-drop ordering

-- Add position column with default 0
alter table leads
  add column position integer not null default 0;

-- Backfill existing leads with ROW_NUMBER() * 1024 per (tenant_id, stage_id)
with ranked as (
  select id,
         row_number() over (partition by tenant_id, stage_id order by created_at) * 1024 as new_position
  from leads
)
update leads
set position = ranked.new_position
from ranked
where leads.id = ranked.id;

-- Add index for board queries
create index leads_board_order_idx on leads (tenant_id, stage_id, position);
