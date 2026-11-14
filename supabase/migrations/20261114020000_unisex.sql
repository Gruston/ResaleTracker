-- Add a Unisex department (code U), e.g. UJ-001 = unisex jumper no. 1.
alter table public.items drop constraint if exists items_department_check;
alter table public.items add constraint items_department_check
  check (department in ('Women', 'Men', 'Kids', 'Unisex'));

-- Existing businesses
insert into public.sku_codes (business_id, kind, label, code, sort)
select id, 'department', 'Unisex', 'U', 4 from public.businesses
on conflict do nothing;

-- New businesses: add Unisex alongside the other departments
create or replace function public.add_unisex_department()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into sku_codes (business_id, kind, label, code, sort)
  values (new.business_id, 'department', 'Unisex', 'U', 4)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists settings_add_unisex on public.business_settings;
create trigger settings_add_unisex after insert on public.business_settings
  for each row execute function public.add_unisex_department();
