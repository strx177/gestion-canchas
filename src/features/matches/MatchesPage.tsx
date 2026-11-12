import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useFacilityData } from '../../app/FacilityProvider';
import { AuthNotice } from '../../components/AuthNotice';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import type { Match, Tournament } from '../../types/database';
import { santiagoLocalToIso } from '../../utils/dateTime';
import { formatDate, formatTime } from '../../utils/format';
import { getTodayKey } from '../../utils/format';
import { courtEndTimes, courtStartTimes } from '../../utils/courtSchedule';

interface Referee { id: string; full_name: string }
type MatchDialog = 'create' | { result: Match } | null;
type MatchStatus = Match['status'];
const statusNames: Record<MatchStatus, string> = {
  scheduled: 'Programado', in_progress: 'En curso', completed: 'Finalizado', cancelled: 'Cancelado'
};

export function MatchesPage() {
  const { profile } = useAuth();
  const { teams, courts } = useFacilityData();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Array<{ tournament_id: string; team_id: string }>>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<MatchDialog>(null);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isStaff = profile?.role === 'owner' || profile?.role === 'receptionist';

  const load = useCallback(async () => {
    if (!supabase) { setLoadError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [matchResult, tournamentResult, registrationResult, refereeResult] = await Promise.all([
      supabase.from('matches').select('*').order('starts_at'),
      supabase.from('tournaments').select('*').order('starts_on'),
      supabase.from('tournament_teams').select('*'),
      isStaff ? supabase.rpc('list_referees') : Promise.resolve({ data: [], error: null })
    ]);
    const failure = matchResult.error ?? tournamentResult.error ?? registrationResult.error ?? refereeResult.error;
    const loadedMatches = matchResult.data;
    const loadedTournaments = tournamentResult.data;
    const loadedRegistrations = registrationResult.data;
    if (failure) setLoadError(failure.message);
    else if (!loadedMatches || !loadedTournaments || !loadedRegistrations) setLoadError('Supabase devolvió datos incompletos al cargar los partidos.');
    else {
      setMatches(loadedMatches);
      setTournaments(loadedTournaments);
      setRegistrations(loadedRegistrations);
      setReferees(refereeResult.data ?? []);
      if (!selectedTournament && loadedTournaments[0]) setSelectedTournament(loadedTournaments[0].id);
    }
    setLoading(false);
  }, [isStaff, selectedTournament]);
  useEffect(() => { void load(); }, [load]);

  const tournamentTeams = useMemo(() => {
    const ids = registrations.filter((item) => item.tournament_id === selectedTournament).map((item) => item.team_id);
    return teams.filter((team) => ids.includes(team.id));
  }, [registrations, selectedTournament, teams]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    let start: string;
    let end: string;
    try {
      const date = String(form.get('date'));
      start = santiagoLocalToIso(`${date}T${String(form.get('starts_at'))}`);
      end = santiagoLocalToIso(`${date}T${String(form.get('ends_at'))}`);
    } catch (validationError) {
      setActionError(validationError instanceof Error ? validationError.message : 'Revisa la fecha del partido.');
      return;
    }
    if (new Date(end) <= new Date(start)) { setActionError('El término debe ser posterior al inicio.'); return; }
    if (form.get('home_team_id') === form.get('away_team_id')) {
      setActionError('Selecciona dos equipos distintos.'); return;
    }
    setSubmitting(true); setActionError(null);
    const result = await supabase.from('matches').insert({
      tournament_id: selectedTournament,
      court_id: String(form.get('court_id')) || null,
      home_team_id: String(form.get('home_team_id')),
      away_team_id: String(form.get('away_team_id')),
      referee_id: String(form.get('referee_id')) || null,
      starts_at: start,
      ends_at: end
    });
    if (result.error) setActionError(result.error.message);
    else { setDialog(null); await load(); }
    setSubmitting(false);
  };

  const saveResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !dialog || dialog === 'create') return;
    const form = new FormData(event.currentTarget);
    const home = Number(form.get('home_score'));
    const away = Number(form.get('away_score'));
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) { setActionError('Ingresa resultados enteros iguales o mayores a cero.'); return; }
    setSubmitting(true); setActionError(null);
    const result = await supabase.from('matches').update({
      home_score: home, away_score: away, status: 'completed'
    }).eq('id', dialog.result.id);
    if (result.error) setActionError(result.error.message);
    else { setDialog(null); await load(); }
    setSubmitting(false);
  };

  const myMatch = (match: Match) => isStaff || match.referee_id === profile?.id;

  return <DataState loading={loading} error={loadError} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading"><div><h2>Partidos</h2><p>Programa encuentros y registra resultados del torneo.</p></div>
        {isStaff && <button className="primary-button" disabled={!tournaments.length} onClick={() => { setActionError(null); setDialog('create'); }}>+ Programar partido</button>}
      </div>
      <AuthNotice error={actionError} />
      {matches.length ? <section className="panel data-panel"><div className="table-scroll"><table className="data-table">
        <thead><tr><th>TORNEO</th><th>ENCUENTRO</th><th>FECHA Y HORA</th><th>CANCHA</th><th>RESULTADO</th><th>ESTADO</th><th></th></tr></thead>
        <tbody>{matches.map((match) => <tr key={match.id}>
          <td>{tournaments.find((item) => item.id === match.tournament_id)?.name ?? 'Torneo'}</td>
          <td><strong>{teams.find((team) => team.id === match.home_team_id)?.name ?? 'Local'} vs {teams.find((team) => team.id === match.away_team_id)?.name ?? 'Visita'}</strong>
            <small>{referees.find((referee) => referee.id === match.referee_id)?.full_name ?? ''}</small></td>
          <td>{formatDate(match.starts_at)} · {formatTime(match.starts_at)}–{formatTime(match.ends_at)}</td>
          <td>{courts.find((court) => court.id === match.court_id)?.name ?? 'Sin cancha'}</td>
          <td>{match.home_score ?? '—'} : {match.away_score ?? '—'}</td><td>{statusNames[match.status]}</td>
          <td>{myMatch(match) && match.status !== 'cancelled' && <button className="secondary-button" onClick={() => { setActionError(null); setDialog({ result: match }); }}>{match.status === 'completed' ? 'Editar resultado' : 'Ingresar resultado'}</button>}</td>
        </tr>)}</tbody>
      </table></div></section> : <section className="panel"><EmptyState title="No hay partidos programados" description="Programa partidos a partir de equipos inscritos en un torneo." /></section>}
    </section>
    {dialog === 'create' && <Modal title="Programar partido" onClose={() => setDialog(null)} onSubmit={(event) => void create(event)} submitting={submitting}>
      <label className="form-field">Torneo<select value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)} required>
        {tournaments.map((tournament) => <option value={tournament.id} key={tournament.id}>{tournament.name}</option>)}
      </select></label>
      <div className="form-grid">
        <label className="form-field">Equipo local<select name="home_team_id" required><option value="">Selecciona equipo</option>{tournamentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label className="form-field">Equipo visita<select name="away_team_id" required><option value="">Selecciona equipo</option>{tournamentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      </div>
      <label className="form-field">Árbitro<select name="referee_id"><option value="">Sin asignar</option>{referees.map((referee) => <option value={referee.id} key={referee.id}>{referee.full_name}</option>)}</select></label>
      <label className="form-field">Cancha (opcional)<select name="court_id"><option value="">Sin asignar</option>{courts.filter((court) => court.status === 'available').map((court) => <option value={court.id} key={court.id}>{court.name}</option>)}</select></label>
      <label className="form-field">Fecha<input name="date" type="date" min={getTodayKey()} defaultValue={getTodayKey()} required /></label>
      <div className="form-grid">
        <label className="form-field">Inicio<select name="starts_at" defaultValue={courtStartTimes[0]} required>{courtStartTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
        <label className="form-field">Término<select name="ends_at" defaultValue={courtEndTimes[1]} required>{courtEndTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
      </div>
      <p className="form-hint">Los partidos deben comenzar y terminar el mismo día, en bloques de 30 minutos entre las 08:00 y las 21:00.</p>
      <AuthNotice error={actionError} />
    </Modal>}
    {dialog && dialog !== 'create' && <Modal title="Registrar resultado" onClose={() => setDialog(null)} onSubmit={(event) => void saveResult(event)} submitting={submitting}>
      <p className="form-hint">{teams.find((team) => team.id === dialog.result.home_team_id)?.name} vs {teams.find((team) => team.id === dialog.result.away_team_id)?.name}</p>
      <div className="form-grid"><label className="form-field">Local<input name="home_score" type="number" min="0" step="1" defaultValue={dialog.result.home_score ?? ''} required /></label><label className="form-field">Visita<input name="away_score" type="number" min="0" step="1" defaultValue={dialog.result.away_score ?? ''} required /></label></div>
      <AuthNotice error={actionError} />
    </Modal>}
  </DataState>;
}
