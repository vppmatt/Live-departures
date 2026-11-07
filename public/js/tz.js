// Small timezone helpers built on Intl (no dependencies).

function parts(tz, ts) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o = {};
  for (const p of f.formatToParts(ts)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
}

/** Offset (ms) of `tz` from UTC at instant `ts`. */
function offsetMs(tz, ts) {
  const p = parts(tz, ts);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
}

/** Epoch ms of local midnight for the local date containing `ts` (+ dayOffset days). */
function localMidnight(tz, ts, dayOffset = 0) {
  const p = parts(tz, ts);
  const naive = Date.UTC(p.y, p.m - 1, p.d + dayOffset);
  let guess = naive - offsetMs(tz, naive);
  guess = naive - offsetMs(tz, guess); // second pass handles DST boundaries
  return guess;
}

/** "HH:MM" local time for epoch ms. */
function hhmm(tz, ts) {
  const p = parts(tz, ts);
  return String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0');
}

/** "YYYY-MM-DDTHH:mm" local time for epoch ms. */
function localIso(tz, ts) {
  const p = parts(tz, ts);
  const z = (n) => String(n).padStart(2, '0');
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

export { offsetMs, localMidnight, hhmm, localIso };
