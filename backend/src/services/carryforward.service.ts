import { db } from '../database';
import { logger } from '../utils/logger';

interface CarryForwardData {
  userId: string;
  financialYear: string;
  stLoss: number;
  ltLoss: number;
  stGain: number;
  ltGain: number;
}

class CarryForwardService {
  /**
   * Calculate carry forward losses for a financial year
   */
  async calculateCarryForward(userId: string, financialYear: string): Promise<any> {
    try {
      // Get tax summary for the year
      const taxResult = await db.query(
        `SELECT 
          total_short_term_gains,
          total_long_term_gains,
          total_short_term_losses,
          total_long_term_losses
         FROM tax_reports
         WHERE user_id = $1 AND financial_year = $2
         ORDER BY generated_at DESC
         LIMIT 1`,
        [userId, financialYear]
      );

      if (taxResult.rows.length === 0) {
        return {
          stCarryForward: 0,
          ltCarryForward: 0,
          message: 'No tax data found for this year'
        };
      }

      const tax = taxResult.rows[0];
      
      // Calculate net losses that can be carried forward
      const netSTLoss = Math.max(0, tax.total_short_term_losses - tax.total_short_term_gains);
      const netLTLoss = Math.max(0, tax.total_long_term_losses - tax.total_long_term_gains);

      // ST losses can offset both ST and LT gains in future years
      // LT losses can only offset LT gains
      
      // Store carry forward data
      if (netSTLoss > 0 || netLTLoss > 0) {
        await db.query(
          `INSERT INTO tax_reports (
            user_id, financial_year, report_type,
            total_short_term_losses, total_long_term_losses,
            report_data
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, financial_year, report_type) 
          DO UPDATE SET
            total_short_term_losses = $4,
            total_long_term_losses = $5,
            report_data = $6,
            generated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            this.getNextFinancialYear(financialYear),
            'carry_forward',
            netSTLoss,
            netLTLoss,
            JSON.stringify({
              sourceYear: financialYear,
              stCarryForward: netSTLoss,
              ltCarryForward: netLTLoss,
              canOffsetSTGains: true,
              canOffsetLTGains: true,
              expiresIn: 8 // 8 years from date of loss
            })
          ]
        );
      }

      return {
        stCarryForward: netSTLoss,
        ltCarryForward: netLTLoss,
        nextYear: this.getNextFinancialYear(financialYear),
        expiresIn: 8,
        message: netSTLoss > 0 || netLTLoss > 0 
          ? 'Losses will be carried forward to next year'
          : 'No losses to carry forward'
      };

    } catch (error: any) {
      logger.error('Error calculating carry forward:', error);
      throw error;
    }
  }

  /**
   * Get available carry forward losses for current year
   */
  async getAvailableCarryForward(userId: string, financialYear: string): Promise<any> {
    try {
      const result = await db.query(
        `SELECT 
          financial_year as source_year,
          total_short_term_losses as st_loss,
          total_long_term_losses as lt_loss,
          report_data,
          generated_at
         FROM tax_reports
         WHERE user_id = $1 
         AND report_type = 'carry_forward'
         AND financial_year <= $2
         ORDER BY financial_year DESC`,
        [userId, financialYear]
      );

      const carryForwards = result.rows.map(row => {
        const data = row.report_data || {};
        return {
          sourceYear: data.sourceYear || row.source_year,
          stLoss: parseFloat(row.st_loss) || 0,
          ltLoss: parseFloat(row.lt_loss) || 0,
          generatedAt: row.generated_at,
          expiresIn: data.expiresIn || 8
        };
      });

      const totalSTCarryForward = carryForwards.reduce((sum, cf) => sum + cf.stLoss, 0);
      const totalLTCarryForward = carryForwards.reduce((sum, cf) => sum + cf.ltLoss, 0);

      return {
        totalSTCarryForward,
        totalLTCarryForward,
        details: carryForwards,
        count: carryForwards.length
      };

    } catch (error: any) {
      logger.error('Error getting carry forward:', error);
      throw error;
    }
  }

  /**
   * Apply carry forward losses to current year gains
   */
  async applyCarryForward(
    userId: string,
    financialYear: string,
    currentSTGain: number,
    currentLTGain: number
  ): Promise<any> {
    try {
      const carryForward = await this.getAvailableCarryForward(userId, financialYear);

      let remainingSTGain = currentSTGain;
      let remainingLTGain = currentLTGain;
      let stLossUsed = 0;
      let ltLossUsed = 0;

      // Apply ST losses first (can offset both ST and LT gains)
      if (carryForward.totalSTCarryForward > 0) {
        // Offset ST gains first
        const stOffset = Math.min(remainingSTGain, carryForward.totalSTCarryForward);
        remainingSTGain -= stOffset;
        stLossUsed += stOffset;

        // Then offset LT gains with remaining ST losses
        const remainingSTLoss = carryForward.totalSTCarryForward - stLossUsed;
        if (remainingSTLoss > 0 && remainingLTGain > 0) {
          const ltOffset = Math.min(remainingLTGain, remainingSTLoss);
          remainingLTGain -= ltOffset;
          stLossUsed += ltOffset;
        }
      }

      // Apply LT losses to LT gains only
      if (carryForward.totalLTCarryForward > 0 && remainingLTGain > 0) {
        const ltOffset = Math.min(remainingLTGain, carryForward.totalLTCarryForward);
        remainingLTGain -= ltOffset;
        ltLossUsed += ltOffset;
      }

      const taxSaved = (stLossUsed * 0.15) + (ltLossUsed * 0.10);

      return {
        originalSTGain: currentSTGain,
        originalLTGain: currentLTGain,
        adjustedSTGain: remainingSTGain,
        adjustedLTGain: remainingLTGain,
        stLossUsed,
        ltLossUsed,
        totalLossUsed: stLossUsed + ltLossUsed,
        taxSaved,
        carryForwardApplied: true
      };

    } catch (error: any) {
      logger.error('Error applying carry forward:', error);
      throw error;
    }
  }

  /**
   * Get next financial year
   */
  private getNextFinancialYear(currentFY: string): string {
    const [startYear] = currentFY.split('-');
    const nextYear = parseInt(startYear) + 1;
    return `${nextYear}-${String(nextYear + 1).slice(2)}`;
  }

  /**
   * Get insights about carry forward usage
   */
  async getCarryForwardInsights(userId: string, financialYear: string): Promise<any> {
    try {
      const available = await this.getAvailableCarryForward(userId, financialYear);
      
      const insights = [];

      if (available.totalSTCarryForward > 0) {
        insights.push({
          type: 'carry_forward',
          message: `You have ₹${available.totalSTCarryForward.toLocaleString('en-IN')} in short-term losses from previous years`,
          action: 'These can offset both short-term and long-term gains',
          priority: 'high'
        });
      }

      if (available.totalLTCarryForward > 0) {
        insights.push({
          type: 'carry_forward',
          message: `You have ₹${available.totalLTCarryForward.toLocaleString('en-IN')} in long-term losses from previous years`,
          action: 'These can offset long-term gains only',
          priority: 'medium'
        });
      }

      if (available.details.length > 0) {
        const oldestYear = available.details[available.details.length - 1];
        const yearsOld = this.calculateYearsDifference(oldestYear.sourceYear, financialYear);
        
        if (yearsOld >= 6) {
          insights.push({
            type: 'expiry_warning',
            message: `Losses from FY ${oldestYear.sourceYear} will expire in ${8 - yearsOld} years`,
            action: 'Consider realizing gains to utilize these losses before they expire',
            priority: 'urgent'
          });
        }
      }

      return {
        insights,
        available: available.totalSTCarryForward + available.totalLTCarryForward,
        count: insights.length
      };

    } catch (error: any) {
      logger.error('Error getting carry forward insights:', error);
      throw error;
    }
  }

  private calculateYearsDifference(fromFY: string, toFY: string): number {
    const [fromYear] = fromFY.split('-').map(Number);
    const [toYear] = toFY.split('-').map(Number);
    return toYear - fromYear;
  }
}

export default new CarryForwardService();
