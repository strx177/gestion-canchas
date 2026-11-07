import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface DataStateProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}

export function DataState({ loading, error, onRetry, children }: DataStateProps) {
  if (loading) {
    return <div className="data-state" role="status">Conectando con Supabase y cargando datos…</div>;
  }

  if (error) {
    return (
      <section className="data-state data-state-error" role="alert">
        <strong>No se pudieron cargar los datos</strong>
        <p>{error}</p>
        <button className="secondary-button" onClick={onRetry}><Icon name="refresh" size={16} />Reintentar</button>
      </section>
    );
  }

  return children;
}
