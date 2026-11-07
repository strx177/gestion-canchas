do $$
begin
  create type public.app_role as enum ('owner', 'receptionist', 'customer', 'maintenance', 'referee');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'customer',
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_customer_id_uidx
  on public.profiles(customer_id)
  where customer_id is not null;
create index if not exists teams_customer_id_idx on public.teams(customer_id);
create index if not exists reservations_customer_id_idx on public.reservations(customer_id);
create index if not exists reservations_team_id_idx on public.reservations(team_id);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.customer_id
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_customer_id() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_customer_id() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_customer_id uuid;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Cliente'
  );

  insert into public.customers (full_name, email)
  values (v_full_name, new.email)
  returning id into v_customer_id;

  insert into public.profiles (id, full_name, role, customer_id)
  values (new.id, v_full_name, 'customer', v_customer_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

do $$
declare
  v_user auth.users%rowtype;
  v_full_name text;
  v_customer_id uuid;
begin
  for v_user in
    select u.*
    from auth.users u
    where not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  loop
    v_full_name := coalesce(
      nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(v_user.email, ''), '@', 1), ''),
      'Cliente'
    );

    insert into public.customers (full_name, email)
    values (v_full_name, v_user.email)
    returning id into v_customer_id;

    insert into public.profiles (id, full_name, role, customer_id)
    values (v_user.id, v_full_name, 'customer', v_customer_id)
    on conflict (id) do nothing;
  end loop;
end;
$$;

create or replace function public.set_app_user_role(
  target_user_id uuid,
  new_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text;
  v_customer_id uuid;
begin
  if (select public.current_app_role()) is distinct from 'owner'::public.app_role then
    raise exception 'Solo el dueño puede asignar roles'
      using errcode = '42501';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'No puedes cambiar tu propio rol'
      using errcode = '42501';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    raise exception 'No existe un perfil para ese usuario';
  end if;

  v_customer_id := v_profile.customer_id;

  if new_role = 'customer'::public.app_role and v_customer_id is null then
    select u.email
    into v_email
    from auth.users u
    where u.id = target_user_id;

    insert into public.customers (full_name, email)
    values (v_profile.full_name, v_email)
    returning id into v_customer_id;
  end if;

  update public.profiles
  set role = new_role,
      customer_id = v_customer_id,
      updated_at = now()
  where id = target_user_id;
end;
$$;

revoke all on function public.set_app_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_app_user_role(uuid, public.app_role) to authenticated;

create or replace function public.guard_customer_reservation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_app_role()) = 'customer'::public.app_role
     and (
       old.status <> 'pending'
       or new.status <> 'cancelled'
       or new.id is distinct from old.id
       or new.court_id is distinct from old.court_id
       or new.customer_id is distinct from old.customer_id
       or new.team_id is distinct from old.team_id
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.total_amount is distinct from old.total_amount
       or new.notes is distinct from old.notes
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'Los clientes solo pueden cancelar sus propias reservas pendientes'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_customer_reservation_update() from public, anon, authenticated;

drop trigger if exists reservations_customer_update_guard on public.reservations;
create trigger reservations_customer_update_guard
before update on public.reservations
for each row execute function public.guard_customer_reservation_update();

alter table public.profiles enable row level security;
alter table public.courts enable row level security;
alter table public.customers enable row level security;
alter table public.teams enable row level security;
alter table public.reservations enable row level security;

revoke all on public.profiles, public.courts, public.customers, public.teams, public.reservations from public, anon, authenticated;

grant select on public.courts to anon, authenticated;
grant select, insert, update, delete on public.customers, public.teams, public.reservations to authenticated;
grant select on public.profiles to authenticated;

drop policy if exists profiles_read_self_or_owner on public.profiles;
create policy profiles_read_self_or_owner
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.current_app_role()) = 'owner'::public.app_role
);

drop policy if exists courts_read_public on public.courts;
create policy courts_read_public
on public.courts
for select
to anon, authenticated
using (true);

drop policy if exists courts_manage_staff on public.courts;
create policy courts_manage_staff
on public.courts
for all
to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists customers_read_authorized on public.customers;
create policy customers_read_authorized
on public.customers
for select
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or id = (select public.current_customer_id())
);

drop policy if exists customers_insert_staff on public.customers;
create policy customers_insert_staff
on public.customers
for insert
to authenticated
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists customers_update_staff_or_self on public.customers;
create policy customers_update_staff_or_self
on public.customers
for update
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or id = (select public.current_customer_id())
)
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or id = (select public.current_customer_id())
);

drop policy if exists customers_delete_staff on public.customers;
create policy customers_delete_staff
on public.customers
for delete
to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists teams_read_authorized on public.teams;
create policy teams_read_authorized
on public.teams
for select
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or customer_id = (select public.current_customer_id())
);

drop policy if exists teams_insert_authorized on public.teams;
create policy teams_insert_authorized
on public.teams
for insert
to authenticated
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or (
    (select public.current_app_role()) = 'customer'::public.app_role
    and customer_id = (select public.current_customer_id())
  )
);

drop policy if exists teams_update_authorized on public.teams;
create policy teams_update_authorized
on public.teams
for update
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or customer_id = (select public.current_customer_id())
)
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or customer_id = (select public.current_customer_id())
);

drop policy if exists teams_delete_authorized on public.teams;
create policy teams_delete_authorized
on public.teams
for delete
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or customer_id = (select public.current_customer_id())
);

drop policy if exists reservations_read_authorized on public.reservations;
create policy reservations_read_authorized
on public.reservations
for select
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or customer_id = (select public.current_customer_id())
);

drop policy if exists reservations_insert_authorized on public.reservations;
create policy reservations_insert_authorized
on public.reservations
for insert
to authenticated
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or (
    (select public.current_app_role()) = 'customer'::public.app_role
    and customer_id = (select public.current_customer_id())
    and status = 'pending'
    and total_amount = 0
    and (
      team_id is null
      or exists (
        select 1
        from public.teams t
        where t.id = team_id
          and t.customer_id = (select public.current_customer_id())
      )
    )
  )
);

drop policy if exists reservations_update_staff on public.reservations;
create policy reservations_update_staff
on public.reservations
for update
to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role))
with check ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));

drop policy if exists reservations_cancel_own_pending on public.reservations;
create policy reservations_cancel_own_pending
on public.reservations
for update
to authenticated
using (
  (select public.current_app_role()) = 'customer'::public.app_role
  and customer_id = (select public.current_customer_id())
  and status = 'pending'
)
with check (
  (select public.current_app_role()) = 'customer'::public.app_role
  and customer_id = (select public.current_customer_id())
  and status = 'cancelled'
);

drop policy if exists reservations_delete_staff on public.reservations;
create policy reservations_delete_staff
on public.reservations
for delete
to authenticated
using ((select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role));
