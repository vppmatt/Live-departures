// Airports offered in the picker. Any other valid 3-letter IATA code also works
// in live mode (the provider looks it up); in demo mode it uses generic data.
export const AIRPORTS = {
  LBA: { name: 'Leeds Bradford', tz: 'Europe/London' },
  MAN: { name: 'Manchester', tz: 'Europe/London' },
  LHR: { name: 'London Heathrow', tz: 'Europe/London' },
  LGW: { name: 'London Gatwick', tz: 'Europe/London' },
  STN: { name: 'London Stansted', tz: 'Europe/London' },
  EDI: { name: 'Edinburgh', tz: 'Europe/London' },
  GLA: { name: 'Glasgow', tz: 'Europe/London' },
  BHX: { name: 'Birmingham', tz: 'Europe/London' },
  BRS: { name: 'Bristol', tz: 'Europe/London' },
  NCL: { name: 'Newcastle', tz: 'Europe/London' },
  DUB: { name: 'Dublin', tz: 'Europe/Dublin' },
  AMS: { name: 'Amsterdam Schiphol', tz: 'Europe/Amsterdam' },
  CDG: { name: 'Paris Charles de Gaulle', tz: 'Europe/Paris' },
  FRA: { name: 'Frankfurt', tz: 'Europe/Berlin' },
  JFK: { name: 'New York JFK', tz: 'America/New_York' },
};
