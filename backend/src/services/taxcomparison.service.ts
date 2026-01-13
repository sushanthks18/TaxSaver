import { logger } from '../utils/logger';

/**
 * ENHANCEMENT 4: Tax Regime Comparison Service
 * 
 * Compares Old Tax Regime vs New Tax Regime for Indian taxpayers
 * Helps users make informed decision on which regime to choose
 */

interface TaxRegimeInput {
  totalIncome: number;
  deductions: {
    section80C: number;        // PPF, ELSS, LIC, etc. (max 1.5L)
    section80D: number;        // Health insurance (max 25K/50K)
    homeLoanInterest: number;  // Section 24(b) (max 2L)
    nps: number;               // Section 80CCD(1B) (max 50K)
    other: number;             // Other deductions
  };
  capitalGains: {
    shortTermEquity: number;
    longTermEquity: number;
    shortTermCrypto: number;
    longTermCrypto: number;
  };
}

interface RegimeCalculation {
  incomeTax: number;
  surcharge: number;
  cess: number;
  capitalGainsTax: number;
  totalTax: number;
  deductionsUsed: number;
  effectiveRate: number;
}

interface TaxComparison {
  oldRegime: RegimeCalculation;
  newRegime: RegimeCalculation;
  recommendation: 'OLD' | 'NEW';
  savings: number;
  savingsPercentage: number;
  explanation: string;
}

class TaxComparisonService {
  private readonly OLD_REGIME_SLABS = [
    { min: 0, max: 250000, rate: 0 },
    { min: 250000, max: 500000, rate: 0.05 },
    { min: 500000, max: 1000000, rate: 0.20 },
    { min: 1000000, max: Infinity, rate: 0.30 }
  ];

  private readonly NEW_REGIME_SLABS = [
    { min: 0, max: 300000, rate: 0 },
    { min: 300000, max: 600000, rate: 0.05 },
    { min: 600000, max: 900000, rate: 0.10 },
    { min: 900000, max: 1200000, rate: 0.15 },
    { min: 1200000, max: 1500000, rate: 0.20 },
    { min: 1500000, max: Infinity, rate: 0.30 }
  ];

  /**
   * Compare Old vs New Tax Regime
   */
  async compareRegimes(input: TaxRegimeInput): Promise<TaxComparison> {
    try {
      // Calculate Old Regime
      const oldRegime = this.calculateOldRegime(input);

      // Calculate New Regime (no deductions allowed)
      const newRegime = this.calculateNewRegime(input);

      // Determine recommendation
      const savings = oldRegime.totalTax - newRegime.totalTax;
      const recommendation = oldRegime.totalTax < newRegime.totalTax ? 'OLD' : 'NEW';
      const savingsPercentage = ((Math.abs(savings) / Math.max(oldRegime.totalTax, newRegime.totalTax)) * 100);

      // Generate explanation
      const explanation = this.generateExplanation(oldRegime, newRegime, savings, input);

      return {
        oldRegime,
        newRegime,
        recommendation,
        savings: Math.abs(savings),
        savingsPercentage,
        explanation
      };
    } catch (error: any) {
      logger.error('Error comparing tax regimes:', error);
      throw new Error('Failed to compare tax regimes');
    }
  }

  /**
   * Calculate Old Tax Regime (with deductions)
   */
  private calculateOldRegime(input: TaxRegimeInput): RegimeCalculation {
    // Calculate total deductions
    const totalDeductions = Math.min(
      input.deductions.section80C + 
      input.deductions.section80D + 
      input.deductions.homeLoanInterest + 
      input.deductions.nps + 
      input.deductions.other,
      350000 // Reasonable max deductions
    );

    // Taxable income after deductions
    const taxableIncome = Math.max(0, input.totalIncome - totalDeductions);

    // Calculate slab-wise tax
    const incomeTax = this.calculateSlabTax(taxableIncome, this.OLD_REGIME_SLABS);

    // Calculate capital gains tax (same for both regimes)
    const capitalGainsTax = this.calculateCapitalGainsTax(input.capitalGains);

    // Calculate surcharge
    const totalIncomeWithGains = input.totalIncome + this.getTotalCapitalGains(input.capitalGains);
    const surcharge = this.calculateSurcharge(incomeTax, totalIncomeWithGains);

    // Calculate cess (4% on tax + surcharge)
    const cess = (incomeTax + surcharge) * 0.04;

    const totalTax = incomeTax + surcharge + cess + capitalGainsTax;
    const effectiveRate = (totalTax / (input.totalIncome + this.getTotalCapitalGains(input.capitalGains))) * 100;

    return {
      incomeTax,
      surcharge,
      cess,
      capitalGainsTax,
      totalTax,
      deductionsUsed: totalDeductions,
      effectiveRate
    };
  }

  /**
   * Calculate New Tax Regime (no deductions)
   */
  private calculateNewRegime(input: TaxRegimeInput): RegimeCalculation {
    const taxableIncome = input.totalIncome; // No deductions

    // Calculate slab-wise tax
    const incomeTax = this.calculateSlabTax(taxableIncome, this.NEW_REGIME_SLABS);

    // Calculate capital gains tax (same for both regimes)
    const capitalGainsTax = this.calculateCapitalGainsTax(input.capitalGains);

    // Calculate surcharge
    const totalIncomeWithGains = input.totalIncome + this.getTotalCapitalGains(input.capitalGains);
    const surcharge = this.calculateSurcharge(incomeTax, totalIncomeWithGains);

    // Calculate cess
    const cess = (incomeTax + surcharge) * 0.04;

    const totalTax = incomeTax + surcharge + cess + capitalGainsTax;
    const effectiveRate = (totalTax / (input.totalIncome + this.getTotalCapitalGains(input.capitalGains))) * 100;

    return {
      incomeTax,
      surcharge,
      cess,
      capitalGainsTax,
      totalTax,
      deductionsUsed: 0,
      effectiveRate
    };
  }

  /**
   * Calculate tax based on slabs
   */
  private calculateSlabTax(income: number, slabs: { min: number; max: number; rate: number }[]): number {
    let tax = 0;

    for (const slab of slabs) {
      if (income > slab.min) {
        const taxableInSlab = Math.min(income, slab.max) - slab.min;
        tax += taxableInSlab * slab.rate;
      }
    }

    return tax;
  }

  /**
   * Calculate capital gains tax
   */
  private calculateCapitalGainsTax(gains: TaxRegimeInput['capitalGains']): number {
    let tax = 0;

    // Short-term equity: 20%
    tax += gains.shortTermEquity * 0.20;

    // Long-term equity: 12.5% (after 1L exemption)
    const ltEquityTaxable = Math.max(0, gains.longTermEquity - 100000);
    tax += ltEquityTaxable * 0.125;

    // Crypto: 30% (both ST and LT)
    tax += (gains.shortTermCrypto + gains.longTermCrypto) * 0.30;

    return tax;
  }

  /**
   * Calculate surcharge based on income
   */
  private calculateSurcharge(tax: number, totalIncome: number): number {
    if (totalIncome <= 5000000) {
      return 0; // No surcharge below 50L
    } else if (totalIncome <= 10000000) {
      return tax * 0.10; // 10% surcharge for 50L-1Cr
    } else if (totalIncome <= 20000000) {
      return tax * 0.15; // 15% surcharge for 1Cr-2Cr
    } else if (totalIncome <= 50000000) {
      return tax * 0.25; // 25% surcharge for 2Cr-5Cr
    } else {
      return tax * 0.37; // 37% surcharge above 5Cr
    }
  }

  /**
   * Get total capital gains
   */
  private getTotalCapitalGains(gains: TaxRegimeInput['capitalGains']): number {
    return gains.shortTermEquity + gains.longTermEquity + 
           gains.shortTermCrypto + gains.longTermCrypto;
  }

  /**
   * Generate explanation
   */
  private generateExplanation(
    oldRegime: RegimeCalculation,
    newRegime: RegimeCalculation,
    savings: number,
    input: TaxRegimeInput
  ): string {
    if (savings > 0) {
      // Old regime is better
      return `Old Regime is better by ₹${Math.abs(savings).toLocaleString('en-IN')}. ` +
        `Your deductions of ₹${oldRegime.deductionsUsed.toLocaleString('en-IN')} ` +
        `result in significant tax savings. Continue maximizing 80C, 80D, and home loan deductions.`;
    } else if (savings < 0) {
      // New regime is better
      return `New Regime is better by ₹${Math.abs(savings).toLocaleString('en-IN')}. ` +
        `The lower tax rates offset the loss of deductions. ` +
        `Consider switching to New Regime for simpler filing and better returns.`;
    } else {
      return `Both regimes result in the same tax liability. ` +
        `You can choose either regime. Old Regime requires more documentation for deductions, ` +
        `while New Regime is simpler.`;
    }
  }

  /**
   * Quick estimate without capital gains
   */
  async quickEstimate(totalIncome: number, deductions: number): Promise<{
    oldRegime: number;
    newRegime: number;
    recommendation: string;
  }> {
    const input: TaxRegimeInput = {
      totalIncome,
      deductions: {
        section80C: deductions,
        section80D: 0,
        homeLoanInterest: 0,
        nps: 0,
        other: 0
      },
      capitalGains: {
        shortTermEquity: 0,
        longTermEquity: 0,
        shortTermCrypto: 0,
        longTermCrypto: 0
      }
    };

    const comparison = await this.compareRegimes(input);

    return {
      oldRegime: comparison.oldRegime.totalTax,
      newRegime: comparison.newRegime.totalTax,
      recommendation: comparison.recommendation
    };
  }
}

export default new TaxComparisonService();
