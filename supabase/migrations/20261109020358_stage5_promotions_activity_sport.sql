-- Applied remotely as migration 20261109020358.
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promotion_date date not null,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  applies_to_all_courts boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.promotion_courts (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  primary key (promotion_id, court_id)
);

create table public.promotion_time_blocks (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at),
  unique (promotion_id, starts_at, ends_at)
);

create index promotions_date_status_idx
  on public.promotions(promotion_date, status);
create index promotion_time_blocks_promotion_id_idx
  on public.promotion_time_blocks(promotion_id);

alter table public.promotions enable row level security;
alter table public.promotion_courts enable row level security;
alter table public.promotion_time_blocks enable row level security;

grant select, insert, update, delete on public.promotions to authenticated;
grant select, insert, update, delete on public.promotion_courts to authenticated;
grant select, insert, update, delete on public.promotion_time_blocks to authenticated;

create policy promotions_owner_all on public.promotions
for all to authenticated
using ((select public.current_app_role()) = 'owner'::public.app_role)
with check ((select public.current_app_role()) = 'owner'::public.app_role);

create policy promotion_courts_owner_all on public.promotion_courts
for all to authenticated
using ((select public.current_app_role()) = 'owner'::public.app_role)
with check ((select public.current_app_role()) = 'owner'::public.app_role);

create policy promotion_time_blocks_owner_all on public.promotion_time_blocks
for all to authenticated
using ((select public.current_app_role()) = 'owner'::public.app_role)
with check ((select public.current_app_role()) = 'owner'::public.app_role);

create function public.save_promotion(
  target_promotion_id uuid,
  target_name text,
  target_date date,
  target_discount_percent numeric,
  target_applies_to_all_courts boolean,
  target_status text,
  target_court_ids uuid[],
  target_time_blocks jsonb
)
returns public.promotions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotions%rowtype;
begin
  if (select public.current_app_role()) is distinct from 'owner'::public.app_role then
    raise exception 'Solo el dueño puede gestionar promociones' using errcode = '42501';
  end if;
  if nullif(trim(target_name), '') is null
     or target_date is null
     or target_applies_to_all_courts is null
     or target_discount_percent is null
     or target_discount_percent <= 0 or target_discount_percent > 100
     or target_status is null or target_status not in ('active', 'inactive') then
    raise exception 'Revisa el nombre, descuento, estado y bloques de horario';
  end if;
  if target_time_blocks is null or jsonb_typeof(target_time_blocks) <> 'array' then
    raise exception 'Los bloques de horario deben entregarse como una lista';
  end if;
  if jsonb_array_length(target_time_blocks) = 0 then
    raise exception 'Agrega al menos un bloque de horario';
  end if;
  if not target_applies_to_all_courts and coalesce(cardinality(target_court_ids), 0) = 0 then
    raise exception 'Selecciona al menos una cancha o indica que aplica a todas';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_time_blocks) as b(starts_at time, ends_at time)
    where b.starts_at is null or b.ends_at is null or b.ends_at <= b.starts_at
  ) then
    raise exception 'Cada bloque debe tener una hora de término posterior a su inicio';
  end if;

  if target_promotion_id is null then
    insert into public.promotions(
      name, promotion_date, discount_percent, applies_to_all_courts, status, created_by
    ) values (
      trim(target_name), target_date, target_discount_percent,
      target_applies_to_all_courts, target_status, auth.uid()
    ) returning * into v_promotion;
  else
    update public.promotions
    set name = trim(target_name),
        promotion_date = target_date,
        discount_percent = target_discount_percent,
        applies_to_all_courts = target_applies_to_all_courts,
        status = target_status
    where id = target_promotion_id
    returning * into v_promotion;
    if not found then
      raise exception 'No se encontró la promoción';
    end if;
  end if;

  delete from public.promotion_courts where promotion_id = v_promotion.id;
  delete from public.promotion_time_blocks where promotion_id = v_promotion.id;
  if not target_applies_to_all_courts then
    insert into public.promotion_courts(promotion_id, court_id)
    select v_promotion.id, selected_courts.court_id
    from unnest(target_court_ids) as selected_courts(court_id);
  end if;
  insert into public.promotion_time_blocks(promotion_id, starts_at, ends_at)
  select v_promotion.id, b.starts_at, b.ends_at
  from jsonb_to_recordset(target_time_blocks) as b(starts_at time, ends_at time);
  return v_promotion;
end;
$$;

revoke all on function public.save_promotion(uuid, text, date, numeric, boolean, text, uuid[], jsonb)
  from public, anon;
grant execute on function public.save_promotion(uuid, text, date, numeric, boolean, text, uuid[], jsonb)
  to authenticated;

alter table public.reservations add column sport text;
alter table public.reservations disable trigger reservations_customer_update_guard;
update public.reservations r
set sport = coalesce(nullif(trim(c.sport), ''), 'Fútbol')
from public.courts c
where c.id = r.court_id;
alter table public.reservations enable trigger reservations_customer_update_guard;
alter table public.reservations alter column sport set default 'Fútbol';
alter table public.reservations alter column sport set not null;
alter table public.reservations
  add column promotion_id uuid references public.promotions(id) on delete set null,
  add column applied_discount_percent numeric(5,2) not null default 0
    check (applied_discount_percent >= 0 and applied_discount_percent <= 100);
alter table public.courts drop column sport;

create function public.create_reservation(
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
    raise exception 'No tienes permiso para crear reservas' using errcode = '42501';
  end if;
  if duration_minutes not in (60, 90, 120, 180) then
    raise exception 'La duración debe ser de 60, 90, 120 o 180 minutos';
  end if;
  if target_sport is null or target_sport not in ('Fútbol', 'Otras actividades') then
    raise exception 'Selecciona un deporte válido';
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
    target_court_id,
    v_customer_id,
    target_team_id,
    target_sport,
    target_starts_at,
    target_starts_at + make_interval(mins => duration_minutes),
    'pending',
    round(v_court.hourly_rate * duration_minutes / 60 * (100 - v_discount) / 100, 2),
    nullif(trim(target_notes), ''),
    v_promotion_id,
    v_discount
  ) returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.create_reservation(uuid, timestamptz, integer, text, uuid, uuid, text)
  from public, anon;
grant execute on function public.create_reservation(uuid, timestamptz, integer, text, uuid, uuid, text)
  to authenticated;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  actor_role public.app_role,
  event_type text not null check (event_type in (
    'reservation_created', 'reservation_cancelled', 'payment_recorded',
    'payment_refunded', 'maintenance_started'
  )),
  description text not null,
  target_id uuid,
  occurred_at timestamptz not null default now()
);

create index activity_logs_occurred_at_idx on public.activity_logs(occurred_at desc);
alter table public.activity_logs enable row level security;
grant select on public.activity_logs to authenticated;
create policy activity_logs_owner_read on public.activity_logs
for select to authenticated
using ((select public.current_app_role()) = 'owner'::public.app_role);

create function public.log_reservation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role public.app_role;
  v_customer_name text;
  v_court_name text;
begin
  select p.full_name, p.role into v_actor_name, v_actor_role
  from public.profiles p where p.id = auth.uid();
  select c.full_name into v_customer_name from public.customers c where c.id = new.customer_id;
  select c.name into v_court_name from public.courts c where c.id = new.court_id;

  if tg_op = 'INSERT' then
    insert into public.activity_logs(actor_id, actor_name, actor_role, event_type, description, target_id)
    values (auth.uid(), coalesce(v_actor_name, 'Sistema'), v_actor_role, 'reservation_created',
      format('Creó una reserva para %s en %s', coalesce(v_customer_name, 'un cliente'), coalesce(v_court_name, 'una cancha')), new.id);
  elsif old.status is distinct from new.status and new.status = 'cancelled' then
    insert into public.activity_logs(actor_id, actor_name, actor_role, event_type, description, target_id)
    values (auth.uid(), coalesce(v_actor_name, 'Sistema'), v_actor_role, 'reservation_cancelled',
      format('Canceló la reserva de %s en %s', coalesce(v_customer_name, 'un cliente'), coalesce(v_court_name, 'una cancha')), new.id);
  end if;
  return new;
end;
$$;

create trigger reservations_activity_insert
after insert on public.reservations
for each row execute function public.log_reservation_activity();

create trigger reservations_activity_cancel
after update of status on public.reservations
for each row execute function public.log_reservation_activity();

create function public.log_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role public.app_role;
begin
  select p.full_name, p.role into v_actor_name, v_actor_role
  from public.profiles p where p.id = auth.uid();
  if tg_op = 'INSERT' then
    insert into public.activity_logs(actor_id, actor_name, actor_role, event_type, description, target_id)
    values (auth.uid(), coalesce(v_actor_name, 'Sistema'), v_actor_role, 'payment_recorded',
      format('Registró un pago de %s', new.amount), new.id);
  elsif old.status is distinct from new.status and new.status = 'refunded' then
    insert into public.activity_logs(actor_id, actor_name, actor_role, event_type, description, target_id)
    values (auth.uid(), coalesce(v_actor_name, 'Sistema'), v_actor_role, 'payment_refunded',
      format('Reembolsó un pago de %s', new.amount), new.id);
  end if;
  return new;
end;
$$;

create trigger payments_activity_insert
after insert on public.payments
for each row execute function public.log_payment_activity();

create trigger payments_activity_refund
after update of status on public.payments
for each row execute function public.log_payment_activity();

create function public.log_maintenance_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role public.app_role;
  v_court_name text;
begin
  if old.status is distinct from new.status and new.status = 'in_progress' then
    select p.full_name, p.role into v_actor_name, v_actor_role
    from public.profiles p where p.id = auth.uid();
    select c.name into v_court_name from public.courts c where c.id = new.court_id;
    if v_actor_role = 'maintenance' then
      insert into public.activity_logs(actor_id, actor_name, actor_role, event_type, description, target_id)
      values (auth.uid(), coalesce(v_actor_name, 'Sistema'), v_actor_role, 'maintenance_started',
        format('Inició mantenimiento “%s” en %s', new.title, coalesce(v_court_name, 'una cancha')), new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger maintenance_activity_started
after update of status on public.maintenance_periods
for each row execute function public.log_maintenance_activity();

revoke all on function public.log_reservation_activity() from public, anon, authenticated;
revoke all on function public.log_payment_activity() from public, anon, authenticated;
revoke all on function public.log_maintenance_activity() from public, anon, authenticated;
