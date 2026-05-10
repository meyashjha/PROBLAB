import { Connection, Commitment } from '@solana/web3.js';

export class SolanaConnection {
  private connection: Connection;
  private rpcUrl: string;

  constructor(rpcUrl: string, commitment: Commitment = 'confirmed') {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, commitment);
  }

  getConnection(): Connection {
    return this.connection;
  }

  async getBalance(publicKey: string): Promise<number> {
    const balance = await this.connection.getBalance(
      new (await import('@solana/web3.js')).PublicKey(publicKey)
    );
    return balance;
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const result = await this.connection.confirmTransaction(signature, 'confirmed');
      return !result.value.err;
    } catch (error) {
      console.error('Error confirming transaction:', error);
      return false;
    }
  }

  async getTransaction(signature: string) {
    return await this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  }

  async getLatestBlockhash() {
    return await this.connection.getLatestBlockhash('finalized');
  }
}
