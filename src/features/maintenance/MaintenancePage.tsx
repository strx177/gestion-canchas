import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { MaintenancePeriod } from '../../types/database';
import { santiagoLocalToIso } from '../../utils/dateTime';
import { formatDate, formatTime } from '../../utils/format';
import { courtEndTimes, courtStartTimes } from '../../utils/courtSchedule';
import { getTodayKey } from '../../utils/format';

const statusNames: Record<MaintenancePeriod['status'], string> = {
  scheduled: 'Programado', in_progress: 'En curso', completed: 'Completado', cancelled: 'Cancelado'
};

function isMaintenanceStatus(value: string): value is MaintenancePeriod['status'] {
  return value in statusNames;
}

export function MaintenancePage() {
  const { profile } = useAuth();
  const { courts } = useFacilityData();
  const [periods, setPeriods] = useState<MaintenancePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) { setLoadError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const result = await supabase.from('maintenance_periods').select('*').order('starts_at');
    if (result.error) setLoadError(result.error.message); else setPeriods(result.data);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !profile) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true); setActionError(null);
    try {
      const date = String(form.get('date'));
      const startsAt = santiagoLocalToIso(`${date}T${String(form.get('starts_at'))}`);
      const endsAt = santiagoLocalToIso(`${date}T${String(form.get('ends_at'))}`);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error('El término debe ser posterior al inicio.');
      const result = await supabase.from('maintenance_periods').insert({
        court_id: String(form.get('court_id')),
        title: String(form.get('title')).trim(),
        description: String(form.get('description')) || null,
        starts_at: startsAt,
        ends_at: endsAt,
        created_by: profile.id
      });
      if (result.error) throw new Error(result.error.message);
      setShowForm(false); await load();
    } catch (createError) {
      setActionError(createError instanceof Error ? createError.message : 'No se pudo programar el mantenimiento.');
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (period: MaintenancePeriod, status: MaintenancePeriod['status']) => {
    if (!supabase) return;
    const result = await supabase.from('maintenance_periods').update({ status }).eq('id', period.id);
    if (result.error) setActionError(result.error.message); else await load();
  };

  return <DataState loading={loading} error={loadError} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading"><div><h2>Mantenimiento</h2><p>Programa bloqueos; los horarios se excluyen automáticamente de la disponibilidad.</p></div>
        <button className="primary-button" onClick={() => { setActionError(null); setShowForm(true); }}>+ Programar mantenimiento</button>
      </div>
      <AuthNotice error={actionError} />
      <section className="panel data-panel">
        <div className="panel-heading"><div><h2>Planificación</h2><p>{periods.length} períodos</p></div></div>
        {periods.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>TAREA</th><th>CANCHA</th><th>INICIO</th><th>TÉRMINO</th><th>ESTADO</th><th></th></tr></thead>
          <tbody>{periods.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><small>{item.description ?? 'Sin descripción'}</small></td>
            <td>{courts.find((court) => court.id === item.court_id)?.name ?? 'Cancha'}</td>
            <td>{formatDate(item.starts_at)} · {formatTime(item.starts_at)}</td><td>{formatDate(item.ends_at)} · {formatTime(item.ends_at)}</td><td>{statusNames[item.status]}</td>
            <td><select className="select-control" aria-label={`Estado de ${item.title}`} value={item.status} onChange={(event) => {
              const status = event.target.value;
              if (isMaintenanceStatus(status)) void updateStatus(item, status);
            }}>
              {Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select></td></tr>)}</tbody></table></div>
          : <EmptyState title="Sin mantenimiento programado" description="Los bloqueos de cancha aparecerán aquí." />}
      </section>
    </section>
    {showForm && <Modal title="Programar mantenimiento" onClose={() => setShowForm(false)} onSubmit={(event) => void create(event)} submitting={submitting}>
      <label className="form-field">Cancha<select name="court_id" required>{courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label>
      <label className="form-field">Título<input name="title" required maxLength={120} /></label>
      <label className="form-field">Descripción<textarea name="description" rows={2} maxLength={500} /></label>
      <label className="form-field">Fecha<input name="date" type="date" min={getTodayKey()} defaultValue={getTodayKey()} required /></label>
      <div className="form-grid">
        <label className="form-field">Inicio<select name="starts_at" defaultValue={courtStartTimes[0]} required>{courtStartTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
        <label className="form-field">Término<select name="ends_at" defaultValue={courtEndTimes[1]} required>{courtEndTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
      </div>
      <p className="form-hint">El mantenimiento debe comenzar y terminar el mismo día, en bloques de 30 minutos entre las 08:00 y las 21:00.</p>
      <AuthNotice error={actionError} />
    </Modal>}
  </DataState>;
}
