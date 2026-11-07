const SANTIAGO_TIME_ZONE = 'America/Santiago';

export function santiagoLocalToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Selecciona una fecha y hora válidas.');
  const [, year, month, day, hour, minute] = match;
  const targetUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let candidate = targetUtc;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SANTIAGO_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(candidate));
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    const shownUtc = Date.UTC(
      Number(part('year')), Number(part('month')) - 1, Number(part('day')),
      Number(part('hour')), Number(part('minute'))
    );
    candidate += targetUtc - shownUtc;
  }
  return new Date(candidate).toISOString();
}

export function getSantiagoWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 16));
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: SANTIAGO_TIME_ZONE, weekday: 'short' }).format(probe);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}
