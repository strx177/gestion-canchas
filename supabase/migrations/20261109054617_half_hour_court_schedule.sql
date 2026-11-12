create table public.court_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null check (
    starts_at >= time '08:00'
    and starts_at < time '21:00'
    and extract(minute from starts_at)::integer in (0, 30)
    and extract(second from starts_at) = 0
  ),
  is_available boolean not null default true,
  unique (court_id, weekday, starts_at)
);

insert into public.court_schedule_blocks (court_id, weekday, starts_at, is_available)
select s.court_id, s.weekday, time '08:00' + make_interval(mins => block.n * 30),
  not s.is_closed
    and time '08:00' + make_interval(mins => block.n * 30) >= s.opens_at
    and time '08:00' + make_interval(mins => (block.n + 1) * 30) <= s.closes_at
from public.court_schedules s
cross join generate_series(0, 25) as block(n)
on conflict (court_id, weekday, starts_at) do nothing;

update public.court_schedules
set opens_at = time '08:00', closes_at = time '21:00';

create function public.initialize_court_schedule_blocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.court_schedule_blocks (court_id, weekday, starts_at, is_available)
  select new.id, days.weekday, time '08:00' + make_interval(mins => blocks.n * 30), true
  from generate_series(0, 6) as days(weekday)
  cross join generate_series(0, 25) as blocks(n)
  on conflict (court_id, weekday, starts_at) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_court_schedule_blocks() from public, anon, authenticated;

create trigger courts_initialize_schedule_blocks
after insert on public.courts
for each row execute function public.initialize_court_schedule_blocks();

alter table public.court_schedule_blocks enable row level security;
revoke all on public.court_schedule_blocks from public, anon, authenticated;
grant select on public.court_schedule_blocks to anon, authenticated;
grant insert, update, delete on public.court_schedule_blocks to authenticated;
create policy court_schedule_blocks_read on public.court_schedule_blocks
for select to anon, authenticated using (true);
create policy court_schedule_blocks_manage_staff on public.court_schedule_blocks
for all to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

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
  v_candidate timestamp;
  v_block_count integer;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
begin
  v_role := (select public.current_app_role());
  if v_role is null or v_role not in ('owner', 'receptionist', 'customer') then
    raise exception 'Inicia sesión con una cuenta autorizada para consultar horarios.';
  end if;
  if duration_minutes < 30 or duration_minutes > 780 or duration_minutes % 30 <> 0 then
    raise exception 'La duración debe ser de 30 minutos o un múltiplo de 30, hasta 13 horas.';
  end if;
  if not exists (select 1 from public.courts c where c.id = target_court_id and c.status = 'available') then
    return;
  end if;

  for v_candidate in
    select target_date + time '08:00' + make_interval(mins => slots.n * 30)
    from generate_series(0, 25) as slots(n)
    where time '08:00' + make_interval(mins => slots.n * 30 + duration_minutes) <= time '21:00'
  loop
    select count(*) into v_block_count
    from generate_series(0, duration_minutes / 30 - 1) as block_number(n)
    where exists (
      select 1
      from public.court_schedule_blocks b
      where b.court_id = target_court_id
        and b.weekday = extract(dow from target_date)::smallint
        and b.starts_at = (v_candidate::time + make_interval(mins => block_number.n * 30))::time
        and b.is_available
    );
    if v_block_count = duration_minutes / 30 then
      v_slot_start := v_candidate at time zone 'America/Santiago';
      v_slot_end := v_slot_start + make_interval(mins => duration_minutes);
      if v_slot_start > now()
         and not exists (
           select 1 from public.reservations r
           where r.court_id = target_court_id and r.status <> 'cancelled'
             and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
         )
         and not exists (
           select 1 from public.maintenance_periods m
           where m.court_id = target_court_id and m.status in ('scheduled', 'in_progress')
             and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
         )
         and not exists (
           select 1 from public.matches m
           where m.court_id = target_court_id and m.status <> 'cancelled'
             and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
         ) then
        starts_at := v_slot_start;
        ends_at := v_slot_end;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.available_reservation_slots(uuid, date, integer) from public, anon;
grant execute on function public.available_reservation_slots(uuid, date, integer) to authenticated;

create or replace function public.create_reservation(
  target_court_id uuid,
  target_starts_at timestamptz,
  duration_minutes integer,
  target_sport text,
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
  v_promotion_id uuid;
  v_discount numeric(5,2) := 0;
  v_result public.reservations%rowtype;
begin
  v_role := (select public.current_app_role());
  if v_role is null or v_role not in ('owner', 'receptionist', 'customer') then
    raise exception 'Inicia sesión con una cuenta autorizada para crear reservas.';
  end if;
  if duration_minutes < 30 or duration_minutes > 780 or duration_minutes % 30 <> 0 then
    raise exception 'La duración debe ser de 30 minutos o un múltiplo de 30, hasta 13 horas.';
  end if;
  if target_sport is null or target_sport not in ('Fútbol', 'Otras actividades') then
    raise exception 'Selecciona un deporte válido para la reserva.';
  end if;

  if v_role = 'customer' then
    v_customer_id := (select public.current_customer_id());
    if v_customer_id is null or (target_customer_id is not null and target_customer_id <> v_customer_id) then
      raise exception 'Tu cuenta no tiene un cliente asociado. Contacta a recepción.';
    end if;
  else
    v_customer_id := target_customer_id;
  end if;
  if v_customer_id is null then raise exception 'Selecciona el cliente de la reserva.'; end if;

  select c.* into v_court
  from public.courts c
  where c.id = target_court_id and c.status = 'available';
  if not found then raise exception 'La cancha seleccionada no está disponible.'; end if;

  v_starts_local := target_starts_at at time zone 'America/Santiago';
  v_ends_local := (target_starts_at + make_interval(mins => duration_minutes)) at time zone 'America/Santiago';
  if target_starts_at <= now()
     or extract(second from v_starts_local) <> 0
     or extract(minute from v_starts_local)::integer % 30 <> 0
     or v_starts_local::date <> v_ends_local::date
     or v_starts_local::time < time '08:00'
     or v_ends_local::time > time '21:00' then
    raise exception 'El horario debe estar entre las 08:00 y las 21:00, en bloques de 30 minutos.';
  end if;

  if exists (
    select 1
    from generate_series(0, duration_minutes / 30 - 1) as block_number(n)
    where not exists (
      select 1 from public.court_schedule_blocks b
      where b.court_id = target_court_id
        and b.weekday = extract(dow from v_starts_local)::smallint
        and b.starts_at = (v_starts_local::time + make_interval(mins => block_number.n * 30))::time
        and b.is_available
    )
  ) then
    raise exception 'La cancha no está disponible durante todo el horario seleccionado.';
  end if;

  if target_team_id is not null and not exists (
    select 1 from public.teams t where t.id = target_team_id and t.customer_id = v_customer_id
  ) then
    raise exception 'El equipo seleccionado no pertenece al cliente indicado.';
  end if;

  select p.id, p.discount_percent into v_promotion_id, v_discount
  from public.promotions p
  where p.status = 'active'
    and p.promotion_date = v_starts_local::date
    and (p.applies_to_all_courts or exists (
      select 1 from public.promotion_courts pc
      where pc.promotion_id = p.id and pc.court_id = target_court_id
    ))
    and exists (
      select 1 from public.promotion_time_blocks b
      where b.promotion_id = p.id
        and v_starts_local::time >= b.starts_at
        and v_ends_local::time <= b.ends_at
    )
  order by p.discount_percent desc, p.created_at asc
  limit 1;
  v_discount := coalesce(v_discount, 0);

  insert into public.reservations (
    court_id, customer_id, team_id, sport, starts_at, ends_at, status,
    total_amount, notes, promotion_id, applied_discount_percent
  ) values (
    target_court_id, v_customer_id, target_team_id, target_sport,
    target_starts_at, target_starts_at + make_interval(mins => duration_minutes),
    'pending',
    round(v_court.hourly_rate * duration_minutes / 60 * (100 - v_discount) / 100, 2),
    nullif(trim(target_notes), ''), v_promotion_id, v_discount
  ) returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.create_reservation(uuid, timestamptz, integer, text, uuid, uuid, text)
  from public, anon;
grant execute on function public.create_reservation(uuid, timestamptz, integer, text, uuid, uuid, text)
  to authenticated;

create function public.validate_half_hour_interval()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_start timestamp;
  v_end timestamp;
begin
  if tg_table_name = 'matches' and new.court_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at
     and (tg_table_name <> 'matches' or new.court_id is not distinct from old.court_id)
     and (tg_table_name <> 'maintenance_periods' or new.court_id is not distinct from old.court_id) then
    return new;
  end if;

  v_start := new.starts_at at time zone 'America/Santiago';
  v_end := new.ends_at at time zone 'America/Santiago';
  if new.ends_at <= new.starts_at then
    raise exception 'La hora de término debe ser posterior a la hora de inicio.';
  end if;
  if v_start::date <> v_end::date then
    raise exception 'El horario debe comenzar y terminar el mismo día.';
  end if;
  if v_start::time < time '08:00' or v_end::time > time '21:00' then
    raise exception 'El horario debe estar entre las 08:00 y las 21:00.';
  end if;
  if extract(second from v_start) <> 0 or extract(second from v_end) <> 0
     or extract(minute from v_start)::integer % 30 <> 0
     or extract(minute from v_end)::integer % 30 <> 0 then
    raise exception 'Selecciona horas en intervalos de 30 minutos.';
  end if;
  return new;
end;
$$;

create trigger reservations_half_hour_interval
before insert or update of court_id, starts_at, ends_at on public.reservations
for each row execute function public.validate_half_hour_interval();
create trigger maintenance_half_hour_interval
before insert or update of court_id, starts_at, ends_at on public.maintenance_periods
for each row execute function public.validate_half_hour_interval();
create trigger matches_half_hour_interval
before insert or update of court_id, starts_at, ends_at on public.matches
for each row execute function public.validate_half_hour_interval();
revoke all on function public.validate_half_hour_interval() from public, anon, authenticated;

create function public.validate_promotion_time_blocks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ends_at <= new.starts_at then
    raise exception 'La hora de término de la promoción debe ser posterior a la hora de inicio.';
  end if;
  if new.starts_at < time '08:00' or new.ends_at > time '21:00' then
    raise exception 'Los horarios de promoción deben estar entre las 08:00 y las 21:00.';
  end if;
  if extract(second from new.starts_at) <> 0 or extract(second from new.ends_at) <> 0
     or extract(minute from new.starts_at)::integer % 30 <> 0
     or extract(minute from new.ends_at)::integer % 30 <> 0 then
    raise exception 'Los bloques de promoción deben comenzar y terminar en intervalos de 30 minutos.';
  end if;
  return new;
end;
$$;
create trigger promotion_time_blocks_half_hour
before insert or update on public.promotion_time_blocks
for each row execute function public.validate_promotion_time_blocks();
revoke all on function public.validate_promotion_time_blocks() from public, anon, authenticated;

create function public.guard_court_delete_with_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.reservations r where r.court_id = old.id) then
    raise exception 'No se puede eliminar esta cancha porque tiene reservas asociadas. Cancela o resuelve esas reservas primero.';
  end if;
  if exists (select 1 from public.maintenance_periods m where m.court_id = old.id) then
    raise exception 'No se puede eliminar esta cancha porque tiene registros de mantenimiento asociados.';
  end if;
  if exists (select 1 from public.matches m where m.court_id = old.id) then
    raise exception 'No se puede eliminar esta cancha porque tiene partidos asociados.';
  end if;
  return old;
end;
$$;
create trigger courts_delete_guard
before delete on public.courts
for each row execute function public.guard_court_delete_with_message();
revoke all on function public.guard_court_delete_with_message() from public, anon, authenticated;
