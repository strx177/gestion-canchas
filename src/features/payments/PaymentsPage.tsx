import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { Payment, Reservation } from '../../types/database';
import { formatCurrency, formatDate } from '../../utils/format';

const methodLabels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' } as const;
const paymentMethods = ['cash', 'card', 'transfer', 'other'] as const;

function isPaymentMethod(value: string): value is Payment['method'] {
  return paymentMethods.some((method) => method === value);
}

export function PaymentsPage() {
  const { profile } = useAuth();
  const { reservations, customers, courts } = useFacilityData();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canRefund = profile?.role === 'owner';
  const load = useCallback(async () => {
    if (!supabase) { setLoadError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const result = await supabase.from('payments').select('*').order('created_at', { ascending: false });
    if (result.error) setLoadError(result.error.message);
    else setPayments(result.data);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = new Map<string, number>();
  for (const payment of payments) if (payment.status === 'paid') totals.set(payment.reservation_id, (totals.get(payment.reservation_id) ?? 0) + Number(payment.amount));
  const pendingReservations = reservations.filter((row) => row.status !== 'cancelled' && Number(row.total_amount) > (totals.get(row.id) ?? 0));

  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !reservation || !profile) return;
    const form = new FormData(event.currentTarget);
    const remaining = Number(reservation.total_amount) - (totals.get(reservation.id) ?? 0);
    const amount = Number(form.get('amount'));
    if (!(amount > 0) || amount > remaining) { setActionError(`Ingresa un monto entre 1 y ${formatCurrency(remaining)}.`); return; }
    const method = String(form.get('method'));
    if (!isPaymentMethod(method)) { setActionError('Selecciona un método de pago válido.'); return; }
    setSubmitting(true); setActionError(null);
    const result = await supabase.from('payments').insert({
      reservation_id: reservation.id,
      amount,
      method,
      reference: String(form.get('reference')) || null,
      recorded_by: profile.id
    });
    if (result.error) setActionError(result.error.message);
    else { setReservation(null); await load(); }
    setSubmitting(false);
  };

  const refund = async (payment: Payment) => {
    if (!supabase || !window.confirm(`¿Marcar ${formatCurrency(Number(payment.amount))} como reembolsado?`)) return;
    const result = await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment.id);
    if (result.error) setActionError(result.error.message);
    else await load();
  };

  return <DataState loading={loading} error={loadError} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading"><div><h2>Pagos</h2><p>Registra abonos asociados a reservas y revisa el saldo pendiente.</p></div></div>
      <AuthNotice error={actionError} />
      <section className="panel data-panel">
        <div className="panel-heading"><div><h2>Reservas con saldo pendiente</h2><p>{pendingReservations.length} pendientes de pago</p></div></div>
        {pendingReservations.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>CLIENTE</th><th>CANCHA</th><th>FECHA</th><th>TOTAL</th><th>PAGADO</th><th>SALDO</th><th></th></tr></thead>
          <tbody>{pendingReservations.map((row) => {
            const paid = totals.get(row.id) ?? 0;
            return <tr key={row.id}><td>{customers.find((c) => c.id === row.customer_id)?.full_name ?? 'Cliente'}</td>
              <td>{courts.find((c) => c.id === row.court_id)?.name ?? 'Cancha'}</td><td>{formatDate(row.starts_at)}</td>
              <td>{formatCurrency(Number(row.total_amount))}</td><td>{formatCurrency(paid)}</td><td><strong>{formatCurrency(Number(row.total_amount) - paid)}</strong></td>
              <td><button className="secondary-button" onClick={() => { setActionError(null); setReservation(row); }}>Registrar pago</button></td></tr>;
          })}</tbody>
        </table></div> : <EmptyState title="No hay saldos pendientes" description="Las reservas con pago pendiente aparecerán aquí." />}
      </section>
      <section className="panel data-panel payments-history">
        <div className="panel-heading"><div><h2>Historial de pagos</h2><p>{payments.length} movimientos</p></div></div>
        {payments.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>FECHA</th><th>RESERVA</th><th>MÉTODO</th><th>REFERENCIA</th><th>MONTO</th><th>ESTADO</th><th></th></tr></thead>
          <tbody>{payments.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td>#{item.reservation_id.slice(0, 8)}</td>
            <td>{methodLabels[item.method]}</td><td>{item.reference ?? '—'}</td><td>{formatCurrency(Number(item.amount))}</td>
            <td>{item.status === 'paid' ? 'Pagado' : 'Reembolsado'}</td>
            <td>{canRefund && item.status === 'paid' && <button className="secondary-button danger-button" onClick={() => void refund(item)}>Reembolsar</button>}</td></tr>)}</tbody>
        </table></div> : <EmptyState title="Sin pagos registrados" description="Al registrar pagos asociados a reservas, aparecerán aquí." />}
      </section>
    </section>
    {reservation && <Modal title="Registrar pago" onClose={() => setReservation(null)} onSubmit={(event) => void savePayment(event)} submitting={submitting}>
      <p className="form-hint">Saldo restante: {formatCurrency(Number(reservation.total_amount) - (totals.get(reservation.id) ?? 0))}</p>
      <label className="form-field">Monto (CLP)<input name="amount" type="number" min="1" max={Number(reservation.total_amount) - (totals.get(reservation.id) ?? 0)} step="1" required /></label>
      <label className="form-field">Método<select name="method"><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label>
      <label className="form-field">Referencia (opcional)<input name="reference" maxLength={120} /></label>
      <AuthNotice error={actionError} />
    </Modal>}
  </DataState>;
}
