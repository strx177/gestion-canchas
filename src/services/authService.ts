import { supabase, supabaseConfigurationError } from '../lib/supabase';

function getClient() {
  if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase no está configurado.');
  return supabase;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUpCustomer(fullName: string, email: string, password: string): Promise<void> {
  const { data, error } = await getClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: `${window.location.origin}/login`
    }
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Supabase no devolvió el usuario creado.');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  const { data: { session }, error: sessionError } = await getClient().auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.');

  const { error } = await getClient().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
