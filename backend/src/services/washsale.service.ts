import { db } from '../database';
import { logger } from '../utils/logger';

/**
 * ENHANCEMENT 6: Wash Sale Prevention Service
 * 
 * Prevents tax loss harvesting violations by tracking 30-day repurchase windows.
 * 
 * Indian Tax Law: While not explicitly called "wash sale", selling and immediately
 * repurchasing the same asset can be viewed as tax avoidance. Best practice is to
 * wait 30 days before repurchasing to ensure the loss is legitimate.
 */

interface WashSaleCheck {
  isWashSale: boolean;
  recentSellDate: Date | null;
  canBuyBackAfter: Date | null;
  daysRemaining: number;
  sellPrice: number | null;
  warning: string | null;
}

interface Transaction {
  transaction_id: string;
  asset_symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  transaction_date: Date;
}

class WashSaleService {
  private readonly WASH_SALE_DAYS = 30;

  /**
   * Check if buying this asset would trigger a wash sale
   */
  async checkWashSale(
    userId: string,
    assetSymbol: string,
    proposedBuyDate?: Date
  ): Promise<WashSaleCheck> {
    try {
      const buyDate = proposedBuyDate || new Date();
      const thirtyDaysBefore = new Date(buyDate);
      thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - this.WASH_SALE_DAYS);

      // Check for recent sell transactions
      const recentSells = await db.query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 
           AND asset_symbol = $2 
           AND type = 'sell'
           AND transaction_date >= $3
           AND transaction_date <= $4
         ORDER BY transaction_date DESC`,
        [userId, assetSymbol, thirtyDaysBefore, buyDate]
      );

      if (recentSells.rows.length === 0) {
        return {
          isWashSale: false,
          recentSellDate: null,
          canBuyBackAfter: null,
          daysRemaining: 0,
          sellPrice: null,
          warning: null
        };
      }

      // Found recent sell - calculate wash sale details
      const mostRecentSell = recentSells.rows[0];
      const sellDate = new Date(mostRecentSell.transaction_date);
      const canBuyBackAfter = new Date(sellDate);
      canBuyBackAfter.setDate(canBuyBackAfter.getDate() + this.WASH_SALE_DAYS);

      const daysRemaining = Math.ceil(
        (canBuyBackAfter.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isWashSale = daysRemaining > 0;

      return {
        isWashSale,
        recentSellDate: sellDate,
        canBuyBackAfter,
        daysRemaining: Math.max(0, daysRemaining),
        sellPrice: mostRecentSell.price,
        warning: isWashSale
          ? `Warning: You sold ${assetSymbol} on ${sellDate.toLocaleDateString()}. ` +
            `To avoid wash sale, wait ${daysRemaining} more days before repurchasing.`
          : null
      };
    } catch (error: any) {
      logger.error('Error checking wash sale:', error);
      throw new Error('Failed to check wash sale');
    }
  }

  /**
   * Check if selling this asset and immediately repurchasing would be a wash sale
   */
  async checkReverseWashSale(
    userId: string,
    assetSymbol: string,
    proposedSellDate?: Date
  ): Promise<WashSaleCheck> {
    try {
      const sellDate = proposedSellDate || new Date();
      const thirtyDaysAfter = new Date(sellDate);
      thirtyDaysAfter.setDate(thirtyDaysAfter.getDate() + this.WASH_SALE_DAYS);

      // Check for recent buy transactions (within 30 days before sell)
      const thirtyDaysBefore = new Date(sellDate);
      thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - this.WASH_SALE_DAYS);

      const recentBuys = await db.query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 
           AND asset_symbol = $2 
           AND type = 'buy'
           AND transaction_date >= $3
           AND transaction_date < $4
         ORDER BY transaction_date DESC`,
        [userId, assetSymbol, thirtyDaysBefore, sellDate]
      );

      if (recentBuys.rows.length > 0) {
        const mostRecentBuy = recentBuys.rows[0];
        const buyDate = new Date(mostRecentBuy.transaction_date);
        const daysSinceBuy = Math.ceil(
          (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          isWashSale: true,
          recentSellDate: buyDate,
          canBuyBackAfter: thirtyDaysAfter,
          daysRemaining: this.WASH_SALE_DAYS - daysSinceBuy,
          sellPrice: mostRecentBuy.price,
          warning: `Warning: You bought ${assetSymbol} ${daysSinceBuy} days ago. ` +
            `Selling now may be considered tax avoidance. Consider waiting ${this.WASH_SALE_DAYS - daysSinceBuy} more days.`
        };
      }

      return {
        isWashSale: false,
        recentSellDate: null,
        canBuyBackAfter: null,
        daysRemaining: 0,
        sellPrice: null,
        warning: null
      };
    } catch (error: any) {
      logger.error('Error checking reverse wash sale:', error);
      throw new Error('Failed to check reverse wash sale');
    }
  }

  /**
   * Get all wash sale warnings for a user's portfolio
   */
  async getAllWashSaleWarnings(userId: string): Promise<any[]> {
    try {
      // Get all unique symbols user has sold in last 30 days
      const recentSells = await db.query(
        `SELECT DISTINCT asset_symbol 
         FROM transactions 
         WHERE user_id = $1 
           AND type = 'sell'
           AND transaction_date >= NOW() - INTERVAL '30 days'`,
        [userId]
      );

      const warnings = [];

      for (const row of recentSells.rows) {
        const check = await this.checkWashSale(userId, row.asset_symbol);
        if (check.isWashSale) {
          warnings.push({
            assetSymbol: row.asset_symbol,
            ...check
          });
        }
      }

      return warnings;
    } catch (error: any) {
      logger.error('Error getting wash sale warnings:', error);
      return [];
    }
  }

  /**
   * Flag recommendations that would trigger wash sales
   */
  async flagWashSaleRecommendations(userId: string, recommendations: any[]): Promise<any[]> {
    try {
      const flaggedRecommendations = [];

      for (const rec of recommendations) {
        // Check if this is a sell recommendation
        if (rec.action === 'sell' || rec.recommended_action === 'sell') {
          const check = await this.checkWashSale(userId, rec.asset_symbol);
          
          flaggedRecommendations.push({
            ...rec,
            washSaleWarning: check.isWashSale,
            washSaleDetails: check.isWashSale ? check : null
          });
        } else {
          flaggedRecommendations.push(rec);
        }
      }

      return flaggedRecommendations;
    } catch (error: any) {
      logger.error('Error flagging wash sale recommendations:', error);
      return recommendations;
    }
  }

  /**
   * Get wash sale history for audit/compliance
   */
  async getWashSaleHistory(userId: string, financialYear: string): Promise<any[]> {
    try {
      const [startYear] = financialYear.split('-');
      const fyStart = new Date(`${startYear}-04-01`);
      const fyEnd = new Date(`${parseInt(startYear) + 1}-03-31`);

      // Find all sells
      const sells = await db.query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 
           AND type = 'sell'
           AND transaction_date BETWEEN $2 AND $3
         ORDER BY transaction_date`,
        [userId, fyStart, fyEnd]
      );

      const washSales = [];

      for (const sell of sells.rows) {
        const thirtyDaysAfter = new Date(sell.transaction_date);
        thirtyDaysAfter.setDate(thirtyDaysAfter.getDate() + this.WASH_SALE_DAYS);

        // Check if repurchased within 30 days
        const repurchase = await db.query(
          `SELECT * FROM transactions 
           WHERE user_id = $1 
             AND asset_symbol = $2 
             AND type = 'buy'
             AND transaction_date > $3
             AND transaction_date <= $4
           ORDER BY transaction_date
           LIMIT 1`,
          [userId, sell.asset_symbol, sell.transaction_date, thirtyDaysAfter]
        );

        if (repurchase.rows.length > 0) {
          const buy = repurchase.rows[0];
          const daysBetween = Math.ceil(
            (new Date(buy.transaction_date).getTime() - 
             new Date(sell.transaction_date).getTime()) / (1000 * 60 * 60 * 24)
          );

          washSales.push({
            assetSymbol: sell.asset_symbol,
            sellDate: sell.transaction_date,
            sellPrice: sell.price,
            sellQuantity: sell.quantity,
            repurchaseDate: buy.transaction_date,
            repurchasePrice: buy.price,
            repurchaseQuantity: buy.quantity,
            daysBetween,
            lossDisallowed: (sell.price - buy.price) * Math.min(sell.quantity, buy.quantity)
          });
        }
      }

      return washSales;
    } catch (error: any) {
      logger.error('Error getting wash sale history:', error);
      return [];
    }
  }
}

export default new WashSaleService();
