export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  dashboard: '/',
  portal: '/portal',
  calendar: '/calendar',
  reservations: '/reservations',
  courts: '/courts',
  customers: '/customers',
  teams: '/teams',
  payments: '/payments',
  maintenance: '/maintenance',
  notifications: '/notifications',
  tournaments: '/tournaments',
  matches: '/matches',
  standings: '/standings',
  occupancy: '/reports/occupancy',
  reports: '/reports',
  promotions: '/promotions',
  users: '/users',
  activity: '/activity'
} as const;

export const NAV_GROUPS = [
  {
    label: 'GENERAL',
    items: [
      { label: 'Dashboard', icon: 'dashboard', to: ROUTES.dashboard },
      { label: 'Calendario de canchas', icon: 'calendar', to: ROUTES.calendar },
      { label: 'Canchas', icon: 'court', to: ROUTES.courts },
      { label: 'Reservas', icon: 'booking', to: ROUTES.reservations }
    ]
  },
  {
    label: 'GESTIÓN',
    items: [
      { label: 'Clientes', icon: 'users', to: ROUTES.customers },
      { label: 'Equipos', icon: 'team', to: ROUTES.teams },
      { label: 'Pagos', icon: 'payments', to: ROUTES.payments },
      { label: 'Mantenimiento', icon: 'tools', to: ROUTES.maintenance },
      { label: 'Notificaciones', icon: 'bell', to: ROUTES.notifications }
    ]
  },
  {
    label: 'TORNEOS',
    items: [
      { label: 'Torneos', icon: 'trophy', to: ROUTES.tournaments },
      { label: 'Partidos', icon: 'match', to: ROUTES.matches },
      { label: 'Tabla de posiciones', icon: 'table', to: ROUTES.standings }
    ]
  },
  {
    label: 'ANÁLISIS',
    items: [
      { label: 'Ingresos y ocupación', icon: 'chart', to: ROUTES.occupancy },
      { label: 'Reportes', icon: 'report', to: ROUTES.reports },
      { label: 'Promociones', icon: 'tag', to: ROUTES.promotions }
    ]
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
      { label: 'Usuarios y permisos', icon: 'settings', to: ROUTES.users },
      { label: 'Registro de actividad', icon: 'activity', to: ROUTES.activity }
    ]
  },
  {
    label: 'MI CUENTA',
    items: [
      { label: 'Mis reservas', icon: 'booking', to: ROUTES.portal }
    ]
  }
] as const;

const titlesByPath: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.to, item.label]))
);

export function getPageTitle(pathname: string): string {
  return titlesByPath[pathname] ?? (pathname === ROUTES.portal ? 'Mis reservas' : 'Página no encontrada');
}
