import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';

export class TokenManager {
  private connection: Connection;
  private payer: Keypair;

  constructor(connection: Connection, payer: Keypair) {
    this.connection = connection;
    this.payer = payer;
  }

  /**
   * Create a new SPL token mint for a parlay
   */
  async createParlayToken(
    decimals: number = 0
  ): Promise<{ mint: PublicKey; mintAddress: string }> {
    try {
      const mint = await createMint(
        this.connection,
        this.payer,
        this.payer.publicKey,
        this.payer.publicKey,
        decimals,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
      );

      return {
        mint,
        mintAddress: mint.toBase58(),
      };
    } catch (error) {
      console.error('Error creating parlay token:', error);
      throw new Error('Failed to create parlay token');
    }
  }

  /**
   * Mint parlay tokens to user's wallet
   */
  async mintParlayTokenToUser(
    mintAddress: string,
    userWalletAddress: string,
    amount: number = 1
  ): Promise<string> {
    try {
      const mint = new PublicKey(mintAddress);
      const userPublicKey = new PublicKey(userWalletAddress);

      // Get or create associated token account for user
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mint,
        userPublicKey
      );

      // Mint tokens to user's account
      const signature = await mintTo(
        this.connection,
        this.payer,
        mint,
        userTokenAccount.address,
        this.payer,
        amount
      );

      return signature;
    } catch (error) {
      console.error('Error minting parlay token to user:', error);
      throw new Error('Failed to mint parlay token to user');
    }
  }

  /**
   * Check if user has the parlay token
   */
  async userHasToken(
    mintAddress: string,
    userWalletAddress: string
  ): Promise<boolean> {
    try {
      const mint = new PublicKey(mintAddress);
      const userPublicKey = new PublicKey(userWalletAddress);

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mint,
        userPublicKey
      );

      const accountInfo = await getAccount(this.connection, userTokenAccount.address);
      return Number(accountInfo.amount) > 0;
    } catch (error) {
      console.error('Error checking user token:', error);
      return false;
    }
  }

  /**
   * Get token balance for a user
   */
  async getTokenBalance(
    mintAddress: string,
    userWalletAddress: string
  ): Promise<number> {
    try {
      const mint = new PublicKey(mintAddress);
      const userPublicKey = new PublicKey(userWalletAddress);

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mint,
        userPublicKey
      );

      const accountInfo = await getAccount(this.connection, userTokenAccount.address);
      return Number(accountInfo.amount);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }
}
