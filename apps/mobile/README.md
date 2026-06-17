# DOJOBID Mobile (Expo)

A React Native (Expo) app with full navigation: authenticated sign-in/register, a bottom-tab
shell (Find Jobs, My Jobs, Activity, Profile) and pushed detail screens (Job Detail, Post Job).
Sessions persist across launches and bids/messages/notifications update live over WebSockets.

This app is **installed independently** of the root npm workspaces, because Expo/Metro and
npm workspace symlinks don't always play nicely (especially on Windows).

## Run

```bash
cd apps/mobile
npm install
npx expo start
```

- Press `w` to open in a web browser, `a` for Android, `i` for iOS (macOS only), or scan the
  QR code with the Expo Go app.
- On a physical device/emulator, `localhost` won't reach your dev machine. Set your LAN IP:

```bash
# PowerShell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:4000/api/v1"; npx expo start
```

## Structure

```
App.tsx                      SafeArea + Auth providers + NavigationContainer
src/api.ts                   REST client, token, signed uploads, device registration
src/auth.tsx                 AuthContext: login/register/logout, AsyncStorage session restore
src/realtime.ts              useRealtime hook (socket.io-client, /realtime namespace)
src/push.ts                  Push permission + Expo token registration + handlers
src/navigation.tsx           Root stack (auth switch) + bottom tabs
src/navTypes.ts              Typed param lists / screen props
src/theme.ts                 Colors, shared StyleSheet, budget formatting
src/components/JobsMap.tsx   Coarse-pin map (native) + .web.tsx list fallback
src/screens/                 Login, FindJobs, JobDetail, PostJob, MyJobs, Activity, Profile
```

### Flows covered

- **Auth**: email/password login + registration (homeowner/contractor); token persisted.
- **Find Jobs**: radius/work-type search; toggle between a list and a **map of coarse pins**
  (native maps on iOS/Android; a tappable list fallback on web).
- **Job Detail**: contractors place a bid; owners review bids and accept; a job-scoped message
  thread (with counterpart selection for owners). Precise address only shows once revealed.
- **Post Job**: create a job (homeowner or contractor) with up to 4 **photos** picked from the
  library and uploaded via the API's signed-URL endpoint.
- **My Jobs**: jobs you posted, refreshed on focus.
- **Activity**: notification feed with live updates + mark-all-read.
- **Profile**: contractor profile editor + logout.
- **Push**: on sign-in the app requests notification permission and registers an Expo push
  token with `POST /devices` (best-effort; no-op on simulators/web).

## Development build (custom icon + splash on iPhone)

Expo Go always shows Expo's icon. To see the **DOJOBID icon and splash** on a physical
iPhone, install a **development build** via EAS (cloud build — works from Windows).

### Prerequisites

1. A free [Expo account](https://expo.dev/signup)
2. An [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year)
   — required to install a custom app on your iPhone (not needed for iOS Simulator on a Mac)
3. The API running on your PC and reachable on your home Wi‑Fi (same network as the phone)

### One-time setup

```bash
cd apps/mobile
npm install
npm run eas:login          # sign in to Expo in the browser
npm run eas:init           # links this app to an EAS project (adds projectId to app.json)
```

During `eas:init`, accept the default slug (`contractor-bidder`) or pick a unique one if
taken.

### Build for your iPhone

```bash
npm run eas:build:ios:dev
```

EAS will prompt for Apple credentials the first time (it can create/manage certificates for
you). When the build finishes, open the install link on your iPhone (or scan the QR code from
the terminal / [expo.dev](https://expo.dev) dashboard) and install **DOJOBID**.

You may need to register your device UDID — EAS walks you through this if prompted.

### Run the app after installing

1. Start the API on your PC (`apps/api`).
2. Start Metro in **dev-client** mode with your PC's LAN IP (not `localhost`):

```powershell
# PowerShell — replace with your PC's Wi‑Fi IP (ipconfig)
$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:4000/api/v1"
npm run start:dev-client
```

3. Open the **DOJOBID** app on your iPhone (not Expo Go) and scan the QR code from the
   terminal, or enter the Metro URL manually.

Rebuild with `npm run eas:build:ios:dev` only when native dependencies or app config
(icon, splash, permissions) change — day-to-day JS changes reload from Metro without rebuilding.

## Production notes

- **Maps**: works out of the box in Expo Go. A standalone/dev build needs a Google Maps API key
  (`android.config.googleMaps.apiKey` in `app.json`) for Android.
- **Photos**: with `MEDIA_S3_BUCKET` unset the API returns a dev placeholder URL and the client
  skips the actual `PUT` — wire real S3 credentials to persist uploads.
- **Push**: `getExpoPushTokenAsync` needs an EAS `projectId` for real delivery; the API's
  `PushService` currently logs in dev. Run on a physical device to obtain a token.

## Next steps

- Token refresh on 401 using the persisted refresh token.
- Deep links from tapped push notifications into the relevant job.
