import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { Tournament } from '../../types/database';
import { formatDate } from '../../utils/format';

type TournamentStatus = Tournament['status'];
const tournamentStatuses: Record<TournamentStatus, string> = {
  planned: 'Planificado', in_progress: 'En curso', completed: 'Finalizado', cancelled: 'Cancelado'
};

function isTournamentStatus(value: string): value is TournamentStatus {
  return value in tournamentStatuses;
}

export function TournamentsPage() {
  const { teams } = useFacilityData();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tournamentToEnroll, setTournamentToEnroll] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setLoadError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [tournamentResult, registrationResult] = await Promise.all([
      supabase.from('tournaments').select('*').order('starts_on'),
      supabase.from('tournament_teams').select('*')
    ]);
    if (tournamentResult.error) setLoadError(tournamentResult.error.message);
    else if (registrationResult.error) setLoadError(registrationResult.error.message);
    else {
      setTournaments(tournamentResult.data);
      setTeamCounts(registrationResult.data.reduce<Record<string, number>>((counts, row) => {
        counts[row.tournament_id] = (counts[row.tournament_id] ?? 0) + 1;
        return counts;
      }, {}));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const start = String(form.get('starts_on'));
    const end = String(form.get('ends_on'));
    if (end < start) { setActionError('La fecha de término no puede ser anterior al inicio.'); return; }
    setSubmitting(true); setActionError(null);
    const result = await supabase.from('tournaments').insert({
      name: String(form.get('name')).trim(),
      sport: String(form.get('sport')).trim(),
      description: String(form.get('description')) || null,
      starts_on: start,
      ends_on: end
    });
    if (result.error) setActionError(result.error.message);
    else { setShowCreate(false); await load(); }
    setSubmitting(false);
  };

  const enroll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !tournamentToEnroll) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true); setActionError(null);
    const result = await supabase.from('tournament_teams').insert({
      tournament_id: tournamentToEnroll.id,
      team_id: String(form.get('team_id'))
    });
    if (result.error) setActionError(result.error.message);
    else { setTournamentToEnroll(null); await load(); }
    setSubmitting(false);
  };

  const setStatus = async (tournament: Tournament, status: TournamentStatus) => {
    if (!supabase) return;
    const result = await supabase.from('tournaments').update({ status }).eq('id', tournament.id);
    if (result.error) setActionError(result.error.message); else await load();
  };

  return <DataState loading={loading} error={loadError} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading"><div><h2>Torneos</h2><p>Organiza competencias y registra equipos participantes.</p></div>
        <button className="primary-button" onClick={() => { setActionError(null); setShowCreate(true); }}>+ Crear torneo</button>
      </div>
      <AuthNotice error={actionError} />
      {tournaments.length ? <div className="tournament-grid">{tournaments.map((tournament) => <article className="panel tournament-card" key={tournament.id}>
        <div className="panel-heading"><div><p className="eyebrow">{tournament.sport}</p><h2>{tournament.name}</h2></div>
          <select className="select-control" aria-label={`Estado de ${tournament.name}`} value={tournament.status} onChange={(event) => {
            const status = event.target.value;
            if (isTournamentStatus(status)) void setStatus(tournament, status);
          }}>{Object.entries(tournamentStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        {tournament.description && <p>{tournament.description}</p>}
        <p>{formatDate(`${tournament.starts_on}T12:00:00`)} – {formatDate(`${tournament.ends_on}T12:00:00`)}</p>
        <strong>{teamCounts[tournament.id] ?? 0} equipos inscritos</strong>
        <button className="secondary-button" onClick={() => { setActionError(null); setTournamentToEnroll(tournament); }}>Inscribir equipo</button>
      </article>)}</div> : <section className="panel"><EmptyState title="Aún no hay torneos" description="Crea un torneo para comenzar a registrar equipos y partidos." /></section>}
    </section>
    {showCreate && <Modal title="Crear torneo" onClose={() => setShowCreate(false)} onSubmit={(event) => void create(event)} submitting={submitting}>
      <label className="form-field">Nombre<input name="name" required maxLength={120} /></label>
      <label className="form-field">Deporte<select name="sport" defaultValue="Fútbol" required>
        <option value="Fútbol">Fútbol</option><option value="Otras actividades">Otras actividades</option>
      </select></label>
      <label className="form-field">Descripción<textarea name="description" rows={2} maxLength={500} /></label>
      <div className="form-grid"><label className="form-field">Inicio<input name="starts_on" type="date" required /></label><label className="form-field">Término<input name="ends_on" type="date" required /></label></div>
      <AuthNotice error={actionError} />
    </Modal>}
    {tournamentToEnroll && <Modal title={`Inscribir equipo · ${tournamentToEnroll.name}`} onClose={() => setTournamentToEnroll(null)} onSubmit={(event) => void enroll(event)} submitting={submitting}>
      <label className="form-field">Equipo<select name="team_id" required><option value="">Selecciona un equipo</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
      <AuthNotice error={actionError} />
    </Modal>}
  </DataState>;
}
