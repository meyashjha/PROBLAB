import { FC } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { Parlay } from '@parlay-tokens/shared';

interface ParlayCardProps {
  parlay: Parlay;
}

export const ParlayCard: FC<ParlayCardProps> = ({ parlay }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-pill status-pill--violet';
      case 'won':
        return 'status-pill status-pill--lime';
      case 'lost':
        return 'status-pill status-pill--danger';
      case 'claimed':
        return 'status-pill status-pill--gold';
      case 'pending_payment':
        return 'status-pill status-pill--gold';
      case 'expired':
        return 'status-pill status-pill--chrome';
      default:
        return 'status-pill status-pill--chrome';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'Pending Payment';
      case 'claimed':
        return 'Won & Claimed';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <Link
      to={`/parlay/${parlay._id}`}
      className="card artifact-panel--interactive block p-6 transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-semibold text-[var(--text-strong)]">
            {parlay.events.length} Events
          </h3>
          <p className="text-sm muted-copy">
            {format(new Date(parlay.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
        <span className={getStatusColor(parlay.status)}>
          {getStatusLabel(parlay.status)}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {parlay.quoteData?.offeredOdds && (
          <div className="flex justify-between text-sm">
            <span className="muted-copy">Odds:</span>
            <span className="font-bold text-[var(--text-strong)]">
              {parlay.quoteData.offeredOdds.toFixed(2)}x
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="muted-copy">Principal:</span>
          <span className="font-bold text-[var(--text-strong)]">{parlay.principalAmount} SOL</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="muted-copy">Potential Payout:</span>
          <span className="font-bold accent-lime">{parlay.potentialPayout.toFixed(4)} SOL</span>
        </div>
        {(parlay.status === 'won' || parlay.status === 'claimed') && (
          <div className="flex justify-between text-sm">
            <span className="muted-copy">Profit:</span>
            <span className="font-bold accent-lime">
              +{(parlay.potentialPayout - parlay.principalAmount).toFixed(4)} SOL
            </span>
          </div>
        )}
      </div>

      <div className="divider-line mb-4" />
      <div className="pt-0">
        <p className="text-xs dim-copy">
          Final Settlement: {format(new Date(parlay.finalSettlementDate), 'MMM d, yyyy')}
        </p>
      </div>
    </Link>
  );
};
