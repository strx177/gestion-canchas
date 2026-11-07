import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigurationError } from '../lib/supabase';
import type { AppRole, Profile } from '../types/database';
import {
  requestPasswordReset,
  signInWithPassword,
  signUpCustomer,
  updatePassword
} from '../services/authService';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveNewPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado durante la autenticación.';
}

export function getHomeRoute(role: AppRole): string {
  if (role === 'customer') return '/portal';
  if (role === 'maintenance') return '/maintenance';
  if (role === 'referee') return '/matches';
  return '/';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const profileRequestId = useRef(0);

  useEffect(() => {
    if (!supabase) {
      setError(supabaseConfigurationError ?? 'El cliente de Supabase no está disponible.');
      setSessionLoading(false);
      return;
    }

    let active = true;
    let receivedAuthEvent = false;
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      const userChanged = activeUserId.current !== nextUserId;
      activeUserId.current = nextUserId;
      setSession(nextSession);
      if (userChanged) {
        profileRequestId.current += 1;
        setProfile(null);
        setError(null);
        setProfileLoading(Boolean(nextUserId));
      }
      setSessionLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (!receivedAuthEvent) {
        if (sessionError) setError(sessionError.message);
        applySession(data.session);
      }
    }).catch((sessionError: unknown) => {
      if (!active || receivedAuthEvent) return;
      setError(getErrorMessage(sessionError));
      setSessionLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    const requestId = ++profileRequestId.current;
    if (!userId || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setError(null);
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileRequestId.current !== requestId) return;
      if (profileError) throw new Error(profileError.message);
      if (!data) {
        throw new Error('Tu cuenta no tiene un perfil de CanchaPro. Pide al dueño que revise el alta en Supabase.');
      }
      setProfile(data);
    } catch (profileError) {
      if (profileRequestId.current !== requestId) return;
      setProfile(null);
      setError(getErrorMessage(profileError));
    } finally {
      if (profileRequestId.current === requestId) setProfileLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const runAuthAction = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (authError) {
      const message = getErrorMessage(authError);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signIn = useCallback((email: string, password: string) =>
    runAuthAction(() => signInWithPassword(email, password)), [runAuthAction]);

  const signUp = useCallback((fullName: string, email: string, password: string) =>
    runAuthAction(() => signUpCustomer(fullName, email, password)), [runAuthAction]);

  const resetPassword = useCallback((email: string) =>
    runAuthAction(() => requestPasswordReset(email)), [runAuthAction]);

  const saveNewPassword = useCallback((password: string) =>
    runAuthAction(() => updatePassword(password)), [runAuthAction]);

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase no está configurado.');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error(signOutError.message);
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    loading: sessionLoading || profileLoading,
    error,
    configurationError: supabaseConfigurationError,
    signIn,
    signUp,
    resetPassword,
    saveNewPassword,
    signOut,
    refreshProfile
  }), [
    session, profile, sessionLoading, profileLoading, error,
    signIn, signUp, resetPassword, saveNewPassword, signOut, refreshProfile
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
