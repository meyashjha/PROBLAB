import { FC, useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api.service';
import { EventSelector } from '../components/EventSelector';
import { LiveOddsDisplay } from '../components/LiveOddsDisplay';
import type { JupiterEvent, CreateParlayInput } from '@parlay-tokens/shared';

interface SelectedEvent {
  eventId: string;
  marketId: string;
  title: string;
  description: string;
  settlementDate: Date;
  selectedOutcome: 'YES' | 'NO';
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'sports', label: 'Sports' },
  { value: 'politics', label: 'Politics' },
  { value: 'esports', label: 'Esports' },
  { value: 'culture', label: 'Culture' },
  { value: 'economics', label: 'Economics' },
  { value: 'tech', label: 'Tech' },
];

const FILTERS = [
  { value: '', label: 'All Events' },
  { value: 'live', label: 'Live' },
  { value: 'trending', label: 'Trending' },
  { value: 'new', label: 'New (24h)' },
];

export const CreateParlayPage: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();

  const [events, setEvents] = useState<JupiterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<SelectedEvent[]>([]);
  const [principalAmount, setPrincipalAmount] = useState<number>(1);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState('');
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [platformWallet, setPlatformWallet] = useState<string | null>(null);

  useEffect(() => {
    // Load platform wallet address
    loadPlatformWallet();
  }, []);

  useEffect(() => {
    // Allow browsing events without wallet connection
    // Only require wallet when creating parlay
    loadEvents();
  }, [category, filter]);

  const loadPlatformWallet = async () => {
    try {
      const response = await ApiService.getBackendWallet();
      if (response.success && response.data?.address) {
        setPlatformWallet(response.data.address);
      }
    } catch (error) {
      console.error('Error loading platform wallet:', error);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Clear events immediately when filter changes to show loading state
      setEvents([]);
      
      const response = await ApiService.getAllEvents(category, filter, 100);
      
      if (response.success && response.data) {
        setEvents(response.data.events || []);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParlay = async () => {
    // Require wallet connection for creating parlay
    if (!connected || !publicKey || !sendTransaction) {
      toast.error('Please connect your wallet to create a parlay');
      return;
    }

    if (selectedEvents.length < 2) {
      toast.error('Select at least 2 events');
      return;
    }

    if (principalAmount < 1) {
      toast.error('Minimum principal amount is 1 SOL');
      return;
    }

    if (!currentQuote || !currentQuote.quote) {
      toast.error('Please wait for quote to load');
      return;
    }

    try {
      setCreating(true);

      // Step 1: Show confirmation with quote details
      const confirmed = window.confirm(
        `Create Parlay?\n\n` +
        `Events: ${selectedEvents.length}\n` +
        `Principal: ${principalAmount} SOL\n` +
        `Odds: ${currentQuote.formattedOdds.decimal}x\n` +
        `Potential Payout: ${currentQuote.quote.potentialPayout.toFixed(4)} SOL\n` +
        `Win Probability: ${(currentQuote.quote.combinedProbability * 100).toFixed(2)}%\n\n` +
        `You will be asked to approve the payment transaction.`
      );

      if (!confirmed) {
        setCreating(false);
        return;
      }

      // Step 2: Send payment FIRST (this is the critical security fix)
      toast.loading('Requesting payment approval...', { id: 'payment' });

      // Get platform wallet address
      if (!platformWallet) {
        toast.error('Platform wallet not loaded. Please refresh the page.', { id: 'payment' });
        setCreating(false);
        return;
      }

      const platformWalletPubkey = new PublicKey(platformWallet);

      // Create payment transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: platformWalletPubkey,
          lamports: principalAmount * LAMPORTS_PER_SOL,
        })
      );

      // Send and confirm payment transaction
      const signature = await sendTransaction(transaction, connection);
      toast.loading('Confirming payment...', { id: 'payment' });
      
      await connection.confirmTransaction(signature, 'confirmed');
      toast.success('Payment confirmed!', { id: 'payment' });

      // Step 3: Create parlay with payment proof
      toast.loading('Creating parlay...', { id: 'create' });

      const input: CreateParlayInput = {
        walletAddress: publicKey.toBase58(),
        events: selectedEvents,
        principalAmount,
      };

      const response = await ApiService.createParlay({
        ...input,
        txSignature: signature, // Include payment proof
      });

      if (response.success && response.data) {
        toast.success('Parlay created successfully!', { id: 'create' });
        navigate(`/parlay/${response.data._id}`);
      } else {
        toast.error(response.error?.message || 'Failed to create parlay', { id: 'create' });
      }
    } catch (error: any) {
      console.error('Error creating parlay:', error);
      
      // Provide helpful error messages
      if (error.message?.includes('User rejected')) {
        toast.error('Payment cancelled', { id: 'payment' });
      } else if (error.response?.data?.error?.message) {
        toast.error(error.response.data.error.message, { id: 'create' });
      } else {
        toast.error('Failed to create parlay. Please try again.', { id: 'create' });
      }
    } finally {
      setCreating(false);
    }
  };

  // Don't show full-page loader - let EventSelector handle loading state
  // if (loading && events.length === 0) {
  //   return <div>Loading...</div>;
  // }

  return (
    <div className="theme-page">
      <div className="page-shell">
        {/* Wallet connection banner for guest users */}
        {!connected && (
          <div className="callout-panel callout-panel--gold mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">👋</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-[var(--text-strong)] mb-1">
                  Browsing as Guest
                </h3>
                <p className="text-sm muted-copy mb-2">
                  You can explore events and build parlays, but you'll need to connect your wallet to create and place bets.
                </p>
                <button
                  onClick={() => {
                    // Trigger wallet connection modal
                    const walletButton = document.querySelector('.wallet-adapter-button');
                    if (walletButton instanceof HTMLElement) {
                      walletButton.click();
                    }
                  }}
                  className="back-link"
                >
                  Connect Wallet Now
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="eyebrow mb-4">
            <span className="eyebrow__dot" />
            Parlay Forge
          </div>
          <h1 className="section-title">Create a structured parlay</h1>
        </div>
        <p className="mb-8 max-w-3xl text-base leading-7 muted-copy">
          Select multiple events and combine them into a single bet with multiplied odds
        </p>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="label">Category</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input appearance-none pr-10"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div>
          <label className="label">Filter</label>
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input appearance-none pr-10"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Event Selection */}
        <div className="lg:col-span-2 space-y-6">
          <EventSelector
            events={events}
            selectedEvents={selectedEvents}
            onSelectEvent={setSelectedEvents}
            loading={loading}
          />
        </div>

        {/* Right Column - Configuration & Preview */}
        <div className="space-y-6">
          <div className="artifact-panel sticky" style={{ top: 'calc(5rem + 1rem)' }}>
            <h2 className="text-2xl font-semibold mb-4 text-[var(--text-strong)]">Configuration</h2>

            {/* Live Odds Display */}
            {selectedEvents.length >= 2 && (
              <div className="mb-6">
                <LiveOddsDisplay
                  events={selectedEvents.map(e => ({
                    eventId: e.eventId,
                    marketId: e.marketId,
                    title: e.title,
                    selectedOutcome: e.selectedOutcome,
                  }))}
                  principalAmount={principalAmount}
                  onQuoteUpdate={(quote) => setCurrentQuote(quote)}
                />
              </div>
            )}

            <div className="mt-6">
              <label className="label">Principal Amount (SOL)</label>
              <input
                type="number"
                min="1"
                step="0.1"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(parseFloat(e.target.value) || 1)}
                className="input"
              />
              <p className="text-xs dim-copy mt-1">
                Minimum: 1 SOL
              </p>
            </div>

            {/* Quote-based preview instead of fixed multiplier */}
            {currentQuote && currentQuote.quote && (
              <div className="mt-6 pt-6">
                <div className="divider-line mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-[var(--text-strong)]">Parlay Summary</h3>
                
                <div className="space-y-2 mb-4">
                  {selectedEvents.map((event, index) => {
                    const eventOdds = currentQuote.quote.events[index];
                    return (
                      <div
                        key={`${event.eventId}-${event.marketId}`}
                        className="callout-panel text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span className="dim-copy font-medium">#{index + 1}:</span>
                          <div className="flex-1">
                            <div className="font-medium accent-violet mb-1">
                              {event.selectedOutcome} - {event.title.substring(0, 40)}...
                            </div>
                            <div className="text-xs dim-copy">
                              Probability: {(eventOdds?.impliedProbability * 100).toFixed(1)}% | 
                              Odds: {eventOdds?.fairOdds.toFixed(2)}x
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="callout-panel callout-panel--violet space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="muted-copy">Events:</span>
                    <span className="font-bold text-[var(--text-strong)]">{selectedEvents.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="muted-copy">Combined Odds:</span>
                    <span className="font-bold text-[var(--text-strong)]">{currentQuote.formattedOdds.decimal}x</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="muted-copy">Win Probability:</span>
                    <span className="font-bold text-[var(--text-strong)]">{(currentQuote.quote.combinedProbability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="muted-copy">Principal:</span>
                    <span className="font-bold text-[var(--text-strong)]">{principalAmount} SOL</span>
                  </div>
                  <div className="divider-line my-2" />
                  <div>
                    <div className="flex justify-between">
                      <span className="font-bold text-[var(--text-strong)]">Potential Payout:</span>
                      <span className="font-bold accent-lime text-lg">
                        {currentQuote.quote.potentialPayout.toFixed(4)} SOL
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!currentQuote && selectedEvents.length >= 2 && (
              <div className="mt-6 text-center text-sm dim-copy">
                Calculating odds...
              </div>
            )}

            <button
              onClick={handleCreateParlay}
              disabled={creating || selectedEvents.length < 2 || !currentQuote || !connected}
              className="btn btn-primary w-full mt-6"
            >
              {!connected 
                ? 'Connect Wallet to Create' 
                : creating 
                ? 'Processing...' 
                : selectedEvents.length < 2
                ? 'Select at least 2 events'
                : !currentQuote
                ? 'Waiting for valid quote...'
                : `Pay ${principalAmount} SOL & Create Parlay`}
            </button>
            
            {!connected && (
              <p className="text-xs text-center accent-gold mt-2">
                Connect your wallet to create this parlay
              </p>
            )}
            
            {connected && selectedEvents.length >= 2 && currentQuote && (
              <p className="text-xs text-center dim-copy mt-2">
                💡 You'll be asked to approve payment before creating the parlay
              </p>
            )}
            
            {connected && selectedEvents.length < 2 && (
              <p className="text-xs text-center dim-copy mt-2">
                Select at least 2 events to create a parlay
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
