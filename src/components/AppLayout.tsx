import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV_GROUPS, getPageTitle } from '../app/routes';
import { useOptionalFacilityData } from '../app/FacilityProvider';
import { useAuth } from '../app/AuthProvider';
import type { AppRole } from '../types/database';
import { Icon } from './Icon';

export interface LayoutOutletContext {
  search: string;
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const location = useLocation();
  const facility = useOptionalFacilityData();
  const { profile, signOut } = useAuth();
  const title = getPageTitle(location.pathname);
  const role = profile?.role ?? 'customer';
  const isStaff = role === 'owner' || role === 'receptionist';
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => navItemsByRole[role].includes(item.to))
  })).filter((group) => group.items.length > 0);
  const today = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Santiago'
  }).format(new Date());

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.');
    }
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-hidden={!sidebarOpen}>
        <div className="sidebar-brand">
          <span className="brand-mark"><Icon name="court" size={21} /></span>
          <strong>Cancha<span>Pro</span></strong>
          <button className="icon-button sidebar-close" aria-label="Cerrar navegación" onClick={() => setSidebarOpen(false)}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="support-card">
          <Icon name="activity" size={20} />
          <span><strong>{roleLabels[role]}</strong><small>{profile?.full_name ?? 'Cuenta activa'}</small></span>
        </div>
        <button className="sidebar-signout" onClick={() => void handleSignOut()}>Cerrar sesión</button>
        <div className="sidebar-version">CanchaPro · Acceso seguro</div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button menu-button" aria-label="Abrir navegación" onClick={() => setSidebarOpen(true)}>
              <Icon name="menu" size={20} />
            </button>
            <div className="topbar-heading">
              <span>{today}</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {isStaff && <label className="global-search">
              <Icon name="search" size={18} />
              <input
                aria-label="Buscar reservas o clientes"
                placeholder="Buscar reserva, cliente..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>}
            <span className="session-state">{facility?.loading ? 'Cargando datos…' : facility?.error ? 'Sin conexión' : roleLabels[role]}</span>
          </div>
        </header>

        {facility?.error && (
          <div className="connection-notice" role="alert">
            <span>{facility.error}</span>
            <button onClick={() => void facility.refresh()}>Reintentar</button>
          </div>
        )}
        {signOutError && <div className="connection-notice" role="alert">{signOutError}</div>}

        <main className="page-content">
          <Outlet context={{ search } satisfies LayoutOutletContext} />
        </main>
      </div>
    </div>
  );
}

const roleLabels: Record<AppRole, string> = {
  owner: 'Dueño',
  receptionist: 'Recepción',
  customer: 'Cliente',
  maintenance: 'Mantenimiento',
  referee: 'Árbitro'
};

const navItemsByRole: Record<AppRole, readonly string[]> = {
  owner: NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to)).filter((path) => path !== '/portal'),
  receptionist: [
    '/', '/calendar', '/reservations', '/customers', '/teams', '/payments',
    '/maintenance', '/notifications', '/matches'
  ],
  customer: ['/portal', '/notifications'],
  maintenance: ['/maintenance', '/notifications'],
  referee: ['/matches', '/notifications']
};
