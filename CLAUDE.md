# Resale Tracker – guide for coding agents

iPhone/iPad app for Kat's secondhand clothing business on eBay (Australia, AUD). Read `AGENTS.md` (Expo rules) and `docs/BUILD_PLAN.md` (what to build) before starting. The approved clickable prototype is the visual and behavioural reference: `docs/prototype/index.html` (open it and match it).

## Stack (fixed: do not change)

- Expo SDK 58, React Native, TypeScript strict, **Expo Router** (routes in `src/app/`).
- **Must run in Expo Go.** Only use modules bundled in Expo Go (all deps already installed are fine). No new native modules, no dev-client-only libraries.
- Supabase (Postgres + Auth + Storage) via `src/lib/supabase.ts`. Schema: `supabase/migrations/`. Row level security is on; every row has `business_id`.
- TanStack Query v5 for server state, persisted to AsyncStorage for offline reading.
- Tests: Jest (`jest-expo` preset). Pure logic lives in `src/domain/` and must have unit tests.

## Folder layout

```
src/app/            routes only (thin: compose components, call hooks)
src/components/     shared UI (Card, Row, Pill, Button, Field, Sheet, KpiTile, Bars, MoneyBar, ...)
src/features/<x>/   feature-specific components and helpers (trips, items, sales, insights, more)
src/data/           Supabase access + query/mutation hooks (the ONLY place that calls supabase)
src/domain/         pure TypeScript: types, money maths, SKUs, analytics, seasons, tax year. No React, no Supabase.
src/theme.ts        colours, spacing, type scale (from the prototype)
```

## Rules

- Money: always use helpers in `src/domain/money.ts`. Round to cents only for display/storage, never mid-calculation.
- Dates are `YYYY-MM-DD` strings (local Australia/Sydney date). No `Date` objects in domain types.
- Seasons are Australian: Summer Dec–Feb, Autumn Mar–May, Winter Jun–Aug, Spring Sep–Nov. Financial year is 1 Jul–30 Jun.
- Use the words Kat uses: "trip", "receipt line", "To list / For family / Keeping / Faulty", "listing price", "You get about", "Buyer sees about", "eBay earnings", "profit".
- Accessibility: touch targets ≥ 44pt, `accessibilityLabel` on icon-only buttons, real text contrast.
- No emoji in UI. Icons: simple stroke SVGs via `react-native-svg` (see `src/components/Icon.tsx`).
- Never put secrets in the app. Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (publishable) are allowed.

## Commands

The sandbox blocks api.expo.dev, so:

```bash
EXPO_OFFLINE=1 npx expo install <pkg>   # only if truly needed; prefer what's installed
npm run typecheck                        # tsc --noEmit
npm test                                 # jest
EXPO_OFFLINE=1 npx expo export --platform ios --output-dir /tmp/rt-export   # bundle check
```

Before you finish a task: typecheck and tests must pass, and the iOS bundle must build. Do not edit files owned by another task (see BUILD_PLAN.md) unless the plan says so; if you need a change there, note it in your final report.
