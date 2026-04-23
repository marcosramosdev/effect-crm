-- 003__seed_defaults.sql — Auto-seed default pipeline stages on tenant creation

create or replace function seed_default_pipeline_for_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pipeline_stages (tenant_id, name, "order", is_default_entry)
  values
    (new.id, 'Novo',        1, true),
    (new.id, 'Em conversa', 2, false),
    (new.id, 'Proposta',    3, false),
    (new.id, 'Ganho',       4, false),
    (new.id, 'Perdido',     5, false);
  return new;
end;
$$;

create trigger seed_pipeline_on_tenant_insert
  after insert on tenants
  for each row
  execute function seed_default_pipeline_for_tenant();
