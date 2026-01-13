import yahooFinance from 'yahoo-finance2';
import axios from 'axios';
import { db } from '../database';
import { logger } from '../utils/logger';

// Circuit breaker for API resilience
interface CircuitBreaker {
  failures: number;
  isOpen: boolean;
  lastFailTime: number | null;
  successCount: number;
}

interface PriceData {
  symbol: string;
  price: number;
  timestamp: Date;
}

const circuitBreakers: { [key: string]: CircuitBreaker } = {};

class PriceEnhancedService {
  private readonly COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
  private readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private priceCache = new Map<string, { price: number; timestamp: number }>();

  /**
   * ENHANCEMENT 1: Get stock price with 3-level fallback strategy
   * Level 1: Yahoo Finance (Primary)
   * Level 2: NSE India API (Fallback)
   * Level 3: Cached price from database (Emergency)
   */
  async getStockPrice(symbol: string): Promise<number> {
    try {
      // Check in-memory cache first
      const cached = this.getCachedPrice(symbol);
      if (cached !== null) return cached;

      // Level 1: Try Yahoo Finance with circuit breaker
      try {
        const price = await this.fetchWithCircuitBreaker('yahoo', async () => {
          const yahooSymbol = symbol.toUpperCase().includes('.NS') 
            ? symbol.toUpperCase() 
            : `${symbol.toUpperCase()}.NS`;

          const quote: any = await yahooFinance.quote(yahooSymbol);
          
          if (!quote || typeof quote.regularMarketPrice !== 'number') {
            throw new Error(`Invalid price data for ${symbol}`);
          }

          return quote.regularMarketPrice;
        });

        this.setCachedPrice(symbol, price);
        await this.storePrice(symbol, price, 'yahoo_finance');
        return price;
      } catch (yahooError) {
        logger.warn(`Yahoo Finance failed for ${symbol}, trying fallback...`);
      }

      // Level 2: Try NSE India API
      try {
        const nsePrice = await this.getNSEPrice(symbol);
        if (nsePrice) {
          this.setCachedPrice(symbol, nsePrice);
          await this.storePrice(symbol, nsePrice, 'nse_india');
          return nsePrice;
        }
      } catch (nseError) {
        logger.warn(`NSE India failed for ${symbol}, using cached price...`);
      }

      // Level 3: Get last known price from database (with staleness warning)
      const cachedPrice = await this.getLastKnownPrice(symbol);
      if (cachedPrice) {
        logger.warn(`Using stale cached price for ${symbol}: ₹${cachedPrice.price} (${cachedPrice.age} old)`);
        return cachedPrice.price;
      }

      throw new Error(`All price sources unavailable for ${symbol}`);
    } catch (error: any) {
      logger.error(`Critical: Failed to fetch stock price for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch stock price for ${symbol}`);
    }
  }

  /**
   * ENHANCEMENT 1: Fetch with circuit breaker pattern
   */
  private async fetchWithCircuitBreaker<T>(
    service: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    if (!circuitBreakers[service]) {
      circuitBreakers[service] = {
        failures: 0,
        isOpen: false,
        lastFailTime: null,
        successCount: 0
      };
    }

    const breaker = circuitBreakers[service];

    // Check if circuit is open
    if (breaker.isOpen) {
      const timeSinceLastFail = Date.now() - (breaker.lastFailTime || 0);
      const waitTime = 60000; // 1 minute

      if (timeSinceLastFail < waitTime) {
        throw new Error(`Circuit breaker is open for ${service}. Retry after ${Math.ceil((waitTime - timeSinceLastFail) / 1000)}s`);
      }

      // Half-open state: try one request
      logger.info(`Circuit breaker half-open for ${service}, attempting request...`);
      breaker.isOpen = false;
    }

    try {
      const result = await fetchFn();
      
      // Success: reset failure count
      breaker.failures = 0;
      breaker.successCount++;
      
      if (breaker.successCount >= 3) {
        logger.info(`Circuit breaker closed for ${service} after 3 successful requests`);
        breaker.successCount = 0;
      }

      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailTime = Date.now();

      if (breaker.failures >= 3) {
        breaker.isOpen = true;
        logger.error(`Circuit breaker opened for ${service} after 3 failures`);
      }

      throw error;
    }
  }

  /**
   * ENHANCEMENT 1: Fallback - NSE India API
   */
  private async getNSEPrice(symbol: string): Promise<number | null> {
    try {
      const response = await axios.get(
        `https://www.nseindia.com/api/quote-equity?symbol=${symbol.toUpperCase()}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );

      const price = response.data?.priceInfo?.lastPrice;
      if (typeof price === 'number') {
        return price;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * ENHANCEMENT 1: Emergency fallback - Get last known price from database
   */
  private async getLastKnownPrice(symbol: string): Promise<{ price: number; age: string } | null> {
    try {
      const result = await db.query(
        `SELECT price, recorded_at 
         FROM price_history 
         WHERE asset_symbol = $1 
         ORDER BY recorded_at DESC 
         LIMIT 1`,
        [symbol]
      );

      if (result.rows.length > 0) {
        const price = parseFloat(result.rows[0].price);
        const recordedAt = new Date(result.rows[0].recorded_at);
        const ageMs = Date.now() - recordedAt.getTime();
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        const age = ageHours > 24 ? `${Math.floor(ageHours / 24)} days` : `${ageHours} hours`;

        return { price, age };
      }

      return null;
    } catch (error) {
      logger.error('Failed to fetch last known price from database:', error);
      return null;
    }
  }

  /**
   * ENHANCEMENT 1: Store price in database for fallback
   */
  private async storePrice(symbol: string, price: number, source: string): Promise<void> {
    try {
      await db.query(
        `INSERT INTO price_history (asset_symbol, price, recorded_at, source) 
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (asset_symbol, recorded_at) DO UPDATE SET price = $2, source = $3`,
        [symbol, price, source]
      );
    } catch (error) {
      logger.error('Failed to store price in database:', error);
    }
  }

  /**
   * Get crypto price with fallback
   */
  async getCryptoPrice(symbol: string): Promise<number> {
    try {
      const cached = this.getCachedPrice(symbol);
      if (cached !== null) return cached;

      const coinId = this.getCoinGeckoId(symbol);

      const response = await axios.get(
        `${this.COINGECKO_BASE_URL}/simple/price`,
        {
          params: {
            ids: coinId,
            vs_currencies: 'inr'
          },
          timeout: 10000
        }
      );

      if (!response.data || !response.data[coinId] || !response.data[coinId].inr) {
        throw new Error(`Invalid price data for ${symbol}`);
      }

      const price = response.data[coinId].inr;
      this.setCachedPrice(symbol, price);
      await this.storePrice(symbol, price, 'coingecko');

      return price;
    } catch (error: any) {
      logger.error(`Error fetching crypto price for ${symbol}:`, error.message);
      
      // Fallback to database
      const cached = await this.getLastKnownPrice(symbol);
      if (cached) {
        logger.warn(`Using cached crypto price for ${symbol}`);
        return cached.price;
      }

      throw new Error(`Failed to fetch crypto price for ${symbol}`);
    }
  }

  /**
   * Get API status for dashboard
   */
  async getAPIStatus(): Promise<{ [key: string]: 'operational' | 'degraded' | 'down' }> {
    const status: { [key: string]: 'operational' | 'degraded' | 'down' } = {};

    // Check Yahoo Finance
    const yahooBreaker = circuitBreakers['yahoo'];
    if (yahooBreaker?.isOpen) {
      status.yahoo_finance = 'down';
    } else if (yahooBreaker?.failures > 0) {
      status.yahoo_finance = 'degraded';
    } else {
      status.yahoo_finance = 'operational';
    }

    // Check CoinGecko
    try {
      await axios.get(`${this.COINGECKO_BASE_URL}/ping`, { timeout: 3000 });
      status.coingecko = 'operational';
    } catch {
      status.coingecko = 'down';
    }

    return status;
  }

  private getCachedPrice(symbol: string): number | null {
    const cached = this.priceCache.get(symbol.toUpperCase());
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION_MS;
    if (isExpired) {
      this.priceCache.delete(symbol.toUpperCase());
      return null;
    }

    return cached.price;
  }

  private setCachedPrice(symbol: string, price: number): void {
    this.priceCache.set(symbol.toUpperCase(), {
      price,
      timestamp: Date.now()
    });
  }

  private getCoinGeckoId(symbol: string): string {
    const symbolMap: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'MATIC': 'matic-network',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'AVAX': 'avalanche-2',
      'DOGE': 'dogecoin',
      'SHIB': 'shiba-inu',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'FTM': 'fantom',
      'NEAR': 'near',
      'ALGO': 'algorand',
      'VET': 'vechain',
      'ICP': 'internet-computer',
      'FIL': 'filecoin',
      'APT': 'aptos',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'INJ': 'injective-protocol',
      'TIA': 'celestia',
      'SEI': 'sei-network',
      'SUI': 'sui',
      'STRK': 'starknet',
      'WLD': 'worldcoin',
      'PEPE': 'pepe'
    };

    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  }
}

export default new PriceEnhancedService();
