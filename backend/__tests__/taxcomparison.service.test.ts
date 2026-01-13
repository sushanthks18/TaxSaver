import taxComparisonService from '../src/services/taxcomparison.service';

describe('Tax Comparison Service', () => {
  describe('compareRegimes', () => {
    it('should recommend Old Regime with high deductions', async () => {
      const input = {
        totalIncome: 1000000, // ₹10L
        deductions: {
          section80C: 150000,
          section80D: 25000,
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

      const result = await taxComparisonService.compareRegimes(input);

      expect(result.recommendation).toBe('OLD');
      expect(result.oldRegime.totalTax).toBeLessThan(result.newRegime.totalTax);
      expect(result.oldRegime.deductionsUsed).toBe(175000);
    });

    it('should recommend New Regime with low deductions', async () => {
      const input = {
        totalIncome: 1000000,
        deductions: {
          section80C: 0,
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

      const result = await taxComparisonService.compareRegimes(input);

      expect(result.recommendation).toBe('NEW');
      expect(result.newRegime.totalTax).toBeLessThan(result.oldRegime.totalTax);
    });

    it('should handle capital gains correctly', async () => {
      const input = {
        totalIncome: 500000,
        deductions: {
          section80C: 0,
          section80D: 0,
          homeLoanInterest: 0,
          nps: 0,
          other: 0
        },
        capitalGains: {
          shortTermEquity: 100000, // ₹1L STCG
          longTermEquity: 200000,  // ₹2L LTCG
          shortTermCrypto: 0,
          longTermCrypto: 0
        }
      };

      const result = await taxComparisonService.compareRegimes(input);

      // STCG: 100000 * 0.20 = 20000
      // LTCG: (200000 - 100000) * 0.125 = 12500
      // Total CG tax: 32500
      expect(result.oldRegime.capitalGainsTax).toBe(32500);
      expect(result.newRegime.capitalGainsTax).toBe(32500); // Same for both
    });

    it('should calculate surcharge for high income', async () => {
      const input = {
        totalIncome: 6000000, // ₹60L (> 50L, so 10% surcharge)
        deductions: {
          section80C: 0,
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

      const result = await taxComparisonService.compareRegimes(input);

      expect(result.newRegime.surcharge).toBeGreaterThan(0);
      expect(result.newRegime.cess).toBeGreaterThan(0);
    });
  });

  describe('quickEstimate', () => {
    it('should provide quick estimate', async () => {
      const result = await taxComparisonService.quickEstimate(800000, 150000);

      expect(result.oldRegime).toBeDefined();
      expect(result.newRegime).toBeDefined();
      expect(result.recommendation).toMatch(/OLD|NEW/);
    });
  });
});
