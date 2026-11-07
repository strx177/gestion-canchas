import { useCallback, useEffect, useState } from 'react';
import type { AppRole, Profile } from '../../types/database';
import { useAuth } from '../../app/AuthProvider';
import { supabase, supabaseConfigurationError } from '../../lib/supabase';
import { DataState } from '../../components/DataState';
import { AuthNotice } from '../../components/AuthNotice';

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'owner', label: 'Dueño' },
  { value: 'receptionist', label: 'Recepción' },
  { value: 'customer', label: 'Cliente' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'referee', label: 'Árbitro' }
];

export function UserManagementPage() {
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!supabase) {
      setError(supabaseConfigurationError ?? 'Supabase no está configurado.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (queryError) throw new Error(queryError.message);
      setProfiles(data);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'No se pudieron cargar los perfiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const changeRole = async (target: Profile, role: AppRole) => {
    if (!supabase || target.id === currentProfile?.id) return;
    setSavingUserId(target.id);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await supabase.rpc('set_app_user_role', {
        target_user_id: target.id,
        new_role: role
      });
      if (updateError) throw new Error(updateError.message);
      setNotice(`Permisos actualizados para ${target.full_name}.`);
      await loadProfiles();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudieron actualizar los permisos.');
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <DataState loading={loading} error={error} onRetry={() => void loadProfiles()}>
      <section>
        <div className="page-intro">
          <div>
            <p className="eyebrow">ADMINISTRACIÓN</p>
            <h2>Usuarios y permisos</h2>
            <p>El rol se valida en Supabase y controla el acceso a los datos mediante RLS.</p>
          </div>
        </div>
        <AuthNotice message={notice} />
        <section className="panel data-panel">
          <div className="panel-heading"><div><h2>Perfiles registrados</h2><p>La cuenta actual no puede cambiar su propio rol.</p></div></div>
          {profiles.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>USUARIO</th><th>ROL ACTUAL</th><th>PERMISOS</th></tr></thead>
                <tbody>
                  {profiles.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.full_name}</strong><small title={item.id}>{item.id}</small></td>
                      <td>{roleOptions.find((option) => option.value === item.role)?.label ?? item.role}</td>
                      <td>
                        <select
                          aria-label={`Cambiar rol de ${item.full_name}`}
                          value={item.role}
                          disabled={item.id === currentProfile?.id || savingUserId === item.id}
                          onChange={(event) => {
                            const nextRole = roleOptions.find((option) => option.value === event.target.value)?.value;
                            if (nextRole) void changeRole(item, nextRole);
                          }}
                        >
                          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        {savingUserId === item.id && <small>Guardando…</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-state">No hay perfiles para mostrar.</p>}
        </section>
      </section>
    </DataState>
  );
}
