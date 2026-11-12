drop trigger if exists courts_delete_guard on public.courts;
drop function if exists public.guard_court_delete_with_message();

alter table public.reservations
  drop constraint reservations_court_id_fkey,
  add constraint reservations_court_id_fkey
    foreign key (court_id) references public.courts(id) on delete cascade;

alter table public.maintenance_periods
  drop constraint maintenance_periods_court_id_fkey,
  add constraint maintenance_periods_court_id_fkey
    foreign key (court_id) references public.courts(id) on delete cascade;

alter table public.payments
  alter column reservation_id drop not null,
  drop constraint payments_reservation_id_fkey,
  add constraint payments_reservation_id_fkey
    foreign key (reservation_id) references public.reservations(id) on delete set null;

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
  if new.reservation_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.reservation_id::text, 0));
  select r.total_amount into v_total
  from public.reservations r
  where r.id = new.reservation_id;

  if not found then
    raise exception 'La reserva asociada al pago ya no existe. Selecciona una reserva vigente.';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.reservation_id = new.reservation_id
    and p.status = 'paid'
    and p.id is distinct from new.id;

  if new.status = 'paid' and v_paid + new.amount > v_total then
    raise exception 'El monto supera el saldo restante de la reserva.';
  end if;
  return new;
end;
$$;
