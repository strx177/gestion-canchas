import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { Court, Customer, Reservation, Team } from '../../types/database';
import { formatTime, getTodayKey } from '../../utils/format';

interface ReservationDialogProps {
  courts: Court[];
  customers: Customer[];
  teams: Team[];
  onClose: () => void;
  onBooked: (reservation: Reservation) => void;
  initialCourtId?: string;
  initialDate?: string;
}

export function ReservationDialog({
  courts, customers, teams, onClose, onBooked, initialCourtId, initialDate
}: ReservationDialogProps) {
  const { profile } = useAuth();
  const isCustomer = profile?.role === 'customer';
  const [courtId, setCourtId] = useState(initialCourtId ?? '');
  const [date, setDate] = useState(initialDate ?? getTodayKey());
  const [duration, setDuration] = useState(60);
  const [customerId, setCustomerId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [slots, setSlots] = useState<Array<{ starts_at: string; ends_at: string }>>([]);
  const [slot, setSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCourts = useMemo(() => courts.filter((court) => court.status === 'available'), [courts]);
  const teamOwnerId = isCustomer ? profile?.customer_id : customerId;
  const customerTeams = useMemo(() => teams.filter((team) => team.customer_id === teamOwnerId), [teams, teamOwnerId]);

  useEffect(() => {
    if (!courtId && availableCourts[0]) setCourtId(availableCourts[0].id);
  }, [courtId, availableCourts]);

  useEffect(() => {
    if (!supabase || !courtId || !date) {
      setSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setError(null);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.rpc('available_reservation_slots', {
          target_court_id: courtId,
          target_date: date,
          duration_minutes: duration
        });
        if (!active) return;
        if (queryError) {
          setError(queryError.message);
          setSlots([]);
        } else {
          setSlots(data);
          setSlot((current) => data.some((item) => item.starts_at === current) ? current : data[0]?.starts_at ?? '');
        }
      } catch (queryError) {
        if (active) setError(queryError instanceof Error ? queryError.message : 'No se pudo consultar la disponibilidad.');
      } finally {
        if (active) setLoadingSlots(false);
      }
    })();
    return () => { active = false; };
  }, [courtId, date, duration]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    if (!slot) { setError('No hay un horario disponible para la selección.'); return; }
    if (!isCustomer && !customerId) { setError('Selecciona el cliente de la reserva.'); return; }
    let startsAt: string;
    try {
      const selectedSlot = slots.find((item) => item.starts_at === slot);
      if (!selectedSlot) throw new Error('El horario seleccionado dejó de estar disponible. Actualiza la lista.');
      startsAt = selectedSlot.starts_at;
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Revisa el horario.');
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: bookingError } = await supabase.rpc('create_reservation', {
        target_court_id: courtId,
        target_starts_at: startsAt,
        duration_minutes: duration,
        target_customer_id: isCustomer ? null : customerId,
        target_team_id: teamId || null,
        target_notes: String(form.get('notes') ?? '') || null
      });
      if (bookingError) {
        setError(bookingError.message);
        return;
      }
      onBooked(data);
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'No se pudo crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Nueva reserva" onClose={onClose} onSubmit={(event) => void submit(event)} submitting={submitting}>
      <label className="form-field">Cancha<select value={courtId} onChange={(event) => setCourtId(event.target.value)} required>
        <option value="">Selecciona una cancha</option>
        {availableCourts.map((court) => <option value={court.id} key={court.id}>{court.name} · {court.sport}</option>)}
      </select></label>
      <div className="form-grid">
        <label className="form-field">Fecha<input type="date" min={getTodayKey()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="form-field">Duración<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
          {[60, 90, 120, 180].map((minutes) => <option value={minutes} key={minutes}>{minutes / 60} {minutes === 60 ? 'hora' : 'horas'}</option>)}
        </select></label>
      </div>
      {!isCustomer && <label className="form-field">Cliente<select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setTeamId(''); }} required>
        <option value="">Selecciona un cliente</option>
        {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.full_name}</option>)}
      </select></label>}
      {customerTeams.length > 0 && <label className="form-field">Equipo (opcional)<select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
        <option value="">Sin equipo</option>{customerTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
      </select></label>}
      <label className="form-field">Horario disponible<select name="time" value={slot} onChange={(event) => setSlot(event.target.value)} disabled={loadingSlots || !slots.length} required>
        {loadingSlots ? <option value="">Consultando horarios…</option> : slots.length ? slots.map((item) => <option key={item.starts_at} value={item.starts_at}>{formatTime(item.starts_at)} – {formatTime(item.ends_at)}</option>) : <option value="">Sin horarios disponibles</option>}
      </select></label>
      <label className="form-field">Notas (opcional)<textarea name="notes" maxLength={500} rows={3} /></label>
      <AuthNotice error={error} />
    </Modal>
  );
}
