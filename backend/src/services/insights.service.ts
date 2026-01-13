import { db } from '../database';
import { logger } from '../utils/logger';
import carryForwardService from './carryforward.service';

interface Insight {
  type: string;
  title: string;
  message: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  value?: number;
}

class InsightsService {
  /**
   * Generate comprehensive portfolio insights
   */
  async generateInsights(userId: string, financialYear: string): Promise<Insight[]> {
    try {
      const insights: Insight[] = [];

      // Get portfolio data
      const holdings = await db.query(
        'SELECT * FROM holdings WHERE user_id = $1',
        [userId]
      );

      // Get tax data
      const taxData = await db.query(
        `SELECT * FROM tax_reports 
         WHERE user_id = $1 AND financial_year = $2 
         ORDER BY generated_at DESC LIMIT 1`,
        [userId, financialYear]
      );

      if (holdings.rows.length === 0) {
        return [{
          type: 'welcome',
          title: 'Get Started',
          message: 'Add your first holding to start optimizing your taxes',
          action: 'Go to Portfolio → Add Holding',
          priority: 'high'
        }];
      }

      // 1. Portfolio Composition Insights
      const portfolioInsights = this.analyzePortfolioComposition(holdings.rows);
      insights.push(...portfolioInsights);

      // 2. Tax Optimization Insights
      if (taxData.rows.length > 0) {
        const taxInsights = this.analyzeTaxOptimization(taxData.rows[0]);
        insights.push(...taxInsights);
      }

      // 3. Holding Period Insights
      const holdingPeriodInsights = this.analyzeHoldingPeriods(holdings.rows);
      insights.push(...holdingPeriodInsights);

      // 4. P&L Insights
      const pnlInsights = this.analyzeProfitLoss(holdings.rows);
      insights.push(...pnlInsights);

      // 5. Carry Forward Insights
      const cfInsights = await carryForwardService.getCarryForwardInsights(userId, financialYear);
      insights.push(...cfInsights.insights);

      // Sort by priority
      return insights.sort((a, b) => {
        const priority = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priority[b.priority] - priority[a.priority];
      });

    } catch (error: any) {
      logger.error('Error generating insights:', error);
      return [];
    }
  }

  private analyzePortfolioComposition(holdings: any[]): Insight[] {
    const insights: Insight[] = [];
    
    const stocks = holdings.filter(h => h.asset_type === 'stock');
    const crypto = holdings.filter(h => h.asset_type === 'crypto');
    
    const stockPercent = (stocks.length / holdings.length) * 100;
    const cryptoPercent = (crypto.length / holdings.length) * 100;

    if (stockPercent > 80) {
      insights.push({
        type: 'diversification',
        title: 'Portfolio Heavily Weighted in Stocks',
        message: `${stockPercent.toFixed(0)}% of your holdings are stocks`,
        action: 'Consider diversifying into crypto for balanced portfolio',
        priority: 'medium'
      });
    }

    if (cryptoPercent > 80) {
      insights.push({
        type: 'diversification',
        title: 'Portfolio Heavily Weighted in Crypto',
        message: `${cryptoPercent.toFixed(0)}% of your holdings are crypto`,
        action: 'Consider adding stocks for stability and lower tax rates',
        priority: 'medium'
      });
    }

    return insights;
  }

  private analyzeTaxOptimization(taxReport: any): Insight[] {
    const insights: Insight[] = [];

    const stGains = parseFloat(taxReport.total_short_term_gains) || 0;
    const ltGains = parseFloat(taxReport.total_long_term_gains) || 0;
    const stLosses = parseFloat(taxReport.total_short_term_losses) || 0;
    const ltLosses = parseFloat(taxReport.total_long_term_losses) || 0;

    // High short-term gains
    if (stGains > 100000) {
      insights.push({
        type: 'tax_optimization',
        title: 'High Short-Term Gains',
        message: `₹${stGains.toLocaleString('en-IN')} in short-term gains (taxed at 15%)`,
        action: 'Consider harvesting losses or holding for long-term benefits',
        priority: 'high',
        value: stGains * 0.15
      });
    }

    // Unutilized losses
    if (stLosses > stGains) {
      const unutilized = stLosses - stGains;
      insights.push({
        type: 'unutilized_loss',
        title: 'Unutilized Short-Term Losses',
        message: `₹${unutilized.toLocaleString('en-IN')} in losses not offset`,
        action: 'These will be carried forward to next year',
        priority: 'medium',
        value: unutilized
      });
    }

    // Near LTCG exemption limit
    if (ltGains > 80000 && ltGains < 100000) {
      insights.push({
        type: 'ltcg_exemption',
        title: 'Near LTCG Exemption Limit',
        message: `₹${ltGains.toLocaleString('en-IN')} of ₹1,00,000 exemption used`,
        action: 'You can realize ₹' + (100000 - ltGains).toLocaleString('en-IN') + ' more tax-free',
        priority: 'high',
        value: 100000 - ltGains
      });
    }

    return insights;
  }

  private analyzeHoldingPeriods(holdings: any[]): Insight[] {
    const insights: Insight[] = [];

    const nearLongTerm = holdings.filter(h => {
      const days = this.calculateHoldingDays(h.purchase_date);
      const threshold = h.asset_type === 'stock' ? 365 : 1095;
      return days > threshold * 0.9 && days < threshold;
    });

    if (nearLongTerm.length > 0) {
      insights.push({
        type: 'holding_period',
        title: `${nearLongTerm.length} Holdings Near Long-Term Status`,
        message: 'Wait for long-term status to reduce tax from 15% to 10%',
        action: 'View these holdings in your portfolio',
        priority: 'medium'
      });
    }

    return insights;
  }

  private analyzeProfitLoss(holdings: any[]): Insight[] {
    const insights: Insight[] = [];

    const profitHoldings = holdings.filter(h => {
      const pnl = (h.current_price - h.average_buy_price) * h.quantity;
      return pnl > 0;
    });

    const lossHoldings = holdings.filter(h => {
      const pnl = (h.current_price - h.average_buy_price) * h.quantity;
      return pnl < 0;
    });

    const profitPercent = (profitHoldings.length / holdings.length) * 100;

    if (profitPercent > 80) {
      insights.push({
        type: 'performance',
        title: 'Strong Portfolio Performance',
        message: `${profitPercent.toFixed(0)}% of holdings are profitable`,
        action: 'Consider booking profits and rebalancing',
        priority: 'low'
      });
    }

    if (lossHoldings.length > holdings.length / 2) {
      insights.push({
        type: 'performance',
        title: 'Many Loss-Making Holdings',
        message: `${lossHoldings.length} holdings are in loss`,
        action: 'Review tax loss harvesting recommendations',
        priority: 'high'
      });
    }

    return insights;
  }

  private calculateHoldingDays(purchaseDate: Date): number {
    const now = new Date();
    const purchase = new Date(purchaseDate);
    return Math.floor((now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get best and worst performers
   */
  async getTopPerformers(userId: string, limit: number = 5): Promise<any> {
    try {
      const result = await db.query(
        `SELECT 
          asset_symbol,
          asset_type,
          quantity,
          average_buy_price,
          current_price,
          ((current_price - average_buy_price) / average_buy_price * 100) as return_percent,
          ((current_price - average_buy_price) * quantity) as profit_loss
         FROM holdings
         WHERE user_id = $1 AND current_price IS NOT NULL
         ORDER BY return_percent DESC
         LIMIT $2`,
        [userId, limit]
      );

      const worst = await db.query(
        `SELECT 
          asset_symbol,
          asset_type,
          quantity,
          average_buy_price,
          current_price,
          ((current_price - average_buy_price) / average_buy_price * 100) as return_percent,
          ((current_price - average_buy_price) * quantity) as profit_loss
         FROM holdings
         WHERE user_id = $1 AND current_price IS NOT NULL
         ORDER BY return_percent ASC
         LIMIT $2`,
        [userId, limit]
      );

      return {
        best: result.rows,
        worst: worst.rows
      };

    } catch (error: any) {
      logger.error('Error getting top performers:', error);
      return { best: [], worst: [] };
    }
  }
}

export default new InsightsService();
