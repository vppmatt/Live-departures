# Live Departures

A split-flap ("Solari") style departures board for **Leeds Bradford Airport (LBA)**, with a
picker for any other airport (3-letter IATA code). Runs in a browser or as an Android app.

- Real two-half flaps that cycle through the alphabet, with a cascading flip on every update
- Refreshes every **30 seconds** with a countdown bar and "next update in Ns" text; Refresh button for an instant update
- Pauses while the app is in the background and refreshes as soon as you come back
- Keeps the screen awake while open; optional flap click sound; auto-pages if there are more than 10 flights
- No backend: the app calls the flight-data API directly. **Your API key is typed into the app
  (Settings) and stored only on your device - it is never in this repo.**
- Without a key it shows a generated demo schedule

## Live data key

1. Sign up at [RapidAPI](https://rapidapi.com) and subscribe (free plan) to
   [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox).
2. Open the app, tap **Settings**, paste the key, **Save**. The badge changes from "demo data" to "live".

Mind your plan's monthly quota: a 30 s refresh is ~120 calls per hour of use. Change
`REFRESH_MS` in `public/js/app.js` if you want it slower.

## Android app

The Android project (`android/`) is a [Capacitor](https://capacitorjs.com) wrapper around `public/`.
Network calls go through Capacitor's native HTTP so there are no browser CORS problems.
The app is locked to landscape, which suits the board.

**Get an APK without installing anything:** push to GitHub; the *Build Android APK* workflow
(`.github/workflows/android.yml`) builds `app-debug.apk` and attaches it to the run as an artifact.
Download it, copy it to your phone and open it (allow "install unknown apps" when asked).

**Build locally** (needs JDK 21 + Android SDK, e.g. via Android Studio):

```sh
npm install
npm run android:sync     # copies public/ into the Android project
npm run android:open     # opens Android Studio; press Run
# or: cd android && ./gradlew assembleDebug  ->  android/app/build/outputs/apk/debug/
```

After changing anything in `public/`, run `npm run android:sync` again.

## Develop in a browser

```sh
npm start        # static server on http://localhost:3000
npm test
```

`/?airport=MAN` opens a specific airport. (Direct browser calls to RapidAPI depend on its CORS
headers; the Android app doesn't have that limitation.)

## Layout

| Path | Purpose |
| --- | --- |
| `public/js/app.js` | Board logic: refresh loop, countdown, paging, settings |
| `public/js/flap.js` | Split-flap tile and row component |
| `public/js/departures.js` | Live-or-demo selection and error fallback |
| `public/js/aerodatabox.js` | AeroDataBox client |
| `public/js/demo.js` | Demo schedule generator |
| `capacitor.config.json`, `android/` | Android wrapper |
