create extension if not exists "uuid-ossp";

create table if not exists courts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sport text not null,
  status text not null default 'available' check (status in ('available', 'maintenance', 'closed')),
  hourly_rate numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  customer_id uuid references customers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default uuid_generate_v4(),
  court_id uuid not null references courts(id),
  customer_id uuid not null references customers(id),
  team_id uuid references teams(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint reservation_valid_range check (ends_at > starts_at)
);

create index if not exists reservations_court_time_idx on reservations(court_id, starts_at, ends_at);

create or replace function prevent_overlapping_reservations()
returns trigger language plpgsql as $$
begin
  if new.status <> 'cancelled' and exists (
    select 1 from reservations r
    where r.court_id = new.court_id
      and r.status <> 'cancelled'
      and r.id <> coalesce(new.id, uuid_nil())
      and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'La cancha ya está reservada en ese horario';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_no_overlap on reservations;
create trigger reservations_no_overlap
before insert or update on reservations
for each row execute function prevent_overlapping_reservations();
