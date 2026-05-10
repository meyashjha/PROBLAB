import bs58 from 'bs58';

/**
 * Wallet authentication utility for signing API requests.
 * 
 * Creates a timestamped message, signs it with the connected wallet,
 * and returns the headers needed for authenticated API calls.
 */

export type WalletAuthHeaders = Record<string, string> & {
  'x-wallet-address': string;
  'x-wallet-signature': string;
  'x-wallet-message': string;
};

/**
 * Sign a message for API authentication.
 * 
 * @param signMessage - The signMessage function from @solana/wallet-adapter-react
 * @param publicKey - The wallet's public key (base58 string)
 * @param action - A label for the action being performed (e.g., 'create-parlay')
 * @returns Headers object to include in the API request
 */
export async function createAuthHeaders(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string,
  action: string
): Promise<WalletAuthHeaders> {
  const timestamp = Date.now();
  const message = `ParlayTokens:${timestamp}:${action}`;
  const messageBytes = new TextEncoder().encode(message);

  const signatureBytes = await signMessage(messageBytes);
  const signature = bs58.encode(signatureBytes);

  return {
    'x-wallet-address': publicKey,
    'x-wallet-signature': signature,
    'x-wallet-message': message,
  };
}
