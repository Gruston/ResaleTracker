-- Reserve several SKUs for one prefix in a single call (used by the bulk CSV import).
-- Same rules as next_sku(): members only, prefix is 2-4 capital letters, counters only change here.
create or replace function public.next_skus(p_business_id uuid, p_prefix text, p_count int)
returns table (sku text, sku_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  last_n int;
begin
  if not is_member(p_business_id) then
    raise exception 'not a member of this business';
  end if;
  if p_prefix !~ '^[A-Z]{2,4}$' then
    raise exception 'bad prefix %', p_prefix;
  end if;
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'bad count %', p_count;
  end if;

  insert into sku_counters as c (business_id, prefix, last_number)
  values (p_business_id, p_prefix, p_count)
  on conflict (business_id, prefix) do update set last_number = c.last_number + p_count
  returning c.last_number into last_n;

  return query
    select p_prefix || '-' || lpad(n::text, 3, '0'), n
    from generate_series(last_n - p_count + 1, last_n) as n
    order by n;
end;
$$;

revoke all on function public.next_skus(uuid, text, int) from public, anon;
grant execute on function public.next_skus(uuid, text, int) to authenticated;
