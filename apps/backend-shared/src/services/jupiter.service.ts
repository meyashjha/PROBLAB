import { env } from '../config/env';
import type { JupiterEvent, JupiterMarket, JupiterEventsResponse } from '@parlay-tokens/shared';

export class JupiterService {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseUrl: string = 'https://api.jup.ag';

  constructor() {
    this.apiKeys = env.JUPITER_API_KEYS_ARRAY;
  }

  /**
   * Rotate API keys to handle rate limiting
   */
  private getNextApiKey(): string {
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * Make authenticated request to Jupiter API with retry logic
   */
  private async jupiterFetch<T>(
    path: string,
    init?: RequestInit,
    retries: number = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const apiKey = this.getNextApiKey();
      
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            ...init?.headers,
          },
        });

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After')) || 10;
          console.warn(`Rate limited, waiting ${retryAfter}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!res.ok) {
          const errorText = await res.text();
          let errorBody: any = { message: errorText || `HTTP_${res.status}` };
          try {
            errorBody = errorText ? JSON.parse(errorText) : errorBody;
          } catch {
            // Keep text fallback
          }
          throw { status: res.status, ...errorBody };
        }

        return await res.json() as T;
      } catch (error: any) {
        if (attempt === retries - 1) {
          // Log safe error info only — never log headers/API keys
          const safeError = {
            message: error?.message || 'Unknown error',
            status: error?.status,
            path,
          };
          console.error('Jupiter API error after retries:', JSON.stringify(safeError));
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Failed to fetch from Jupiter API');
  }

  /**
   * Fetch all prediction market events
   */
  async getEvents(page: number = 1, limit: number = 50): Promise<JupiterEventsResponse> {
    try {
      const start = (page - 1) * limit;
      const end = start + limit;
      
      const response = await this.jupiterFetch<JupiterEventsResponse>(
        `/prediction/v1/events?start=${start}&end=${end}&includeMarkets=true`
      );

      // Response structure: { data: [...], pagination: {...} }
      return response;
    } catch (error) {
      console.error('Error fetching Jupiter events:', error);
      throw new Error('Failed to fetch prediction market events');
    }
  }

  /**
   * Search for specific events
   */
  async searchEvents(query: string, limit: number = 50): Promise<JupiterEvent[]> {
    try {
      const params = new URLSearchParams({
        query: query,
        limit: limit.toString(),
      });

      const response = await this.jupiterFetch<{ data: JupiterEvent[] }>(
        `/prediction/v1/events/search?${params.toString()}`
      );

      // Response structure: { data: [...] }
      return response.data || [];
    } catch (error) {
      console.error('Error searching Jupiter events:', error);
      return [];
    }
  }

  /**
   * Get specific market details
   */
  async getMarket(marketId: string): Promise<JupiterMarket | null> {
    try {
      // Market endpoint returns the market object directly
      const market = await this.jupiterFetch<JupiterMarket>(
        `/prediction/v1/markets/${marketId}`
      );

      return market;
    } catch (error: any) {
      // 404 is expected for markets that don't exist
      if (error?.status === 404) {
        console.log(`Market ${marketId} not found (404)`);
        return null;
      }
      // Log but don't throw - return null to handle gracefully
      console.error(`Error fetching market ${marketId}:`, error?.message || error);
      return null;
    }
  }

  /**
   * Get market orderbook
   */
  async getMarketOrderbook(marketId: string) {
    try {
      const response = await this.jupiterFetch<any>(
        `/prediction/v1/orderbook/${marketId}`
      );

      return response;
    } catch (error) {
      console.error(`Error fetching orderbook for ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Fetch ALL events from Jupiter, paginating exhaustively.
   *
   * Jupiter API uses `start` (0-indexed inclusive) and `end` (exclusive)
   * as range params — max window of 100 items per request.
   * We keep requesting batches until:
   *   - the API returns `pagination.hasNext === false`, OR
   *   - the returned data array is empty
   *
   * An optional `limit` can cap the total, but defaults to Infinity
   * so we get every event available.
   */
  async getAllEvents(options?: {
    category?: string;
    subcategory?: string;
    filter?: 'new' | 'live' | 'trending';
    sortBy?: 'volume' | 'beginAt';
    sortDirection?: 'asc' | 'desc';
    limit?: number;
  }): Promise<JupiterEvent[]> {
    try {
      const maxItems = options?.limit ?? Infinity;
      // Jupiter API returns max ~20 events per page regardless of window size.
      // Use 20-item steps to avoid wasting range slots.
      const PAGE_SIZE = 20;
      const allEvents: JupiterEvent[] = [];
      const seenIds = new Set<string>();

      let cursor = 0;
      let pageCount = 0;

      while (allEvents.length < maxItems) {
        const end = cursor + PAGE_SIZE;

        const params = new URLSearchParams({
          start: cursor.toString(),
          end: end.toString(),
          includeMarkets: 'true',
        });

        if (options?.category && options.category !== 'all') {
          params.append('category', options.category);
        }
        if (options?.subcategory) {
          params.append('subcategory', options.subcategory);
        }
        if (options?.filter) {
          params.append('filter', options.filter);
        }
        if (options?.sortBy) {
          params.append('sortBy', options.sortBy);
        }
        if (options?.sortDirection) {
          params.append('sortDirection', options.sortDirection);
        }

        const response = await this.jupiterFetch<JupiterEventsResponse>(
          `/prediction/v1/events?${params.toString()}`
        );

        const events = response.data || [];
        const pag = response.pagination;
        pageCount++;

        if (events.length === 0) {
          break;
        }

        // Deduplicate by eventId
        let newCount = 0;
        for (const event of events) {
          if (!seenIds.has(event.eventId)) {
            seenIds.add(event.eventId);
            allEvents.push(event);
            newCount++;
          }
        }

        // Advance cursor
        cursor = end;

        // Stop when API says no more pages
        if (pag?.hasNext === false) {
          break;
        }

        // Safety: cap cursor to avoid infinite loop
        if (cursor >= 2000) {
          console.warn('⚠️ Hit safety cap of 2000 cursor, stopping pagination');
          break;
        }

        // Brief delay between pages to reduce rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      // Trim to limit if specified
      const limited = maxItems < Infinity
        ? allEvents.slice(0, maxItems)
        : allEvents;

      // Filter to active events only
      const activeEvents = limited.filter((event: JupiterEvent) => event.isActive);

      console.log(`✅ Fetched ${activeEvents.length} active events from Jupiter (${allEvents.length} total, ${pageCount} pages, cursor=${cursor}) [category: ${options?.category || 'all'}]`);

      return activeEvents;
    } catch (error) {
      console.error('Error fetching all events:', error);
      return [];
    }
  }

  /**
   * Check if event has settled and get outcome
   */
  async checkEventSettlement(eventId: string, marketId: string): Promise<{
    settled: boolean;
    outcome?: 'YES' | 'NO';
  }> {
    try {
      const market = await this.getMarket(marketId);
      
      if (!market) {
        console.log(`Market ${marketId} not found`);
        return { settled: false };
      }

      console.log(`Market ${marketId} status: ${market.status}, result: ${market.result}`);

      // Check if market is settled or closed
      if (market.status === 'settled' || market.status === 'closed') {
        // Use the 'result' field from the API response
        // Result can be: "yes", "no", or null/empty
        if (market.result) {
          const outcome = market.result.toUpperCase() as 'YES' | 'NO';
          console.log(`✅ Market ${marketId} settled with outcome: ${outcome}`);
          return { settled: true, outcome };
        } else {
          console.log(`⚠️ Market ${marketId} is ${market.status} but has no result yet`);
          return { settled: false };
        }
      }

      return { settled: false };
    } catch (error) {
      console.error(`Error checking settlement for event ${eventId}:`, error);
      return { settled: false };
    }
  }
}

export const jupiterService = new JupiterService();
