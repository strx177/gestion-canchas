import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFacilityData } from '../../app/FacilityProvider';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import type { Match, Tournament } from '../../types/database';

interface Registration {
  tournament_id: string;
  team_id: string;
}

interface Standing {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export function StandingsPage() {
  const { teams } = useFacilityData();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase no está configurado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const [tournamentResult, registrationResult, matchResult] = await Promise.all([
      supabase.from('tournaments').select('*').order('starts_on'),
      supabase.from('tournament_teams').select('tournament_id, team_id'),
      supabase.from('matches').select('*')
    ]);

    const failure = tournamentResult.error ?? registrationResult.error ?? matchResult.error;
    if (failure) {
      setError(failure.message);
    } else if (!tournamentResult.data || !registrationResult.data || !matchResult.data) {
      setError('Supabase devolvió datos incompletos al cargar las posiciones.');
    } else {
      setTournaments(tournamentResult.data);
      setRegistrations(registrationResult.data);
      setMatches(matchResult.data);
      setSelectedTournament((current) => current || tournamentResult.data[0]?.id || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const standings = useMemo(() => {
    const rows = new Map<string, Standing>();
    for (const registration of registrations) {
      if (registration.tournament_id === selectedTournament) {
        rows.set(registration.team_id, {
          teamId: registration.team_id,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0
        });
      }
    }

    for (const match of matches) {
      if (match.tournament_id !== selectedTournament || match.status !== 'completed'
        || match.home_score === null || match.away_score === null) continue;

      const home = rows.get(match.home_team_id);
      const away = rows.get(match.away_team_id);
      if (!home || !away) continue;

      home.played += 1;
      away.played += 1;
      home.goalsFor += match.home_score;
      home.goalsAgainst += match.away_score;
      away.goalsFor += match.away_score;
      away.goalsAgainst += match.home_score;

      if (match.home_score > match.away_score) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (match.home_score < match.away_score) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    return [...rows.values()].sort((first, second) =>
      second.points - first.points
      || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
      || second.goalsFor - first.goalsFor
      || (teams.find((team) => team.id === first.teamId)?.name ?? '')
        .localeCompare(teams.find((team) => team.id === second.teamId)?.name ?? '', 'es')
    );
  }, [matches, registrations, selectedTournament, teams]);

  return <DataState loading={loading} error={error} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading">
        <div><h2>Tabla de posiciones</h2><p>Clasificación calculada desde los resultados finalizados del torneo.</p></div>
        <label className="filter-control">Torneo
          <select className="select-control" value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)}>
            {tournaments.map((tournament) => <option value={tournament.id} key={tournament.id}>{tournament.name}</option>)}
          </select>
        </label>
      </div>
      {tournaments.length && standings.length ? <section className="panel data-panel">
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>#</th><th>EQUIPO</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead>
          <tbody>{standings.map((standing, index) => <tr key={standing.teamId}>
            <td>{index + 1}</td>
            <td><strong>{teams.find((team) => team.id === standing.teamId)?.name ?? 'Equipo'}</strong></td>
            <td>{standing.played}</td><td>{standing.wins}</td><td>{standing.draws}</td><td>{standing.losses}</td>
            <td>{standing.goalsFor}</td><td>{standing.goalsAgainst}</td><td>{standing.goalsFor - standing.goalsAgainst}</td><td><strong>{standing.points}</strong></td>
          </tr>)}</tbody>
        </table></div>
      </section> : <section className="panel"><EmptyState
        title={tournaments.length ? 'Sin equipos inscritos' : 'Aún no hay torneos'}
        description={tournaments.length ? 'Inscribe equipos y la tabla se completará a medida que se registren resultados.' : 'Crea un torneo e inscribe equipos para generar una tabla de posiciones.'}
      /></section>}
    </section>
  </DataState>;
}
