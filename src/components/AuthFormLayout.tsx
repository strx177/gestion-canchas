import type { PropsWithChildren } from 'react';
import { Icon } from './Icon';

interface AuthFormLayoutProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function AuthFormLayout({ title, subtitle, children }: AuthFormLayoutProps) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="court" size={23} /></span>
          <strong>Cancha<span>Pro</span></strong>
        </div>
        <div className="auth-brand-copy">
          <p>GESTIÓN DEPORTIVA</p>
          <h1>Tu complejo,<br />siempre en juego.</h1>
          <span>Reservas, canchas y gestión deportiva en un solo lugar.</span>
        </div>
        <div className="auth-brand-foot"><Icon name="check" size={18} />Acceso seguro con Supabase Auth</div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-card">
          <p className="eyebrow">CANCHAPRO</p>
          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
