create or replace function public.available_reservation_slots(
  target_court_id uuid,
  target_date date,
  duration_minutes integer
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_schedule public.court_schedules%rowtype;
  v_open timestamptz;
  v_close timestamptz;
begin
  v_role := (select public.current_app_role());
  if v_role not in ('owner', 'receptionist', 'customer') then
    raise exception 'No tienes permiso para consultar disponibilidad'
      using errcode = '42501';
  end if;
  if duration_minutes not in (60, 90, 120, 180) then
    raise exception 'La duración solicitada no es válida';
  end if;
  if not exists (
    select 1 from public.courts c where c.id = target_court_id and c.status = 'available'
  ) then
    return;
  end if;

  select s.* into v_schedule
  from public.court_schedules s
  where s.court_id = target_court_id
    and s.weekday = extract(dow from target_date)::smallint
    and not s.is_closed;
  if not found then return; end if;

  v_open := (target_date + v_schedule.opens_at) at time zone 'America/Santiago';
  v_close := (target_date + v_schedule.closes_at) at time zone 'America/Santiago';

  return query
  select slot_start, slot_start + make_interval(mins => duration_minutes)
  from generate_series(
    v_open,
    v_close - make_interval(mins => duration_minutes),
    interval '30 minutes'
  ) as slot_start
  where slot_start > now()
    and not exists (
      select 1 from public.reservations r
      where r.court_id = target_court_id
        and r.status <> 'cancelled'
        and tstzrange(r.starts_at, r.ends_at, '[)')
            && tstzrange(slot_start, slot_start + make_interval(mins => duration_minutes), '[)')
    )
    and not exists (
      select 1 from public.maintenance_periods m
      where m.court_id = target_court_id
        and m.status in ('scheduled', 'in_progress')
        and tstzrange(m.starts_at, m.ends_at, '[)')
            && tstzrange(slot_start, slot_start + make_interval(mins => duration_minutes), '[)')
    )
    and not exists (
      select 1 from public.matches m
      where m.court_id = target_court_id
        and m.status <> 'cancelled'
        and tstzrange(m.starts_at, m.ends_at, '[)')
            && tstzrange(slot_start, slot_start + make_interval(mins => duration_minutes), '[)')
    )
  order by slot_start;
end;
$$;

revoke all on function public.available_reservation_slots(uuid, date, integer) from public, anon;
grant execute on function public.available_reservation_slots(uuid, date, integer) to authenticated;

create or replace function public.prevent_conflicting_maintenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('scheduled', 'in_progress') then
    perform pg_advisory_xact_lock(hashtextextended(new.court_id::text, 0));
    if exists (
      select 1 from public.reservations r
      where r.court_id = new.court_id
        and r.status <> 'cancelled'
        and tstzrange(r.starts_at, r.ends_at, '[)')
            && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'No se puede programar mantenimiento sobre una reserva activa'
        using errcode = '23P01';
    end if;
    if exists (
      select 1 from public.matches m
      where m.court_id = new.court_id
        and m.status <> 'cancelled'
        and tstzrange(m.starts_at, m.ends_at, '[)')
            && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'No se puede programar mantenimiento sobre un partido'
        using errcode = '23P01';
    end if;
    if exists (
      select 1 from public.maintenance_periods m
      where m.court_id = new.court_id
        and m.id is distinct from new.id
        and m.status in ('scheduled', 'in_progress')
        and tstzrange(m.starts_at, m.ends_at, '[)')
            && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'Ya existe mantenimiento para ese horario'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_conflicting_maintenance() from public, anon, authenticated;
drop trigger if exists maintenance_no_conflict on public.maintenance_periods;
create trigger maintenance_no_conflict
before insert or update on public.maintenance_periods
for each row execute function public.prevent_conflicting_maintenance();

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
      select 1 from public.reservations r
      where r.court_id = new.court_id and r.status <> 'cancelled'
        and r.id is distinct from new.id
        and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) or exists (
      select 1 from public.maintenance_periods m
      where m.court_id = new.court_id and m.status in ('scheduled', 'in_progress')
        and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) or exists (
      select 1 from public.matches m
      where m.court_id = new.court_id and m.status <> 'cancelled'
        and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'La cancha ya está reservada o bloqueada en ese horario'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_match_conflicts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.court_id is not null and new.status <> 'cancelled' then
    perform pg_advisory_xact_lock(hashtextextended(new.court_id::text, 0));
    if exists (
      select 1 from public.reservations r
      where r.court_id = new.court_id and r.status <> 'cancelled'
        and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) or exists (
      select 1 from public.maintenance_periods m
      where m.court_id = new.court_id and m.status in ('scheduled', 'in_progress')
        and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) or exists (
      select 1 from public.matches m
      where m.court_id = new.court_id and m.id is distinct from new.id and m.status <> 'cancelled'
        and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'El horario de cancha ya está reservado o bloqueado'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_match_conflicts() from public, anon, authenticated;
drop trigger if exists matches_no_conflict on public.matches;
create trigger matches_no_conflict before insert or update on public.matches
for each row execute function public.prevent_match_conflicts();

create or replace function public.validate_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(12,2);
  v_paid numeric(12,2);
begin
  perform pg_advisory_xact_lock(hashtextextended(new.reservation_id::text, 0));
  select r.total_amount into v_total from public.reservations r where r.id = new.reservation_id;
  select coalesce(sum(p.amount), 0) into v_paid from public.payments p
  where p.reservation_id = new.reservation_id and p.status = 'paid'
    and p.id is distinct from new.id;
  if new.status = 'paid' and v_paid + new.amount > v_total then
    raise exception 'El monto supera el saldo restante de la reserva';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_payment_amount() from public, anon, authenticated;
drop trigger if exists payments_amount_guard on public.payments;
create trigger payments_amount_guard before insert or update on public.payments
for each row execute function public.validate_payment_amount();

create or replace function public.list_referees()
returns table (id uuid, full_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_app_role()) not in ('owner'::public.app_role, 'receptionist'::public.app_role) then
    raise exception 'No tienes permiso para consultar árbitros' using errcode = '42501';
  end if;
  return query select p.id, p.full_name
  from public.profiles p where p.role = 'referee'::public.app_role order by p.full_name;
end;
$$;
revoke all on function public.list_referees() from public, anon;
grant execute on function public.list_referees() to authenticated;

create or replace function public.guard_referee_match_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.current_app_role()) = 'referee'::public.app_role
     and (
       new.id is distinct from old.id
       or new.tournament_id is distinct from old.tournament_id
       or new.court_id is distinct from old.court_id
       or new.home_team_id is distinct from old.home_team_id
       or new.away_team_id is distinct from old.away_team_id
       or new.referee_id is distinct from old.referee_id
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.created_at is distinct from old.created_at
       or new.status <> 'completed'
       or old.status = 'cancelled'
     ) then
    raise exception 'Los árbitros solo pueden actualizar los resultados del partido'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_referee_match_update() from public, anon, authenticated;
drop trigger if exists matches_referee_update_guard on public.matches;
create trigger matches_referee_update_guard
before update on public.matches
for each row execute function public.guard_referee_match_update();

drop policy if exists matches_manage_staff on public.matches;
drop policy if exists matches_update_referee on public.matches;
create policy matches_insert_staff on public.matches
for insert to authenticated
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
create policy matches_update_authorized on public.matches
for update to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or (
    (select public.current_app_role()) = 'referee'::public.app_role
    and referee_id = (select auth.uid())
  )
)
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or (
    (select public.current_app_role()) = 'referee'::public.app_role
    and referee_id = (select auth.uid())
  )
);
create policy matches_delete_staff on public.matches
for delete to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
