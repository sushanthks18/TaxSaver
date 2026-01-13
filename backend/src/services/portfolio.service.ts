import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Holding {
  holdingId: string;
  userId: string;
  assetType: 'stock' | 'crypto';
  assetSymbol: string;
  assetName?: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice?: number;
  purchaseDate: Date;
  platform?: string;
  exchange?: string;
  profitLoss?: number;
  profitLossPercentage?: number;
  holdingPeriodDays?: number;
  isShortTerm?: boolean;
  createdAt: Date;
}

export interface Transaction {
  transactionId: string;
  userId: string;
  assetType: 'stock' | 'crypto';
  assetSymbol: string;
  transactionType: 'buy' | 'sell';
  quantity: number;
  price: number;
  transactionDate: Date;
  fees: number;
  platform?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  totalHoldings: number;
  stocksCount: number;
  cryptoCount: number;
  gainersCount: number;
  losersCount: number;
}

export class PortfolioService {
  // Get all holdings for a user with P&L calculations
  async getUserHoldings(userId: string): Promise<Holding[]> {
    const result = await db.query(
      `SELECT h.holding_id, h.user_id, h.asset_type, h.asset_symbol, h.asset_name,
              h.quantity, h.average_buy_price, h.current_price, h.purchase_date,
              h.platform, h.exchange, h.created_at
       FROM holdings h
       WHERE h.user_id = $1
       ORDER BY h.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => this.enrichHolding(row));
  }

  // Get single holding by ID
  async getHoldingById(holdingId: string, userId: string): Promise<Holding | null> {
    const result = await db.query(
      `SELECT h.holding_id, h.user_id, h.asset_type, h.asset_symbol, h.asset_name,
              h.quantity, h.average_buy_price, h.current_price, h.purchase_date,
              h.platform, h.exchange, h.created_at
       FROM holdings h
       WHERE h.holding_id = $1 AND h.user_id = $2`,
      [holdingId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.enrichHolding(result.rows[0]);
  }

  // Create new holding
  async createHolding(
    userId: string,
    data: {
      assetType: 'stock' | 'crypto';
      assetSymbol: string;
      assetName?: string;
      quantity: number;
      averageBuyPrice: number;
      currentPrice?: number;
      purchaseDate: Date;
      platform?: string;
      exchange?: string;
    }
  ): Promise<Holding> {
    const {
      assetType,
      assetSymbol,
      assetName,
      quantity,
      averageBuyPrice,
      currentPrice,
      purchaseDate,
      platform,
      exchange,
    } = data;

    // Check if holding already exists
    const existing = await db.query(
      `SELECT holding_id FROM holdings 
       WHERE user_id = $1 AND asset_symbol = $2 AND asset_type = $3`,
      [userId, assetSymbol.toUpperCase(), assetType]
    );

    if (existing.rows.length > 0) {
      throw new ApiError(400, `Holding for ${assetSymbol} already exists. Update it instead.`);
    }

    const result = await db.query(
      `INSERT INTO holdings (user_id, asset_type, asset_symbol, asset_name, quantity, 
                            average_buy_price, current_price, purchase_date, platform, exchange)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        assetType,
        assetSymbol.toUpperCase(),
        assetName,
        quantity,
        averageBuyPrice,
        currentPrice,
        purchaseDate,
        platform,
        exchange,
      ]
    );

    logger.info('Holding created', { userId, assetSymbol });
    return this.enrichHolding(result.rows[0]);
  }

  // Update holding
  async updateHolding(
    holdingId: string,
    userId: string,
    data: Partial<{
      quantity: number;
      averageBuyPrice: number;
      currentPrice: number;
    }>
  ): Promise<Holding> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`);
      values.push(data.quantity);
    }
    if (data.averageBuyPrice !== undefined) {
      updates.push(`average_buy_price = $${paramIndex++}`);
      values.push(data.averageBuyPrice);
    }
    if (data.currentPrice !== undefined) {
      updates.push(`current_price = $${paramIndex++}`);
      values.push(data.currentPrice);
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No valid update fields provided');
    }

    values.push(holdingId, userId);

    const result = await db.query(
      `UPDATE holdings 
       SET ${updates.join(', ')}
       WHERE holding_id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Holding not found');
    }

    logger.info('Holding updated', { userId, holdingId });
    return this.enrichHolding(result.rows[0]);
  }

  // Delete holding
  async deleteHolding(holdingId: string, userId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM holdings WHERE holding_id = $1 AND user_id = $2 RETURNING holding_id',
      [holdingId, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Holding not found');
    }

    logger.info('Holding deleted', { userId, holdingId });
  }

  // Get portfolio summary
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const holdings = await this.getUserHoldings(userId);

    let totalValue = 0;
    let totalInvested = 0;
    let stocksCount = 0;
    let cryptoCount = 0;
    let gainersCount = 0;
    let losersCount = 0;

    holdings.forEach((holding) => {
      const invested = holding.quantity * holding.averageBuyPrice;
      const current = holding.quantity * (holding.currentPrice || holding.averageBuyPrice);

      totalInvested += invested;
      totalValue += current;

      if (holding.assetType === 'stock') stocksCount++;
      if (holding.assetType === 'crypto') cryptoCount++;

      if ((holding.profitLoss || 0) > 0) gainersCount++;
      if ((holding.profitLoss || 0) < 0) losersCount++;
    });

    const totalProfitLoss = totalValue - totalInvested;
    const totalProfitLossPercentage =
      totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalInvested,
      totalProfitLoss,
      totalProfitLossPercentage,
      totalHoldings: holdings.length,
      stocksCount,
      cryptoCount,
      gainersCount,
      losersCount,
    };
  }

  // Import holdings from CSV data
  async importFromCSV(
    userId: string,
    csvData: Array<{
      assetType: 'stock' | 'crypto';
      assetSymbol: string;
      assetName?: string;
      quantity: number;
      buyPrice: number;
      currentPrice?: number;
      purchaseDate: string;
      platform?: string;
    }>
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of csvData) {
      try {
        await this.createHolding(userId, {
          assetType: row.assetType,
          assetSymbol: row.assetSymbol,
          assetName: row.assetName,
          quantity: row.quantity,
          averageBuyPrice: row.buyPrice,
          currentPrice: row.currentPrice,
          purchaseDate: new Date(row.purchaseDate),
          platform: row.platform,
        });
        imported++;
      } catch (error: any) {
        failed++;
        errors.push(`${row.assetSymbol}: ${error.message}`);
      }
    }

    logger.info('CSV import completed', { userId, imported, failed });

    return { imported, failed, errors };
  }

  // Enrich holding with calculated fields
  private enrichHolding(row: any): Holding {
    const quantity = parseFloat(row.quantity);
    const averageBuyPrice = parseFloat(row.average_buy_price);
    const currentPrice = row.current_price ? parseFloat(row.current_price) : averageBuyPrice;

    const invested = quantity * averageBuyPrice;
    const currentValue = quantity * currentPrice;
    const profitLoss = currentValue - invested;
    const profitLossPercentage = invested > 0 ? (profitLoss / invested) * 100 : 0;

    const purchaseDate = new Date(row.purchase_date);
    const today = new Date();
    const holdingPeriodDays = Math.floor(
      (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Short-term: <365 days for stocks, <1095 days (3 years) for crypto
    const isShortTerm =
      row.asset_type === 'stock' ? holdingPeriodDays < 365 : holdingPeriodDays < 1095;

    return {
      holdingId: row.holding_id,
      userId: row.user_id,
      assetType: row.asset_type,
      assetSymbol: row.asset_symbol,
      assetName: row.asset_name,
      quantity,
      averageBuyPrice,
      currentPrice,
      purchaseDate,
      platform: row.platform,
      exchange: row.exchange,
      profitLoss,
      profitLossPercentage,
      holdingPeriodDays,
      isShortTerm,
      createdAt: row.created_at,
    };
  }
}

export const portfolioService = new PortfolioService();
