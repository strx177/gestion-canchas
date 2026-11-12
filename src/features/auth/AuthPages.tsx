import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { getHomeRoute, useAuth } from "../../app/AuthProvider";
import { ROUTES } from "../../app/routes";
import { AuthFormLayout } from "../../components/AuthFormLayout";
import { AuthNotice } from "../../components/AuthNotice";
import type { AppRole } from "../../types/database";

function AuthLoading() {
  return (
    <div className="auth-loading" role="status">
      Comprobando sesión…
    </div>
  );
}

export function PublicOnlyRoute() {
  const { loading, session, profile, error } = useAuth();
  if (loading) return <AuthLoading />;
  if (session && profile)
    return <Navigate to={getHomeRoute(profile.role)} replace />;
  if (session && error) return <AuthProblem />;
  return <Outlet />;
}

export function RequireAuth() {
  const { loading, session, profile, error, refreshProfile, signOut } =
    useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to={ROUTES.login} replace />;
  if (error || !profile) {
    return (
      <AuthProblem
        error={error ?? "No se encontró el perfil asociado a esta cuenta."}
        onRetry={() => void refreshProfile()}
        onSignOut={() =>
          void signOut().catch((signOutFailure: unknown) => {
            setSignOutError(
              signOutFailure instanceof Error
                ? signOutFailure.message
                : "No se pudo cerrar la sesión.",
            );
          })
        }
        signOutError={signOutError}
      />
    );
  }
  return <Outlet />;
}

export function RequireRoles({ allowed }: { allowed: readonly AppRole[] }) {
  const { profile } = useAuth();
  if (!profile || !allowed.includes(profile.role)) {
    return (
      <Navigate
        to={profile ? getHomeRoute(profile.role) : ROUTES.login}
        replace
      />
    );
  }
  return <Outlet />;
}

export function AuthenticatedRedirect() {
  const { loading, profile } = useAuth();
  if (loading) return <AuthLoading />;
  if (!profile) return <Navigate to={ROUTES.login} replace />;
  return <Navigate to={getHomeRoute(profile.role)} replace />;
}

export function LoginPage() {
  const { signIn, configurationError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(configurationError);
  const [message, setMessage] = useState<string | null>(
    location.state?.message ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await signIn(String(form.get("email")), String(form.get("password")));
      setMessage("Inicio de sesión correcto. Cargando tu perfil…");
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title="Bienvenido de vuelta"
      subtitle="Ingresa tus credenciales para acceder al sistema."
    >
      <form className="auth-form" onSubmit={submit}>
        <AuthNotice error={error} message={message} />
        <label className="auth-field">
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="auth-field">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <div className="auth-form-options">
          <span>Acceso con cuenta Supabase</span>
          <Link to={ROUTES.forgotPassword}>¿Olvidaste tu contraseña?</Link>
        </div>
        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={submitting || Boolean(configurationError)}
        >
          {submitting ? "Ingresando…" : "Iniciar sesión"}
        </button>
        <p className="auth-bottom-link">
          ¿No tienes cuenta? <Link to={ROUTES.register}>Regístrate</Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}

export function RegisterPage() {
  const { signUp, configurationError } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(configurationError);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("passwordConfirmation"))) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(
        String(form.get("fullName")),
        String(form.get("email")),
        password,
      );
      setMessage(
        "Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.",
      );
      window.setTimeout(
        () =>
          navigate(ROUTES.login, {
            replace: true,
            state: { message: "Confirma tu correo para activar el acceso." },
          }),
        900,
      );
    } catch (signUpError) {
      setError(
        signUpError instanceof Error
          ? signUpError.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title="Crear cuenta"
      subtitle="Regístrate como cliente para consultar tus reservas."
    >
      <form className="auth-form" onSubmit={submit}>
        <AuthNotice error={error} message={message} />
        <label className="auth-field">
          Nombre completo
          <input
            name="fullName"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label className="auth-field">
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="auth-field">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="auth-field">
          Confirmar contraseña
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={submitting || Boolean(configurationError)}
        >
          {submitting ? "Creando cuenta…" : "Crear cuenta"}
        </button>
        <p className="auth-bottom-link">
          ¿Ya tienes cuenta? <Link to={ROUTES.login}>Inicia sesión</Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}

export function ForgotPasswordPage() {
  const { resetPassword, configurationError } = useAuth();
  const [error, setError] = useState<string | null>(configurationError);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await resetPassword(String(form.get("email")));
      setMessage(
        "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "No se pudo solicitar la recuperación.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace de recuperación si el correo está registrado."
    >
      <form className="auth-form" onSubmit={submit}>
        <AuthNotice error={error} message={message} />
        <label className="auth-field">
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={submitting || Boolean(configurationError)}
        >
          {submitting ? "Enviando…" : "Enviar enlace"}
        </button>
        <p className="auth-bottom-link">
          <Link to={ROUTES.login}>Volver al inicio de sesión</Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}

export function ResetPasswordPage() {
  const { saveNewPassword, configurationError, session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(configurationError);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !session && !configurationError) {
      setError(
        "El enlace de recuperación expiró o no es válido. Solicita uno nuevo.",
      );
    }
  }, [loading, session, configurationError]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("passwordConfirmation"))) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      await saveNewPassword(password);
      setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
      window.setTimeout(() => navigate(ROUTES.login, { replace: true }), 900);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "No se pudo actualizar la contraseña.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title="Nueva contraseña"
      subtitle="Elige una contraseña segura para tu cuenta."
    >
      <form className="auth-form" onSubmit={submit}>
        <AuthNotice error={error} message={message} />
        <label className="auth-field">
          Contraseña nueva
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="auth-field">
          Confirmar contraseña
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={
            submitting || loading || !session || Boolean(configurationError)
          }
        >
          {submitting ? "Actualizando…" : "Guardar contraseña"}
        </button>
        <p className="auth-bottom-link">
          <Link to={ROUTES.login}>Volver al inicio de sesión</Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}

function AuthProblem({
  error = "No se pudo cargar el perfil de usuario.",
  onRetry,
  onSignOut,
  signOutError,
}: {
  error?: string;
  onRetry?: () => void;
  onSignOut?: () => void;
  signOutError?: string | null;
}) {
  const { signOut: authSignOut } = useAuth();
  const [localSignOutError, setLocalSignOutError] = useState<string | null>(
    null,
  );
  const handleSignOut =
    onSignOut ??
    (() => {
      setLocalSignOutError(null);
      void authSignOut().catch((signOutFailure: unknown) => {
        setLocalSignOutError(
          signOutFailure instanceof Error
            ? signOutFailure.message
            : "No se pudo cerrar la sesión.",
        );
      });
    });
  return (
    <main className="auth-problem">
      <section>
        <p className="eyebrow">CANCHAPRO</p>
        <h1>No se pudo verificar tu perfil</h1>
        <p>{error}</p>
        <AuthNotice error={signOutError ?? localSignOutError} />
        <div className="auth-problem-actions">
          {onRetry && (
            <button className="secondary-button" onClick={onRetry}>
              Reintentar
            </button>
          )}
          <button className="primary-button" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  );
}
