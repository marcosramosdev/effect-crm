-- 007__fix_tenant_members_rls.sql
-- tenant_members_select had an exists(select from tenant_members) subquery inside itself
-- causing infinite recursion whenever any other table's policy joined tenant_members.
-- Fix: SECURITY DEFINER function bypasses RLS when checking owner, breaking the loop.

create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

drop policy if exists "tenant_members_select" on tenant_members;
create policy "tenant_members_select" on tenant_members
  for select using (
    user_id = auth.uid()
    or public.is_tenant_owner(tenant_id)
  );
