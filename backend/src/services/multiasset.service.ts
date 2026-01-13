import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * ENHANCEMENT 8: Multi-Asset Support Service
 * 
 * Extends beyond stocks and crypto to include:
 * - Mutual Funds (NAV from mfapi.in)
 * - Gold ETFs (Gold BeES, Kotak Gold ETF)
 * - Bonds (different tax treatment)
 * 
 * Tax implications differ by asset class
 */

export type AssetCategory = 'equity' | 'crypto' | 'mutual_fund' | 'gold_etf' | 'bond' | 'debt_mf';

interface AssetPrice {
  price: number;
  source: string;
  timestamp: Date;
}

interface MutualFundNAV {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

class MultiAssetService {
  private readonly MF_API_BASE = 'https://api.mfapi.in/mf';
  private readonly GOLD_API_BASE = 'https://api.metals.live/v1/spot';

  /**
   * Get Mutual Fund NAV from mfapi.in
   * Scheme codes: Search at https://api.mfapi.in/mf/search?q=HDFC
   */
  async getMutualFundNAV(schemeCode: string): Promise<number> {
    try {
      const response = await axios.get(`${this.MF_API_BASE}/${schemeCode}`, {
        timeout: 5000
      });

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        throw new Error(`No NAV data found for scheme ${schemeCode}`);
      }

      // Get latest NAV (first entry)
      const latestNAV = response.data.data[0];
      const nav = parseFloat(latestNAV.nav);

      if (isNaN(nav)) {
        throw new Error(`Invalid NAV value for scheme ${schemeCode}`);
      }

      logger.debug(`Mutual Fund ${schemeCode} NAV: ₹${nav}`);
      return nav;
    } catch (error: any) {
      logger.error(`Failed to fetch MF NAV for ${schemeCode}:`, error.message);
      throw new Error(`Failed to fetch mutual fund NAV for ${schemeCode}`);
    }
  }

  /**
   * Search mutual funds by name
   */
  async searchMutualFunds(query: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.MF_API_BASE}/search`, {
        params: { q: query },
        timeout: 5000
      });

      return response.data || [];
    } catch (error: any) {
      logger.error(`Failed to search mutual funds:`, error.message);
      return [];
    }
  }

  /**
   * Get Gold price (USD per ounce, converted to INR per gram)
   */
  async getGoldPrice(): Promise<number> {
    try {
      const response = await axios.get(`${this.GOLD_API_BASE}/gold`, {
        timeout: 5000
      });

      const pricePerOunce = response.data.price; // USD per ounce
      const usdToInr = 83; // Approximate, should be fetched from forex API
      const gramsPerOunce = 31.1035;

      const pricePerGram = (pricePerOunce * usdToInr) / gramsPerOunce;

      logger.debug(`Gold price: ₹${Math.round(pricePerGram)} per gram`);
      return Math.round(pricePerGram);
    } catch (error: any) {
      logger.error('Failed to fetch gold price:', error.message);
      
      // Fallback: approximate based on known range
      const approximatePrice = 6500; // ₹6500 per gram (fallback)
      logger.warn(`Using approximate gold price: ₹${approximatePrice}`);
      return approximatePrice;
    }
  }

  /**
   * Get Gold ETF price (Gold BeES on NSE)
   */
  async getGoldETFPrice(symbol: string = 'GOLDBEES'): Promise<number> {
    try {
      // Gold ETFs trade on NSE like stocks
      const response = await axios.get(
        `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`,
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
        logger.debug(`Gold ETF ${symbol} price: ₹${price}`);
        return price;
      }

      throw new Error('Invalid price data');
    } catch (error: any) {
      logger.error(`Failed to fetch Gold ETF price for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch Gold ETF price for ${symbol}`);
    }
  }

  /**
   * Calculate tax based on asset category
   * 
   * Tax Rules by Asset Class:
   * 1. Equity: 20% STCG (<1 yr), 12.5% LTCG (>1 yr, after 1L exemption)
   * 2. Crypto: 30% flat (no LTCG benefit)
   * 3. Equity MF: Same as equity (if >65% equity exposure)
   * 4. Debt MF: 30% STCG (<3 yr), 12.5% LTCG (>3 yr) without indexation
   * 5. Gold/Gold ETF: 30% STCG (<3 yr), 12.5% LTCG (>3 yr) without indexation
   * 6. Bonds: 30% STCG (<3 yr), 12.5% LTCG (>3 yr) without indexation
   */
  calculateTaxByAssetCategory(
    gain: number,
    category: AssetCategory,
    holdingPeriodDays: number
  ): {
    taxRate: number;
    tax: number;
    gainType: 'SHORT_TERM' | 'LONG_TERM';
    exemption: number;
  } {
    let taxRate = 0;
    let gainType: 'SHORT_TERM' | 'LONG_TERM' = 'SHORT_TERM';
    let exemption = 0;

    switch (category) {
      case 'equity':
        if (holdingPeriodDays >= 365) {
          // Long-term equity
          gainType = 'LONG_TERM';
          exemption = 100000; // ₹1L exemption
          const taxableGain = Math.max(0, gain - exemption);
          taxRate = 0.125; // 12.5%
          return {
            taxRate,
            tax: taxableGain * taxRate,
            gainType,
            exemption
          };
        } else {
          // Short-term equity
          taxRate = 0.20; // 20%
          return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
        }

      case 'crypto':
        // Crypto: Flat 30%, no LTCG benefit
        taxRate = 0.30;
        return { taxRate: 0.30, tax: gain * 0.30, gainType: 'SHORT_TERM', exemption: 0 };

      case 'mutual_fund':
        // Equity MF (>65% equity): Same as equity
        if (holdingPeriodDays >= 365) {
          gainType = 'LONG_TERM';
          exemption = 100000;
          const taxableGain = Math.max(0, gain - exemption);
          taxRate = 0.125;
          return { taxRate, tax: taxableGain * taxRate, gainType, exemption };
        } else {
          taxRate = 0.20;
          return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
        }

      case 'debt_mf':
        // Debt MF: LTCG after 3 years
        if (holdingPeriodDays >= 1095) {
          gainType = 'LONG_TERM';
          taxRate = 0.125; // 12.5% without indexation
          return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
        } else {
          taxRate = 0.30;
          return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
        }

      case 'gold_etf':
      case 'bond':
        // Gold/Bonds: LTCG after 3 years
        if (holdingPeriodDays >= 1095) {
          gainType = 'LONG_TERM';
          taxRate = 0.125; // 12.5% without indexation
          return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
        } else {
          taxRate = 0.30;
          return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
        }

      default:
        // Default: treat as other capital assets
        taxRate = 0.30;
        return { taxRate, tax: gain * taxRate, gainType, exemption: 0 };
    }
  }

  /**
   * Get holding period requirement for LTCG by asset category
   */
  getLTCGHoldingPeriod(category: AssetCategory): number {
    switch (category) {
      case 'equity':
      case 'mutual_fund':
        return 365; // 1 year

      case 'crypto':
        return Infinity; // No LTCG benefit

      case 'debt_mf':
      case 'gold_etf':
      case 'bond':
        return 1095; // 3 years

      default:
        return 1095;
    }
  }

  /**
   * Validate asset category and symbol
   */
  async validateAsset(symbol: string, category: AssetCategory): Promise<boolean> {
    try {
      switch (category) {
        case 'mutual_fund':
        case 'debt_mf':
          // Validate MF scheme code (6 digits)
          if (!/^\d{6}$/.test(symbol)) {
            return false;
          }
          await this.getMutualFundNAV(symbol);
          return true;

        case 'gold_etf':
          // Validate Gold ETF symbol
          const validGoldETFs = ['GOLDBEES', 'KOTAKGOLD', 'GOLDSHARE'];
          return validGoldETFs.includes(symbol.toUpperCase());

        case 'bond':
          // Bonds have ISIN codes (12 alphanumeric)
          return /^[A-Z]{2}[A-Z0-9]{10}$/.test(symbol);

        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get price for any asset category
   */
  async getAssetPrice(symbol: string, category: AssetCategory): Promise<AssetPrice> {
    try {
      let price: number;
      let source: string;

      switch (category) {
        case 'mutual_fund':
        case 'debt_mf':
          price = await this.getMutualFundNAV(symbol);
          source = 'mfapi.in';
          break;

        case 'gold_etf':
          price = await this.getGoldETFPrice(symbol);
          source = 'NSE';
          break;

        case 'bond':
          // Bonds require specialized pricing - placeholder
          throw new Error('Bond pricing not yet implemented');

        default:
          throw new Error(`Unsupported asset category: ${category}`);
      }

      return {
        price,
        source,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error(`Failed to get asset price for ${symbol} (${category}):`, error.message);
      throw error;
    }
  }
}

export default new MultiAssetService();
