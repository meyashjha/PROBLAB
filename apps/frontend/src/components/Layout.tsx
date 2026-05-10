import { FC, ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="app-shell">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] btn btn-primary">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="site-header__inner px-4 sm:px-5 lg:px-6  ">
          <div className="flex h-[4.4rem] items-center justify-between gap-4">
            <Link to="/" className="brand-link" onClick={() => setMobileMenuOpen(false)}>
              <div className="brand-icon" aria-hidden="true">
                <img src="ProbLab.png" className="rounded-xl" />
              </div>
              <div className="brand-copy">
                <span className="brand-title">ProbLab</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="site-nav hidden md:flex" aria-label="Main navigation">
              <Link
                to="/"
                className={`nav-pill ${isActive('/') ? 'nav-pill--active' : ''}`}
              >
                Home
              </Link>
              <Link
                to="/create"
                className={`nav-pill ${isActive('/create') ? 'nav-pill--active' : ''}`}
              >
                Create Parlay
              </Link>
              <Link
                to="/probability-options"
                className={`nav-pill ${isActive('/probability-options') ? 'nav-pill--active' : ''}`}
              >
                Options
              </Link>
              <Link
                to="/my-portfolio"
                className={`nav-pill ${isActive('/my-portfolio') ? 'nav-pill--active' : ''}`}
              >
                Portfolio
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden btn btn-secondary px-3 py-2"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <div className="shrink-0 hidden md:block">
              <WalletMultiButton />
            </div>
          </div>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-[var(--border-soft)] pt-4" aria-label="Mobile navigation">
              <div className="flex flex-col gap-2">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-pill w-full text-center ${isActive('/') ? 'nav-pill--active' : ''}`}
                >
                  🏠 Home
                </Link>
                <Link
                  to="/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-pill w-full text-center ${isActive('/create') ? 'nav-pill--active' : ''}`}
                >
                  ✨ Create Parlay
                </Link>
                <Link
                  to="/probability-options"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-pill w-full text-center ${isActive('/probability-options') ? 'nav-pill--active' : ''}`}
                >
                  📊 Options
                </Link>
                <Link
                  to="/my-portfolio"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-pill w-full text-center ${isActive('/my-portfolio') ? 'nav-pill--active' : ''}`}
                >
                  💼 Portfolio
                </Link>
                <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
                  <WalletMultiButton />
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 pt-4 pb-20 md:pb-4" id="main-content">
        {children}
      </main>

      <footer className="site-footer mt-auto">
        <div className="site-footer__inner px-6 py-8">
          <div className="flex flex-col gap-4 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
            <div>
              <p className="brand-title text-[1.5rem]">ProbLab</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Structured probability instruments for cosmic-scale conviction.
              </p>
            </div>
            <div className="orbital-meta justify-center lg:justify-end">
              <span className="orbital-meta__dot" />
              <span>Prediction Parlays</span>
              <span className="orbital-meta__dot" />
              <span>Probability Options</span>
              <span className="orbital-meta__dot" />
              <span>Solana Devnet</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
