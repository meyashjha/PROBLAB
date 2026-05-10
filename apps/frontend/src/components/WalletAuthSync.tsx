import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { setWalletSigner } from '../services/api.service';

/**
 * Syncs the connected wallet's signMessage function and public key
 * to the API service module so that all state-changing requests
 * automatically include wallet signature headers.
 *
 * Place this component inside the WalletProvider tree.
 */
export function WalletAuthSync() {
  const { signMessage, publicKey, connected } = useWallet();

  useEffect(() => {
    if (connected && signMessage && publicKey) {
      setWalletSigner(signMessage, publicKey.toBase58());
    } else {
      setWalletSigner(null, null);
    }
  }, [connected, signMessage, publicKey]);

  return null; // Render nothing — side-effect only
}
