# Resale Tracker

iPhone and iPad app for Kat's secondhand clothing business on eBay: shopping trips and receipt lines, items with meaningful SKUs and storage locations, sales (including combined orders), returns, expenses, insights, pricing what-if and a tax-year report.

- **Run it:** see [docs/TESTING_ON_IPHONE.md](docs/TESTING_ON_IPHONE.md). Without a `.env` it runs in demo mode with sample data.
- **What was built and why:** [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md); agent rules in [CLAUDE.md](CLAUDE.md).
- **Approved design:** [docs/prototype/index.html](docs/prototype/index.html).
- **Database:** `supabase/migrations/` (apply to the Supabase project once).

## Checks

```bash
npm run typecheck
npm test
EXPO_PUBLIC_DEMO=1 npx expo start --web   # quick look in a browser with sample data
```

## Next phases

1. **AI helpers:** listing writer, price suggestion, receipt reader (Claude API via a Supabase Edge Function; key never in the app).
2. **eBay sync:** import active listings, pull orders, fees and tracking automatically.
3. **Later:** Depop channel; standalone app via TestFlight (Apple Developer account).

## Known follow-ups

- CSV import makes three requests per row; add a bulk import mutation before importing thousands of rows.
- More › Shared with can add Damon but doesn't list current members yet (needs a small RPC returning member emails).
