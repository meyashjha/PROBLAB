import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './providers/WalletProvider';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { CreateParlayPage } from './pages/CreateParlayPage';
import { MyParlaysPage } from './pages/MyParlaysPage';
import { ParlayDetailPage } from './pages/ParlayDetailPage';
import { ProbabilityOptionsPage } from './pages/ProbabilityOptionsPage';
import { CreateOptionPage } from './pages/CreateOptionPage';
import { OptionDetailPage } from './pages/OptionDetailPage';
import { WalletAuthSync } from './components/WalletAuthSync';

function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <WalletAuthSync />
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/create" element={<CreateParlayPage />} />
              <Route path="/my-portfolio" element={<MyParlaysPage />} />
              <Route path="/parlay/:id" element={<ParlayDetailPage />} />
              <Route path="/probability-options" element={<ProbabilityOptionsPage />} />
              <Route path="/create-option" element={<CreateOptionPage />} />
              <Route path="/option/:id" element={<OptionDetailPage />} />
            </Routes>
          </Layout>
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-shell',
            duration: 4000,
            style: {
              zIndex: 60,
            },
          }}
        />
      </WalletProvider>
    </ErrorBoundary>
  );
}

export default App;
