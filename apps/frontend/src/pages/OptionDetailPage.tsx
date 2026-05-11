import { FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api.service';
import type { ProbabilityOption } from '@parlay-tokens/shared';

export const OptionDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();

  const [option, setOption] = useState<ProbabilityOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [exercising, setExercising] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!connected) {
      navigate('/');
      return;
    }

    if (id) {
      loadOption();
    }
  }, [connected, id, navigate]);

  const loadOption = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await ApiService.getOptionById(id);

      if (response.success && response.data) {
        setOption(response.data);
      } else {
        toast.error('Option not found');
        navigate('/my-portfolio');
      }
    } catch (error) {
      toast.error('Failed to load option');
      navigate('/my-portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateValue = async () => {
    if (!id) return;

    try {
      setUpdating(true);
      const response = await ApiService.updateOptionValue(id);

      if (response.success && response.data) {
        setOption(response.data);
        toast.success('Option value updated');
      }
    } catch (error) {
      toast.error('Failed to update value');
    } finally {
      setUpdating(false);
    }
  };

  const handleExercise = async () => {
    if (!publicKey || !id) return;

    if (!confirm('Are you sure you want to exercise this option? This action cannot be undone.')) {
      return;
    }

    try {
      setExercising(true);
      const response = await ApiService.exerciseOption({
        optionId: id,
        walletAddress: publicKey.toBase58(),
      });

      if (response.success) {
        toast.success('Option exercised successfully!');
        loadOption();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to exercise option');
    } finally {
      setExercising(false);
    }
  };

  if (loading) {
    return (
      <div className="theme-page">
        <div className="page-shell loading-state">
          <div className="mx-auto spinner" />
          <div className="mt-4">Loading option...</div>
        </div>
      </div>
    );
  }

  if (!option) {
    return null;
  }

  const currentValue = (option.intrinsicValue || 0) + (option.timeValue || 0);
  const profitLoss = currentValue - option.premium;
  const profitLossPercent = (profitLoss / option.premium) * 100;

  const canExercise = 
    option.status === 'active' || option.status === 'profitable';
  
  const isInTheMoney = (option.intrinsicValue || 0) > 0;

  return (
    <div className="theme-page">
      <div className="page-shell">
      <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/my-portfolio')}
          className="back-link"
        >
          ← Back to My Portfolio
        </button>
      </div>

      <div className="artifact-panel">
        {/* Header */}
        <div className="pb-6 mb-6">
          <div className="eyebrow mb-4">
            <span className="eyebrow__dot" />
            Option Vault
          </div>
          <div className="divider-line mb-6" />
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="section-title text-[2.5rem] mb-2">
                {option.optionType} Option
              </h1>
              <p className="muted-copy mb-3">{option.eventTitle}</p>
              {option.eventId && (
                <a
                  href={`https://jup.ag/prediction/${option.eventId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary px-4 py-2 text-[10px]"
                >
                  <span>View on Jupiter</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
            <div className="text-right">
              <span
                className={
                  option.status === 'active'
                    ? 'status-pill status-pill--violet'
                    : option.status === 'profitable'
                    ? 'status-pill status-pill--lime'
                    : option.status === 'exercised'
                    ? 'status-pill status-pill--gold'
                    : 'status-pill status-pill--chrome'
                }
              >
                {option.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Current Value Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="value-box">
              <div className="text-sm dim-copy mb-1">Current Value</div>
              <div className="text-2xl font-bold text-[var(--text-strong)]">
                {currentValue.toFixed(4)} SOL
              </div>
            </div>
            <div className={`value-box ${
              profitLoss >= 0 ? 'value-box--lime' : 'value-box--gold'
            }`}>
              <div className="text-sm dim-copy mb-1">Profit/Loss</div>
              <div className={`text-2xl font-bold ${
                profitLoss >= 0 ? 'accent-lime' : 'accent-gold'
              }`}>
                {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(4)} SOL
              </div>
              <div className={`text-sm ${
                profitLoss >= 0 ? 'accent-lime' : 'accent-gold'
              }`}>
                {profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(1)}%
              </div>
            </div>
            <div className="value-box value-box--violet">
              <div className="text-sm dim-copy mb-1">Current Probability</div>
              <div className="text-2xl font-bold accent-violet">
                {((option.currentProbability || option.initialProbability) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Option Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-bold text-lg mb-4 text-[var(--text-strong)]">Option Parameters</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="muted-copy">Type:</span>
                <span className={`font-semibold ${
                  option.optionType === 'CALL' ? 'accent-lime' : 'accent-gold'
                }`}>
                  {option.optionType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Strike Price:</span>
                <span className="font-semibold text-[var(--text-strong)]">{(option.strikePrice * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Premium Paid:</span>
                <span className="font-semibold text-[var(--text-strong)]">{option.premium.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Position Size:</span>
                <span className="font-semibold text-[var(--text-strong)]">{option.notionalAmount.toFixed(2)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Implied Volatility:</span>
                <span className="font-semibold text-[var(--text-strong)]">{(option.impliedVolatility * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-4 text-[var(--text-strong)]">Current Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="muted-copy">Initial Probability:</span>
                <span className="font-semibold text-[var(--text-strong)]">{(option.initialProbability * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Current Probability:</span>
                <span className="font-semibold accent-violet">
                  {((option.currentProbability || option.initialProbability) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Intrinsic Value:</span>
                <span className={`font-semibold ${isInTheMoney ? 'accent-lime' : 'dim-copy'}`}>
                  {(option.intrinsicValue || 0).toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Time Value:</span>
                <span className="font-semibold text-[var(--text-strong)]">{(option.timeValue || 0).toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="muted-copy">Status:</span>
                <span className={`font-semibold ${
                  isInTheMoney ? 'accent-lime' : 'dim-copy'
                }`}>
                  {isInTheMoney ? 'In the Money ✓' : 'Out of the Money'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="pt-6 mb-6">
          <div className="divider-line mb-6" />
          <h3 className="font-bold text-lg mb-4 text-[var(--text-strong)]">Important Dates</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm dim-copy mb-1">Created</div>
              <div className="font-semibold text-[var(--text-strong)]">
                {new Date(option.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm dim-copy mb-1">Expires</div>
              <div className="font-semibold text-[var(--text-strong)]">
                {new Date(option.expirationDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm dim-copy mb-1">Event Settlement</div>
              <div className="font-semibold text-[var(--text-strong)]">
                {new Date(option.eventSettlementDate).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6">
          <div className="divider-line mb-6" />
          <div className="flex gap-4">
            <button
              onClick={handleUpdateValue}
              disabled={updating}
              className="btn btn-secondary flex-1 py-3 px-4"
            >
              {updating ? 'Updating...' : '🔄 Update Value'}
            </button>
            
            {canExercise && (
              <button
                onClick={handleExercise}
                disabled={exercising || !isInTheMoney}
                className="btn btn-primary flex-1 py-3 px-4"
                title={!isInTheMoney ? 'Option must be in the money to exercise' : ''}
              >
                {exercising ? 'Exercising...' : '💰 Exercise Option'}
              </button>
            )}

            {option.status === 'exercised' && option.payout && (
              <div className="flex-1 callout-panel callout-panel--lime text-center">
                <div className="text-sm accent-lime mb-1">Payout Received</div>
                <div className="text-xl font-bold text-[var(--lime-soft)]">
                  {option.payout.toFixed(4)} SOL
                </div>
              </div>
            )}
          </div>

          {!isInTheMoney && canExercise && (
            <p className="text-sm dim-copy mt-2 text-center">
              Option is currently out of the money. Wait for probability to move in your favor.
            </p>
          )}
        </div>

        {/* Educational Info */}
        <div className="mt-6 callout-panel callout-panel--violet">
          <h4 className="font-semibold text-[var(--text-strong)] mb-2 flex items-center gap-2">
            {option.optionType === 'CALL' ? '📈 CALL Option' : '📉 PUT Option'}
          </h4>
          <p className="text-sm text-[var(--text-base)]">
            {option.optionType === 'CALL' 
              ? `This CALL option profits when the market probability rises above ${(option.strikePrice * 100).toFixed(1)}%. The current probability is ${((option.currentProbability || option.initialProbability) * 100).toFixed(1)}%.`
              : `This PUT option profits when the market probability falls below ${(option.strikePrice * 100).toFixed(1)}%. The current probability is ${((option.currentProbability || option.initialProbability) * 100).toFixed(1)}%.`
            }
          </p>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
};
