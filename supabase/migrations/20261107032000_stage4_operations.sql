create table if not exists public.court_schedules (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (court_id, weekday),
  check (is_closed or closes_at > opens_at)
);

insert into public.court_schedules (court_id, weekday, opens_at, closes_at)
select c.id, d.weekday, '08:00'::time, '23:00'::time
from public.courts c
cross join generate_series(0, 6) as d(weekday)
on conflict (court_id, weekday) do nothing;

create or replace function public.initialize_court_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.court_schedules (court_id, weekday, opens_at, closes_at)
  select new.id, d.weekday, '08:00'::time, '23:00'::time
  from generate_series(0, 6) as d(weekday)
  on conflict (court_id, weekday) do nothing;
  return new;
end;
$$;

drop trigger if exists courts_initialize_schedule on public.courts;
create trigger courts_initialize_schedule
after insert on public.courts
for each row execute function public.initialize_court_schedule();

create table if not exists public.maintenance_periods (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete restrict,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists maintenance_periods_court_time_idx
  on public.maintenance_periods(court_id, starts_at, ends_at)
  where status in ('scheduled', 'in_progress');

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'transfer', 'other')),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payments_reservation_id_idx on public.payments(reservation_id);
create index if not exists payments_created_at_idx on public.payments(created_at);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  registered_at timestamptz not null default now(),
  primary key (tournament_id, team_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  court_id uuid references public.courts(id) on delete set null,
  home_team_id uuid not null,
  away_team_id uuid not null,
  referee_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  foreign key (tournament_id, home_team_id)
    references public.tournament_teams(tournament_id, team_id) on delete cascade,
  foreign key (tournament_id, away_team_id)
    references public.tournament_teams(tournament_id, team_id) on delete cascade,
  check (home_team_id <> away_team_id),
  check (ends_at > starts_at)
);

create index if not exists matches_starts_at_idx on public.matches(starts_at);
create index if not exists matches_referee_id_idx on public.matches(referee_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  reservation_id uuid references public.reservations(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create or replace function public.prevent_overlapping_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'cancelled' then
    perform pg_advisory_xact_lock(hashtextextended(new.court_id::text, 0));

    if exists (
      select 1
      from public.reservations r
      where r.court_id = new.court_id
        and r.status <> 'cancelled'
        and r.id is distinct from new.id
        and tstzrange(r.starts_at, r.ends_at, '[)')
            && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'La cancha ya está reservada en ese horario'
        using errcode = '23P01';
    end if;

    if exists (
      select 1
      from public.maintenance_periods m
      where m.court_id = new.court_id
        and m.status in ('scheduled', 'in_progress')
        and tstzrange(m.starts_at, m.ends_at, '[)')
            && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'La cancha tiene mantenimiento en ese horario'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_reservation(
  target_court_id uuid,
  target_starts_at timestamptz,
  duration_minutes integer,
  target_customer_id uuid default null,
  target_team_id uuid default null,
  target_notes text default null
)
returns public.reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_customer_id uuid;
  v_court public.courts%rowtype;
  v_starts_local timestamp;
  v_ends_local timestamp;
  v_result public.reservations%rowtype;
begin
  v_role := (select public.current_app_role());
  if v_role not in ('owner', 'receptionist', 'customer') then
    raise exception 'No tienes permiso para crear reservas' using errcode = '42501';
  end if;
  if duration_minutes not in (60, 90, 120, 180) then
    raise exception 'La duración debe ser de 60, 90, 120 o 180 minutos';
  end if;

  if v_role = 'customer' then
    v_customer_id := (select public.current_customer_id());
    if v_customer_id is null or (target_customer_id is not null and target_customer_id <> v_customer_id) then
      raise exception 'La cuenta no tiene un cliente asociado' using errcode = '42501';
    end if;
  else
    v_customer_id := target_customer_id;
  end if;
  if v_customer_id is null then
    raise exception 'Selecciona un cliente para la reserva';
  end if;

  select c.* into v_court
  from public.courts c
  where c.id = target_court_id and c.status = 'available';
  if not found then
    raise exception 'La cancha no está disponible';
  end if;

  v_starts_local := target_starts_at at time zone 'America/Santiago';
  v_ends_local := (target_starts_at + make_interval(mins => duration_minutes)) at time zone 'America/Santiago';
  if target_starts_at <= now()
     or extract(second from v_starts_local) <> 0
     or extract(minute from v_starts_local)::integer % 30 <> 0
     or v_starts_local::date <> v_ends_local::date
     or not exists (
       select 1 from public.court_schedules s
       where s.court_id = target_court_id
         and s.weekday = extract(dow from v_starts_local)::smallint
         and not s.is_closed
         and v_starts_local::time >= s.opens_at
         and v_ends_local::time <= s.closes_at
     ) then
    raise exception 'El horario solicitado está fuera de la disponibilidad de la cancha';
  end if;

  if target_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = target_team_id and t.customer_id = v_customer_id
  ) then
    raise exception 'El equipo no pertenece al cliente seleccionado' using errcode = '42501';
  end if;

  insert into public.reservations (
    court_id, customer_id, team_id, starts_at, ends_at, status, total_amount, notes
  ) values (
    target_court_id,
    v_customer_id,
    target_team_id,
    target_starts_at,
    target_starts_at + make_interval(mins => duration_minutes),
    'pending',
    round(v_court.hourly_rate * duration_minutes / 60, 2),
    nullif(trim(target_notes), '')
  ) returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.set_reservation_status(
  target_reservation_id uuid,
  new_status text
)
returns public.reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_reservation public.reservations%rowtype;
begin
  v_role := (select public.current_app_role());
  if new_status not in ('confirmed', 'cancelled') then
    raise exception 'El estado solicitado no es válido';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = target_reservation_id
  for update;
  if not found then
    raise exception 'No se encontró la reserva';
  end if;

  if v_role = 'customer' then
    if v_reservation.customer_id is distinct from (select public.current_customer_id())
       or v_reservation.status <> 'pending'
       or new_status <> 'cancelled' then
      raise exception 'Solo puedes cancelar tus reservas pendientes'
        using errcode = '42501';
    end if;
  elsif v_role not in ('owner', 'receptionist') then
    raise exception 'No tienes permiso para modificar reservas'
      using errcode = '42501';
  end if;

  update public.reservations
  set status = new_status
  where id = target_reservation_id
  returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.handle_reservation_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select p.id into v_user_id
  from public.profiles p
  where p.customer_id = new.customer_id;

  if v_user_id is not null then
    insert into public.notifications (user_id, kind, title, body, reservation_id)
    values (
      v_user_id,
      case when tg_op = 'INSERT' then 'reservation_created' else 'reservation_updated' end,
      case when tg_op = 'INSERT' then 'Reserva recibida' else 'Reserva actualizada' end,
      case when tg_op = 'INSERT' then 'Tu solicitud de reserva fue registrada.'
           else 'El estado de tu reserva cambió a ' || new.status || '.' end,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_notify_customer_insert on public.reservations;
create trigger reservations_notify_customer_insert
after insert on public.reservations
for each row execute function public.handle_reservation_notification();

drop trigger if exists reservations_notify_customer_update on public.reservations;
create trigger reservations_notify_customer_update
after update of status on public.reservations
for each row when (old.status is distinct from new.status)
execute function public.handle_reservation_notification();

create or replace function public.handle_payment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select p.id into v_user_id
  from public.profiles p
  join public.reservations r on r.customer_id = p.customer_id
  where r.id = new.reservation_id;

  if v_user_id is not null then
    insert into public.notifications (user_id, kind, title, body, reservation_id)
    values (
      v_user_id, 'payment_recorded', 'Pago registrado',
      'Se registró un pago de $' || new.amount::text || ' para tu reserva.',
      new.reservation_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists payments_notify_customer on public.payments;
create trigger payments_notify_customer
after insert on public.payments
for each row execute function public.handle_payment_notification();

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.kind is distinct from old.kind
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.reservation_id is distinct from old.reservation_id
     or new.created_at is distinct from old.created_at
     or (new.read_at is null and old.read_at is not null) then
    raise exception 'Solo puedes marcar una notificación como leída';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_update_guard on public.notifications;
create trigger notifications_update_guard
before update on public.notifications
for each row execute function public.guard_notification_update();

revoke all on function public.initialize_court_schedule() from public, anon, authenticated;
revoke all on function public.handle_reservation_notification() from public, anon, authenticated;
revoke all on function public.handle_payment_notification() from public, anon, authenticated;
revoke all on function public.guard_notification_update() from public, anon, authenticated;
revoke all on function public.create_reservation(uuid, timestamptz, integer, uuid, uuid, text) from public, anon;
revoke all on function public.set_reservation_status(uuid, text) from public, anon;
grant execute on function public.create_reservation(uuid, timestamptz, integer, uuid, uuid, text) to authenticated;
grant execute on function public.set_reservation_status(uuid, text) to authenticated;

alter table public.court_schedules enable row level security;
alter table public.maintenance_periods enable row level security;
alter table public.payments enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.matches enable row level security;
alter table public.notifications enable row level security;

revoke all on public.court_schedules, public.maintenance_periods, public.payments,
  public.tournaments, public.tournament_teams, public.matches, public.notifications
from public, anon, authenticated;

grant select on public.court_schedules to anon, authenticated;
grant insert, update, delete on public.court_schedules, public.maintenance_periods,
  public.payments, public.tournaments, public.tournament_teams, public.matches to authenticated;
grant select on public.maintenance_periods, public.payments, public.tournaments,
  public.tournament_teams, public.matches, public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert, update on public.reservations from authenticated;

drop policy if exists court_schedules_read on public.court_schedules;
create policy court_schedules_read on public.court_schedules
for select to anon, authenticated using (true);

drop policy if exists court_schedules_manage_staff on public.court_schedules;
create policy court_schedules_manage_staff on public.court_schedules
for all to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists maintenance_read_staff on public.maintenance_periods;
create policy maintenance_read_staff on public.maintenance_periods
for select to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role));

drop policy if exists maintenance_manage_staff on public.maintenance_periods;
create policy maintenance_manage_staff on public.maintenance_periods
for all to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role, 'maintenance'::public.app_role));

drop policy if exists reservations_update_staff on public.reservations;
drop policy if exists reservations_cancel_own_pending on public.reservations;
drop policy if exists reservations_update_authorized on public.reservations;

drop policy if exists payments_read_staff on public.payments;
create policy payments_read_staff on public.payments
for select to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists payments_insert_staff on public.payments;
create policy payments_insert_staff on public.payments
for insert to authenticated
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  and recorded_by = (select auth.uid())
);

drop policy if exists payments_update_owner on public.payments;
create policy payments_update_owner on public.payments
for update to authenticated
using ((select public.current_app_role()) = 'owner'::public.app_role)
with check ((select public.current_app_role()) = 'owner'::public.app_role);

drop policy if exists payments_delete_owner on public.payments;
create policy payments_delete_owner on public.payments
for delete to authenticated
using ((select public.current_app_role()) = 'owner'::public.app_role);

drop policy if exists tournaments_read_authenticated on public.tournaments;
create policy tournaments_read_authenticated on public.tournaments
for select to authenticated using (true);

drop policy if exists tournaments_manage_staff on public.tournaments;
create policy tournaments_manage_staff on public.tournaments
for all to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists tournament_teams_read_authenticated on public.tournament_teams;
create policy tournament_teams_read_authenticated on public.tournament_teams
for select to authenticated using (true);

drop policy if exists tournament_teams_manage_staff on public.tournament_teams;
create policy tournament_teams_manage_staff on public.tournament_teams
for all to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists matches_read_authorized on public.matches;
create policy matches_read_authorized on public.matches
for select to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or referee_id = (select auth.uid())
  or (select public.current_app_role()) = 'customer'::public.app_role
);

drop policy if exists matches_manage_staff on public.matches;
create policy matches_manage_staff on public.matches
for all to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists matches_update_referee on public.matches;
create policy matches_update_referee on public.matches
for update to authenticated
using (
  (select public.current_app_role()) = 'referee'::public.app_role
  and referee_id = (select auth.uid())
)
with check (
  (select public.current_app_role()) = 'referee'::public.app_role
  and referee_id = (select auth.uid())
);

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace view public.reservation_payment_summary
with (security_invoker = true)
as
select
  r.id as reservation_id,
  r.court_id,
  r.customer_id,
  r.starts_at,
  r.ends_at,
  r.status as reservation_status,
  r.total_amount,
  coalesce(sum(p.amount) filter (where p.status = 'paid'), 0)::numeric(12,2) as amount_paid
from public.reservations r
left join public.payments p on p.reservation_id = r.id
group by r.id;

grant select on public.reservation_payment_summary to authenticated;
