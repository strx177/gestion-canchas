import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFacilityData } from '../../app/FacilityProvider';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';
import type { CourtSchedule, Payment } from '../../types/database';
import { formatCurrency, formatDate, getDateKey } from '../../utils/format';

export function ReportsPage() {
  const { courts, reservations } = useFacilityData();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [schedules, setSchedules] = useState<CourtSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setError(null);
    const [paymentsResult, schedulesResult] = await Promise.all([
      supabase.from('payments').select('*').eq('status', 'paid').order('created_at', { ascending: false }),
      supabase.from('court_schedules').select('*')
    ]);
    if (paymentsResult.error) setError(paymentsResult.error.message);
    else if (schedulesResult.error) setError(schedulesResult.error.message);
    else { setPayments(paymentsResult.data); setSchedules(schedulesResult.data); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revenue = payments.reduce((total, item) => total + Number(item.amount), 0);
  const activeReservations = reservations.filter((item) => item.status !== 'cancelled');
  const capacityHours = schedules.reduce((total, item) => {
    if (item.is_closed) return total;
    const [openHour, openMinute] = item.opens_at.split(':').map(Number);
    const [closeHour, closeMinute] = item.closes_at.split(':').map(Number);
    return total + Math.max(0, ((closeHour * 60 + closeMinute) - (openHour * 60 + openMinute)) / 60) * (30 / 7);
  }, 0);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const bookedHours = activeReservations
    .filter((item) => new Date(item.starts_at).getTime() >= cutoff && new Date(item.starts_at).getTime() <= Date.now())
    .reduce((total, item) => total + (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 3_600_000, 0);
  const occupancy = capacityHours ? Math.min(100, Math.round(bookedHours / capacityHours * 100)) : 0;
  const revenuesByDay = useMemo(() => {
    const days = new Map<string, number>();
    for (const payment of payments) {
      const key = getDateKey(payment.created_at);
      days.set(key, (days.get(key) ?? 0) + Number(payment.amount));
    }
    return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 7).reverse();
  }, [payments]);

  const exportCsv = () => {
    const rows = [['Fecha', 'Reserva', 'Método', 'Monto'], ...payments.map((payment) => [
      formatDate(payment.created_at), payment.reservation_id, payment.method, String(payment.amount)
    ])];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'reporte-pagos.csv'; anchor.click();
    URL.revokeObjectURL(url);
  };

  return <DataState loading={loading} error={error} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading"><div><h2>Reportes</h2><p>Indicadores calculados a partir de reservas y pagos confirmados.</p></div>
        <button className="secondary-button" disabled={!payments.length} onClick={exportCsv}><Icon name="report" size={16} />Exportar pagos CSV</button>
      </div>
      <section className="stats-grid">
        <article className="stat-card"><div className="stat-content"><p>Ingresos registrados</p><strong>{formatCurrency(revenue)}</strong><small>Pagos vigentes en Supabase</small></div></article>
        <article className="stat-card"><div className="stat-content"><p>Reservas activas</p><strong>{activeReservations.length}</strong><small>No incluye cancelaciones</small></div></article>
        <article className="stat-card"><div className="stat-content"><p>Ocupación estimada</p><strong>{occupancy}%</strong><small>Últimos 30 días · horarios semanales configurados</small></div></article>
        <article className="stat-card"><div className="stat-content"><p>Canchas registradas</p><strong>{courts.length}</strong><small>Configuración actual del complejo</small></div></article>
      </section>
      <section className="panel data-panel"><div className="panel-heading"><div><h2>Ingresos diarios</h2><p>Últimos días con movimientos registrados</p></div></div>
        {revenuesByDay.length ? <div className="report-bars">{revenuesByDay.map(([day, amount]) => {
          const max = Math.max(...revenuesByDay.map(([, value]) => value), 1);
          return <div className="report-bar-row" key={day}><span>{formatDate(`${day}T12:00:00`)}</span><div className="report-bar-track"><i style={{ width: `${amount / max * 100}%` }} /></div><strong>{formatCurrency(amount)}</strong></div>;
        })}</div> : <EmptyState title="No hay pagos" description="Los ingresos aparecerán cuando se registren pagos para las reservas." />}
      </section>
    </section>
  </DataState>;
}
