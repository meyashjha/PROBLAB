import { FC } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

const INSTRUMENTS = [
  {
    title: 'Prediction Parlays',
    eyebrow: 'High Conviction',
    accent: 'status-pill--violet',
    link: '/create',
    cta: 'Forge a Parlay',
    description:
      'Combine multiple markets into one artifact-grade position with compounding payout logic.',
    points: [
      'Combine 2 to 10+ outcomes',
      'Live odds sourced from real market probabilities',
      'Tokenized exposure with automatic settlement',
    ],
  },
  {
    title: 'Probability Options',
    eyebrow: 'Hedge the Orbit',
    accent: 'status-pill--lime',
    link: '/probability-options',
    cta: 'Open the Chain',
    description:
      'Trade volatility, hedge downside, and structure asymmetric payoff around prediction confidence.',
    points: [
      'Call and put structures on market probability',
      'Strike ladders, payoff diagrams, and Greeks',
      'Designed for active risk management',
    ],
  },
];

const SEQUENCE = [
  {
    step: '01',
    title: 'Select an Event',
    copy: 'Enter live Jupiter prediction markets and isolate the outcomes you actually believe in.',
  },
  {
    step: '02',
    title: 'Shape the instrument',
    copy: 'Stack events into parlays or select a strike and expiry from the options chain.',
  },
  {
    step: '03',
    title: 'Commit capital',
    copy: 'Approve the payment flow on Solana and mint your exposure without any complexities.',
  },
  {
    step: '04',
    title: 'Track the instrument',
    copy: 'Monitor status, payout, and probability drift from your portfolio until settlement.',
  },
];

const CATEGORIES = [
  { emoji: '₿', label: 'Crypto', accent: 'accent-gold' },
  { emoji: '⚽', label: 'Sports', accent: 'accent-lime' },
  { emoji: '🎮', label: 'Esports', accent: 'accent-violet' },
  { emoji: '🗳', label: 'Politics', accent: 'accent-gold' },
  { emoji: '📈', label: 'Economics', accent: 'accent-lime' },
  { emoji: '💻', label: 'Tech', accent: 'accent-violet' },
  { emoji: '🎬', label: 'Culture', accent: 'accent-gold' },
  { emoji: '🌍', label: 'World Events', accent: 'accent-lime' },
];

export const HomePage: FC = () => {
  const { connected } = useWallet();

  return (
    <div className="theme-page">
      <section className="page-shell">
        <div className="hero-shell">
          <div className="hero-grid">
            <div className="relative z-10">
              <div className="eyebrow mb-6">
                <span className="eyebrow__dot" />
                Live on Solana Devnet
              </div>

              <h1 className="display-title mb-6">
                <span className="text-shimmer">Probability Lab</span>
                <br />
              </h1>

              <p className="max-w-2xl text-lg leading-8 muted-copy md:text-xl">
                The derivatives layer for prediction markets. Parlays, options, and beyond.
              </p>

              <div className="orbital-meta mt-8">
                <span className="orbital-meta__dot" />
                <span>Powered by Jupiter</span>
                <span className="orbital-meta__dot" />
                <span>Structured on Solana</span>
              </div>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                {connected ? (
                  <>
                    <Link to="/create" className="btn btn-primary">
                      Create Parlay
                    </Link>
                    <Link to="/probability-options" className="btn btn-secondary">
                      Explore Options
                    </Link>
                  </>
                ) : (
                  <div className="callout-panel callout-panel--gold max-w-xl">
                    <p className="text-sm uppercase tracking-[0.22em] dim-copy">Access Gate</p>
                    <p className="mt-2 text-base text-[var(--text-strong)]">
                      Connect a wallet from the chrome nav above to activate the laboratory.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="artifact-object">
              <div className="artifact-pillar artifact-pillar--left" />
              <div className="artifact-pillar artifact-pillar--right" />
              <div className="artifact-ring" />
              <div className="artifact-core" />
              <div className="artifact-orbit artifact-orbit--top" />
              <div className="artifact-orbit artifact-orbit--mid" />
              <div className="artifact-orbit artifact-orbit--low" />

              <div className="artifact-panel absolute left-0 top-8 hidden w-48 lg:block">
                <p className="text-xs uppercase tracking-[0.18em] dim-copy">Current Ritual</p>
                <p className="mt-2 text-sm text-[var(--text-strong)]">
                  Probabilities become positions when conviction meets structure.
                </p>
              </div>

              <div className="artifact-panel absolute bottom-6 right-0 hidden w-52 lg:block">
                <p className="text-xs uppercase tracking-[0.18em] dim-copy">Inner Plasma</p>
                <p className="mt-2 text-sm text-[var(--text-strong)]">
                  Lime intelligence inside violet hardware. Built to feel expensive and dangerous.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="section-heading">
          <span className="eyebrow eyebrow--violet">
            <span className="eyebrow__dot" />
            Two Signature Instruments
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {INSTRUMENTS.map((instrument) => (
            <div key={instrument.title} className="artifact-panel artifact-panel--interactive">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`status-pill ${instrument.accent}`}>{instrument.eyebrow}</span>
                  <h2 className="section-title mt-5 text-[2.2rem]">{instrument.title}</h2>
                </div>
                <div className="eyebrow">
                  <span className="eyebrow__dot" />
                  Live
                </div>
              </div>

              <p className="mt-5 max-w-xl text-base leading-7 muted-copy">
                {instrument.description}
              </p>

              <div className="mt-8 space-y-3">
                {instrument.points.map((point) => (
                  <div key={point} className="callout-panel">
                    <div className="flex items-center gap-3">
                      <span className="orbital-meta__dot" />
                      <span className="text-sm text-[var(--text-base)]">{point}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Link to={instrument.link} className="btn btn-secondary mt-8">
                {instrument.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="artifact-panel artifact-panel--interactive">
            <p className="text-sm uppercase tracking-[0.18em] dim-copy">Active Markets</p>
            <p className="mt-4 text-5xl font-semibold text-shimmer">100+</p>
            <p className="mt-3 text-sm muted-copy">
              Liquid questions waiting to be turned into structured conviction.
            </p>
          </div>
          <div className="artifact-panel artifact-panel--interactive">
            <p className="text-sm uppercase tracking-[0.18em] dim-copy">Event Density</p>
            <p className="mt-4 text-5xl font-semibold text-shimmer">2-10+</p>
            <p className="mt-3 text-sm muted-copy">
              Build compact high-signal parlays or more elaborate scenario stacks.
            </p>
          </div>
          <div className="artifact-panel artifact-panel--interactive">
            <p className="text-sm uppercase tracking-[0.18em] dim-copy">Minimum Entry</p>
            <p className="mt-4 text-5xl font-semibold text-shimmer">1 SOL</p>
            <p className="mt-3 text-sm muted-copy">
              Accessible capital floor with the feel of a premium trading chamber.
            </p>
          </div>
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="artifact-panel">
          <div className="max-w-3xl">
            <div className="section-heading">
              <span className="eyebrow">
                <span className="eyebrow__dot" />
                Protocol Sequence
              </span>
            </div>
            <h2 className="section-title">How conviction travels through the machine</h2>
            <p className="mt-4 text-base leading-7 muted-copy">
              The flow stays simple on purpose: discovery, structure, commit, settle. The
              experience should feel ceremonial without ever changing the underlying logic.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-4">
            {SEQUENCE.map((item) => (
              <div key={item.step} className="callout-panel callout-panel--violet">
                <p className="text-xs uppercase tracking-[0.22em] accent-lime">{item.step}</p>
                <h3 className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 muted-copy">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="artifact-panel artifact-panel--highlight">
            <div className="section-heading">
              <span className="eyebrow eyebrow--violet">
                <span className="eyebrow__dot" />
                Beyond Binary Betting
              </span>
            </div>
            <h2 className="section-title">Technological in function. Mythological in feel.</h2>
            <p className="mt-5 max-w-3xl text-base leading-8 muted-copy">
              Traditional prediction markets stop at YES and NO. ProbLab keeps going:
              derivatives, hedges, structured probability exposure, and new financial primitives
              designed for an intergalactic capital system rather than a flat web dashboard.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="callout-panel callout-panel--lime">
                <p className="text-xs uppercase tracking-[0.2em] dim-copy">Available Now</p>
                <p className="mt-3 text-lg text-[var(--text-strong)]">Parlays and options are already live inside the laboratory.</p>
              </div>
              <div className="callout-panel callout-panel--gold">
                <p className="text-xs uppercase tracking-[0.2em] dim-copy">Expanding Next</p>
                <p className="mt-3 text-lg text-[var(--text-strong)]">Futures Contracts, Perpetual Swaps, structured products, and volatility Indices.</p>
              </div>
            </div>
          </div>

          <div className="artifact-panel">
            <p className="text-sm uppercase tracking-[0.18em] dim-copy">Market Domains</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {CATEGORIES.map((category) => (
                <div key={category.label} className="callout-panel">
                  <p className="text-2xl">{category.emoji}</p>
                  <p className={`mt-3 text-base font-semibold ${category.accent}`}>
                    {category.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="artifact-panel artifact-panel--highlight text-center">
          <div className="section-heading justify-center">
            <span className="eyebrow">
              <span className="eyebrow__dot" />
              Enter the Chamber
            </span>
          </div>
          <h2 className="section-title">Build your first probability instrument</h2>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            {connected ? (
              <>
                <Link to="/create" className="btn btn-primary">
                  Create Your First Parlay
                </Link>
                <Link to="/probability-options" className="btn btn-secondary">
                  Inspect the Options Chain
                </Link>
              </>
            ) : (
              <div className="callout-panel callout-panel--gold mx-auto max-w-xl">
                <p className="text-sm text-[var(--text-strong)]">
                  Connect your wallet and start stacking probabilities.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
