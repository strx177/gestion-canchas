import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFacilityData } from '../../app/FacilityProvider';
import { ROUTES } from '../../app/routes';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { useLayoutSearch } from '../../hooks/useLayoutSearch';
import { formatDateLong, formatTime, getDateKey, getTodayKey } from '../../utils/format';

export function CalendarPage() {
  const { courts, customers, teams, reservations, loading, error, refresh } = useFacilityData();
  const { search } = useLayoutSearch();
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const [selectedCourt, setSelectedCourt] = useState('all');

  const visibleReservations = useMemo(() => reservations
    .filter((reservation) => getDateKey(reservation.starts_at) === selectedDate)
    .filter((reservation) => selectedCourt === 'all' || reservation.court_id === selectedCourt)
    .filter((reservation) => {
      const court = courts.find((item) => item.id === reservation.court_id);
      const customer = customers.find((item) => item.id === reservation.customer_id);
      const team = teams.find((item) => item.id === reservation.team_id);
      return `${court?.name ?? ''} ${customer?.full_name ?? ''} ${team?.name ?? ''} ${reservation.status}`
        .toLowerCase()
        .includes(search.toLowerCase());
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [
    reservations, selectedDate, selectedCourt, search, courts, customers, teams
  ]);

  const shiftDate = (days: number) => {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + days);
    setSelectedDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
  };

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <section className="calendar-page">
        <div className="module-heading">
          <div><h2>Calendario de canchas</h2><p>Consulta las reservas del día y crea una reserva en un horario disponible.</p></div>
          <Link className="primary-button" to={`${ROUTES.reservations}?date=${selectedDate}${selectedCourt !== 'all' ? `&court_id=${selectedCourt}` : ''}`}>
            <Icon name="plus" size={17} />Nueva reserva
          </Link>
        </div>

        <div className="calendar-toolbar panel">
          <div className="date-controls">
            <button className="outline-icon-button" aria-label="Día anterior" onClick={() => shiftDate(-1)}><Icon name="left" size={18} /></button>
            <button className="today-button" onClick={() => setSelectedDate(getTodayKey())}>Hoy</button>
            <button className="outline-icon-button" aria-label="Día siguiente" onClick={() => shiftDate(1)}><Icon name="right" size={18} /></button>
            <label className="calendar-date-picker">
              <span>{formatDateLong(`${selectedDate}T12:00:00-03:00`)}</span>
              <input aria-label="Seleccionar fecha" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </div>
          <label className="court-filter">
            <span>Cancha</span>
            <select className="select-control court-select" value={selectedCourt} onChange={(event) => setSelectedCourt(event.target.value)}>
              <option value="all">Todas las canchas</option>
              {courts.map((court) => <option value={court.id} key={court.id}>{court.name}</option>)}
            </select>
          </label>
        </div>

        <section className="panel data-panel">
          <div className="panel-heading">
            <div><h2>Agenda del día</h2><p>{visibleReservations.length} reservas encontradas</p></div>
            <button className="secondary-button refresh-button" onClick={() => void refresh()}><Icon name="refresh" size={15} />Actualizar</button>
          </div>
          {visibleReservations.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>HORA</th><th>CANCHA</th><th>CLIENTE / EQUIPO</th><th>ESTADO</th><th>MONTO</th></tr></thead>
                <tbody>
                  {visibleReservations.map((reservation) => {
                    const court = courts.find((item) => item.id === reservation.court_id);
                    const customer = customers.find((item) => item.id === reservation.customer_id);
                    const team = teams.find((item) => item.id === reservation.team_id);
                    return (
                      <tr key={reservation.id}>
                        <td><strong>{formatTime(reservation.starts_at)} – {formatTime(reservation.ends_at)}</strong></td>
                        <td>{court?.name ?? 'Cancha no encontrada'}</td>
                        <td><strong>{team?.name ?? customer?.full_name ?? 'Cliente no encontrado'}</strong><small>{customer?.full_name ?? ''}</small></td>
                        <td><StatusBadge status={reservation.status} /></td>
                        <td>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(reservation.total_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No hay reservas para esta fecha" description="No se agregan reservas de ejemplo; los datos se consultan desde Supabase." />
          )}
        </section>
      </section>
    </DataState>
  );
}
