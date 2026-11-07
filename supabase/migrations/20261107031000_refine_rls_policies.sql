drop policy if exists courts_manage_staff on public.courts;
drop policy if exists courts_insert_staff on public.courts;
drop policy if exists courts_update_staff on public.courts;
drop policy if exists courts_delete_staff on public.courts;

grant insert, update, delete on public.courts to authenticated;

create policy courts_insert_staff
on public.courts
for insert
to authenticated
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
);

create policy courts_update_staff
on public.courts
for update
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
)
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
);

create policy courts_delete_staff
on public.courts
for delete
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
);

drop policy if exists reservations_update_staff on public.reservations;
drop policy if exists reservations_cancel_own_pending on public.reservations;

create policy reservations_update_authorized
on public.reservations
for update
to authenticated
using (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or (
    (select public.current_app_role()) = 'customer'::public.app_role
    and customer_id = (select public.current_customer_id())
    and status = 'pending'
  )
)
with check (
  (select public.current_app_role()) in ('owner'::public.app_role, 'receptionist'::public.app_role)
  or (
    (select public.current_app_role()) = 'customer'::public.app_role
    and customer_id = (select public.current_customer_id())
    and status = 'cancelled'
  )
);
