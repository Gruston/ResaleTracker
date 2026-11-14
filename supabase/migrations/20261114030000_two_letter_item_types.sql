-- Item types use two letters (first two letters of the type), so SKUs read like WDR-014
-- (women's dress no. 14). Existing SKUs keep their old codes; new items get the new ones.

-- 1. Storage locations: 'WD' -> 'WDR' etc. (uses the old codes, so do this first)
update public.storage_locations s
set prefix = left(s.prefix, 1) || t.code
from public.sku_codes c
join (values
  ('Dress', 'DR'), ('Top', 'TO'), ('Shirt', 'SH'), ('Cardigan', 'CA'), ('Jumper', 'JU'),
  ('Jacket', 'JA'), ('Coat', 'CO'), ('Skirt', 'SK'), ('Pants', 'PA'), ('Jeans', 'JE'),
  ('Shoes', 'SO'), ('Bag', 'BA'), ('Accessory', 'AC'), ('Romper', 'RO'), ('Playsuit', 'PL')
) as t(label, code) on t.label = c.label
where c.kind = 'item_type'
  and c.business_id = s.business_id
  and length(s.prefix) = 2
  and substr(s.prefix, 2) = c.code
  and length(c.code) = 1
  -- skip if the new code is already used by another item type, or the new prefix already has a location
  and not exists (select 1 from public.sku_codes o
                  where o.business_id = c.business_id and o.kind = 'item_type' and o.code = t.code)
  and not exists (select 1 from public.storage_locations x
                  where x.business_id = s.business_id and x.prefix = left(s.prefix, 1) || t.code);

-- 2. The codes themselves (only the built-in one-letter ones; custom two-letter codes are kept)
update public.sku_codes c
set code = t.code
from (values
  ('Dress', 'DR'), ('Top', 'TO'), ('Shirt', 'SH'), ('Cardigan', 'CA'), ('Jumper', 'JU'),
  ('Jacket', 'JA'), ('Coat', 'CO'), ('Skirt', 'SK'), ('Pants', 'PA'), ('Jeans', 'JE'),
  ('Shoes', 'SO'), ('Bag', 'BA'), ('Accessory', 'AC'), ('Romper', 'RO'), ('Playsuit', 'PL')
) as t(label, code)
where c.kind = 'item_type' and c.label = t.label and length(c.code) = 1
  -- skip if another item type already uses the new code (e.g. a custom "Shorts = SH")
  and not exists (select 1 from public.sku_codes o
                  where o.business_id = c.business_id and o.kind = 'item_type' and o.code = t.code);

-- Item types still on a one-letter code (because the two-letter code was taken) are listed by
-- the query at the end; change them in the app under More > SKU codes.

-- 3. New businesses: departments incl. Unisex, and two-letter item types
drop trigger if exists settings_add_unisex on public.business_settings;
drop function if exists public.add_unisex_department();

create or replace function public.create_business(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into businesses (name, owner_id) values (p_name, auth.uid()) returning id into bid;
  insert into business_members (business_id, user_id, role) values (bid, auth.uid(), 'owner');
  insert into business_settings (business_id) values (bid);

  insert into sku_codes (business_id, kind, label, code, sort) values
    (bid, 'department', 'Women', 'W', 1),
    (bid, 'department', 'Men', 'M', 2),
    (bid, 'department', 'Kids', 'K', 3),
    (bid, 'department', 'Unisex', 'U', 4),
    (bid, 'item_type', 'Dress', 'DR', 1),
    (bid, 'item_type', 'Top', 'TO', 2),
    (bid, 'item_type', 'Shirt', 'SH', 3),
    (bid, 'item_type', 'Cardigan', 'CA', 4),
    (bid, 'item_type', 'Jumper', 'JU', 5),
    (bid, 'item_type', 'Jacket', 'JA', 6),
    (bid, 'item_type', 'Coat', 'CO', 7),
    (bid, 'item_type', 'Skirt', 'SK', 8),
    (bid, 'item_type', 'Pants', 'PA', 9),
    (bid, 'item_type', 'Jeans', 'JE', 10),
    (bid, 'item_type', 'Shoes', 'SO', 11),
    (bid, 'item_type', 'Bag', 'BA', 12),
    (bid, 'item_type', 'Accessory', 'AC', 13),
    (bid, 'item_type', 'Romper', 'RO', 14),
    (bid, 'item_type', 'Playsuit', 'PL', 15);

  insert into shops (business_id, name, kind) values (bid, 'My wardrobe', 'wardrobe');

  return bid;
end;
$$;

revoke all on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;

-- Anything left to sort out by hand (usually nothing):
select label, code as old_code, 'two-letter code already taken: pick one in More > SKU codes' as note
from public.sku_codes where kind = 'item_type' and length(code) = 1;
