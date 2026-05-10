import { parlayApi, optionsApi } from '../config/api';
import { createAuthHeaders, type WalletAuthHeaders } from './walletAuth';
import type {
  ApiResponse,
  CreateParlayInput,
  ClaimParlayInput,
  Parlay,
  CreateOptionInput,
  ExerciseOptionInput,
  ProbabilityOption,
  OptionQuote,
  OptionPricingParams,
  ScoredMarket,
  OptionsChainEntry,
  MarketSnapshotData,
  PayoffPoint,
} from '@parlay-tokens/shared';

/**
 * Wallet signer state — set once by the app when wallet connects.
 * This avoids prop-drilling signMessage through every component.
 */
let _signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null = null;
let _publicKey: string | null = null;

/**
 * Set the wallet signer. Call this from the app root when the wallet connects.
 */
export function setWalletSigner(
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null,
  publicKey: string | null
) {
  _signMessage = signMessage;
  _publicKey = publicKey;
}

/**
 * Get auth headers for state-changing requests.
 * Throws if wallet is not connected or signMessage is unavailable.
 */
async function getAuthHeaders(action: string): Promise<WalletAuthHeaders> {
  if (!_signMessage || !_publicKey) {
    throw new Error('Wallet not connected. Please connect your wallet to perform this action.');
  }
  return createAuthHeaders(_signMessage, _publicKey, action);
}

export class ApiService {
  // Jupiter API (on parlay service)
  static async getEvents(page: number = 1, limit: number = 50) {
    const response = await parlayApi.get<ApiResponse>('/jupiter/events', {
      params: { page, limit },
    });
    return response.data;
  }

  static async getAllEvents(category?: string, filter?: string, limit?: number) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (filter) params.append('filter', filter);
    if (limit) params.append('limit', limit.toString());
    
    const url = `/jupiter/events/all${params.toString() ? '?' + params.toString() : ''}`;
    const response = await parlayApi.get<ApiResponse>(url);
    return response.data;
  }

  static async searchEvents(query: string) {
    const response = await parlayApi.get<ApiResponse>('/jupiter/events/search', {
      params: { q: query },
    });
    return response.data;
  }

  static async getMarket(marketId: string) {
    const response = await parlayApi.get<ApiResponse>(`/jupiter/markets/${marketId}`);
    return response.data;
  }

  // Parlay API — state-changing routes require wallet auth
  static async createParlay(input: CreateParlayInput) {
    const authHeaders = await getAuthHeaders('create-parlay');
    const response = await parlayApi.post<ApiResponse<Parlay>>('/parlays', input, {
      headers: authHeaders,
    });
    return response.data;
  }

  static async confirmPayment(parlayId: string, txSignature: string) {
    const authHeaders = await getAuthHeaders('confirm-payment');
    const response = await parlayApi.post<ApiResponse<Parlay>>(
      `/parlays/${parlayId}/confirm-payment`,
      { txSignature },
      { headers: authHeaders }
    );
    return response.data;
  }

  static async getParlayById(parlayId: string) {
    const response = await parlayApi.get<ApiResponse<Parlay>>(`/parlays/${parlayId}`);
    return response.data;
  }

  static async getParlaysByWallet(walletAddress: string) {
    const response = await parlayApi.get<ApiResponse<Parlay[]>>(`/parlays/wallet/${walletAddress}`);
    return response.data;
  }

  static async claimParlay(input: ClaimParlayInput) {
    const authHeaders = await getAuthHeaders('claim-parlay');
    const response = await parlayApi.post<ApiResponse>(
      `/parlays/${input.parlayId}/claim`,
      { walletAddress: input.walletAddress },
      { headers: authHeaders }
    );
    return response.data;
  }

  static async getStats(walletAddress?: string) {
    const url = walletAddress ? `/parlays/stats/${walletAddress}` : '/parlays/stats';
    const response = await parlayApi.get<ApiResponse>(url);
    return response.data;
  }

  // Health API
  static async getHealth() {
    const response = await parlayApi.get<ApiResponse>('/health');
    return response.data;
  }

  static async getBackendWallet() {
    const response = await parlayApi.get<ApiResponse>('/health/backend-wallet');
    return response.data;
  }

  // Probability Options API — state-changing routes require wallet auth
  static async getOptionQuote(params: OptionPricingParams) {
    const response = await optionsApi.post<ApiResponse<OptionQuote>>('/options/quote', params);
    return response.data;
  }

  static async createOption(input: CreateOptionInput) {
    const authHeaders = await getAuthHeaders('create-option');
    const response = await optionsApi.post<ApiResponse<ProbabilityOption>>('/options', input, {
      headers: authHeaders,
    });
    return response.data;
  }

  static async confirmOptionPayment(optionId: string, txSignature: string) {
    const authHeaders = await getAuthHeaders('confirm-option-payment');
    const response = await optionsApi.post<ApiResponse<ProbabilityOption>>(
      `/options/${optionId}/confirm-payment`,
      { txSignature },
      { headers: authHeaders }
    );
    return response.data;
  }

  static async getOptionById(optionId: string) {
    const response = await optionsApi.get<ApiResponse<ProbabilityOption>>(`/options/${optionId}`);
    return response.data;
  }

  static async updateOptionValue(optionId: string) {
    const response = await optionsApi.put<ApiResponse<ProbabilityOption>>(`/options/${optionId}/update-value`);
    return response.data;
  }

  static async exerciseOption(input: ExerciseOptionInput) {
    const authHeaders = await getAuthHeaders('exercise-option');
    const response = await optionsApi.post<ApiResponse>(
      `/options/${input.optionId}/exercise`,
      { walletAddress: input.walletAddress },
      { headers: authHeaders }
    );
    return response.data;
  }

  static async getOptionsByWallet(walletAddress: string) {
    const response = await optionsApi.get<ApiResponse<ProbabilityOption[]>>(`/options/wallet/${walletAddress}`);
    return response.data;
  }

  static async getOptionStats(walletAddress?: string) {
    const url = walletAddress ? `/options/stats/${walletAddress}` : '/options/stats';
    const response = await optionsApi.get<ApiResponse>(url);
    return response.data;
  }

  static async getImpliedVolatility(eventId: string, marketId: string) {
    const response = await optionsApi.get<ApiResponse<{ impliedVolatility: number }>>(
      `/options/volatility/${eventId}/${marketId}`
    );
    return response.data;
  }

  // ─── New: Scored Markets, Options Chain, Snapshots, Payoff ──────

  static async getScoredMarkets(category?: string, limit?: number) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (limit) params.append('limit', limit.toString());
    const url = `/events/scored${params.toString() ? '?' + params.toString() : ''}`;
    const response = await optionsApi.get<ApiResponse<{ markets: ScoredMarket[]; total: number }>>(url);
    return response.data;
  }

  static async getOptionsChain(marketId: string, eventId?: string) {
    const params = eventId ? `?eventId=${eventId}` : '';
    const response = await optionsApi.get<ApiResponse<{
      chain: OptionsChainEntry[];
      currentProbability: number;
      daysToExpiry: number;
      impliedVolatility: number;
    }>>(`/events/chain/${marketId}${params}`);
    return response.data;
  }

  static async getMarketSnapshots(marketId: string, since?: string) {
    const params = since ? `?since=${since}` : '';
    const response = await optionsApi.get<ApiResponse<{
      snapshots: MarketSnapshotData[];
      total: number;
    }>>(`/events/snapshots/${marketId}${params}`);
    return response.data;
  }

  static async getPayoffData(
    marketId: string,
    strike: number,
    expiry: number,
    optionType: 'CALL' | 'PUT',
    notional: number,
    eventId?: string
  ) {
    const params = new URLSearchParams({
      strike: strike.toString(),
      expiry: expiry.toString(),
      optionType,
      notional: notional.toString(),
    });
    if (eventId) params.append('eventId', eventId);
    const response = await optionsApi.get<ApiResponse<{
      payoffPoints: PayoffPoint[];
      premium: number;
      breakEven: number;
      maxProfit: number;
      maxLoss: number;
      currentProbability: number;
    }>>(`/events/payoff/${marketId}?${params.toString()}`);
    return response.data;
  }
}
