import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const courts = [
  { id: 1, name: 'Cancha Norte', type: 'Fútbol 5', status: 'Disponible', color: 'green', bookings: 8, income: '$ 1.240.000' },
  { id: 2, name: 'Cancha Centro', type: 'Fútbol 7', status: 'Disponible', color: 'green', bookings: 11, income: '$ 1.980.000' },
  { id: 3, name: 'Cancha Sur', type: 'Fútbol 5', status: 'Mantenimiento', color: 'orange', bookings: 5, income: '$ 720.000' },
  { id: 4, name: 'Cancha Arena', type: 'Vóley playa', status: 'Disponible', color: 'green', bookings: 7, income: '$ 890.000' }
];

const initialReservations = [
  { id: '#R-1048', client: 'Martín Rojas', team: 'Los Pumas', court: 'Cancha Norte', date: 'Hoy, 18:00', duration: '1 h', state: 'Confirmada', amount: '$ 45.000', initials: 'MR' },
  { id: '#R-1047', client: 'Sofía Martínez', team: 'Las Estrellas', court: 'Cancha Centro', date: 'Hoy, 19:30', duration: '1,5 h', state: 'Pendiente', amount: '$ 67.500', initials: 'SM' },
  { id: '#R-1046', client: 'Diego Fernández', team: 'Barrio Unido', court: 'Cancha Norte', date: 'Hoy, 21:00', duration: '1 h', state: 'Confirmada', amount: '$ 45.000', initials: 'DF' },
  { id: '#R-1045', client: 'Camila Torres', team: 'Sin equipo', court: 'Cancha Arena', date: 'Mañana, 10:00', duration: '1 h', state: 'Pendiente', amount: '$ 35.000', initials: 'CT' }
];

const navItems = [
  ['Inicio', '⌂'], ['Reservas', '▣'], ['Canchas', '▤'], ['Clientes', '♙'],
  ['Pagos', '$'], ['Mantenimiento', '⚒'], ['Torneos', '♛'], ['Reportes', '▥']
];

function App() {
  const [active, setActive] = useState('Inicio');
  const [reservations, setReservations] = useState(initialReservations);
  const [showBooking, setShowBooking] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  const filteredReservations = useMemo(() => reservations.filter((item) =>
    `${item.client} ${item.team} ${item.court} ${item.id}`.toLowerCase().includes(search.toLowerCase())
  ), [reservations, search]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const addReservation = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client = form.get('client');
    const court = form.get('court');
    const date = form.get('date');
    const next = {
      id: `#R-${1049 + reservations.length - initialReservations.length}`,
      client,
      team: form.get('team') || 'Sin equipo',
      court,
      date: `Hoy, ${date}`,
      duration: '1 h',
      state: 'Pendiente',
      amount: '$ 45.000',
      initials: client.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()
    };
    setReservations([next, ...reservations]);
    setShowBooking(false);
    notify('Reserva creada correctamente');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">CC</div><div><strong>cancha</strong><span>central</span></div></div>
        <div className="workspace"><span className="workspace-dot" /> Complejo Deportivo <b>⌄</b></div>
        <nav>
          <p className="nav-label">MENÚ PRINCIPAL</p>
          {navItems.map(([label, icon]) => (
            <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => setActive(label)}>
              <span className="nav-icon">{icon}</span>{label}
              {label === 'Reservas' && <em>4</em>}
            </button>
          ))}
          <p className="nav-label nav-bottom">CUENTA</p>
          <button className="nav-item"><span className="nav-icon">⚙</span>Configuración</button>
          <button className="nav-item"><span className="nav-icon">?</span>Ayuda</button>
        </nav>
        <div className="sidebar-user"><div className="avatar purple">JS</div><div><strong>Juan Sebastián</strong><small>Administrador</small></div><span>⋮</span></div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Inicio</span><b>/</b><strong>{active}</strong></div>
          <div className="top-actions"><button className="icon-btn">⌕</button><button className="icon-btn notification">♢<i /></button><div className="avatar purple">JS</div></div>
        </header>
        <div className="page-content">
          {active === 'Inicio' ? (
            <Dashboard onNewBooking={() => setShowBooking(true)} reservations={filteredReservations} search={search} setSearch={setSearch} notify={notify} />
          ) : (
            <ModuleView active={active} onNewBooking={() => setShowBooking(true)} notify={notify} courts={courts} reservations={filteredReservations} search={search} setSearch={setSearch} />
          )}
        </div>
      </main>
      {showBooking && <BookingModal onClose={() => setShowBooking(false)} onSubmit={addReservation} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

function Dashboard({ onNewBooking, reservations, search, setSearch, notify }) {
  return <div>
    <div className="page-heading"><div><p className="eyebrow">MARTES, 14 DE MAYO DE 2024</p><h1>Buenos días, Juan <span>✦</span></h1><p className="subtitle">Este es el resumen de tu complejo para hoy.</p></div><button className="primary-btn" onClick={onNewBooking}>＋ Nueva reserva</button></div>
    <div className="alert"><div className="alert-icon">!</div><div><strong>Cancha Sur está en mantenimiento</strong><p>El mantenimiento está programado hasta hoy a las 16:00. <a href="#maintenance">Ver detalle</a></p></div><button onClick={() => notify('Aviso descartado')}>×</button></div>
    <section className="stats-grid">
      <StatCard label="Ingresos del mes" value="$ 4.830.000" change="+12,5%" icon="↗" tone="blue" foot="vs. mes anterior" />
      <StatCard label="Reservas este mes" value="86" change="+8,2%" icon="▣" tone="purple" foot="vs. mes anterior" />
      <StatCard label="Ocupación promedio" value="68,4%" change="+4,6%" icon="◒" tone="orange" foot="vs. mes anterior" />
      <StatCard label="Pagos pendientes" value="$ 385.000" change="12 reservas" icon="$" tone="pink" foot="requieren seguimiento" />
    </section>
    <div className="section-grid">
      <section className="panel reservations-panel">
        <div className="panel-header"><div><h2>Próximas reservas</h2><p>Las reservas más recientes de tu complejo</p></div><button className="text-btn" onClick={() => notify('Mostrando todas las reservas')}>Ver todas <span>→</span></button></div>
        <div className="table-tools"><div className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente o equipo..." /></div><button className="filter-btn">☷ Filtrar</button></div>
        <ReservationTable reservations={reservations} onAction={notify} />
      </section>
      <section className="panel occupancy-panel"><div className="panel-header"><div><h2>Ocupación de canchas</h2><p>Rendimiento durante este mes</p></div><button className="more-btn">⋮</button></div><div className="donut-wrap"><div className="donut"><div><strong>68%</strong><span>ocupación</span></div></div><div className="legend"><span><i className="dot blue-dot" />Ocupado <b>68%</b></span><span><i className="dot gray-dot" />Disponible <b>32%</b></span></div></div><div className="mini-bars">{courts.map((court) => <div className="bar-row" key={court.id}><span>{court.name.replace('Cancha ', '')}</span><div><i style={{ width: `${court.bookings * 8 + 14}%` }} /></div><b>{court.bookings * 8 + 14}%</b></div>)}</div></section>
    </div>
    <div className="section-grid bottom-grid"><section className="panel"><div className="panel-header"><div><h2>Ingresos</h2><p>Comparativa de los últimos 6 meses</p></div><select><option>Últimos 6 meses</option></select></div><RevenueChart /></section><section className="panel activity"><div className="panel-header"><div><h2>Actividad reciente</h2><p>Últimos movimientos del sistema</p></div><button className="text-btn">Ver todo →</button></div><Activity /></section></div>
  </div>;
}

function StatCard({ label, value, change, icon, tone, foot }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><strong>{value}</strong><div className="stat-change"><span>↗ {change}</span> <small>{foot}</small></div></div>;
}

function ReservationTable({ reservations, onAction }) {
  return <div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>CANCHA</th><th>FECHA Y HORA</th><th>ESTADO</th><th>MONTO</th><th /></tr></thead><tbody>{reservations.map((item) => <tr key={item.id}><td><div className="client-cell"><div className="avatar blue">{item.initials}</div><div><strong>{item.client}</strong><small>{item.team} · {item.id}</small></div></div></td><td>{item.court}</td><td><strong>{item.date}</strong><small>{item.duration}</small></td><td><span className={`status ${item.state === 'Confirmada' ? 'confirmed' : 'pending'}`}><i />{item.state}</span></td><td><strong>{item.amount}</strong><small>Seña recibida</small></td><td><button className="row-menu" onClick={() => onAction(`Opciones de ${item.id}`)}>⋮</button></td></tr>)}</tbody></table></div>;
}

function RevenueChart() {
  const values = [48, 62, 54, 72, 65, 87];
  return <div className="chart"><div className="y-labels"><span>$2M</span><span>$1.5M</span><span>$1M</span><span>$500k</span><span>$0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 600 190" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5576f6" stopOpacity=".25" /><stop offset="1" stopColor="#5576f6" stopOpacity="0" /></linearGradient></defs><path d="M0,150 C45,135 55,90 120,116 S185,140 230,100 S290,80 340,88 S405,42 455,64 S520,40 600,15 V190 H0Z" fill="url(#fill)" /><path d="M0,150 C45,135 55,90 120,116 S185,140 230,100 S290,80 340,88 S405,42 455,64 S520,40 600,15" fill="none" stroke="#5576f6" strokeWidth="3" /></svg>{values.map((_, i) => <span className="x-label" style={{ left: `${i * 20}%` }} key={i}>{['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May'][i]}</span>)}</div></div>;
}

function Activity() {
  return <div className="activity-list">{[['MR', 'Nueva reserva creada', 'Martín Rojas reservó Cancha Norte', 'Hace 12 min', 'blue'], ['$', 'Pago registrado', 'Pago de $45.000 · Reserva #R-1048', 'Hace 28 min', 'green'], ['⚒', 'Mantenimiento programado', 'Cancha Sur · Cambio de césped', 'Hace 1 h', 'orange'], ['SM', 'Nuevo cliente registrado', 'Sofía Martínez se unió al sistema', 'Hace 2 h', 'purple']].map(([icon, title, detail, time, tone]) => <div className="activity-item" key={title}><div className={`activity-icon ${tone}`}>{icon}</div><div><strong>{title}</strong><p>{detail}</p><small>{time}</small></div></div>)}</div>;
}

function ModuleView({ active, onNewBooking, notify, courts: courtList, reservations, search, setSearch }) {
  const descriptions = { Reservas: 'Gestiona los turnos, disponibilidad y estados de pago.', Canchas: 'Administra los espacios deportivos y sus horarios.', Clientes: 'Consulta clientes, equipos e historial de reservas.', Pagos: 'Controla anticipos, pagos completos y saldos pendientes.', Mantenimiento: 'Planifica trabajos y cierres temporales del complejo.', Torneos: 'Organiza competencias, equipos, partidos y resultados.', Reportes: 'Analiza ingresos, ocupación y oportunidades de promoción.' };
  return <div><div className="page-heading"><div><p className="eyebrow">GESTIÓN DEL COMPLEJO</p><h1>{active}</h1><p className="subtitle">{descriptions[active]}</p></div>{(active === 'Reservas' || active === 'Clientes') && <button className="primary-btn" onClick={onNewBooking}>＋ {active === 'Reservas' ? 'Nueva reserva' : 'Nuevo cliente'}</button>}</div>
    {active === 'Reservas' ? <section className="panel module-panel"><div className="table-tools"><div className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar reserva..." /></div><button className="filter-btn">☷ Filtrar</button><button className="filter-btn">▦ Calendario</button></div><ReservationTable reservations={reservations} onAction={notify} /></section> : active === 'Canchas' ? <CourtCards courts={courtList} notify={notify} /> : <GenericModule active={active} notify={notify} />}</div>;
}

function CourtCards({ courts: courtList, notify }) {
  return <div className="court-grid">{courtList.map((court) => <div className="court-card" key={court.id}><div className={`court-visual visual-${court.id}`}><span>⚽</span><small>{court.type}</small></div><div className="court-card-body"><div className="card-title-row"><div><h2>{court.name}</h2><p><i className={`dot ${court.color === 'green' ? 'green-dot' : 'orange-dot'}`} />{court.status}</p></div><button className="row-menu">⋮</button></div><div className="court-metrics"><span><small>Reservas</small><b>{court.bookings}</b></span><span><small>Ingresos</small><b>{court.income}</b></span></div><button className="outline-btn" onClick={() => notify(`Abriendo agenda de ${court.name}`)}>Ver agenda →</button></div></div>)}</div>;
}

function GenericModule({ active, notify }) {
  const data = {
    Clientes: [['Martín Rojas', 'Los Pumas', '18 reservas', 'MR'], ['Sofía Martínez', 'Las Estrellas', '12 reservas', 'SM'], ['Diego Fernández', 'Barrio Unido', '9 reservas', 'DF'], ['Camila Torres', 'Sin equipo', '6 reservas', 'CT']],
    Pagos: [['#P-8821', 'Martín Rojas', '$ 45.000', 'Acreditado'], ['#P-8820', 'Sofía Martínez', '$ 30.000', 'Pendiente'], ['#P-8819', 'Diego Fernández', '$ 45.000', 'Acreditado'], ['#P-8818', 'Camila Torres', '$ 17.500', 'Pendiente']],
    Mantenimiento: [['Cancha Sur', 'Cambio de césped sintético', 'Hoy · 08:00 - 16:00', 'En curso'], ['Cancha Centro', 'Revisión de luminarias', '18 May · 09:00 - 12:00', 'Programado'], ['Cancha Norte', 'Limpieza profunda', '22 May · 07:00 - 09:00', 'Programado']],
    Torneos: [['Copa Apertura 2024', '16 equipos · 32 partidos', 'Inicio: 25 May', 'En inscripción'], ['Liga Empresarial', '8 equipos · 28 partidos', 'En curso', 'Activo'], ['Torneo Relámpago', '12 equipos · 11 partidos', 'Finalizado: 10 May', 'Finalizado']],
    Reportes: [['Ingresos mensuales', 'Ingresos acumulados en el período', '$ 4.830.000', '+12,5%'], ['Ocupación por cancha', 'Promedio de uso de espacios', '68,4%', '+4,6%'], ['Horarios de baja demanda', 'Oportunidades para promociones', 'Martes 14:00', 'Detectado']]
  };
  return <section className="panel module-panel"><div className="panel-header"><div><h2>{active === 'Clientes' ? 'Clientes registrados' : `Resumen de ${active.toLowerCase()}`}</h2><p>Información actualizada en tiempo real</p></div><button className="filter-btn" onClick={() => notify('Filtros disponibles próximamente')}>☷ Filtrar</button></div><div className="generic-list">{data[active].map((row, i) => <div className="generic-row" key={row[0]}><div className={`avatar ${['blue', 'purple', 'green', 'orange'][i % 4]}`}>{active === 'Clientes' ? row[3] : active === 'Pagos' ? '$' : i + 1}</div><div className="generic-main"><strong>{row[0]}</strong><span>{row[1]}</span></div><div className="generic-detail"><strong>{row[2]}</strong><span className={row[3]?.includes('Pendiente') || row[3]?.includes('curso') ? 'warning-text' : ''}>{row[3]}</span></div><button className="row-menu" onClick={() => notify(`Abriendo ${row[0]}`)}>⋮</button></div>)}</div></section>;
}

function BookingModal({ onClose, onSubmit }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={onSubmit}><div className="modal-header"><div><p className="eyebrow">NUEVA OPERACIÓN</p><h2>Crear reserva</h2></div><button type="button" className="close-btn" onClick={onClose}>×</button></div><label>Cliente<input name="client" required placeholder="Nombre y apellido" /></label><label>Equipo <span className="optional">(opcional)</span><input name="team" placeholder="Nombre del equipo" /></label><div className="form-row"><label>Cancha<select name="court"><option>Cancha Norte</option><option>Cancha Centro</option><option>Cancha Arena</option></select></label><label>Hora<select name="date"><option>18:00</option><option>19:30</option><option>21:00</option></select></label></div><div className="availability">✓ Horario disponible · No hay otra reserva en este turno</div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" type="submit">Crear reserva</button></div></form></div>;
}

createRoot(document.getElementById('root')).render(<App />);
