# Trying Resale Tracker on your iPhone and iPad

The app runs inside **Expo Go**, a free app that opens apps still being built. Later, once Kat is happy, we can turn it into a normal app on her home screen via TestFlight (needs an Apple Developer account, $149 AUD/year).

## For Kat (one-off setup, about 5 minutes)

1. On your iPhone (and iPad), install **Expo Go** from the App Store. Make sure it is up to date (version 58 or later).
2. Open Expo Go and tap **Sign up** to create a free Expo account. Use the email Greg has for you.
3. Tell Greg your Expo username. He adds you to his Expo organisation so the app appears in your Expo Go.
4. Wait for Greg to say a new version is ready, then open Expo Go: the app is listed under **Projects** (or open the link Greg sends you).
5. The first time, enter your email. You'll get a 6-digit code by email; type it in. You stay signed in after that.

That's it. When Greg publishes a new version, just close and reopen the app in Expo Go to get it.

## For Greg

One-off:

```bash
git clone https://github.com/Gruston/ResaleTracker && cd ResaleTracker
npm ci
cp .env.example .env      # paste the Supabase URL and publishable key from Kat's project
npx eas-cli@latest login  # your Expo account
npx eas-cli@latest init   # links the project to your Expo account (commit the projectId it adds to app.json)
npx eas-cli@latest update:configure   # sets up EAS Update (commit the app.json changes)
```

Invite Kat: expo.dev › your account › Members › invite her username.

Each time you want Kat to get a new version:

```bash
git pull
npx eas-cli@latest update --branch kat --message "what changed"
```

Quick testing together on the same Wi-Fi instead (no publishing): `npx expo start` and Kat scans the QR code with her iPhone camera.

## Demo mode

If `.env` is missing, the app runs with built-in sample data (a "Demo data" banner shows). Nothing is saved. Handy for trying things out.
