import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { loadFacilityData } from '../services/facilityService';
import type { FacilityData } from '../types/database';
import { supabase, supabaseConfigurationError } from '../lib/supabase';

interface FacilityContextValue extends FacilityData {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const emptyData: FacilityData = {
  courts: [],
  customers: [],
  teams: [],
  reservations: []
};

const FacilityContext = createContext<FacilityContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado al consultar Supabase.';
}

export function FacilityProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<FacilityData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!supabase) {
      setData(emptyData);
      setError(supabaseConfigurationError ?? 'El cliente de Supabase no está disponible.');
      setLoading(false);
      return;
    }

    try {
      const nextData = await loadFacilityData(supabase);
      setData(nextData);
    } catch (loadError) {
      setData(emptyData);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ ...data, loading, error, refresh }),
    [data, loading, error, refresh]
  );

  return <FacilityContext.Provider value={value}>{children}</FacilityContext.Provider>;
}

export function useFacilityData(): FacilityContextValue {
  const context = useContext(FacilityContext);
  if (!context) throw new Error('useFacilityData debe utilizarse dentro de FacilityProvider.');
  return context;
}

export function useOptionalFacilityData(): FacilityContextValue | null {
  return useContext(FacilityContext);
}
