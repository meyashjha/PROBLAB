import { FC } from 'react';
import type { EventStatus } from '@parlay-tokens/shared';

interface EventStatusBadgeProps {
  status: EventStatus;
}

export const EventStatusBadge: FC<EventStatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case 'active':
        return 'status-pill status-pill--violet';
      case 'won':
        return 'status-pill status-pill--lime';
      case 'lost':
        return 'status-pill status-pill--danger';
      case 'cancelled':
        return 'status-pill status-pill--chrome';
      default:
        return 'status-pill status-pill--chrome';
    }
  };

  const getStatusIcon = (status: EventStatus) => {
    switch (status) {
      case 'won':
        return '✓';
      case 'lost':
        return '✗';
      case 'active':
        return '⏳';
      case 'cancelled':
        return '⊘';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: EventStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <span className={getStatusColor(status)} role="status" aria-label={`Status: ${getStatusLabel(status)}`}>
      <span aria-hidden="true">{getStatusIcon(status)}</span> {getStatusLabel(status)}
    </span>
  );
};
