create or replace function public.current_app_role()
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = (select auth.uid());

  if v_role is null then
    raise exception 'La cuenta no tiene un perfil habilitado'
      using errcode = '42501';
  end if;

  return v_role;
end;
$$;
