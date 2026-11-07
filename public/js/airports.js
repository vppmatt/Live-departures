// Built-in airports (name + timezone) for quick-add and demo mode. Any other valid IATA code can
// be added in Settings; it is looked up through the API.
// `terminals` is only a seed for airports whose layout is well known. More are learned from
// flight data as you view an airport (see terminalsFor).
export const AIRPORTS = {
  LBA: { name: 'Leeds Bradford', tz: 'Europe/London' },
  MAN: { name: 'Manchester', tz: 'Europe/London', terminals: ['1', '2', '3'] },
  LHR: { name: 'London Heathrow', tz: 'Europe/London', terminals: ['2', '3', '4', '5'] },
  LGW: { name: 'London Gatwick', tz: 'Europe/London', terminals: ['N', 'S'] },
  STN: { name: 'London Stansted', tz: 'Europe/London' },
  LTN: { name: 'London Luton', tz: 'Europe/London' },
  EDI: { name: 'Edinburgh', tz: 'Europe/London' },
  GLA: { name: 'Glasgow', tz: 'Europe/London' },
  ABZ: { name: 'Aberdeen', tz: 'Europe/London' },
  BHX: { name: 'Birmingham', tz: 'Europe/London' },
  EMA: { name: 'East Midlands', tz: 'Europe/London' },
  LPL: { name: 'Liverpool', tz: 'Europe/London' },
  BRS: { name: 'Bristol', tz: 'Europe/London' },
  NCL: { name: 'Newcastle', tz: 'Europe/London' },
  BFS: { name: 'Belfast International', tz: 'Europe/London' },
  DUB: { name: 'Dublin', tz: 'Europe/Dublin', terminals: ['1', '2'] },
  AMS: { name: 'Amsterdam Schiphol', tz: 'Europe/Amsterdam' },
  CDG: { name: 'Paris Charles de Gaulle', tz: 'Europe/Paris' },
  FRA: { name: 'Frankfurt', tz: 'Europe/Berlin', terminals: ['1', '2'] },
  JFK: { name: 'New York JFK', tz: 'America/New_York' },
};

/** "Terminal 2", "T2", "2", "north" -> a comparable key: "2", "N". */
export function normTerm(t) {
  let s = String(t ?? '').trim().toUpperCase().replace(/^TERMINAL\s*/, '').replace(/^T(?=\d)/, '');
  if (s === 'NORTH') s = 'N';
  if (s === 'SOUTH') s = 'S';
  return s;
}

export function termLabel(n) {
  return n === 'N' ? 'North Terminal' : n === 'S' ? 'South Terminal' : `Terminal ${n}`;
}

/** Known + learned terminals for a preferred-airport entry, de-duplicated and sorted. */
export function terminalsFor(entry) {
  const set = new Set([...(AIRPORTS[entry.iata]?.terminals || []), ...(entry.terminals || [])].map(normTerm).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Terminals present in a set of flights. */
export function terminalsIn(flights) {
  return [...new Set(flights.map((f) => normTerm(f.terminal)).filter(Boolean))];
}

export function filterByTerminal(flights, term) {
  return term ? flights.filter((f) => normTerm(f.terminal) === term) : flights;
}
