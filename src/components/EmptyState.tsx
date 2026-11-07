import { Icon } from './Icon';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span><Icon name="search" size={20} /></span>
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}
