import { Connection, Keypair } from '@solana/web3.js';
import { SolanaConnection, WalletManager, TokenManager, PaymentManager } from '@parlay-tokens/solana';
import { env } from '../config/env';

export class SolanaService {
  private connection: SolanaConnection;
  private walletManager: WalletManager;
  private tokenManager: TokenManager;
  private paymentManager: PaymentManager;

  constructor() {
    this.connection = new SolanaConnection(env.SOLANA_RPC_URL);
    this.walletManager = WalletManager.fromPrivateKey(env.BACKEND_WALLET_PRIVATE_KEY_ARRAY);
    
    const conn = this.connection.getConnection();
    const keypair = this.walletManager.getKeypair();
    
    this.tokenManager = new TokenManager(conn, keypair);
    this.paymentManager = new PaymentManager(conn, env.BACKEND_WALLET_PUBLIC_KEY);
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(txSignature: string, expectedAmount: number, senderAddress: string) {
    return await this.paymentManager.verifyPayment(txSignature, expectedAmount, senderAddress);
  }

  /**
   * Create parlay token and mint to user
   */
  async createParlayToken(userWalletAddress: string): Promise<{
    mintAddress: string;
    signature: string;
  }> {
    // Create new token mint
    const { mintAddress } = await this.tokenManager.createParlayToken(0);

    // Mint 1 token to user
    const signature = await this.tokenManager.mintParlayTokenToUser(
      mintAddress,
      userWalletAddress,
      1
    );

    return { mintAddress, signature };
  }

  /**
   * Check if user has parlay token
   */
  async userHasToken(mintAddress: string, userWalletAddress: string): Promise<boolean> {
    return await this.tokenManager.userHasToken(mintAddress, userWalletAddress);
  }

  /**
   * Send payout to winner
   */
  async sendPayout(recipientAddress: string, amount: number): Promise<string> {
    const keypair = this.walletManager.getKeypair();
    return await this.paymentManager.sendPayout(recipientAddress, amount, keypair);
  }

  /**
   * Get backend wallet balance
   */
  async getBackendBalance(): Promise<number> {
    return await this.paymentManager.getBackendBalance();
  }

  /**
   * Get backend wallet address
   */
  getBackendWalletAddress(): string {
    return this.walletManager.getPublicKeyString();
  }
}

export const solanaService = new SolanaService();
