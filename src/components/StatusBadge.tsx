interface StatusBadgeProps {
  status: string;
}

const statusLabels: Record<string, string> = {
  available: 'Disponible',
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
  maintenance: 'Mantenimiento',
  closed: 'Cerrada'
};

function getTone(status: string): string {
  if (status === 'available' || status === 'confirmed') return 'green';
  if (status === 'pending' || status === 'maintenance') return 'yellow';
  if (status === 'cancelled' || status === 'closed') return 'gray';
  return 'blue';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${getTone(status)}`}>
      <i />
      {statusLabels[status] ?? status}
    </span>
  );
}
