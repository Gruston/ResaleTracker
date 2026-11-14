# Roadmap and Sonnet task prompts

Summary and decisions: "Resale Tracker – Roadmap & Build Plan" (Claude Doc). Requirements: "Resale Tracker – Requirements & Design Brief".

## How to run a task

The orchestrator (Claude Opus) gives each Sonnet agent the prompt below plus this preamble, runs tasks in parallel only when their files don't overlap, then reviews, integrates, bumps `src/lib/version.ts`, and pushes.

> **Preamble for every task.** You are working on Resale Tracker in this repo (Expo SDK 58, TypeScript strict, Expo Router, Supabase). Read `CLAUDE.md`, `AGENTS.md` and the files named in your task first. Must run in Expo Go (no new native modules). Money via `src/domain/money.ts`; dates are ISO internally, shown/typed as Australian (`formatDate`, `formatDateAU`, shared `DateField`). Use Kat's words. Pure logic goes in `src/domain` or `src/features/<x>/*.ts` with Jest tests (`/// <reference types="jest" />` at the top of test files). Database changes = a new numbered file in `supabase/migrations/` (never edit old ones), tested against a local Postgres with the stubs used in earlier migrations if available. Only edit the files your task owns; list anything else you need in your report. Done = `npm run typecheck`, `npm test` and `EXPO_OFFLINE=1 npx expo export --platform ios --output-dir /tmp/rt-export-<task>` all pass. Do not commit. Report files changed, decisions and anything untested.

---

## Phase A – Polish

### A1 Kat's feedback round
Prompt: "Fix the following issues reported by Kat (screenshots attached/quoted): <list>. For each, find the cause, fix it, add a test where the logic is pure, and describe the fix in one line."

### A2 Bulk CSV import
Owns: `src/data/mutations/import.ts` (new), `src/data/index.ts` (export only), `src/app/(tabs)/more/import.tsx`.
Prompt: "CSV import currently runs useCreateItem + useRecordSale + useMarkPosted per row, each refetching the business. Add `useImportSales()` that takes the planned rows (see `planRow` in `src/features/more/importMap.ts`) and writes them in batches of 50: reserve SKUs (call `next_sku` per item, or add a migration with `next_skus(p_business_id, p_prefix, p_count)` returning a set), insert items, orders, order_items (allocations via `allocateOrder`), set status 'posted' with posted_date = sold date, create missing shops once. Invalidate business data once at the end. Demo mode: same API against the in-memory store. Report progress via a callback. Switch import.tsx to it; keep Stop working between batches. Test the batching/planning logic. Target: 300 rows in under a minute."

### A3 Members list
Owns: new migration, `src/data/members.ts` (new), `src/data/index.ts` (export), `src/app/(tabs)/more/index.tsx` (Shared with section).
Prompt: "Add a security-definer SQL function `business_members_list(p_business_id uuid)` returning user_id, email, role for members of a business the caller belongs to (join auth.users). Add `useMembers()` and show members under More › Shared with (email + Owner/Member). Owner can remove a non-owner member via a second function `remove_member(p_business_id, p_user_id)` (owner only, can't remove self). Demo mode: show 'Kat (owner)'."

### A4 Offline changes queue
Owns: `src/data/QueryProvider.tsx`, `src/data/mutations/helpers.ts`, `src/components/Screen.tsx` (banner only).
Prompt: "Make writes survive poor signal in op shops. Use TanStack Query's paused mutations with networkMode 'offlineFirst', @react-native-community/netinfo for onlineManager, persisted mutations (setMutationDefaults per mutation key so they can resume after restart) and resumePausedMutations on reconnect. Show a small 'Offline – N changes waiting' banner. Photos: if upload fails offline, keep the local uri and retry later. Document limits in the report."

---

## Phase B – AI helpers (Claude API)

### B1 AI Edge Function
Owns: `supabase/functions/ai/` (new), new migration (usage table), `docs/AI.md`.
Prompt: "Create a Supabase Edge Function `ai` (Deno) that authenticates the caller's Supabase JWT, checks business membership, enforces a per-business daily cap (table `ai_usage(business_id, day, calls)`), and calls the Anthropic Messages API with the key from secret ANTHROPIC_API_KEY (never sent to the app). Actions: `listing` (input: image URLs signed from storage + brand/type/size/department/condition notes → JSON { title ≤ 80 chars, description, keywords[] }), `price` (input: item facts + up to 30 of the business's own comparable sales → JSON { low, high, reasoning }), `receipt` (input: receipt image → JSON { shop, date (ISO), total, lines: [{ description, qty, price }] }). Use the current Claude Sonnet model id from Anthropic's docs, tool-use/JSON output, and validate the JSON before returning. Write docs/AI.md: deploy steps (`supabase functions deploy ai`, `supabase secrets set ANTHROPIC_API_KEY=...`), cost notes."

### B2 Listing writer and price suggestion
Owns: `src/features/items/ai.ts`, `src/features/items/AiListingButton.tsx`, small edits in `src/features/items/ItemForm.tsx`, `src/data/ai.ts` (new).
Prompt: "Replace the disabled 'Write listing with AI · Coming soon' button with a working one calling the `ai` function (`listing` then `price`). Show a sheet with the suggested title (80-char counter), description and price range with reasoning; buttons Use (fills the item form), Copy title, Copy description (expo-clipboard if bundled in Expo Go, else Share sheet) so Kat pastes into eBay herself. The app never posts to eBay. Needs at least one photo uploaded first; explain if not. Loading and error states in Kat's words. Demo mode: return canned suggestions."

### B3 Receipt reader
Owns: `src/features/trips/receipt*.ts(x)`, small edits in `src/features/trips/TripForm.tsx`.
Prompt: "On New trip, after taking a receipt photo, offer 'Read this receipt'. Call `ai` `receipt`, then prefill shop (match existing shops case-insensitively, else offer to add), date, total and draft lines (qty and price). Kat reviews before saving; highlight lines that don't add up to the total."

### B4 AI usage display
Owns: More screen row + `src/data/ai.ts` usage query.
Prompt: "Show 'AI helpers: N used today of M' in More, and a friendly message when the cap is reached."

---

## Phase C – eBay sync (read-only)

**Principle: Kat creates and edits listings in eBay. The app only reads from eBay (listings, orders, fees, tracking) and never posts, edits or ends anything there.** Request read-only OAuth scopes only.

Prerequisite (people, not code): eBay developer account and production keyset approved; decide whose account. Confirm in eBay's docs which APIs give order totals, Buyer Protection, postage label cost, promoted listing (ad) fees and tracking for Australian private sellers, and how far back order history is available.

### C1 eBay connection (OAuth)
Owns: `supabase/functions/ebay-auth/`, migration `ebay_connections` (business_id, refresh token encrypted/stored server-side only, scopes, expires), More › eBay account.
Prompt: "Implement read-only eBay OAuth (authorization code grant, read-only scopes only) via an Edge Function: start URL opened with expo-web-browser's auth session, callback handled by the function, tokens stored server-side with RLS denying client reads. More shows Connected as <eBay user> / Disconnect."

### C2 Import active listings
Owns: `supabase/functions/ebay-sync/` (listings part), items mapping helpers in `src/domain/ebay.ts`.
Prompt: "Pull the seller's active listings and create or update items: title, first listing price, listed date, eBay listing id, photos (store URLs), SKU from the eBay Custom label (SKU) field that Kat types when listing; if it is empty or unknown, create the item with a new SKU and flag it so Kat can add that SKU to the listing in eBay herself. Never write to eBay. Items get status 'listed' and cost null (flagged 'missing a cost')."

### C3 Orders, fees, tracking
Owns: `ebay-sync` (orders part), `src/domain/ebay.ts`.
Prompt: "Pull orders since the last sync: create orders/order_items (combined orders via allocateOrder, but use eBay's real per-item amounts where available), buyer protection, postage label cost, ad fees, tracking and shipped date; set item status sold/posted. Idempotent on eBay order id. Unit-test the mapping with recorded sample payloads."

### C4 Scheduled sync
Owns: Supabase cron/pg_net schedule, Home 'Last synced' line and Sync now button.

---

## Phase D – Standalone app
D1: `eas.json` profiles, app icon/splash, bundle id `com.gruston.resaletracker` (or Kat's), `eas build -p ios` + `eas submit` to TestFlight; runtimeVersion policy switched from `exposdk:58.0.0` to `appVersion` for builds (keep a separate Expo Go channel if still needed).

## Phase E – Later
E1 Depop channel (channel picker on sale, Depop fee settings, insights split by channel). E2 Business-seller scenario in what-if.
