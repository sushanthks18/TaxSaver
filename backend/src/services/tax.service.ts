import { db } from '../database';
import { portfolioService, Holding } from './portfolio.service';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface TaxConfig {
  financialYear: string;
  shortTermEquityRate: number;
  longTermEquityRate: number;
  longTermEquityExemption: number;
  cryptoShortTermRate: number;
  cryptoLongTermRate: number;
  surchargeThreshold: number;
  surchargeRate: number;
  cessRate: number;
}

export interface TaxCalculation {
  holding: Holding;
  gainLoss: number;
  isShortTerm: boolean;
  taxRate: number;
  taxableAmount: number;
  taxLiability: number;
  assetType: 'stock' | 'crypto';
}

export interface TaxSummary {
  userId: string;
  financialYear: string;
  totalShortTermGains: number;
  totalLongTermGains: number;
  totalShortTermLosses: number;
  totalLongTermLosses: number;
  netShortTermGains: number;
  netLongTermGains: number;
  totalTaxLiability: number;
  totalTaxWithSurchargeAndCess: number;
  calculations: TaxCalculation[];
}

export interface TaxRecommendation {
  recommendationId?: string;
  userId: string;
  holdingId: string;
  assetSymbol: string;
  recommendationType: 'harvest_loss' | 'defer_gain' | 'sell_partial';
  currentPrice: number;
  purchasePrice: number;
  quantity: number;
  potentialLoss: number;
  taxSavings: number;
  priorityScore: number;
  deadline: Date;
  notes: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export class TaxService {
  // Get tax configuration for a financial year
  async getTaxConfig(financialYear: string): Promise<TaxConfig> {
    const result = await db.query(
      `SELECT financial_year, short_term_equity_rate, long_term_equity_rate,
              long_term_equity_exemption, crypto_short_term_rate, crypto_long_term_rate,
              surcharge_threshold, surcharge_rate, cess_rate
       FROM tax_config
       WHERE financial_year = $1`,
      [financialYear]
    );

    if (result.rows.length === 0) {
      // Return default config for current year
      return {
        financialYear,
        shortTermEquityRate: 15.0,
        longTermEquityRate: 10.0,
        longTermEquityExemption: 100000.0,
        cryptoShortTermRate: 30.0,
        cryptoLongTermRate: 20.0,
        surchargeThreshold: 5000000.0,
        surchargeRate: 10.0,
        cessRate: 4.0,
      };
    }

    const row = result.rows[0];
    return {
      financialYear: row.financial_year,
      shortTermEquityRate: parseFloat(row.short_term_equity_rate),
      longTermEquityRate: parseFloat(row.long_term_equity_rate),
      longTermEquityExemption: parseFloat(row.long_term_equity_exemption),
      cryptoShortTermRate: parseFloat(row.crypto_short_term_rate),
      cryptoLongTermRate: parseFloat(row.crypto_long_term_rate),
      surchargeThreshold: parseFloat(row.surcharge_threshold),
      surchargeRate: parseFloat(row.surcharge_rate),
      cessRate: parseFloat(row.cess_rate),
    };
  }

  // Calculate tax for all holdings
  async calculateTax(userId: string, financialYear: string): Promise<TaxSummary> {
    const holdings = await portfolioService.getUserHoldings(userId);
    const taxConfig = await this.getTaxConfig(financialYear);

    const calculations: TaxCalculation[] = [];
    let totalShortTermGains = 0;
    let totalLongTermGains = 0;
    let totalShortTermLosses = 0;
    let totalLongTermLosses = 0;

    for (const holding of holdings) {
      const calculation = this.calculateHoldingTax(holding, taxConfig);
      calculations.push(calculation);

      if (calculation.isShortTerm) {
        if (calculation.gainLoss > 0) {
          totalShortTermGains += calculation.gainLoss;
        } else {
          totalShortTermLosses += Math.abs(calculation.gainLoss);
        }
      } else {
        if (calculation.gainLoss > 0) {
          totalLongTermGains += calculation.gainLoss;
        } else {
          totalLongTermLosses += Math.abs(calculation.gainLoss);
        }
      }
    }

    // Net gains after set-off
    const netShortTermGains = Math.max(0, totalShortTermGains - totalShortTermLosses);
    const netLongTermGains = Math.max(0, totalLongTermGains - totalLongTermLosses);

    // Calculate tax liability
    const totalTaxLiability = calculations.reduce(
      (sum, calc) => sum + calc.taxLiability,
      0
    );

    // Apply surcharge if income exceeds threshold
    let taxWithSurcharge = totalTaxLiability;
    if (totalShortTermGains + totalLongTermGains > taxConfig.surchargeThreshold) {
      taxWithSurcharge += totalTaxLiability * (taxConfig.surchargeRate / 100);
    }

    // Apply cess
    const totalTaxWithSurchargeAndCess =
      taxWithSurcharge + taxWithSurcharge * (taxConfig.cessRate / 100);

    logger.info('Tax calculated', { userId, financialYear, totalTaxLiability });

    return {
      userId,
      financialYear,
      totalShortTermGains,
      totalLongTermGains,
      totalShortTermLosses,
      totalLongTermLosses,
      netShortTermGains,
      netLongTermGains,
      totalTaxLiability,
      totalTaxWithSurchargeAndCess,
      calculations,
    };
  }

  // Calculate tax for a single holding
  private calculateHoldingTax(holding: Holding, config: TaxConfig): TaxCalculation {
    const gainLoss = holding.profitLoss || 0;
    const isShortTerm = holding.isShortTerm || false;
    const assetType = holding.assetType;

    let taxRate = 0;
    let taxableAmount = gainLoss;
    let taxLiability = 0;

    // Only tax gains, not losses
    if (gainLoss > 0) {
      if (assetType === 'stock') {
        if (isShortTerm) {
          taxRate = config.shortTermEquityRate;
          taxableAmount = gainLoss;
        } else {
          taxRate = config.longTermEquityRate;
          // Apply exemption for long-term equity
          taxableAmount = Math.max(0, gainLoss - config.longTermEquityExemption);
        }
      } else if (assetType === 'crypto') {
        taxRate = isShortTerm ? config.cryptoShortTermRate : config.cryptoLongTermRate;
        taxableAmount = gainLoss;
      }

      taxLiability = (taxableAmount * taxRate) / 100;
    }

    return {
      holding,
      gainLoss,
      isShortTerm,
      taxRate,
      taxableAmount,
      taxLiability,
      assetType,
    };
  }

  // Generate tax loss harvesting recommendations
  async generateRecommendations(userId: string, financialYear: string): Promise<TaxRecommendation[]> {
    const taxSummary = await this.calculateTax(userId, financialYear);
    const recommendations: TaxRecommendation[] = [];

    // Find all loss-making holdings
    const lossHoldings = taxSummary.calculations.filter((calc) => calc.gainLoss < 0);

    for (const calc of lossHoldings) {
      const holding = calc.holding;
      const potentialLoss = Math.abs(calc.gainLoss);

      // Calculate tax savings if this loss is harvested
      // Loss can offset gains in the same category (ST or LT)
      let taxSavings = 0;

      if (calc.isShortTerm && taxSummary.netShortTermGains > 0) {
        const offsetAmount = Math.min(potentialLoss, taxSummary.netShortTermGains);
        taxSavings = (offsetAmount * calc.taxRate) / 100;
      } else if (!calc.isShortTerm && taxSummary.netLongTermGains > 0) {
        const offsetAmount = Math.min(potentialLoss, taxSummary.netLongTermGains);
        taxSavings = (offsetAmount * calc.taxRate) / 100;
      }

      // Calculate priority score (higher loss and savings = higher priority)
      const lossPercentage = Math.abs(calc.holding.profitLossPercentage || 0);
      const priorityScore = Math.min(10, Math.floor(lossPercentage / 5) + (taxSavings > 0 ? 3 : 0));

      // Set deadline to end of financial year (March 31)
      const deadline = new Date(`${parseInt(financialYear.split('-')[0]) + 1}-03-31`);

      const recommendation: TaxRecommendation = {
        userId,
        holdingId: holding.holdingId,
        assetSymbol: holding.assetSymbol,
        recommendationType: 'harvest_loss',
        currentPrice: holding.currentPrice || holding.averageBuyPrice,
        purchasePrice: holding.averageBuyPrice,
        quantity: holding.quantity,
        potentialLoss,
        taxSavings,
        priorityScore,
        deadline,
        notes: `Selling this asset will realize a loss of ₹${potentialLoss.toFixed(2)}, potentially saving ₹${taxSavings.toFixed(2)} in taxes.`,
        status: 'pending',
      };

      recommendations.push(recommendation);
    }

    // Sort by priority score (highest first)
    recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

    // Save recommendations to database
    for (const rec of recommendations) {
      await this.saveRecommendation(rec);
    }

    logger.info('Recommendations generated', { userId, count: recommendations.length });

    return recommendations;
  }

  // Save recommendation to database
  private async saveRecommendation(rec: TaxRecommendation): Promise<string> {
    const result = await db.query(
      `INSERT INTO tax_recommendations 
       (user_id, holding_id, asset_symbol, recommendation_type, current_price, 
        purchase_price, quantity, potential_loss, tax_savings, priority_score, 
        deadline, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING recommendation_id`,
      [
        rec.userId,
        rec.holdingId,
        rec.assetSymbol,
        rec.recommendationType,
        rec.currentPrice,
        rec.purchasePrice,
        rec.quantity,
        rec.potentialLoss,
        rec.taxSavings,
        rec.priorityScore,
        rec.deadline,
        rec.notes,
        rec.status,
      ]
    );

    return result.rows[0].recommendation_id;
  }

  // Get recommendations for user
  async getRecommendations(userId: string, status?: string): Promise<TaxRecommendation[]> {
    let query = `
      SELECT recommendation_id, user_id, holding_id, asset_symbol, recommendation_type,
             current_price, purchase_price, quantity, potential_loss, tax_savings,
             priority_score, deadline, notes, status, created_at
      FROM tax_recommendations
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY priority_score DESC, created_at DESC`;

    const result = await db.query(query, params);

    return result.rows.map((row) => ({
      recommendationId: row.recommendation_id,
      userId: row.user_id,
      holdingId: row.holding_id,
      assetSymbol: row.asset_symbol,
      recommendationType: row.recommendation_type,
      currentPrice: parseFloat(row.current_price),
      purchasePrice: parseFloat(row.purchase_price),
      quantity: parseFloat(row.quantity),
      potentialLoss: parseFloat(row.potential_loss),
      taxSavings: parseFloat(row.tax_savings),
      priorityScore: row.priority_score,
      deadline: row.deadline,
      notes: row.notes,
      status: row.status,
    }));
  }

  // Update recommendation status
  async updateRecommendationStatus(
    recommendationId: string,
    userId: string,
    status: 'accepted' | 'rejected'
  ): Promise<void> {
    const result = await db.query(
      `UPDATE tax_recommendations 
       SET status = $1
       WHERE recommendation_id = $2 AND user_id = $3`,
      [status, recommendationId, userId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(404, 'Recommendation not found');
    }

    logger.info('Recommendation status updated', { recommendationId, status });
  }

  // Get current financial year in Indian format (YYYY-YY)
  getCurrentFinancialYear(): string {
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const year = today.getFullYear();

    // Financial year starts April 1st
    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(2)}`;
    }
  }
}

export const taxService = new TaxService();
