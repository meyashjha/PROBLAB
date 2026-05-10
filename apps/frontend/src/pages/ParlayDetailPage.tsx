import { FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ApiService } from '../services/api.service';
import { EventStatusBadge } from '../components/EventStatusBadge';
import { parseOutcomeDescription } from '../utils/outcomeParser';
import type { Parlay } from '@parlay-tokens/shared';

export const ParlayDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();

  const [parlay, setParlay] = useState<Parlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [backendWallet, setBackendWallet] = useState<string>('');

  useEffect(() => {
    if (!connected) {
      navigate('/');
      return;
    }

    loadParlay();
    loadBackendWallet();
  }, [id, connected, navigate]);

  const loadParlay = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await ApiService.getParlayById(id);
      if (response.success && response.data) {
        setParlay(response.data);
      }
    } catch (error) {
      console.error('Error loading parlay:', error);
      toast.error('Failed to load parlay');
    } finally {
      setLoading(false);
    }
  };

  const loadBackendWallet = async () => {
    try {
      const response = await ApiService.getBackendWallet();
      if (response.success && response.data) {
        setBackendWallet(response.data.address);
      }
    } catch (error) {
      console.error('Error loading backend wallet:', error);
    }
  };

  const handlePayment = async () => {
    if (!publicKey || !parlay || !backendWallet) {
      toast.error('Missing required data');
      return;
    }

    try {
      setPaying(true);

      const lamports = Math.floor(parlay.principalAmount * LAMPORTS_PER_SOL);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(backendWallet),
          lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      toast.success('Payment sent! Confirming...');

      // Confirm payment with backend
      const response = await ApiService.confirmPayment(parlay._id!, signature);
      
      if (response.success) {
        toast.success('Payment confirmed! Parlay activated.');
        await loadParlay();
      } else {
        toast.error(response.error?.message || 'Failed to confirm payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !parlay) {
      toast.error('Missing required data');
      return;
    }

    try {
      setClaiming(true);

      const response = await ApiService.claimParlay({
        parlayId: parlay._id!,
        walletAddress: publicKey.toBase58(),
      });

      if (response.success) {
        toast.success('Payout claimed successfully!');
        await loadParlay();
      } else {
        toast.error(response.error?.message || 'Failed to claim payout');
      }
    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error(error.response?.data?.error?.message || 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="theme-page">
        <div className="page-shell loading-state">
          <div className="mx-auto spinner" />
          <p className="mt-4">Loading parlay...</p>
        </div>
      </div>
    );
  }

  if (!parlay) {
    return (
      <div className="theme-page">
        <div className="page-shell empty-state">
          <p>Parlay not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-page">
      <div className="page-shell">
        <div className="mb-8">
          <button onClick={() => navigate('/my-portfolio')} className="back-link block mb-6">
            ← Back to My Portfolio
          </button>
          <div className="eyebrow mb-4">
            <span className="eyebrow__dot" />
            Settlement Chamber
          </div>
          <h1 className="section-title">Parlay details</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Events */}
          <div className="artifact-panel">
            <h2 className="text-2xl font-semibold mb-4 text-[var(--text-strong)]">Events ({parlay.events.length})</h2>
            <div className="space-y-4">
              {parlay.events.map((event, index) => {
                const selectedDescription = parseOutcomeDescription(event.description, event.selectedOutcome, event.title);
                const actualDescription = event.actualOutcome 
                  ? parseOutcomeDescription(event.description, event.actualOutcome, event.title)
                  : null;

                return (
                  <div key={event.eventId} className="callout-panel">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-[var(--text-strong)]">#{index + 1}: {event.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://jup.ag/prediction/${event.eventId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary px-4 py-2 text-[10px]"
                        >
                          <span>View on Jupiter</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        <EventStatusBadge status={event.status} />
                      </div>
                    </div>
                    <p className="text-sm muted-copy mb-3 line-clamp-3">{event.description}</p>
                    
                    <div className="value-box space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-sm muted-copy min-w-[80px]">Your Pick:</span>
                        <span className="text-sm font-bold accent-violet">{selectedDescription}</span>
                      </div>
                      {actualDescription && (
                        <div className="flex items-start gap-2">
                          <span className="text-sm muted-copy min-w-[80px]">Actual:</span>
                          <span className={`text-sm font-bold ${
                            event.status === 'won' ? 'accent-lime' : 
                            event.status === 'lost' ? 'accent-gold' : 
                            'text-[var(--text-base)]'
                          }`}>
                            {actualDescription}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs dim-copy mt-3">
                      Settlement: {format(new Date(event.settlementDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="artifact-panel">
            <h2 className="text-xl font-bold mb-4 text-[var(--text-strong)]">Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="muted-copy">Status:</span>
                <span className="font-bold text-[var(--text-strong)] capitalize">{parlay.status.replace('_', ' ')}</span>
              </div>
              {parlay.quoteData?.offeredOdds && (
                <div className="flex justify-between">
                  <span className="muted-copy">Odds:</span>
                  <span className="font-bold text-[var(--text-strong)]">{parlay.quoteData.offeredOdds.toFixed(2)}x</span>
                </div>
              )}
              {parlay.multiplier && (
                <div className="flex justify-between">
                  <span className="muted-copy">Multiplier:</span>
                  <span className="font-bold text-[var(--text-strong)]">{parlay.multiplier}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="muted-copy">Principal:</span>
                <span className="font-bold text-[var(--text-strong)]">{parlay.principalAmount} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Potential Payout:</span>
                <span className="font-bold accent-lime">{parlay.potentialPayout.toFixed(4)} SOL</span>
              </div>
            </div>

            {/* Action Buttons */}
            {parlay.status === 'pending_payment' && (
              <button
                onClick={handlePayment}
                disabled={paying}
                className="btn btn-primary w-full mt-6"
              >
                {paying ? 'Processing...' : `Pay ${parlay.principalAmount} SOL`}
              </button>
            )}

            {parlay.status === 'won' && !parlay.claimedAt && (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="btn btn-primary w-full mt-6"
              >
                {claiming ? 'Claiming...' : `Claim ${parlay.potentialPayout} SOL`}
              </button>
            )}

            {parlay.status === 'claimed' && (
              <div className="callout-panel callout-panel--lime mt-6 text-center">
                <p className="accent-lime font-bold">✓ Claimed</p>
              </div>
            )}

            {parlay.status === 'lost' && (
              <div className="callout-panel callout-panel--gold mt-6 text-center">
                <p className="accent-gold font-bold">✗ Lost</p>
              </div>
            )}
          </div>

          {/* Token Info */}
          {parlay.tokenMint && (
            <div className="artifact-panel">
              <h2 className="text-xl font-bold mb-4 text-[var(--text-strong)]">Token Info</h2>
              <div className="space-y-2">
                <p className="text-sm muted-copy">Token Mint:</p>
                <p className="text-xs font-mono break-all value-box text-[var(--text-base)]">
                  {parlay.tokenMint}
                </p>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="artifact-panel">
            <h2 className="text-xl font-bold mb-4 text-[var(--text-strong)]">Timeline</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="muted-copy">Created:</span>
                <p className="font-medium text-[var(--text-strong)]">{format(new Date(parlay.createdAt), 'MMM d, yyyy HH:mm')}</p>
              </div>
              <div>
                <span className="muted-copy">Final Settlement:</span>
                <p className="font-medium text-[var(--text-strong)]">{format(new Date(parlay.finalSettlementDate), 'MMM d, yyyy')}</p>
              </div>
              {parlay.settledAt && (
                <div>
                  <span className="muted-copy">Settled:</span>
                  <p className="font-medium text-[var(--text-strong)]">{format(new Date(parlay.settledAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
