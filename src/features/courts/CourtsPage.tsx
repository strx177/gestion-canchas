import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormEvent } from 'react';
import { useFacilityData } from '../../app/FacilityProvider';
import { useAuth } from '../../app/AuthProvider';
import { ROUTES } from '../../app/routes';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { supabase } from '../../lib/supabase';
import type { Court, CourtSchedule } from '../../types/database';
import { formatCurrency } from '../../utils/format';

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type Dialog = { kind: 'court'; court: Court | null } | { kind: 'schedule'; court: Court } | null;

export function CourtsPage() {
  const { courts, loading, error: dataError, refresh } = useFacilityData();
  const { profile } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [schedules, setSchedules] = useState<CourtSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canManage = profile?.role === 'owner' || profile?.role === 'receptionist';

  const editSchedule = async (court: Court) => {
    if (!supabase) return;
    setError(null);
    const { data, error: queryError } = await supabase.from('court_schedules').select('*').eq('court_id', court.id).order('weekday');
    if (queryError) { setError(queryError.message); return; }
    setSchedules(data);
    setDialog({ kind: 'schedule', court });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !dialog) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      if (dialog.kind === 'court') {
        const values = {
          name: String(form.get('name')).trim(),
          sport: String(form.get('sport')).trim(),
          status: String(form.get('status')),
          hourly_rate: Number(form.get('hourly_rate'))
        };
        if (!values.name || !values.sport || !Number.isFinite(values.hourly_rate) || values.hourly_rate < 0) {
          throw new Error('Revisa el nombre, deporte y tarifa de la cancha.');
        }
        const result = dialog.court
          ? await supabase.from('courts').update(values).eq('id', dialog.court.id)
          : await supabase.from('courts').insert(values);
        if (result.error) throw new Error(result.error.message);
      } else {
        const rows = weekdays.map((_, weekday) => {
          const isClosed = form.get(`closed-${weekday}`) === 'on';
          return {
            court_id: dialog.court.id,
            weekday,
            is_closed: isClosed,
            opens_at: String(form.get(`opens-${weekday}`) || '08:00'),
            closes_at: String(form.get(`closes-${weekday}`) || '23:00')
          };
        });
        const result = await supabase.from('court_schedules').upsert(rows, { onConflict: 'court_id,weekday' });
        if (result.error) throw new Error(result.error.message);
      }
      setDialog(null);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la cancha.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeCourt = async (court: Court) => {
    if (!supabase || !window.confirm(`¿Eliminar la cancha “${court.name}”?`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from('courts').delete().eq('id', court.id);
    if (deleteError) setError(deleteError.message);
    else await refresh();
  };

  return (
    <DataState loading={loading} error={dataError} onRetry={() => void refresh()}>
      <section className="module-page">
        <div className="module-heading">
          <div><h2>Canchas</h2><p>Administra tarifas, estados y horarios semanales.</p></div>
          {canManage && <button className="primary-button" onClick={() => { setError(null); setDialog({ kind: 'court', court: null }); }}><Icon name="plus" size={17} />Registrar cancha</button>}
        </div>
        <AuthNotice error={error} />
        {courts.length ? (
          <div className="courts-grid">
            {courts.map((court) => (
              <article className="panel court-card" key={court.id}>
                <div className="court-card-visual"><Icon name="court" size={34} /></div>
                <div className="court-card-content">
                  <div className="court-card-heading">
                    <div><h3>{court.name}</h3><p>{court.sport}</p></div>
                    <StatusBadge status={court.status} />
                  </div>
                  <div className="court-card-info">
                    <span><small>Estado</small><strong>{court.status}</strong></span>
                    <span><small>Tarifa por hora</small><strong>{formatCurrency(Number(court.hourly_rate))}</strong></span>
                  </div>
                  <div className="court-actions">
                    <Link className="secondary-button" to={ROUTES.calendar}>Consultar agenda <Icon name="arrow" size={16} /></Link>
                    {canManage && <>
                      <button className="secondary-button" onClick={() => void editSchedule(court)}>Horarios</button>
                      <button className="secondary-button" onClick={() => setDialog({ kind: 'court', court })}>Editar</button>
                      <button className="secondary-button danger-button" onClick={() => void removeCourt(court)}>Eliminar</button>
                    </>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="panel"><EmptyState title="No hay canchas registradas" description="Registra una cancha para configurar su disponibilidad y recibir reservas." /></div>}
      </section>

      {dialog?.kind === 'court' && (
        <Modal title={dialog.court ? 'Editar cancha' : 'Registrar cancha'} onClose={() => setDialog(null)} onSubmit={(event) => void save(event)} submitting={submitting}>
          <label className="form-field">Nombre<input name="name" defaultValue={dialog.court?.name} required maxLength={100} /></label>
          <label className="form-field">Deporte<input name="sport" defaultValue={dialog.court?.sport} required maxLength={80} /></label>
          <label className="form-field">Tarifa por hora (CLP)<input name="hourly_rate" type="number" min="0" step="100" defaultValue={dialog.court?.hourly_rate ?? 0} required /></label>
          <label className="form-field">Estado<select name="status" defaultValue={dialog.court?.status ?? 'available'}><option value="available">Disponible</option><option value="maintenance">Mantenimiento</option><option value="closed">Cerrada</option></select></label>
          <AuthNotice error={error} />
        </Modal>
      )}

      {dialog?.kind === 'schedule' && (
        <Modal title={`Horarios · ${dialog.court.name}`} onClose={() => setDialog(null)} onSubmit={(event) => void save(event)} submitting={submitting}>
          <div className="schedule-editor">
            {weekdays.map((day, weekday) => {
              const row = schedules.find((item) => item.weekday === weekday);
              return <div className="schedule-row" key={day}>
                <label className="schedule-day"><input type="checkbox" name={`closed-${weekday}`} defaultChecked={row?.is_closed ?? false} />{day}</label>
                <input aria-label={`${day} apertura`} type="time" name={`opens-${weekday}`} defaultValue={row?.opens_at.slice(0, 5) ?? '08:00'} />
                <span>a</span>
                <input aria-label={`${day} cierre`} type="time" name={`closes-${weekday}`} defaultValue={row?.closes_at.slice(0, 5) ?? '23:00'} />
              </div>;
            })}
          </div>
          <p className="form-hint">Marca la casilla para dejar el día cerrado.</p>
          <AuthNotice error={error} />
        </Modal>
      )}
    </DataState>
  );
}
