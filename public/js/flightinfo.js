// Flight detail popup. Shows only what the data source actually provides.
import { normTerm, termLabel } from './airports.js';

export function fmtMins(m) {
  m = Math.abs(Math.round(m));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d + 'T12:00:00Z');
  return isNaN(t) ? '' : t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

export const STATUS_LABEL = {
  scheduled: ['On time', 'ok'], delayed: ['Delayed', 'warn'], checkin: ['Check-in open', 'ok'], boarding: ['Boarding', 'good'],
  gateclosed: ['Gate closed', 'bad'], departed: ['Departed', 'good'], cancelled: ['Cancelled', 'bad'], diverted: ['Diverted', 'bad'],
};

/** Headline about delay/cancellation, or null when there's nothing to say. */
export function describeDelay(f) {
  switch (f.status) {
    case 'cancelled': return { tone: 'bad', text: 'This flight has been cancelled.' };
    case 'diverted': return { tone: 'bad', text: 'This flight has been diverted.' };
    case 'delayed':
      if (!f.expected) return { tone: 'warn', text: 'Delayed. A new departure time has not been published yet.' };
      return { tone: 'warn', text: `${f.delayMins > 0 ? `Delayed by ${fmtMins(f.delayMins)}. ` : 'Delayed. '}Now expected at ${f.expected} (scheduled ${f.time}).` };
  }
  if (f.expected && f.delayMins < 0) return { tone: 'good', text: `${fmtMins(f.delayMins)} earlier than scheduled. Now expected at ${f.expected}.` };
  return null;
}

/** [label, value] pairs for the details grid; missing values are left out. */
export function detailRows(f) {
  const t = normTerm(f.terminal);
  const dest = [f.dest, f.destIata && `(${f.destIata})`].filter(Boolean).join(' ');
  const rows = [
    ['Airline', f.airline],
    ['Aircraft', f.aircraft],
    ['Scheduled', [f.time, fmtDate(f.date)].filter(Boolean).join(' · ')],
    ['Expected', f.expected || ''],
    ['Terminal', t ? termLabel(t) : ''],
    ['Gate', f.gate],
    ['Check-in', f.checkIn],
    ['Destination', dest + (f.destName && !dest.toUpperCase().includes(f.destName.toUpperCase()) ? ` – ${f.destName}` : '')],
    ['Country', f.country],
  ];
  return rows.filter(([, v]) => v);
}

export const flightKey = (f) => `${f.flight}|${f.date || ''}|${f.time}`;

export function initFlightInfo({ dlg }) {
  const $ = (id) => document.getElementById(id);
  let key = null;

  function paint(f) {
    $('fNo').textContent = f.flight;
    $('fDest').textContent = `to ${f.dest}`;
    const [label, tone] = STATUS_LABEL[f.status] || STATUS_LABEL.scheduled;
    const pill = $('fPill');
    pill.textContent = label; pill.dataset.tone = tone;
    const d = describeDelay(f);
    const banner = $('fBanner');
    banner.hidden = !d;
    if (d) { banner.textContent = d.text; banner.dataset.tone = d.tone; }
    $('fList').replaceChildren(...detailRows(f).flatMap(([k, v]) => {
      const wrap = document.createElement('div');
      const dt = Object.assign(document.createElement('dt'), { textContent: k });
      const dd = Object.assign(document.createElement('dd'), { textContent: v });
      wrap.append(dt, dd);
      return [wrap];
    }));
    $('fNote').hidden = !['delayed', 'cancelled', 'diverted'].includes(f.status);
  }

  $('fClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  dlg.addEventListener('close', () => { key = null; });

  return {
    show(f) { key = flightKey(f); paint(f); if (!dlg.open) dlg.showModal(); },
    /** Called after each data refresh so an open popup stays current. */
    update(flights) {
      if (!key || !dlg.open) return;
      const f = flights.find((x) => flightKey(x) === key);
      if (f) paint(f);
    },
  };
}
