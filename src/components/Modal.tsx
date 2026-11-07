import type { FormEvent, PropsWithChildren } from 'react';

interface ModalProps extends PropsWithChildren {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
}

export function Modal({ title, onClose, onSubmit, submitting = false, children }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <form className="modal-form" onSubmit={onSubmit}>
          {children}
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={submitting} onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
