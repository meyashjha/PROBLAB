import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api.service';
import { ParlayCard } from '../components/ParlayCard';
import type { Parlay, ProbabilityOption } from '@parlay-tokens/shared';

export const MyParlaysPage: FC = () => {
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();

  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [options, setOptions] = useState<ProbabilityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'won' | 'lost'>('all');
  const [activeTab, setActiveTab] = useState<'parlays' | 'options'>('parlays');

  useEffect(() => {
    if (!connected || !publicKey) {
      navigate('/');
      return;
    }

    // Use a flag to prevent duplicate calls in React StrictMode
    let isMounted = true;
    
    const fetchData = async () => {
      if (isMounted) {
        await loadData();
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [connected, publicKey, navigate]);

  const loadData = async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      console.log('🔍 Fetching parlays for wallet:', publicKey.toBase58());
      
      const [parlaysResponse, optionsResponse] = await Promise.all([
        ApiService.getParlaysByWallet(publicKey.toBase58()),
        ApiService.getOptionsByWallet(publicKey.toBase58()),
      ]);
      
      console.log('📊 Parlays response:', parlaysResponse);
      console.log('📊 Options response:', optionsResponse);
      
      if (parlaysResponse.success && parlaysResponse.data) {
        console.log('✅ Found parlays:', parlaysResponse.data.length);
        console.log('📋 Parlay statuses:', parlaysResponse.data.map((p: Parlay) => ({ id: p._id, status: p.status })));
        setParlays(parlaysResponse.data);
      } else {
        console.error('❌ Parlays response not successful:', parlaysResponse);
        setParlays([]);
      }
      
      if (optionsResponse.success && optionsResponse.data) {
        console.log('✅ Found options:', optionsResponse.data.length);
        setOptions(optionsResponse.data);
      } else {
        console.error('❌ Options response not successful:', optionsResponse);
        setOptions([]);
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Set empty arrays on error to prevent stale data
      setParlays([]);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredParlays = parlays.filter((parlay) => {
    if (filter === 'all') return true;
    if (filter === 'active') return parlay.status === 'active' || parlay.status === 'pending_payment';
    if (filter === 'won') {
      // Include won, claimed, and any parlay that has been paid out
      const isWon = parlay.status === 'won' || parlay.status === 'claimed';
      console.log(`🔍 Filtering parlay ${parlay._id}: status=${parlay.status}, isWon=${isWon}`);
      return isWon;
    }
    if (filter === 'lost') return parlay.status === 'lost' || parlay.status === 'expired';
    return parlay.status === filter;
  });

  console.log(`🎯 Current filter: ${filter}, Total parlays: ${parlays.length}, Filtered: ${filteredParlays.length}`);

  const filteredOptions = options.filter((option) => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['active', 'profitable', 'unprofitable'].includes(option.status);
    if (filter === 'won') return option.status === 'exercised';
    if (filter === 'lost') return option.status === 'expired' && (option.intrinsicValue || 0) === 0;
    return false;
  });

  if (!connected) {
    return null;
  }

  return (
    <div className="theme-page">
      <div className="page-shell">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow mb-4">
              <span className="eyebrow__dot" />
              Portfolio Vault
            </div>
            <h1 className="section-title">Your probability instruments</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 muted-copy">
              Track parlay exposure, option value drift, and settlement outcomes
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/create" className="btn btn-secondary">
              Create Parlay
            </Link>
            <Link to="/probability-options" className="btn btn-primary">
              Create Option
            </Link>
          </div>
        </div>

        <div className="artifact-panel mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="segment-bar">
              <button
                onClick={() => setActiveTab('parlays')}
                className={`segment-button ${activeTab === 'parlays' ? 'segment-button--active' : ''}`}
              >
                Parlays ({parlays.length})
              </button>
              <button
                onClick={() => setActiveTab('options')}
                className={`segment-button ${activeTab === 'options' ? 'segment-button--active' : ''}`}
              >
                Options ({options.length})
              </button>
            </div>

            <div className="segment-bar">
              {(['all', 'active', 'won', 'lost'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`segment-button ${filter === tab ? 'segment-button--active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="mx-auto spinner" />
            <p className="mt-4">Loading portfolio state...</p>
          </div>
        ) : activeTab === 'parlays' ? (
          filteredParlays.length === 0 ? (
            <div className="artifact-panel empty-state py-20">
              <div className="text-6xl mb-4">🎲</div>
              <h3 className="text-2xl font-bold text-[var(--text-strong)] mb-2">
                No parlays found
              </h3>
              <p className="muted-copy mb-6 max-w-md mx-auto">
                {filter === 'all' 
                  ? 'Create your first parlay to start tracking your predictions'
                  : `No ${filter} parlays in your portfolio. Try a different filter or create a new parlay.`
                }
              </p>
              <Link to="/create" className="btn btn-primary">
                ✨ Create Your First Parlay
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredParlays.map((parlay) => (
                <ParlayCard key={parlay._id} parlay={parlay} />
              ))}
            </div>
          )
        ) : filteredOptions.length === 0 ? (
          <div className="artifact-panel empty-state py-20">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-[var(--text-strong)] mb-2">
              No options found
            </h3>
            <p className="muted-copy mb-6 max-w-md mx-auto">
              Open a position from the probability chain to populate this view.
            </p>
            <Link to="/probability-options" className="btn btn-primary">
              📈 Create Your First Option
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredOptions.map((option) => {
              const currentValue = (option.intrinsicValue || 0) + (option.timeValue || 0);
              const profitLoss = currentValue - option.premium;
              const isInTheMoney = (option.intrinsicValue || 0) > 0;

              const statusClass =
                option.status === 'active'
                  ? 'status-pill status-pill--violet'
                  : option.status === 'profitable'
                  ? 'status-pill status-pill--lime'
                  : option.status === 'exercised'
                  ? 'status-pill status-pill--gold'
                  : 'status-pill status-pill--chrome';

              return (
                <Link
                  key={option._id}
                  to={`/option/${option._id}`}
                  className="card artifact-panel--interactive block transition-shadow"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span
                      className={
                        option.optionType === 'CALL'
                          ? 'status-pill status-pill--lime'
                          : 'status-pill status-pill--gold'
                      }
                    >
                      {option.optionType}
                    </span>
                    <span className={statusClass}>{option.status}</span>
                  </div>

                  <h3 className="line-clamp-2 text-2xl font-semibold text-[var(--text-strong)]">
                    {option.eventTitle}
                  </h3>

                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="muted-copy">Strike:</span>
                      <span className="font-semibold text-[var(--text-strong)]">
                        {(option.strikePrice * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="muted-copy">Current:</span>
                      <span className="font-semibold accent-violet">
                        {((option.currentProbability || option.initialProbability) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="muted-copy">Premium:</span>
                      <span className="font-semibold text-[var(--text-strong)]">
                        {option.premium.toFixed(4)} SOL
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 divider-line" />

                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm muted-copy">P/L</span>
                    <span className={`font-bold ${profitLoss >= 0 ? 'accent-lime' : 'accent-gold'}`}>
                      {profitLoss >= 0 ? '+' : ''}
                      {profitLoss.toFixed(4)} SOL
                    </span>
                  </div>

                  <div className="mt-2 text-right text-xs dim-copy">
                    {isInTheMoney ? 'In the Money' : 'Out of the Money'}
                  </div>

                  <div className="mt-4 text-xs dim-copy">
                    Expires: {new Date(option.expirationDate).toLocaleDateString()}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
