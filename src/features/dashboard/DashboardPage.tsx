import { Link } from 'react-router-dom';
import { useFacilityData } from '../../app/FacilityProvider';
import { ROUTES } from '../../app/routes';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { useLayoutSearch } from '../../hooks/useLayoutSearch';
import { formatTime, getDateKey, getTodayKey } from '../../utils/format';

export function DashboardPage() {
  const { courts, customers, teams, reservations, loading, error, refresh } = useFacilityData();
  const { search } = useLayoutSearch();
  const today = getTodayKey();
  const todayReservations = reservations.filter((reservation) =>
    getDateKey(reservation.starts_at) === today && reservation.status !== 'cancelled'
  );
  const visibleReservations = todayReservations.filter((reservation) => {
    const court = courts.find((item) => item.id === reservation.court_id);
    const customer = customers.find((item) => item.id === reservation.customer_id);
    const team = teams.find((item) => item.id === reservation.team_id);
    return `${court?.name ?? ''} ${customer?.full_name ?? ''} ${team?.name ?? ''} ${reservation.status}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  const availableCourts = courts.filter((court) => court.status === 'available').length;
  const maintenanceCourts = courts.filter((court) => court.status === 'maintenance').length;
  const pendingReservations = todayReservations.filter((reservation) => reservation.status === 'pending').length;
  const courtsWithReservations = courts.map((court) => ({
    court,
    count: reservations.filter((reservation) => reservation.court_id === court.id && reservation.status !== 'cancelled').length
  }));
  const maxCourtReservations = Math.max(...courtsWithReservations.map((item) => item.count), 1);

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <div className="dashboard-page">
        <section className="page-intro">
          <div>
            <p className="eyebrow">RESUMEN OPERATIVO</p>
            <h2>Panel de gestión</h2>
            <p>Indicadores calculados a partir de los registros disponibles en Supabase.</p>
          </div>
          <Link className="primary-button" to={ROUTES.calendar}><Icon name="calendar" size={17} />Ver calendario</Link>
        </section>

        <section className="stats-grid" aria-label="Indicadores del complejo">
          <StatCard title="Reservas de hoy" value={todayReservations.length} detail="Registros activos para la fecha local" icon="booking" tone="green" />
          <StatCard title="Canchas disponibles" value={availableCourts} detail={`${courts.length} canchas registradas`} icon="court" tone="blue" />
          <StatCard title="Reservas pendientes" value={pendingReservations} detail="Estado obtenido de la tabla de reservas" icon="clock" tone="yellow" />
          <StatCard title="Canchas en mantenimiento" value={maintenanceCourts} detail="Según el estado almacenado en Supabase" icon="tools" tone="purple" />
        </section>

        <section className="dashboard-grid">
          <Panel title="Reservas por cancha" description="Conteo de reservas activas cargadas desde la base de datos" className="chart-panel">
            {courtsWithReservations.length ? (
              <div className="court-count-chart">
                {courtsWithReservations.map(({ court, count }) => (
                  <div className="court-count-row" key={court.id}>
                    <span>{court.name}</span>
                    <div className="court-count-track"><i style={{ width: `${count / maxCourtReservations * 100}%` }} /></div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="Aún no hay canchas" description="Cuando se registren en Supabase, aparecerán aquí." />}
          </Panel>

          <Panel
            title="Estado de canchas"
            description="Estados almacenados en la base de datos"
            action={<Link className="link-button" to={ROUTES.courts}>Ver todas</Link>}
          >
            {courts.length ? (
              <div className="court-status-list">
                {courts.slice(0, 5).map((court) => (
                  <div className="court-status-row" key={court.id}>
                    <span className="court-icon"><Icon name="court" size={19} /></span>
                    <span className="court-status-copy"><strong>{court.name}</strong><small>{court.sport}</small></span>
                    <StatusBadge status={court.status} />
                  </div>
                ))}
              </div>
            ) : <EmptyState title="Aún no hay canchas" description="No hay registros en la tabla courts." />}
          </Panel>

          <Panel
            title="Reservas de hoy"
            description={visibleReservations.length ? `${visibleReservations.length} reservas encontradas` : 'Sin datos locales de ejemplo'}
            action={<Link className="link-button" to={ROUTES.reservations}>Ver reservas</Link>}
          >
            {visibleReservations.length ? (
              <div className="upcoming-list">
                {visibleReservations.slice(0, 6).map((reservation) => {
                  const court = courts.find((item) => item.id === reservation.court_id);
                  const customer = customers.find((item) => item.id === reservation.customer_id);
                  const team = teams.find((item) => item.id === reservation.team_id);
                  return (
                    <div className="upcoming-row" key={reservation.id}>
                      <div className="reservation-time"><strong>{formatTime(reservation.starts_at)}</strong><small>{formatTime(reservation.ends_at)}</small></div>
                      <div className="reservation-team">
                        <strong>{team?.name ?? customer?.full_name ?? 'Cliente sin nombre disponible'}</strong>
                        <small>{court?.name ?? 'Cancha no disponible'} · {customer?.full_name ?? 'Cliente'}</small>
                      </div>
                      <StatusBadge status={reservation.status} />
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState title="No hay reservas para esta fecha" description="El dashboard no muestra reservas de ejemplo." />}
          </Panel>

          <Panel title="Información de datos" description="Alcance de esta configuración inicial">
            <div className="data-note">
              <Icon name="activity" size={18} />
              <p>Ingresos, pagos, auditoría y notificaciones se mostrarán cuando sus tablas y servicios estén implementados. No se generan métricas ficticias.</p>
            </div>
            <div className="data-summary">
              <span><strong>{courts.length}</strong><small>canchas</small></span>
              <span><strong>{reservations.length}</strong><small>reservas</small></span>
              <span><strong>{customers.length}</strong><small>clientes</small></span>
              <span><strong>{teams.length}</strong><small>equipos</small></span>
            </div>
          </Panel>
        </section>
      </div>
    </DataState>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  detail: string;
  icon: 'booking' | 'court' | 'clock' | 'tools';
  tone: 'green' | 'blue' | 'yellow' | 'purple';
}

function StatCard({ title, value, detail, icon, tone }: StatCardProps) {
  return (
    <article className="stat-card">
      <span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={20} /></span>
      <div className="stat-content"><p>{title}</p><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}
