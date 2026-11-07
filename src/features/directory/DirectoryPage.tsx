import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { useLayoutSearch } from '../../hooks/useLayoutSearch';
import { supabase } from '../../lib/supabase';
import type { Customer, Team } from '../../types/database';

type Entity = 'customers' | 'teams';
type Dialog = { customer?: Customer; team?: Team } | null;

export function DirectoryPage({ entity }: { entity: Entity }) {
  const { customers, teams, loading, error: dataError, refresh } = useFacilityData();
  const { search } = useLayoutSearch();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const title = entity === 'customers' ? 'Clientes' : 'Equipos';
  const filteredCustomers = useMemo(() => customers.filter((row) =>
    `${row.full_name} ${row.phone ?? ''} ${row.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
  ), [customers, search]);
  const filteredTeams = useMemo(() => teams.filter((row) =>
    row.name.toLowerCase().includes(search.toLowerCase())
  ), [teams, search]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      if (entity === 'customers') {
        const values = {
          full_name: String(form.get('full_name')).trim(),
          email: String(form.get('email')).trim() || null,
          phone: String(form.get('phone')).trim() || null
        };
        const result = dialog?.customer
          ? await supabase.from('customers').update(values).eq('id', dialog.customer.id)
          : await supabase.from('customers').insert(values);
        if (result.error) throw new Error(result.error.message);
      } else {
        const values = {
          name: String(form.get('name')).trim(),
          customer_id: String(form.get('customer_id')) || null
        };
        const result = dialog?.team
          ? await supabase.from('teams').update(values).eq('id', dialog.team.id)
          : await supabase.from('teams').insert(values);
        if (result.error) throw new Error(result.error.message);
      }
      setDialog(null);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `No se pudo guardar ${title.toLowerCase()}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string, label: string) => {
    if (!supabase || !window.confirm(`¿Eliminar ${label}?`)) return;
    const result = entity === 'customers'
      ? await supabase.from('customers').delete().eq('id', id)
      : await supabase.from('teams').delete().eq('id', id);
    if (result.error) setError(result.error.message);
    else await refresh();
  };

  return (
    <DataState loading={loading} error={dataError} onRetry={() => void refresh()}>
      <section className="module-page">
        <div className="module-heading">
          <div><h2>{title}</h2><p>Registros administrados directamente en Supabase.</p></div>
          <button className="primary-button" onClick={() => { setError(null); setDialog({}); }}>+ Agregar {entity === 'customers' ? 'cliente' : 'equipo'}</button>
        </div>
        <AuthNotice error={error} />
        <section className="panel data-panel">
          <div className="panel-heading"><div><h2>{title} registrados</h2><p>{entity === 'customers' ? filteredCustomers.length : filteredTeams.length} resultados</p></div></div>
          {entity === 'customers' ? (filteredCustomers.length ? <div className="table-scroll"><table className="data-table">
            <thead><tr><th>NOMBRE</th><th>CORREO</th><th>TELÉFONO</th><th>ACCIONES</th></tr></thead>
            <tbody>{filteredCustomers.map((row) => <tr key={row.id}>
              <td><strong>{row.full_name}</strong></td><td>{row.email ?? '—'}</td><td>{row.phone ?? '—'}</td>
              <td><div className="row-actions"><button className="secondary-button" onClick={() => setDialog({ customer: row })}>Editar</button><button className="secondary-button danger-button" onClick={() => void remove(row.id, row.full_name)}>Eliminar</button></div></td>
            </tr>)}</tbody>
          </table></div> : <EmptyState title="No hay clientes" description="Agrega clientes o cambia la búsqueda." />) : (
            filteredTeams.length ? <div className="table-scroll"><table className="data-table">
              <thead><tr><th>EQUIPO</th><th>RESPONSABLE</th><th>ACCIONES</th></tr></thead>
              <tbody>{filteredTeams.map((row) => <tr key={row.id}>
                <td><strong>{row.name}</strong></td><td>{customers.find((customer) => customer.id === row.customer_id)?.full_name ?? 'Sin responsable'}</td>
                <td><div className="row-actions"><button className="secondary-button" onClick={() => setDialog({ team: row })}>Editar</button><button className="secondary-button danger-button" onClick={() => void remove(row.id, row.name)}>Eliminar</button></div></td>
              </tr>)}</tbody>
            </table></div> : <EmptyState title="No hay equipos" description="Agrega equipos o cambia la búsqueda." />
          )}
        </section>
      </section>
      {dialog && <Modal title={`${dialog.customer || dialog.team ? 'Editar' : 'Agregar'} ${entity === 'customers' ? 'cliente' : 'equipo'}`} onClose={() => setDialog(null)} onSubmit={(event) => void save(event)} submitting={submitting}>
        {entity === 'customers' ? <>
          <label className="form-field">Nombre completo<input name="full_name" defaultValue={dialog.customer?.full_name} required maxLength={150} /></label>
          <label className="form-field">Correo<input name="email" type="email" defaultValue={dialog.customer?.email ?? ''} /></label>
          <label className="form-field">Teléfono<input name="phone" type="tel" defaultValue={dialog.customer?.phone ?? ''} maxLength={40} /></label>
        </> : <>
          <label className="form-field">Nombre del equipo<input name="name" defaultValue={dialog.team?.name} required maxLength={120} /></label>
          <label className="form-field">Cliente responsable<select name="customer_id" defaultValue={dialog.team?.customer_id ?? ''}><option value="">Sin responsable</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.full_name}</option>)}</select></label>
        </>}
        <AuthNotice error={error} />
      </Modal>}
    </DataState>
  );
}
