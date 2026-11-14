-- Newer Supabase projects don't grant table privileges to the API roles automatically.
-- Signed-in users (role "authenticated") get full access to the public tables; row level
-- security policies (see the init migration) still limit them to their own business's rows.
-- The anonymous role gets nothing.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- sku_counters is only changed through next_sku() (security definer)
revoke insert, update, delete on public.sku_counters from authenticated;

-- membership and businesses are only created through create_business() / add_member_by_email()
revoke insert, delete on public.business_members from authenticated;
revoke update on public.business_members from authenticated;
revoke insert, delete on public.businesses from authenticated;

-- future tables
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

revoke all on all tables in schema public from anon;
