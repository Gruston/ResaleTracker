# AI helpers: setup for Greg

The app has three AI helpers: write a listing from photos, suggest a price, and read a receipt. They run in a Supabase Edge Function called `ai`. The Anthropic key lives only in Supabase, never in the app or the repo. The app never posts to eBay.

Model: `claude-sonnet-5-5`. Limit: 50 calls per business per day (change with the `AI_DAILY_CAP` secret).

## 1. Create the usage table (SQL Editor)

1. Open the Supabase dashboard, then SQL Editor, then New query.
2. Paste the whole of `supabase/migrations/20261115020000_ai_usage.sql` and press Run.

## 2. Deploy the function (Windows PowerShell, in the project folder)

```powershell
npx supabase login
npx supabase link --project-ref ltinycshcydsjtytchbu
npx supabase functions deploy ai
```

`login` opens a browser. `link` may ask for the database password. Re-run the `deploy` line whenever `supabase/functions/` changes.

## 3. Add the secret (dashboard only)

1. Supabase dashboard, then Edge Functions, then Secrets.
2. Add `ANTHROPIC_API_KEY` with your key from console.anthropic.com. Do not paste the key in chat, the repo or a `.env` file.
3. Optional: add `AI_DAILY_CAP` (a number, for example `30`) to change the daily limit.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function automatically.

## 4. Set a monthly spend limit (Anthropic Console)

1. console.anthropic.com, then Settings, then Limits.
2. Set a monthly spend limit (for example USD 10) and, if offered, a notification threshold below it.

## Cost

Rough guide, check current prices at anthropic.com/pricing: a listing call with 3 to 4 photos is about 1 to 2 cents (USD), a price call under 1 cent, a receipt call about 1 cent. At the 50 per day cap the worst case is roughly USD 1 per day, and normal use is a few cents a day. Failed or unusable answers still count toward the daily cap.

## How it behaves

- Sign-in required. The function checks the caller's login and that they belong to the business, and that every photo path starts with that business id.
- Photos are given to Claude as short-lived signed links (5 minutes). The photo bucket stays private.
- Errors come back as `{ "error": "friendly message" }` with status 401 (sign in again), 403 (not your business), 422 (bad request or unusable AI answer), 429 (daily cap reached) or 500.
- `src/domain/ai.ts` and `supabase/functions/_shared/ai.ts` must stay identical (a Jest test checks this). Edit the first, then copy it over the second.
