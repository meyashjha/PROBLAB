// Types
export * from './types/parlay';
export * from './types/jupiter';
export * from './types/api';
export * from './types/probabilityOption';

// Constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const JUPITER_PRICE_UNIT = 1_000_000; // 1,000,000 native units = $1.00

// Utilities
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function jupiterPriceToUsd(price: number): number {
  return price / JUPITER_PRICE_UNIT;
}

export function usdToJupiterPrice(usd: number): number {
  return Math.floor(usd * JUPITER_PRICE_UNIT);
}
