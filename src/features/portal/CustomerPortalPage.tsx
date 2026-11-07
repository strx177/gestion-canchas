import { useState } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { ReservationDialog } from '../reservations/ReservationDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { supabase } from '../../lib/supabase';
import { formatDate, formatTime } from '../../utils/format';

export function CustomerPortalPage() {
  const { profile } = useAuth();
  const { courts, teams, reservations, loading, error, refresh } = useFacilityData();
  const [showBooking, setShowBooking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const myReservations = reservations
    .filter((reservation) => reservation.customer_id === profile?.customer_id)
    .sort((left, right) => right.starts_at.localeCompare(left.starts_at));

  const cancel = async (id: string) => {
    if (!supabase) return;
    setSavingId(id);
    setActionError(null);
    try {
      const { error: cancelError } = await supabase.rpc('set_reservation_status', {
        target_reservation_id: id,
        new_status: 'cancelled'
      });
      if (cancelError) setActionError(cancelError.message);
      else await refresh();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : 'No se pudo cancelar la reserva.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <section>
        <div className="page-intro">
          <div>
            <p className="eyebrow">MI CUENTA</p>
            <h2>Mis reservas</h2>
            <p>Consulta las reservas asociadas a tu perfil.</p>
          </div>
          <button className="primary-button" onClick={() => { setActionError(null); setShowBooking(true); }}>Nueva reserva</button>
        </div>
        <AuthNotice error={actionError} />
        <section className="panel data-panel">
          <div className="panel-heading">
            <div><h2>Historial de reservas</h2><p>Información cargada desde tu cuenta de CanchaPro</p></div>
          </div>
          {!profile?.customer_id ? (
            <div className="data-state data-state-error" role="alert">
              <strong>Tu cuenta no tiene un cliente asociado.</strong>
              <p>Contacta a recepción para revisar tu perfil.</p>
            </div>
          ) : myReservations.length ? (
            <div className="generic-list">
              {myReservations.map((reservation) => {
                const court = courts.find((item) => item.id === reservation.court_id);
                return (
                  <article className="portal-reservation" key={reservation.id}>
                    <div className="generic-index">
                      {new Intl.DateTimeFormat('es-CL', { day: 'numeric' }).format(new Date(reservation.starts_at))}
                    </div>
                    <div className="generic-copy">
                      <strong>{court?.name ?? 'Cancha no disponible'}</strong>
                      <small>{formatDate(reservation.starts_at)} · {formatTime(reservation.starts_at)}–{formatTime(reservation.ends_at)}</small>
                    </div>
                    <StatusBadge status={reservation.status} />
                    {reservation.status === 'pending' && <button className="secondary-button danger-button" disabled={savingId === reservation.id} onClick={() => void cancel(reservation.id)}>Cancelar</button>}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Aún no tienes reservas" description="Cuando se registren reservas asociadas a tu perfil, aparecerán aquí." />
          )}
        </section>
      </section>
      {showBooking && <ReservationDialog
        courts={courts}
        customers={[]}
        teams={teams}
        onClose={() => setShowBooking(false)}
        onBooked={() => { setShowBooking(false); void refresh(); }}
      />}
    </DataState>
  );
}
