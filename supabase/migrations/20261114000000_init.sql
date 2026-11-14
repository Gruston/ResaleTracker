-- Resale Tracker: initial schema
-- One "business" owns all data. Members (Kat, optionally Damon) can read/write it.
-- All money in AUD, numeric(10,2).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Businesses and membership
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create or replace function public.is_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = bid and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Settings, SKU codes, storage
-- ---------------------------------------------------------------------------
create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  protection_fixed numeric(10,2) not null default 0.75,   -- buyer protection: fixed part ($)
  protection_pct numeric(5,2) not null default 5,         -- buyer protection: % of item + postage
  default_ad_rate numeric(5,2) not null default 3,        -- promoted listing %, per-item override
  ad_fee_base text not null default 'item' check (ad_fee_base in ('item', 'item_plus_postage')),
  default_label_cost numeric(10,2) not null default 12.50,
  updated_at timestamptz not null default now()
);

-- kind = 'department' (Women/Men/Kids -> W/M/K) or 'item_type' (Dress -> D ...)
create table public.sku_codes (
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('department', 'item_type')),
  label text not null,
  code text not null check (code ~ '^[A-Z]{1,2}$'),
  sort int not null default 0,
  primary key (business_id, kind, label),
  unique (business_id, kind, code)
);

-- prefix is a full prefix ('WD') or a department letter ('M') as fallback
create table public.storage_locations (
  business_id uuid not null references public.businesses(id) on delete cascade,
  prefix text not null,
  location text not null,
  primary key (business_id, prefix)
);

create table public.sku_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  prefix text not null,
  last_number int not null default 0,
  primary key (business_id, prefix)
);

-- ---------------------------------------------------------------------------
-- Shops, trips, receipt lines
-- ---------------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  kind text not null default 'shop' check (kind in ('shop', 'online', 'wardrobe')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  trip_date date not null default current_date,
  total numeric(10,2) not null default 0,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  description text not null,
  qty int not null default 1 check (qty >= 1),
  price numeric(10,2) not null default 0,       -- total for the line (qty x unit)
  outcome text not null default 'to_list'
    check (outcome in ('to_list', 'listed', 'family', 'keeping', 'faulty')),
  item_id uuid,                                  -- set when outcome = 'listed'
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sku text not null,
  sku_prefix text not null,
  sku_number int not null,
  title text not null default '',
  brand text not null default '',
  department text not null check (department in ('Women', 'Men', 'Kids')),
  item_type text not null,
  size text not null default '',
  description text not null default '',
  shop_id uuid references public.shops(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  trip_line_id uuid references public.trip_lines(id) on delete set null,
  purchase_date date,
  cost numeric(10,2),                            -- null = unknown (flag in UI); 0 = own wardrobe
  online_order_no text,
  status text not null default 'draft'
    check (status in ('draft', 'listed', 'sold', 'posted', 'returned', 'faulty')),
  listed_date date,
  first_list_price numeric(10,2),                -- what Kat first set on eBay
  ad_rate numeric(5,2),                          -- promoted listing %
  channel text not null default 'ebay' check (channel in ('ebay', 'depop', 'other')),
  ebay_listing_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku)
);

alter table public.trip_lines
  add constraint trip_lines_item_fk foreign key (item_id) references public.items(id) on delete set null;

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  path text not null,                            -- storage path in bucket 'photos'
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders (one eBay order can hold several items: combined orders)
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null default 'ebay' check (channel in ('ebay', 'depop', 'other')),
  order_no text,
  sold_date date not null default current_date,
  order_total numeric(10,2) not null,            -- what the buyer paid all-in for the whole order
  buyer_protection numeric(10,2) not null default 0,
  postage numeric(10,2) not null default 0,      -- label cost (= postage buyer paid)
  tracking_no text,
  posted_date date,
  postage_receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-item share of an order. Allocations are computed client-side
-- (src/domain/orders.ts) proportionally to sale_price and stored for history.
create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_price numeric(10,2) not null,
  alloc_postage numeric(10,2) not null default 0,
  alloc_protection numeric(10,2) not null default 0,
  ad_fee numeric(10,2) not null default 0,
  alloc_total numeric(10,2) not null,            -- item's share of order_total
  primary key (order_id, item_id)
);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  return_date date not null default current_date,
  refund_amount numeric(10,2) not null default 0,
  reason text,
  outcome text not null default 'pending' check (outcome in ('pending', 'relisted', 'thrown_out')),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  expense_date date not null default current_date,
  description text not null,
  category text not null default 'Packaging'
    check (category in ('Packaging', 'Stationery', 'Printer and labels', 'eBay fees', 'Other')),
  amount numeric(10,2) not null check (amount >= 0),
  receipt_path text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index on public.trips (business_id, trip_date desc);
create index on public.trip_lines (trip_id, sort);
create index on public.items (business_id, status);
create index on public.items (business_id, item_type);
create index on public.items (business_id, brand);
create index on public.items (trip_id);
create index on public.item_photos (item_id, sort);
create index on public.orders (business_id, sold_date desc);
create index on public.order_items (item_id);
create index on public.returns (item_id);
create index on public.expenses (business_id, expense_date desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.business_settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a business for the signed-in user, with defaults. Returns the business id.
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
    (bid, 'item_type', 'Dress', 'D', 1),
    (bid, 'item_type', 'Top', 'T', 2),
    (bid, 'item_type', 'Shirt', 'S', 3),
    (bid, 'item_type', 'Cardigan', 'C', 4),
    (bid, 'item_type', 'Jumper', 'J', 5),
    (bid, 'item_type', 'Jacket', 'K', 6),
    (bid, 'item_type', 'Coat', 'O', 7),
    (bid, 'item_type', 'Skirt', 'R', 8),
    (bid, 'item_type', 'Pants', 'P', 9),
    (bid, 'item_type', 'Jeans', 'N', 10),
    (bid, 'item_type', 'Shoes', 'F', 11),
    (bid, 'item_type', 'Bag', 'B', 12),
    (bid, 'item_type', 'Accessory', 'A', 13),
    (bid, 'item_type', 'Romper', 'Y', 14),
    (bid, 'item_type', 'Playsuit', 'U', 15);

  insert into shops (business_id, name, kind) values (bid, 'My wardrobe', 'wardrobe');

  return bid;
end;
$$;

-- Atomically reserve the next SKU for a prefix, e.g. 'WD' -> 'WD-015'.
create or replace function public.next_sku(p_business_id uuid, p_prefix text)
returns table (sku text, sku_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not is_member(p_business_id) then
    raise exception 'not a member of this business';
  end if;
  if p_prefix !~ '^[A-Z]{2,4}$' then
    raise exception 'bad prefix %', p_prefix;
  end if;

  insert into sku_counters as c (business_id, prefix, last_number)
  values (p_business_id, p_prefix, 1)
  on conflict (business_id, prefix) do update set last_number = c.last_number + 1
  returning c.last_number into n;

  sku := p_prefix || '-' || lpad(n::text, 3, '0');
  sku_number := n;
  return next;
end;
$$;

-- Add another person (e.g. Damon) to the business by email. Owner only.
create or replace function public.add_member_by_email(p_business_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  if not exists (
    select 1 from business_members
    where business_id = p_business_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'only the owner can add members';
  end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'no account with that email yet; ask them to sign in to the app once first';
  end if;
  insert into business_members (business_id, user_id, role)
  values (p_business_id, uid, 'member')
  on conflict do nothing;
end;
$$;

revoke all on function public.create_business(text) from public, anon;
revoke all on function public.next_sku(uuid, text) from public, anon;
revoke all on function public.add_member_by_email(uuid, text) from public, anon;
grant execute on function public.create_business(text) to authenticated;
grant execute on function public.next_sku(uuid, text) to authenticated;
grant execute on function public.add_member_by_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.sku_codes enable row level security;
alter table public.storage_locations enable row level security;
alter table public.sku_counters enable row level security;
alter table public.shops enable row level security;
alter table public.trips enable row level security;
alter table public.trip_lines enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.returns enable row level security;
alter table public.expenses enable row level security;

create policy "members read business" on public.businesses
  for select to authenticated using (public.is_member(id));
create policy "owner updates business" on public.businesses
  for update to authenticated using (owner_id = auth.uid());

create policy "members read membership" on public.business_members
  for select to authenticated using (public.is_member(business_id));

-- sku_counters only changes through next_sku()
create policy "members read counters" on public.sku_counters
  for select to authenticated using (public.is_member(business_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'business_settings', 'sku_codes', 'storage_locations', 'shops', 'trips', 'trip_lines',
    'items', 'item_photos', 'orders', 'order_items', 'returns', 'expenses'
  ] loop
    execute format(
      'create policy "members all" on public.%I for all to authenticated
         using (public.is_member(business_id)) with check (public.is_member(business_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket 'photos', path = '<business_id>/<anything>'
-- Used for item photos, receipt photos and postage receipts.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "members read photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members write photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members update photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
