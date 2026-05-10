import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

export interface PaymentVerification {
  verified: boolean;
  amount: number;
  from: string;
  to: string;
  signature: string;
  timestamp: number;
}

export class PaymentManager {
  private connection: Connection;
  private backendWallet: PublicKey;

  constructor(connection: Connection, backendWalletAddress: string) {
    this.connection = connection;
    this.backendWallet = new PublicKey(backendWalletAddress);
  }

  /**
   * Verify that a payment transaction was received
   */
  async verifyPayment(
    txSignature: string,
    expectedAmount: number,
    senderAddress: string
  ): Promise<PaymentVerification> {
    try {
      const transaction = await this.connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        return {
          verified: false,
          amount: 0,
          from: senderAddress,
          to: this.backendWallet.toBase58(),
          signature: txSignature,
          timestamp: Date.now(),
        };
      }

      // Check if transaction was successful
      if (transaction.meta?.err) {
        return {
          verified: false,
          amount: 0,
          from: senderAddress,
          to: this.backendWallet.toBase58(),
          signature: txSignature,
          timestamp: Date.now(),
        };
      }

      // Get pre and post balances
      const accountKeys = transaction.transaction.message.getAccountKeys();
      const backendWalletIndex = accountKeys.staticAccountKeys.findIndex(
        (key) => key.equals(this.backendWallet)
      );

      if (backendWalletIndex === -1) {
        return {
          verified: false,
          amount: 0,
          from: senderAddress,
          to: this.backendWallet.toBase58(),
          signature: txSignature,
          timestamp: Date.now(),
        };
      }

      if (!transaction.meta) {
        return {
          verified: false,
          amount: 0,
          from: senderAddress,
          to: this.backendWallet.toBase58(),
          signature: txSignature,
          timestamp: Date.now(),
        };
      }

      const preBalance = transaction.meta.preBalances[backendWalletIndex];
      const postBalance = transaction.meta.postBalances[backendWalletIndex];
      const receivedLamports = postBalance - preBalance;
      const receivedSol = receivedLamports / LAMPORTS_PER_SOL;

      // Allow small tolerance for transaction fees
      const tolerance = 0.001; // 0.001 SOL tolerance
      const verified = Math.abs(receivedSol - expectedAmount) <= tolerance;

      return {
        verified,
        amount: receivedSol,
        from: senderAddress,
        to: this.backendWallet.toBase58(),
        signature: txSignature,
        timestamp: transaction.blockTime || Date.now(),
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      return {
        verified: false,
        amount: 0,
        from: senderAddress,
        to: this.backendWallet.toBase58(),
        signature: txSignature,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Send payout to winner
   */
  async sendPayout(
    recipientAddress: string,
    amount: number,
    payerKeypair: Keypair
  ): Promise<string> {
    try {
      const recipient = new PublicKey(recipientAddress);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payerKeypair.publicKey,
          toPubkey: recipient,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payerKeypair],
        {
          commitment: 'confirmed',
        }
      );

      return signature;
    } catch (error) {
      console.error('Error sending payout:', error);
      throw new Error('Failed to send payout');
    }
  }

  /**
   * Get backend wallet balance
   */
  async getBackendBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.backendWallet);
    return balance / LAMPORTS_PER_SOL;
  }
}
