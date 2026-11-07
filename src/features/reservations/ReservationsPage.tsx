import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFacilityData } from '../../app/FacilityProvider';
import { useAuth } from '../../app/AuthProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ReservationDialog } from './ReservationDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { useLayoutSearch } from '../../hooks/useLayoutSearch';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';

export function ReservationsPage() {
  const { courts, customers, teams, reservations, loading, error, refresh } = useFacilityData();
  const { profile } = useAuth();
  const { search } = useLayoutSearch();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBooking, setShowBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const canManage = profile?.role === 'owner' || profile?.role === 'receptionist';

  const filteredReservations = useMemo(() => reservations
    .filter((reservation) => statusFilter === 'all' || reservation.status === statusFilter)
    .filter((reservation) => {
      const court = courts.find((item) => item.id === reservation.court_id);
      const customer = customers.find((item) => item.id === reservation.customer_id);
      const team = teams.find((item) => item.id === reservation.team_id);
      return `${reservation.id} ${court?.name ?? ''} ${customer?.full_name ?? ''} ${team?.name ?? ''}`
        .toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at)), [
    reservations, statusFilter, search, courts, customers, teams
  ]);

  const changeStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    if (!supabase) return;
    setSavingId(id);
    setErrorMessage(null);
    try {
      const { error: updateError } = await supabase.rpc('set_reservation_status', {
        target_reservation_id: id,
        new_status: status
      });
      if (updateError) setErrorMessage(updateError.message);
      else await refresh();
    } catch (updateError) {
      setErrorMessage(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la reserva.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <section className="module-page">
        <div className="module-heading">
          <div><h2>Reservas</h2><p>Consulta, confirma o cancela reservas con disponibilidad validada en Supabase.</p></div>
          {canManage && <button className="primary-button" onClick={() => { setErrorMessage(null); setShowBooking(true); }}>
            <Icon name="plus" size={17} />Nueva reserva
          </button>}
        </div>
        <AuthNotice error={errorMessage} />
        <section className="panel data-panel">
          <div className="panel-heading">
            <div><h2>Reservas registradas</h2><p>{filteredReservations.length} resultados</p></div>
            <div className="panel-tools">
              <label className="filter-control"><Icon name="filter" size={16} /><select className="select-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="cancelled">Cancelada</option>
              </select></label>
              <button className="secondary-button refresh-button" onClick={() => void refresh()}><Icon name="refresh" size={15} />Actualizar</button>
            </div>
          </div>
          {filteredReservations.length ? (
            <div className="table-scroll"><table className="data-table">
              <thead><tr><th>RESERVA</th><th>EQUIPO Y CLIENTE</th><th>CANCHA</th><th>FECHA Y HORA</th><th>ESTADO</th><th>MONTO</th>{canManage && <th>ACCIONES</th>}</tr></thead>
              <tbody>{filteredReservations.map((reservation) => {
                const court = courts.find((item) => item.id === reservation.court_id);
                const customer = customers.find((item) => item.id === reservation.customer_id);
                const team = teams.find((item) => item.id === reservation.team_id);
                return <tr key={reservation.id}>
                  <td><strong>#{reservation.id.slice(0, 8)}</strong></td>
                  <td><strong>{team?.name ?? 'Sin equipo'}</strong><small>{customer?.full_name ?? 'Cliente no encontrado'}</small></td>
                  <td>{court?.name ?? 'Cancha no encontrada'}</td>
                  <td><strong>{formatDate(reservation.starts_at)}</strong><small>{formatTime(reservation.starts_at)} – {formatTime(reservation.ends_at)}</small></td>
                  <td><StatusBadge status={reservation.status} /></td>
                  <td><strong>{formatCurrency(reservation.total_amount)}</strong></td>
                  {canManage && <td><div className="row-actions">
                    {reservation.status === 'pending' && <button className="secondary-button" disabled={savingId === reservation.id} onClick={() => void changeStatus(reservation.id, 'confirmed')}>Confirmar</button>}
                    {reservation.status !== 'cancelled' && <button className="secondary-button danger-button" disabled={savingId === reservation.id} onClick={() => void changeStatus(reservation.id, 'cancelled')}>Cancelar</button>}
                  </div></td>}
                </tr>;
              })}</tbody>
            </table></div>
          ) : <EmptyState title="No se encontraron reservas" description="Crea una reserva o cambia la búsqueda y el filtro." />}
        </section>
      </section>
      {showBooking && <ReservationDialog
        courts={courts}
        customers={customers}
        teams={teams}
        initialCourtId={searchParams.get('court_id') ?? undefined}
        initialDate={searchParams.get('date') ?? undefined}
        onClose={() => setShowBooking(false)}
        onBooked={() => { setShowBooking(false); void refresh(); }}
      />}
    </DataState>
  );
}
