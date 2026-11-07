import { useLocation } from 'react-router-dom';
import { useOptionalFacilityData } from '../../app/FacilityProvider';
import { getPageTitle } from '../../app/routes';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { useLayoutSearch } from '../../hooks/useLayoutSearch';

const moduleDescriptions: Record<string, string> = {
  Clientes: 'Consulta de clientes almacenados en Supabase.',
  Equipos: 'Consulta de equipos almacenados en Supabase.',
  Pagos: 'El esquema de pagos se definirá en el módulo correspondiente.',
  Mantenimiento: 'Las tareas de mantenimiento y sus bloqueos se incorporarán en su módulo.',
  Notificaciones: 'El centro de notificaciones se conectará cuando exista su tabla y servicio.',
  Torneos: 'Los datos de torneos y participantes aún no forman parte del esquema inicial.',
  Partidos: 'Partidos y asignaciones se incorporarán junto con el módulo de torneos.',
  'Tabla de posiciones': 'La clasificación se calculará a partir de partidos y resultados persistidos.',
  'Ingresos y ocupación': 'Los reportes se calcularán sobre datos persistidos, no sobre valores de muestra.',
  Reportes: 'Los reportes se conectarán cuando se definan sus consultas y filtros.',
  Promociones: 'La administración de promociones se implementará en una etapa posterior.',
  'Usuarios y permisos': 'Los perfiles, roles y políticas RLS se controlan mediante Supabase.',
  'Registro de actividad': 'La auditoría se mostrará cuando exista su tabla y servicio.'
};

export function ModulePage() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const facility = useOptionalFacilityData();
  const customers = facility?.customers ?? [];
  const teams = facility?.teams ?? [];
  const loading = facility?.loading ?? false;
  const error = facility?.error ?? null;
  const refresh = facility?.refresh ?? (async () => undefined);
  const { search } = useLayoutSearch();

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <section className="module-page">
        <div className="module-heading"><div><h2>{title}</h2><p>{moduleDescriptions[title] ?? 'Este módulo no está disponible.'}</p></div></div>
        {(title === 'Clientes' || title === 'Equipos') ? (
          <section className="panel data-panel">
            <div className="panel-heading">
              <div><h2>{title} registrados</h2><p>Datos obtenidos de Supabase</p></div>
              <button className="secondary-button refresh-button" onClick={() => void refresh()}><Icon name="refresh" size={15} />Actualizar</button>
            </div>
            {title === 'Clientes' ? (
              <EntityList rows={customers.filter((customer) => `${customer.full_name} ${customer.email ?? ''} ${customer.phone ?? ''}`.toLowerCase().includes(search.toLowerCase())).map((customer) => ({
                id: customer.id,
                title: customer.full_name,
                detail: [customer.email, customer.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'
              }))} entity="clientes" />
            ) : (
              <EntityList rows={teams.filter((team) => team.name.toLowerCase().includes(search.toLowerCase())).map((team) => ({
                id: team.id,
                title: team.name,
                detail: team.customer_id ? 'Tiene un cliente responsable asociado' : 'Sin cliente responsable asociado'
              }))} entity="equipos" />
            )}
          </section>
        ) : (
          <section className="panel module-placeholder">
            <span className="module-placeholder-icon"><Icon name="activity" size={22} /></span>
            <h2>Módulo preparado para una siguiente etapa</h2>
            <p>{moduleDescriptions[title] ?? 'Este módulo aún no está configurado.'} No se muestra contenido de ejemplo.</p>
          </section>
        )}
      </section>
    </DataState>
  );
}

interface EntityRow {
  id: string;
  title: string;
  detail: string;
}

function EntityList({ rows, entity }: { rows: EntityRow[]; entity: string }) {
  if (!rows.length) {
    return <EmptyState title={`No hay ${entity} para mostrar`} description="No se inyectan datos de ejemplo; revisa los registros existentes en Supabase." />;
  }

  return (
    <div className="generic-list">
      {rows.map((row) => (
        <div className="generic-row" key={row.id}>
          <span className="generic-index"><Icon name="users" size={17} /></span>
          <span className="generic-copy"><strong>{row.title}</strong><small>{row.detail}</small></span>
        </div>
      ))}
    </div>
  );
}
