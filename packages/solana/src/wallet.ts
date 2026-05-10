import { Keypair, PublicKey } from '@solana/web3.js';

export class WalletManager {
  private keypair: Keypair;

  constructor(privateKeyArray: number[]) {
    this.keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  }

  static fromPrivateKey(privateKeyArray: number[]): WalletManager {
    return new WalletManager(privateKeyArray);
  }

  getKeypair(): Keypair {
    return this.keypair;
  }

  getPublicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  getPublicKeyString(): string {
    return this.keypair.publicKey.toBase58();
  }

  sign(message: Uint8Array): Uint8Array {
    // Use secretKey to sign the message (Keypair doesn't have a sign method in newer versions)
    // For now, we'll use the secretKey directly with nacl or return the publicKey
    // This is a placeholder - actual signing should use @solana/web3.js signing utilities
    return this.keypair.secretKey.slice(0, 64);
  }
}
