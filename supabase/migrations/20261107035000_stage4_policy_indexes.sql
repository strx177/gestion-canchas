revoke all on function public.prevent_overlapping_reservations()
from public, anon, authenticated;

create index if not exists maintenance_periods_created_by_idx
  on public.maintenance_periods(created_by);
create index if not exists matches_court_id_idx
  on public.matches(court_id);
create index if not exists matches_tournament_home_team_idx
  on public.matches(tournament_id, home_team_id);
create index if not exists matches_tournament_away_team_idx
  on public.matches(tournament_id, away_team_id);
create index if not exists notifications_reservation_id_idx
  on public.notifications(reservation_id);
create index if not exists payments_recorded_by_idx
  on public.payments(recorded_by);
create index if not exists tournament_teams_team_id_idx
  on public.tournament_teams(team_id);
create index if not exists tournaments_created_by_idx
  on public.tournaments(created_by);

drop policy if exists court_schedules_manage_staff on public.court_schedules;
create policy court_schedules_insert_staff on public.court_schedules
for insert to authenticated
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy court_schedules_update_staff on public.court_schedules
for update to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy court_schedules_delete_staff on public.court_schedules
for delete to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists maintenance_manage_staff on public.maintenance_periods;
create policy maintenance_insert_staff on public.maintenance_periods
for insert to authenticated
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role));
create policy maintenance_update_staff on public.maintenance_periods
for update to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role));
create policy maintenance_delete_staff on public.maintenance_periods
for delete to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role));

drop policy if exists tournaments_manage_staff on public.tournaments;
create policy tournaments_insert_staff on public.tournaments
for insert to authenticated
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy tournaments_update_staff on public.tournaments
for update to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy tournaments_delete_staff on public.tournaments
for delete to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists tournament_teams_manage_staff on public.tournament_teams;
create policy tournament_teams_insert_staff on public.tournament_teams
for insert to authenticated
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy tournament_teams_update_staff on public.tournament_teams
for update to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy tournament_teams_delete_staff on public.tournament_teams
for delete to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
