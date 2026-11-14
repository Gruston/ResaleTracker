-- Members list: who has access to a business, and removing a member (owner only).

-- Lists user_id, email and role for every member of a business the caller belongs to.
create or replace function public.business_members_list(p_business_id uuid)
returns table (user_id uuid, email text, role text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
  ) then
    raise exception 'not a member of this business';
  end if;
  return query
    select m.user_id, u.email::text, m.role
    from public.business_members m
    join auth.users u on u.id = m.user_id
    where m.business_id = p_business_id
    order by (m.role = 'owner') desc, m.created_at, u.email;
end;
$$;

-- Removes a non-owner member. Owner only; the owner cannot remove themselves.
create or replace function public.remove_member(p_business_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'only the owner can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'the owner cannot remove themselves';
  end if;
  if exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'the owner cannot be removed';
  end if;
  delete from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
  if not found then
    raise exception 'that person is not a member of this business';
  end if;
end;
$$;

revoke all on function public.business_members_list(uuid) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.business_members_list(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
