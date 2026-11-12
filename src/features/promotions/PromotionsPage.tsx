import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { CourtScheduleBlock, Promotion, PromotionTimeBlock } from '../../types/database';
import { getDateKey, getTodayKey, formatDate } from '../../utils/format';
import { getSantiagoWeekday } from '../../utils/dateTime';
import { formatCourtTime } from '../../utils/courtSchedule';

interface PromotionRecord extends Promotion {
  courtIds: string[];
  blocks: PromotionTimeBlock[];
}

interface TimeBlockDraft {
  starts_at: string;
  ends_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localMinutes(value: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

function timeLabel(value: string): string {
  return value.slice(0, 5);
}

export function PromotionsPage() {
  const { profile } = useAuth();
  const { courts, reservations } = useFacilityData();
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [schedules, setSchedules] = useState<CourtScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PromotionRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [promotionDate, setPromotionDate] = useState(getTodayKey());
  const [blocks, setBlocks] = useState<TimeBlockDraft[]>([{ starts_at: '12:00', ends_at: '13:00' }]);
  const [appliesToAll, setAppliesToAll] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoadError('Supabase no está configurado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [promotionResult, courtsResult, blocksResult, scheduleResult] = await Promise.all([
        supabase.from('promotions').select('*').order('promotion_date', { ascending: false }),
        supabase.from('promotion_courts').select('*'),
        supabase.from('promotion_time_blocks').select('*').order('starts_at'),
        supabase.from('court_schedule_blocks').select('*')
      ]);
      if (promotionResult.error) throw new Error(promotionResult.error.message);
      if (courtsResult.error) throw new Error(courtsResult.error.message);
      if (blocksResult.error) throw new Error(blocksResult.error.message);
      if (scheduleResult.error) throw new Error(scheduleResult.error.message);
      if (!promotionResult.data || !courtsResult.data || !blocksResult.data || !scheduleResult.data) {
        throw new Error('Supabase devolvió datos incompletos al cargar las promociones.');
      }
      setSchedules(scheduleResult.data);
      setPromotions(promotionResult.data.map((promotion) => ({
        ...promotion,
        courtIds: courtsResult.data.filter((row) => row.promotion_id === promotion.id).map((row) => row.court_id),
        blocks: blocksResult.data.filter((row) => row.promotion_id === promotion.id)
      })));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las promociones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const demandSuggestions = useMemo(() => {
    const weekday = getSantiagoWeekday(promotionDate);
    const openBlocks = new Set<number>();
    for (const schedule of schedules) {
      if (schedule.weekday === weekday && schedule.is_available) {
        const [hour, minute] = schedule.starts_at.split(':').map(Number);
        openBlocks.add(hour * 60 + minute);
      }
    }
    const cutoff = Date.now() - 90 * DAY_MS;
    const counts = new Map<number, number>();
    for (const reservation of reservations) {
      if (reservation.status === 'cancelled'
          || new Date(reservation.starts_at).getTime() < cutoff
          || getSantiagoWeekday(getDateKey(reservation.starts_at)) !== weekday) continue;
      const start = localMinutes(reservation.starts_at);
      const end = start + (new Date(reservation.ends_at).getTime() - new Date(reservation.starts_at).getTime()) / 60_000;
      for (const block of openBlocks) {
        if (start < block + 30 && end > block) counts.set(block, (counts.get(block) ?? 0) + 1);
      }
    }
    return [...openBlocks]
      .map((start) => ({ start, count: counts.get(start) ?? 0 }))
      .sort((left, right) => left.count - right.count || left.start - right.start)
      .slice(0, 3);
  }, [promotionDate, reservations, schedules]);

  const openNewPromotion = () => {
    setActionError(null);
    setEditing(null);
    setPromotionDate(getTodayKey());
    setBlocks([{ starts_at: '12:00', ends_at: '13:00' }]);
    setAppliesToAll(true);
    setShowForm(true);
  };

  const openEditPromotion = (promotion: PromotionRecord) => {
    setActionError(null);
    setEditing(promotion);
    setPromotionDate(promotion.promotion_date);
    setAppliesToAll(promotion.applies_to_all_courts);
    setBlocks(promotion.blocks.map((block) => ({
      starts_at: timeLabel(block.starts_at),
      ends_at: timeLabel(block.ends_at)
    })));
    setShowForm(true);
  };

  const addSuggestion = (startMinute: number) => {
    const start = formatCourtTime(startMinute);
    const end = formatCourtTime(startMinute + 30);
    if (blocks.some((block) => block.starts_at === start && block.ends_at === end)) return;
    setBlocks((current) => [...current, { starts_at: start, ends_at: end }].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const courtIds = appliesToAll
      ? []
      : courts.filter((court) => form.get(`court-${court.id}`) === 'on').map((court) => court.id);
    const isValidCourtTime = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      const minutes = hour * 60 + minute;
      return Number.isInteger(minutes) && minutes >= 8 * 60 && minutes <= 21 * 60 && minutes % 30 === 0;
    };
    if (!blocks.length || blocks.some((block) =>
      !isValidCourtTime(block.starts_at)
      || !isValidCourtTime(block.ends_at)
      || block.ends_at <= block.starts_at
    )) {
      setActionError('Agrega al menos un bloque válido entre las 08:00 y las 21:00, en intervalos de 30 minutos.');
      return;
    }
    if (!appliesToAll && !courtIds.length) {
      setActionError('Selecciona al menos una cancha o marca que aplica a todas.');
      return;
    }
    const discount = Number(form.get('discount_percent'));
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      setActionError('El descuento debe estar entre 1% y 100%.');
      return;
    }
    const status = String(form.get('status'));
    if (status !== 'active' && status !== 'inactive') {
      setActionError('Selecciona un estado de promoción válido.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const { error: saveError } = await supabase.rpc('save_promotion', {
        target_promotion_id: editing?.id ?? null,
        target_name: String(form.get('name')).trim(),
        target_date: promotionDate,
        target_discount_percent: discount,
        target_applies_to_all_courts: appliesToAll,
        target_status: status,
        target_court_ids: courtIds,
        target_time_blocks: blocks.map((block) => ({ starts_at: block.starts_at, ends_at: block.ends_at }))
      });
      if (saveError) throw new Error(saveError.message);
      setShowForm(false);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo guardar la promoción.');
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (promotion: PromotionRecord) => {
    if (!supabase) return;
    setActionError(null);
    const nextStatus = promotion.status === 'active' ? 'inactive' : 'active';
    const { error: updateError } = await supabase.from('promotions').update({ status: nextStatus }).eq('id', promotion.id);
    if (updateError) setActionError(updateError.message);
    else await load();
  };

  const remove = async (promotion: PromotionRecord) => {
    if (!supabase || !window.confirm(`¿Eliminar la promoción “${promotion.name}”?`)) return;
    const { error: deleteError } = await supabase.from('promotions').delete().eq('id', promotion.id);
    if (deleteError) setActionError(deleteError.message);
    else await load();
  };

  if (profile?.role !== 'owner') return <section className="module-page"><AuthNotice error="Solo el dueño puede consultar y administrar las promociones." /></section>;

  return <DataState loading={loading} error={loadError} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading">
        <div><h2>Promociones</h2><p>Ofrece descuentos en fechas y bloques con menor demanda.</p></div>
        <button className="primary-button" onClick={openNewPromotion}>+ Crear promoción</button>
      </div>
      <AuthNotice error={actionError} />
      {promotions.length ? <div className="tournament-grid">{promotions.map((promotion) => <article className="panel tournament-card" key={promotion.id}>
        <div className="panel-heading">
          <div><p className="eyebrow">{promotion.discount_percent}% de descuento</p><h2>{promotion.name}</h2></div>
          <span className={`status-badge ${promotion.status === 'active' ? 'status-green' : 'status-gray'}`}><i />{promotion.status === 'active' ? 'Activa' : 'Pausada'}</span>
        </div>
        <p>{formatDate(`${promotion.promotion_date}T12:00:00`)}</p>
        <p>{promotion.applies_to_all_courts ? 'Todas las canchas' : promotion.courtIds.map((id) => courts.find((court) => court.id === id)?.name ?? 'Cancha').join(', ')}</p>
        <div className="promotion-block-list">{promotion.blocks.map((block) =>
          <span className="promotion-block" key={block.id}>{timeLabel(block.starts_at)}–{timeLabel(block.ends_at)}</span>
        )}</div>
        <div className="row-actions">
          <button className="secondary-button" onClick={() => openEditPromotion(promotion)}>Editar</button>
          <button className="secondary-button" onClick={() => void setStatus(promotion)}>{promotion.status === 'active' ? 'Pausar' : 'Activar'}</button>
          <button className="secondary-button danger-button" onClick={() => void remove(promotion)}>Eliminar</button>
        </div>
      </article>)}</div> : <section className="panel"><EmptyState title="Aún no hay promociones" description="Crea una promoción para ofrecer descuentos en bloques horarios específicos." /></section>}
    </section>
    {showForm && <Modal title={editing ? 'Editar promoción' : 'Crear promoción'} onClose={() => setShowForm(false)} onSubmit={(event) => void save(event)} submitting={submitting}>
      <label className="form-field">Nombre<input name="name" defaultValue={editing?.name} maxLength={100} required /></label>
      <div className="form-grid">
        <label className="form-field">Fecha<input type="date" min={getTodayKey()} value={promotionDate} onChange={(event) => setPromotionDate(event.target.value)} required /></label>
        <label className="form-field">Descuento (%)<input name="discount_percent" type="number" min="1" max="100" step="0.5" defaultValue={editing?.discount_percent ?? 10} required /></label>
      </div>
      <label className="form-field">Estado<select name="status" defaultValue={editing?.status ?? 'active'}><option value="active">Activa</option><option value="inactive">Pausada</option></select></label>
      <label className="promotion-check"><input type="checkbox" name="all_courts" checked={appliesToAll} onChange={(event) => setAppliesToAll(event.target.checked)} /> Aplicar a todas las canchas</label>
      <fieldset className="promotion-court-list" disabled={appliesToAll}>
        <legend>Canchas específicas</legend>
        {courts.map((court) => <label key={court.id}><input type="checkbox" name={`court-${court.id}`} defaultChecked={editing?.courtIds.includes(court.id) ?? false} />{court.name}</label>)}
      </fieldset>
      <div className="promotion-block-editor">
        <div className="panel-heading"><div><strong>Bloques horarios</strong><p>Las reservas deben quedar dentro de un bloque para recibir el descuento.</p></div>
          <button type="button" className="secondary-button" onClick={() => setBlocks((current) => [...current, { starts_at: '12:00', ends_at: '13:00' }])}>+ Bloque</button>
        </div>
        {blocks.map((block, index) => <div className="promotion-block-inputs" key={`${index}-${block.starts_at}`}>
          <input aria-label="Inicio del bloque" type="time" min="08:00" max="20:30" step="1800" value={block.starts_at} onChange={(event) => setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, starts_at: event.target.value } : item))} required />
          <span>a</span>
          <input aria-label="Término del bloque" type="time" min="08:30" max="21:00" step="1800" value={block.ends_at} onChange={(event) => setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ends_at: event.target.value } : item))} required />
          <button type="button" className="secondary-button danger-button" disabled={blocks.length === 1} aria-label="Quitar bloque" onClick={() => setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
        </div>)}
      </div>
      <div className="promotion-suggestions">
        <strong>Sugerencias de baja demanda</strong>
        <small>Basadas en reservas de los últimos 90 días para el día de la semana seleccionado.</small>
        {demandSuggestions.length ? demandSuggestions.map(({ start, count }) => <button type="button" className="secondary-button" key={start} onClick={() => addSuggestion(start)}>
          {formatCourtTime(start)}–{formatCourtTime(start + 30)} · {count} reservas
        </button>) : <small>No hay horarios abiertos para la fecha seleccionada.</small>}
      </div>
      <AuthNotice error={actionError} />
    </Modal>}
  </DataState>;
}
