import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFacilityData } from '../../app/FacilityProvider';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { listCourtScheduleBlocks, listMaintenanceBetween, listPaymentsBetween } from '../../services/facilityService';
import { supabase } from '../../lib/supabase';
import type { CourtScheduleBlock, MaintenancePeriod, Payment } from '../../types/database';
import { getSantiagoWeekday, santiagoLocalToIso } from '../../utils/dateTime';
import { formatCurrency, getTodayKey } from '../../utils/format';
import { formatCourtTime } from '../../utils/courtSchedule';

type Period = 'today' | 'month' | 'three-months' | 'six-months' | 'year';
const periods: { value: Period; label: string; months: number }[] = [
  { value: 'today', label: 'Hoy', months: 0 },
  { value: 'month', label: '1 mes', months: 1 },
  { value: 'three-months', label: '3 meses', months: 3 },
  { value: 'six-months', label: '6 meses', months: 6 },
  { value: 'year', label: '1 año', months: 12 }
];
const DAY_MS = 24 * 60 * 60 * 1000;

function subtractMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetMonth = month - 1 - months;
  const firstOfTarget = new Date(Date.UTC(year, targetMonth, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, lastDay));
  return firstOfTarget.toISOString().slice(0, 10);
}

function localMinutes(value: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

export function RevenueOccupancyPage() {
  const { courts, reservations, loading: facilityLoading, error: facilityError, refresh } = useFacilityData();
  const [period, setPeriod] = useState<Period>('month');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [schedules, setSchedules] = useState<CourtScheduleBlock[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenancePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = getTodayKey();
  const range = useMemo(() => {
    const config = periods.find((item) => item.value === period);
    const startDate = period === 'today' ? today : subtractMonths(today, config?.months ?? 1);
    const startAt = santiagoLocalToIso(`${startDate}T00:00`);
    const endAt = new Date().toISOString();
    return { startDate, startAt, endAt };
  }, [period, today]);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase no está configurado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedPayments, loadedSchedules, loadedMaintenance] = await Promise.all([
        listPaymentsBetween(supabase, range.startAt, range.endAt),
        listCourtScheduleBlocks(supabase),
        listMaintenanceBetween(supabase, range.startAt, range.endAt)
      ]);
      setPayments(loadedPayments);
      setSchedules(loadedSchedules);
      setMaintenance(loadedMaintenance);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { void load(); }, [load]);

  const periodReservations = reservations.filter((reservation) =>
    reservation.status !== 'cancelled'
    && new Date(reservation.starts_at).getTime() >= new Date(range.startAt).getTime()
    && new Date(reservation.starts_at).getTime() <= new Date(range.endAt).getTime()
  );
  const revenue = payments.filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const rangeStart = Date.parse(range.startAt);
  const rangeEnd = Date.parse(range.endAt);
  const bookedHours = periodReservations.reduce((sum, reservation) => {
    const start = Math.max(rangeStart, new Date(reservation.starts_at).getTime());
    const end = Math.min(rangeEnd, new Date(reservation.ends_at).getTime());
    return sum + Math.max(0, end - start) / 3_600_000;
  }, 0);

  let capacityHours = 0;
  for (let timestamp = Date.parse(`${range.startDate}T12:00:00Z`); timestamp <= Date.parse(`${today}T12:00:00Z`); timestamp += DAY_MS) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    const weekday = getSantiagoWeekday(day);
    for (const court of courts) {
      if (court.status !== 'available') continue;
      const courtBlocks = schedules.filter((item) =>
        item.court_id === court.id && item.weekday === weekday && item.is_available
      );
      for (const block of courtBlocks) {
        const startAt = Date.parse(santiagoLocalToIso(`${day}T${block.starts_at.slice(0, 5)}`));
        const endAt = Date.parse(santiagoLocalToIso(`${day}T${block.starts_at.slice(0, 5)}`)) + 30 * 60 * 1000;
        const openAt = Math.max(rangeStart, startAt);
        const closeAt = Math.min(rangeEnd, endAt);
        if (closeAt <= openAt) continue;
        const blocked = maintenance
          .filter((item) => item.court_id === court.id)
          .map((item) => ({
            start: Math.max(openAt, new Date(item.starts_at).getTime()),
            end: Math.min(closeAt, new Date(item.ends_at).getTime())
          }))
          .filter((item) => item.end > item.start)
          .sort((left, right) => left.start - right.start);
        let blockedMilliseconds = 0;
        let blockedUntil = openAt;
        for (const interval of blocked) {
          const start = Math.max(interval.start, blockedUntil);
          if (interval.end > start) blockedMilliseconds += interval.end - start;
          blockedUntil = Math.max(blockedUntil, interval.end);
        }
        capacityHours += (closeAt - openAt - blockedMilliseconds) / 3_600_000;
      }
    }
  }
  const occupancy = capacityHours ? Math.min(100, Math.round(bookedHours / capacityHours * 100)) : 0;
  const demand = new Map<number, number>();
  for (const reservation of periodReservations) {
    const start = localMinutes(reservation.starts_at);
    const block = Math.floor(start / 30) * 30;
    demand.set(block, (demand.get(block) ?? 0) + 1);
  }
  const demandRows = [...demand.entries()].sort(([a], [b]) => a - b);
  const maxDemand = Math.max(...demandRows.map(([, count]) => count), 1);
  const courtOccupancy = courts.map((court) => ({
    court,
    booked: periodReservations
      .filter((reservation) => reservation.court_id === court.id)
      .reduce((sum, reservation) => {
        const start = Math.max(rangeStart, new Date(reservation.starts_at).getTime());
        const end = Math.min(rangeEnd, new Date(reservation.ends_at).getTime());
        return sum + Math.max(0, end - start) / 3_600_000;
      }, 0)
  }));
  const maxCourtBooked = Math.max(...courtOccupancy.map((item) => item.booked), 1);

  return <DataState loading={facilityLoading || loading} error={facilityError ?? error} onRetry={() => {
    void refresh();
    void load();
  }}>
    <section className="module-page">
      <div className="module-heading">
        <div><h2>Ingresos y ocupación</h2><p>Indicadores calculados a partir de pagos, reservas y horarios registrados.</p></div>
        <label className="filter-control"><Icon name="filter" size={16} /><select className="select-control" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
          {periods.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select></label>
      </div>
      <section className="stats-grid analytics-stats">
        <Metric title="Ingresos registrados" value={formatCurrency(revenue)} detail="Pagos vigentes en el período" />
        <Metric title="Ocupación" value={`${occupancy}%`} detail={`${bookedHours.toFixed(1)} h reservadas de ${capacityHours.toFixed(1)} h habilitadas`} />
        <Metric title="Reservas" value={periodReservations.length} detail="No incluye reservas canceladas" />
        <Metric title="Canchas activas" value={courts.filter((court) => court.status === 'available').length} detail={`De ${courts.length} canchas registradas`} />
      </section>
      <div className="analytics-grid">
        <section className="panel data-panel">
          <div className="panel-heading"><div><h2>Demanda por horario</h2><p>Reservas activas según hora local de inicio</p></div></div>
          {demandRows.length ? <div className="report-bars">{demandRows.map(([start, count]) => <div className="report-bar-row" key={start}>
            <span>{formatCourtTime(start)}</span><div className="report-bar-track"><i style={{ width: `${count / maxDemand * 100}%` }} /></div><strong>{count}</strong>
          </div>)}</div> : <EmptyState title="Sin reservas en el período" description="La demanda por horario aparecerá cuando existan reservas." />}
        </section>
        <section className="panel data-panel">
          <div className="panel-heading"><div><h2>Ocupación por cancha</h2><p>Horas reservadas en el período seleccionado</p></div></div>
          {courtOccupancy.length ? <div className="report-bars">{courtOccupancy.map(({ court, booked }) => <div className="report-bar-row" key={court.id}>
            <span>{court.name}</span><div className="report-bar-track"><i style={{ width: `${booked / maxCourtBooked * 100}%` }} /></div><strong>{booked.toFixed(1)} h</strong>
          </div>)}</div> : <EmptyState title="Sin canchas registradas" description="Agrega canchas para consultar su ocupación." />}
        </section>
      </div>
    </section>
  </DataState>;
}

function Metric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return <article className="stat-card"><div className="stat-content"><p>{title}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}
