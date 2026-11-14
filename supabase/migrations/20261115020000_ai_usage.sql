-- AI helpers: per-business daily call counter (the cap is enforced by the `ai` Edge Function).

create table public.ai_usage (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  calls int not null default 0 check (calls >= 0),
  primary key (business_id, day)
);

alter table public.ai_usage enable row level security;

create policy "members read ai usage" on public.ai_usage
  for select to authenticated using (public.is_member(business_id));

-- Members can read only; counts change through ai_take_call() below.
revoke insert, update, delete on public.ai_usage from authenticated;
revoke all on public.ai_usage from anon;

-- Adds one call for today (Australia/Sydney) and returns the new count.
-- Raises 'ai_daily_cap_reached' (errcode P0001) when the business has already used p_cap calls today.
-- Called by the Edge Function with the service role, after it has checked the caller is a member.
create or replace function public.ai_take_call(p_business_id uuid, p_cap int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Australia/Sydney')::date;
  used int;
begin
  insert into public.ai_usage as u (business_id, day, calls)
  values (p_business_id, today, 1)
  on conflict (business_id, day) do update
    set calls = u.calls + 1
    where u.calls < p_cap
  returning u.calls into used;

  if used is null then
    raise exception 'ai_daily_cap_reached' using errcode = 'P0001';
  end if;
  return used;
end;
$$;

revoke all on function public.ai_take_call(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_take_call(uuid, int) to service_role;
