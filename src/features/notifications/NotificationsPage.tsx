import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { DataState } from '../../components/DataState';
import { EmptyState } from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { formatDate, formatTime } from '../../utils/format';

type Notification = Database['public']['Tables']['notifications']['Row'];

export function NotificationsPage() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!supabase || !session) { setError('Se requiere una sesión para consultar notificaciones.'); setLoading(false); return; }
    setLoading(true); setError(null);
    const result = await supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (result.error) setError(result.error.message); else setNotifications(result.data);
    setLoading(false);
  }, [session]);
  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: Notification) => {
    if (!supabase || item.read_at) return;
    const result = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
    if (result.error) setError(result.error.message); else await load();
  };

  return <DataState loading={loading} error={error} onRetry={() => void load()}>
    <section className="module-page">
      <div className="module-heading"><div><h2>Notificaciones</h2><p>Avisos de reservas y pagos asociados a tu cuenta.</p></div></div>
      {notifications.length ? <section className="panel data-panel">
        <div className="notification-list">{notifications.map((item) => <article className={`notification-row ${item.read_at ? '' : 'notification-unread'}`} key={item.id}>
          <span className="notification-dot" aria-hidden="true" />
          <div className="generic-copy"><strong>{item.title}</strong><p>{item.body}</p><small>{formatDate(item.created_at)} · {formatTime(item.created_at)}</small></div>
          {!item.read_at && <button className="secondary-button" onClick={() => void markRead(item)}>Marcar leída</button>}
        </article>)}</div>
      </section> : <section className="panel"><EmptyState title="No hay notificaciones" description="Los avisos de actividad de tu cuenta aparecerán aquí." /></section>}
    </section>
  </DataState>;
}
