-- eBay AU Buyer Protection = $0.30 flat + tiers on the item price (8% to $20, 6% to $500,
-- 4% to $5,000). The tiers live in the app (src/domain/money.ts); only the flat fee is a setting.
-- protection_pct is no longer used.
alter table public.business_settings alter column protection_fixed set default 0.30;
update public.business_settings set protection_fixed = 0.30 where protection_fixed = 0.75;
comment on column public.business_settings.protection_pct is 'unused since 2026-11-14 (tiered fee in app)';
