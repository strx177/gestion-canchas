# CanchaPro

Panel administrativo de gestión deportiva construido con React, TypeScript y Vite.

## Requisitos

- Node.js LTS y npm
- Un proyecto Supabase y una cuenta de usuario para acceder a la aplicación

## Desarrollo local

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` como `.env.local`.
3. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con la URL del proyecto y su clave pública `anon`.
4. Aplica, en orden, todas las migraciones de `supabase/migrations/` en tu proyecto Supabase. En instalaciones nuevas, no ejecutes `supabase/schema.sql` además de las migraciones. `supabase/schema.sql` es solo la referencia del esquema inicial; las migraciones son la fuente de verdad actual.
5. Inicia Vite con `npm run dev`.

No uses la clave `service_role` en variables `VITE_*` ni en el navegador. Configura únicamente la clave pública `anon`. No publiques el panel con datos operativos hasta aplicar y verificar las migraciones de autenticación y RLS.

## Despliegue de demostración en Vercel

1. Importa el repositorio en Vercel y conserva los valores detectados para Vite: comando de compilación `npm run build` y directorio de salida `dist`.
2. En **Settings → Environment Variables**, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para los entornos `Production`, `Preview` y/o `Development` que vayas a utilizar. Usa solo la clave pública `anon`/publishable; nunca agregues `service_role`, contraseñas ni secretos de administración al prefijo `VITE_`.
3. En **Supabase → Authentication → URL Configuration**, configura la URL de producción como `Site URL` y agrega a `Redirect URLs` las URL locales y de Vercel utilizadas para confirmación y recuperación de contraseña (incluidos los dominios Preview necesarios).
4. `vercel.json` redirige las rutas de React Router al punto de entrada SPA para que las recargas directas de rutas como `/portal` o `/reset-password` funcionen.
5. Después de cambiar variables de entorno, vuelve a desplegar. El mismo código utiliza los valores del entorno local o de Vercel sin cambios manuales en los fuentes.

Las variables `VITE_*` se incorporan al bundle del navegador y no son secretas. La URL y la clave pública de Supabase son configuración cliente; proteger los datos depende de RLS y de no exponer credenciales privilegiadas. `.env.local` está excluido de Git.

## Comandos

- `npm run dev`: inicia el servidor local.
- `npm run typecheck`: verifica los tipos TypeScript.
- `npm run build`: verifica TypeScript y genera la aplicación en `dist/`.
- `npm run preview`: sirve localmente la compilación.

## Autenticación y roles

- El registro público crea únicamente cuentas con rol `customer`; el rol no se acepta desde metadata del navegador.
- Configura en Supabase Auth la URL local (`http://localhost:5173/**`) y la URL de producción permitida para confirmación y recuperación de contraseña.
- Después de crear y confirmar tu cuenta, asigna el rol inicial `owner` una sola vez desde el SQL Editor de Supabase, sustituyendo el correo por el de esa cuenta:

  ```sql
  update public.profiles p
  set role = 'owner', customer_id = null, updated_at = now()
  from auth.users u
  where p.id = u.id and u.email = 'tu-correo@ejemplo.com';
  ```

- Desde entonces, un dueño puede cambiar roles en **Usuarios y permisos**. La cuenta actual no puede cambiar su propio rol.
- RLS restringe los registros de clientes a personal autorizado y a cada cliente; las canchas tienen lectura pública. La interfaz también protege las rutas, pero la autorización efectiva está en Supabase.

## Etapa de demostración

La aplicación consulta canchas, horarios, clientes, equipos, reservas, pagos, mantenimiento, torneos, partidos, notificaciones y perfiles desde Supabase. El deporte se registra por reserva. Las promociones del dueño pueden aplicar descuentos automáticamente a reservas que coincidan con su fecha, canchas y bloques horarios; si coinciden varias, se aplica solo la de mayor descuento. La base de datos valida disponibilidad y bloquea conflictos entre reservas, partidos y mantenimiento. Los usuarios autenticados solo reciben los registros permitidos por su rol y las políticas RLS.

El portal permite al cliente solicitar reservas y consultar o cancelar sus solicitudes pendientes. Las notificaciones son internas a la aplicación (no se envían correos ni SMS). Ingresos y ocupación presenta pagos registrados, reservas activas, demanda horaria y una estimación de ocupación basada en los horarios semanales configurados. El registro de actividad incluye creación y cancelación de reservas, pagos y comienzos de mantenimiento.

La gestión de canchas está disponible desde la navegación para los roles autorizados y permite registrar, editar y configurar la disponibilidad semanal por bloques de 30 minutos, desde las 08:00 hasta las 21:00. Reservas, mantenimiento, partidos y promociones respetan esa misma cuadrícula horaria. Las pantallas identificadas como pendientes muestran ese estado explícitamente y no simulan operaciones.
