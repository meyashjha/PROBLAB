import { FC, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api.service';
import { PayoffChart } from '../components/PayoffChart';
import { ProbabilityGauge } from '../components/ProbabilityGauge';
import type { PayoffPoint } from '@parlay-tokens/shared';

interface LocationState {
  marketId: string;
  eventId: string;
  eventTitle: string;
  marketTitle: string;
  eventDescription: string;
  eventSettlementDate: string;
  strike: number;
  expiryDays: number;
  optionType: 'CALL' | 'PUT';
  premium: number;
  currentProbability: number;
  impliedVolatility: number;
  daysToExpiry: number;
}

export const CreateOptionPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // Get pre-filled data from navigation state
  const state = location.state as LocationState | null;

  // Form state
  const [notionalAmount, setNotionalAmount] = useState(1);
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>(state?.optionType || 'CALL');
  
  // Calculated values
  const [quote, setQuote] = useState<{
    premium: number;
    intrinsicValue: number;
    timeValue: number;
    breakEvenProbability: number;
    maxProfit: number;
    maxLoss: number;
    probabilityOfProfit: number;
    delta: number;
    theta: number;
    vega: number;
  } | null>(null);
  
  const [payoffData, setPayoffData] = useState<{
    payoffPoints: PayoffPoint[];
    premium: number;
    breakEven: number;
    maxProfit: number;
    maxLoss: number;
    currentProbability: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Redirect if no state provided
  useEffect(() => {
    if (!state) {
      toast.error('Please select an option from the options chain');
      navigate('/probability-options');
    }
  }, [state, navigate]);

  // Load quote and payoff when notional or option type changes
  useEffect(() => {
    if (state) {
      loadQuoteAndPayoff();
    }
  }, [notionalAmount, optionType, state]);

  const loadQuoteAndPayoff = async () => {
    if (!state) return;

    try {
      setLoading(true);

      // Get quote
      const quoteResponse = await ApiService.getOptionQuote({
        currentProbability: state.currentProbability,
        strikePrice: state.strike,
        timeToExpiration: state.expiryDays,
        impliedVolatility: state.impliedVolatility,
        notionalAmount,
        optionType,
      });

      if (quoteResponse.success && quoteResponse.data) {
        setQuote(quoteResponse.data);
      }

      // Get payoff
      const payoffResponse = await ApiService.getPayoffData(
        state.marketId,
        state.strike,
        state.expiryDays,
        optionType,
        notionalAmount,
        state.eventId
      );

      if (payoffResponse.success && payoffResponse.data) {
        setPayoffData(payoffResponse.data);
      }
    } catch (error) {
      console.error('Error loading quote:', error);
      toast.error('Failed to load option quote');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOption = async () => {
    if (!connected || !publicKey || !state || !quote) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setCreating(true);

      // Step 1: Get backend wallet address
      toast.loading('Preparing payment...', { id: 'payment' });
      
      const backendWalletResponse = await ApiService.getBackendWallet();
      if (!backendWalletResponse.success || !backendWalletResponse.data?.address) {
        throw new Error('Failed to get backend wallet address');
      }

      const platformWalletPubkey = new PublicKey(backendWalletResponse.data.address);

      // Step 2: Create payment transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: platformWalletPubkey,
          lamports: Math.floor(quote.premium * LAMPORTS_PER_SOL),
        })
      );

      // Step 3: Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      toast.loading('Confirming payment...', { id: 'payment' });
      
      // Step 4: Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      toast.success('Payment confirmed!', { id: 'payment' });

      // Step 5: Create option with payment proof
      toast.loading('Creating option...', { id: 'create' });

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + state.expiryDays);

      const response = await ApiService.createOption({
        walletAddress: publicKey.toBase58(),
        eventId: state.eventId,
        marketId: state.marketId,
        eventTitle: state.eventTitle,
        eventDescription: state.eventDescription,
        eventSettlementDate: state.eventSettlementDate,
        optionType,
        strikePrice: state.strike,
        notionalAmount,
        expirationDate: expirationDate.toISOString(),
        txSignature: signature,
      });

      if (response.success && response.data) {
        toast.success('Option created successfully!', { id: 'create' });
        navigate(`/option/${response.data._id}`);
      } else {
        throw new Error('Failed to create option');
      }
    } catch (error: any) {
      console.error('Error creating option:', error);
      toast.error(error.message || 'Failed to create option', { id: 'create' });
      toast.dismiss('payment');
    } finally {
      setCreating(false);
    }
  };

  if (!connected) {
    return (
      <div className="theme-page">
        <div className="page-shell">
          <div className="artifact-panel text-center">
            <h2 className="section-title text-[2.2rem] mb-4">Connect Your Wallet</h2>
            <p className="muted-copy">Please connect your wallet to create options</p>
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  const isInTheMoney = optionType === 'CALL' 
    ? state.currentProbability > state.strike
    : state.currentProbability < state.strike;

  return (
    <div className="theme-page">
      <div className="page-shell">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/probability-options')}
          className="back-link mb-4"
        >
          ← Back to Markets
        </button>
        <div className="eyebrow mb-4">
          <span className="eyebrow__dot" />
          Option Mint
        </div>
        <h1 className="section-title">Create a probability option</h1>
        <p className="mt-3 muted-copy">Configure and purchase your option</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Configuration */}
        <div className="space-y-6">
          {/* Market Info */}
          <div className="artifact-panel">
            <h3 className="text-xl font-semibold mb-4 text-[var(--text-strong)]">Underlying Market</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm dim-copy mb-1">Event</div>
                <div className="font-semibold text-[var(--text-strong)]">{state.eventTitle}</div>
              </div>
              <div>
                <div className="text-sm dim-copy mb-1">Market</div>
                <div className="text-sm muted-copy">{state.marketTitle}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm dim-copy mb-1">Current Probability</div>
                  <div className="flex items-center gap-2">
                    <ProbabilityGauge probability={state.currentProbability} size={48} />
                    <span className="text-2xl font-bold accent-violet">
                      {(state.currentProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm dim-copy mb-1">Days to Settlement</div>
                  <div className="text-2xl font-bold text-[var(--text-strong)]">{state.daysToExpiry.toFixed(0)}</div>
                </div>
              </div>
              <div>
                <a
                  href={`https://jup.ag/prediction/${state.eventId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary px-4 py-2 text-[10px]"
                >
                  <span>View on Jupiter</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Option Configuration */}
          <div className="artifact-panel">
            <h3 className="text-xl font-semibold mb-4 text-[var(--text-strong)]">Option Parameters</h3>
            
            {/* Option Type Toggle */}
            <div className="mb-4">
              <label className="label">
                Option Type
              </label>
              <div className="segment-bar w-full">
                <button
                  onClick={() => setOptionType('CALL')}
                  className={`segment-button flex-1 ${
                    optionType === 'CALL'
                      ? 'segment-button--active'
                      : ''
                  }`}
                >
                  📈 CALL
                </button>
                <button
                  onClick={() => setOptionType('PUT')}
                  className={`segment-button flex-1 ${
                    optionType === 'PUT'
                      ? 'segment-button--active'
                      : ''
                  }`}
                >
                  📉 PUT
                </button>
              </div>
              <p className="text-xs dim-copy mt-2">
                {optionType === 'CALL' 
                  ? 'Profits when probability rises above strike'
                  : 'Profits when probability falls below strike'
                }
              </p>
            </div>

            {/* Strike (read-only) */}
            <div className="mb-4">
              <label className="label">
                Strike Price
              </label>
              <div className="value-box value-box--violet px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[var(--text-strong)]">{(state.strike * 100).toFixed(1)}%</span>
                  {isInTheMoney && (
                    <span className="status-pill status-pill--lime">
                      In the Money ✓
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Expiry (read-only) */}
            <div className="mb-4">
              <label className="label">
                Expiration
              </label>
              <div className="value-box px-4 py-3">
                <div className="text-lg font-bold text-[var(--text-strong)]">{state.expiryDays} days</div>
                <div className="text-xs dim-copy">
                  {new Date(Date.now() + state.expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Notional Amount (adjustable) */}
            <div className="mb-4">
              <label className="label">
                Position Size (Notional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={notionalAmount}
                  onChange={(e) => setNotionalAmount(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  className="input flex-1 text-lg font-semibold"
                />
                <span className="muted-copy font-medium">SOL</span>
              </div>
              <p className="text-xs dim-copy mt-1">
                Minimum: 0.1 SOL • Controls your profit/loss scale
              </p>
            </div>
          </div>

          {/* Premium & Greeks */}
          {quote && (
            <div className="artifact-panel">
              <h3 className="text-xl font-semibold mb-4 text-[var(--text-strong)]">Pricing Details</h3>
              
              {/* Premium */}
              <div className="value-box value-box--violet mb-4">
                <div className="text-sm muted-copy mb-1">Premium to Pay</div>
                <div className="text-3xl font-bold accent-violet">
                  {quote.premium.toFixed(4)} SOL
                </div>
                <div className="text-xs dim-copy mt-1">
                  ≈ ${(quote.premium * 150).toFixed(2)} USD (estimated)
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="muted-copy">Intrinsic Value:</span>
                  <span className="font-semibold text-[var(--text-strong)]">{quote.intrinsicValue.toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="muted-copy">Time Value:</span>
                  <span className="font-semibold text-[var(--text-strong)]">{quote.timeValue.toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="muted-copy">Break-Even:</span>
                  <span className="font-semibold text-[var(--text-strong)]">{(quote.breakEvenProbability * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Greeks */}
              <div className="pt-4">
                <div className="divider-line mb-4" />
                <div className="text-xs font-semibold dim-copy uppercase mb-2">Greeks</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs dim-copy">Delta</div>
                    <div className="font-bold text-[var(--text-strong)]">{quote.delta.toFixed(3)}</div>
                  </div>
                  <div>
                    <div className="text-xs dim-copy">Theta</div>
                    <div className="font-bold text-[var(--text-strong)]">{quote.theta.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-xs dim-copy">Vega</div>
                    <div className="font-bold text-[var(--text-strong)]">{quote.vega.toFixed(4)}</div>
                  </div>
                </div>
              </div>

              {/* Risk Metrics */}
              <div className="pt-4 mt-4">
                <div className="divider-line mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs dim-copy mb-1">Max Profit</div>
                    <div className="text-lg font-bold accent-lime">
                      +{quote.maxProfit.toFixed(4)} SOL
                    </div>
                  </div>
                  <div>
                    <div className="text-xs dim-copy mb-1">Max Loss</div>
                    <div className="text-lg font-bold accent-gold">
                      -{quote.maxLoss.toFixed(4)} SOL
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs dim-copy mb-1">Probability of Profit</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[rgba(255,255,255,0.06)] rounded-full h-2">
                      <div 
                        className="bg-[var(--lime)] h-2 rounded-full transition-all"
                        style={{ width: `${quote.probabilityOfProfit * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-[var(--text-strong)]">
                      {(quote.probabilityOfProfit * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Payoff Chart */}
        <div className="space-y-6">
          {payoffData && (
            <div className="artifact-panel">
              <h3 className="text-xl font-semibold mb-4 text-[var(--text-strong)]">Payoff Diagram</h3>
              <PayoffChart
                points={payoffData.payoffPoints}
                currentProbability={payoffData.currentProbability}
                breakEven={payoffData.breakEven}
                maxProfit={payoffData.maxProfit}
                maxLoss={payoffData.maxLoss}
                strike={state.strike}
                optionType={optionType}
                premium={payoffData.premium}
              />
              <div className="mt-4 text-xs dim-copy">
                <p className="mb-2">
                  This chart shows your profit/loss at every possible probability outcome at expiration.
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Green line = Your P/L</li>
                  <li>Blue dot = Current probability</li>
                  <li>Red line = Break-even point</li>
                  <li>Max loss is always the premium paid</li>
                </ul>
              </div>
            </div>
          )}

          {/* Educational Info */}
          <div className="callout-panel callout-panel--violet">
            <h4 className="font-semibold text-[var(--text-strong)] mb-3 flex items-center gap-2">
              <span>💡</span>
              {optionType === 'CALL' ? 'CALL Option Strategy' : 'PUT Option Strategy'}
            </h4>
            <div className="text-sm text-[var(--text-base)] space-y-2">
              {optionType === 'CALL' ? (
                <>
                  <p>
                    <strong className="text-[var(--text-strong)]">You profit when:</strong> Market probability rises above {(state.strike * 100).toFixed(1)}%
                  </p>
                  <p>
                    <strong className="text-[var(--text-strong)]">Break-even:</strong> {quote ? `${(quote.breakEvenProbability * 100).toFixed(1)}%` : '—'}
                  </p>
                  <p>
                    <strong className="text-[var(--text-strong)]">Best case:</strong> Probability goes to 100%, you make {quote ? `${quote.maxProfit.toFixed(4)} SOL` : '—'}
                  </p>
                  <p>
                    <strong className="text-[var(--text-strong)]">Worst case:</strong> Probability stays below strike, you lose premium ({quote ? `${quote.maxLoss.toFixed(4)} SOL` : '—'})
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong className="text-[var(--text-strong)]">You profit when:</strong> Market probability falls below {(state.strike * 100).toFixed(1)}%
                  </p>
                  <p>
                    <strong className="text-[var(--text-strong)]">Break-even:</strong> {quote ? `${(quote.breakEvenProbability * 100).toFixed(1)}%` : '—'}
                  </p>
                  <p>
                    <strong className="text-[var(--text-strong)]">Best case:</strong> Probability goes to 0%, you make {quote ? `${quote.maxProfit.toFixed(4)} SOL` : '—'}
                  </p>
                  <p>
                    <strong className="text-[var(--text-strong)]">Worst case:</strong> Probability stays above strike, you lose premium ({quote ? `${quote.maxLoss.toFixed(4)} SOL` : '—'})
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateOption}
            disabled={creating || loading || !quote}
            className="btn btn-primary w-full py-4 text-lg"
          >
            {creating ? (
              <>
                <div className="spinner spinner--sm mr-2" />
                Creating Option...
              </>
            ) : (
              <>💰 Buy Option for {quote ? `${quote.premium.toFixed(4)} SOL` : '...'}</>
            )}
          </button>

          <p className="text-xs dim-copy text-center">
            By creating this option, you agree to pay the premium upfront. 
            You can exercise the option anytime before expiration if it's profitable.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};
