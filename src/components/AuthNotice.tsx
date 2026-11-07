interface AuthNoticeProps {
  error?: string | null;
  message?: string | null;
}

export function AuthNotice({ error, message }: AuthNoticeProps) {
  if (error) return <p className="auth-notice auth-notice-error" role="alert">{error}</p>;
  if (message) return <p className="auth-notice auth-notice-success" role="status">{message}</p>;
  return null;
}
