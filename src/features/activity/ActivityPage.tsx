import { useCallback, useEffect, useState } from 'react';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import type { ActivityLog } from '../../types/database';
import { formatDate, formatTime } from '../../utils/format';

const eventLabels: Record<string, string> = {
  reservation_created: 'Reserva creada',
  reservation_cancelled: 'Reserva cancelada',
  payment_recorded: 'Pago registrado',
  payment_refunded: 'Pago reembolsado',
  maintenance_started: 'Mantenimiento iniciado'
};

const roleLabels = {
  owner: 'Dueño',
  receptionist: 'Recepción',
  customer: 'Cliente',
  maintenance: 'Mantenimiento',
  referee: 'Árbitro'
} as const;

export function ActivityPage() {
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase no está configurado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(250);
      if (queryError) throw new Error(queryError.message);
      setEntries(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el registro de actividad.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <DataState loading={loading} error={error} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading">
        <div><h2>Registro de actividad</h2><p>Acciones importantes registradas automáticamente desde la base de datos.</p></div>
        <button className="secondary-button" onClick={() => void load()}>Actualizar</button>
      </div>
      {entries.length ? <section className="panel data-panel">
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>FECHA Y HORA</th><th>ACCIÓN</th><th>USUARIO</th><th>DETALLE</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id}>
            <td><strong>{formatDate(entry.occurred_at)}</strong><small>{formatTime(entry.occurred_at)}</small></td>
            <td>{eventLabels[entry.event_type] ?? entry.event_type}</td>
            <td><strong>{entry.actor_name}</strong><small>{entry.actor_role ? roleLabels[entry.actor_role] : 'Cuenta no disponible'}</small></td>
            <td>{entry.description}</td>
          </tr>)}</tbody>
        </table></div>
      </section> : !error && <section className="panel"><EmptyState title="Aún no hay actividad registrada" description="Las creaciones y cancelaciones de reservas, pagos y comienzos de mantenimiento aparecerán aquí." /></section>}
    </section>
  </DataState>;
}
