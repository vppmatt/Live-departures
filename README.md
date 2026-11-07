# Live Departures

A split-flap ("Solari") style departures board for **Leeds Bradford Airport (LBA)**,
with a picker for other airports (any 3-letter IATA code).

- Real two-half flaps that cycle through the alphabet, with a cascading flip on every update
- Optional mechanical click sound, fullscreen mode, auto-paging when there are more than 10 flights
- Status colouring (on time / expected time / boarding / gate closed / departed / cancelled)
- Clock shown in the airport's local time
- No dependencies, Node 18+

## Run

```sh
npm start            # http://localhost:3000
```

With no API key it runs in **demo mode** (a generated, realistic schedule whose statuses
progress in real time) so you can see the board straight away.

## Live data

1. Subscribe (free tier available) to [AeroDataBox on RapidAPI](https://rapidapi.com/aedbx-aedbx/api/aerodatabox).
2. `cp .env.example .env` and set `RAPIDAPI_KEY`.
3. `npm start`. The badge in the header changes from "demo data" to "live".

The key stays on the server. Responses are cached for 60 s per airport, so a wall-mounted
board polling every minute uses roughly 1 API call per minute per airport. If the live call
fails the board shows the last good data (or demo data) rather than going blank.

Other providers can be added by returning the same shape as `src/aerodatabox.js`
(`{airport, source, flights:[{time, expected, flight, dest, gate, terminal, status}]}`).

## URL options

`/?airport=MAN` opens a specific airport (the last choice is also remembered in the browser).

## Test

```sh
npm test
```

## Layout

| Path | Purpose |
| --- | --- |
| `server.js` | HTTP server, `/api/departures`, caching, static files |
| `src/demo.js` | Demo schedule generator |
| `src/aerodatabox.js` | Live provider |
| `public/flap.js` | Split-flap tile and row component |
| `public/app.js` | Board logic: polling, paging, controls |
