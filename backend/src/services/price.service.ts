import yahooFinance from 'yahoo-finance2';
import axios from 'axios';
import { db } from '../database';

interface PriceData {
  symbol: string;
  price: number;
  timestamp: Date;
}

class PriceService {
  private readonly COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
  private readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private priceCache = new Map<string, { price: number; timestamp: number }>();

  /**
   * Fetch stock price from Yahoo Finance
   * Automatically adds .NS suffix for NSE stocks
   */
  async getStockPrice(symbol: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.getCachedPrice(symbol);
      if (cached !== null) {
        return cached;
      }

      // Add .NS suffix for NSE stocks if not present
      const yahooSymbol = symbol.toUpperCase().includes('.NS') 
        ? symbol.toUpperCase() 
        : `${symbol.toUpperCase()}.NS`;

      const quote: any = await yahooFinance.quote(yahooSymbol);
      
      if (!quote || typeof quote.regularMarketPrice !== 'number') {
        throw new Error(`Invalid price data for ${symbol}`);
      }

      const price = quote.regularMarketPrice;
      this.setCachedPrice(symbol, price);
      
      return price;
    } catch (error: any) {
      console.error(`Error fetching stock price for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch stock price for ${symbol}`);
    }
  }

  /**
   * Fetch crypto price from CoinGecko
   * Converts symbol to CoinGecko ID (e.g., BTC -> bitcoin)
   */
  async getCryptoPrice(symbol: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.getCachedPrice(symbol);
      if (cached !== null) {
        return cached;
      }

      // Convert common symbols to CoinGecko IDs
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

      return price;
    } catch (error: any) {
      console.error(`Error fetching crypto price for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch crypto price for ${symbol}`);
    }
  }

  /**
   * Validate if symbol exists and is tradeable
   */
  async validateSymbol(symbol: string, assetType: 'stock' | 'crypto'): Promise<boolean> {
    try {
      if (assetType === 'stock') {
        await this.getStockPrice(symbol);
        return true;
      } else {
        await this.getCryptoPrice(symbol);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Update all holdings with current prices
   * Returns count of updated holdings
   */
  async updateAllHoldingsPrices(userId?: string): Promise<number> {
    try {
      const query = userId
        ? 'SELECT holding_id, asset_symbol, asset_type FROM holdings WHERE user_id = $1'
        : 'SELECT holding_id, asset_symbol, asset_type FROM holdings';

      const params = userId ? [userId] : [];
      const result = await db.query(query, params);

      let updatedCount = 0;

      for (const holding of result.rows) {
        try {
          const price = holding.asset_type === 'stock'
            ? await this.getStockPrice(holding.asset_symbol)
            : await this.getCryptoPrice(holding.asset_symbol);

          await db.query(
            'UPDATE holdings SET current_price = $1, updated_at = NOW() WHERE holding_id = $2',
            [price, holding.holding_id]
          );

          // Store in price history
          await this.savePriceHistory({
            symbol: holding.asset_symbol,
            price,
            timestamp: new Date()
          });

          updatedCount++;
        } catch (error: any) {
          console.error(`Failed to update price for ${holding.asset_symbol}:`, error.message);
          // Continue with other holdings
        }
      }

      console.log(`Updated prices for ${updatedCount} holdings`);
      return updatedCount;
    } catch (error: any) {
      console.error('Error updating holdings prices:', error.message);
      throw error;
    }
  }

  /**
   * Save price to history table for charting
   */
  private async savePriceHistory(data: PriceData): Promise<void> {
    try {
      await db.query(
        `INSERT INTO price_history (asset_symbol, price, recorded_at) 
         VALUES ($1, $2, $3)
         ON CONFLICT (asset_symbol, recorded_at) 
         DO UPDATE SET price = $2`,
        [data.symbol, data.price, data.timestamp]
      );
    } catch (error: any) {
      // Non-critical, just log
      console.error('Error saving price history:', error.message);
    }
  }

  /**
   * Get cached price if available and not expired
   */
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

  /**
   * Cache price for 15 minutes
   */
  private setCachedPrice(symbol: string, price: number): void {
    this.priceCache.set(symbol.toUpperCase(), {
      price,
      timestamp: Date.now()
    });
  }

  /**
   * Convert symbol to CoinGecko ID
   */
  private getCoinGeckoId(symbol: string): string {
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'SHIB': 'shiba-inu',
      'AVAX': 'avalanche-2',
      'LTC': 'litecoin',
      'UNI': 'uniswap',
      'LINK': 'chainlink',
      'ATOM': 'cosmos',
      'XLM': 'stellar',
      'ETC': 'ethereum-classic',
      'BCH': 'bitcoin-cash',
      'ALGO': 'algorand',
      'FIL': 'filecoin',
      'TRX': 'tron',
      'APT': 'aptos',
      'ARB': 'arbitrum',
      'OP': 'optimism'
    };

    const upperSymbol = symbol.toUpperCase();
    return symbolMap[upperSymbol] || symbol.toLowerCase();
  }

  /**
   * Get price history for charting
   */
  async getPriceHistory(
    symbol: string, 
    days: number = 30
  ): Promise<Array<{ date: Date; price: number }>> {
    try {
      const result = await db.query(
        `SELECT recorded_at as date, price 
         FROM price_history 
         WHERE asset_symbol = $1 
         AND recorded_at >= NOW() - INTERVAL '${days} days'
         ORDER BY recorded_at ASC`,
        [symbol]
      );

      return result.rows;
    } catch (error: any) {
      console.error(`Error fetching price history for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.priceCache.clear();
    console.log('Price cache cleared');
  }
}

export default new PriceService();
