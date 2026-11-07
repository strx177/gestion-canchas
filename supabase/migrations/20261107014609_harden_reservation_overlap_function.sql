create or replace function public.prevent_overlapping_reservations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'cancelled' and exists (
    select 1
    from public.reservations r
    where r.court_id = new.court_id
      and r.status <> 'cancelled'
      and r.id <> new.id
      and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'La cancha ya está reservada en ese horario';
  end if;
  return new;
end;
$$;
