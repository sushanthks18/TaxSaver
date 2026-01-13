import multiAssetService from '../src/services/multiasset.service';

describe('Multi-Asset Service', () => {
  describe('calculateTaxByAssetCategory', () => {
    it('should calculate equity STCG correctly', () => {
      const result = multiAssetService.calculateTaxByAssetCategory(
        100000, // ₹1L gain
        'equity',
        200 // 200 days (<1 year)
      );

      expect(result.gainType).toBe('SHORT_TERM');
      expect(result.taxRate).toBe(0.20);
      expect(result.tax).toBe(20000); // 20% of 1L
      expect(result.exemption).toBe(0);
    });

    it('should calculate equity LTCG with exemption', () => {
      const result = multiAssetService.calculateTaxByAssetCategory(
        200000, // ₹2L gain
        'equity',
        400 // >1 year
      );

      expect(result.gainType).toBe('LONG_TERM');
      expect(result.taxRate).toBe(0.125);
      expect(result.exemption).toBe(100000);
      expect(result.tax).toBe(12500); // 12.5% of (200000-100000)
    });

    it('should calculate crypto tax (flat 30%)', () => {
      const result = multiAssetService.calculateTaxByAssetCategory(
        150000,
        'crypto',
        1500 // Even after 3+ years
      );

      expect(result.gainType).toBe('SHORT_TERM'); // No LTCG for crypto
      expect(result.taxRate).toBe(0.30);
      expect(result.tax).toBe(45000); // 30% flat
      expect(result.exemption).toBe(0);
    });

    it('should calculate debt MF LTCG after 3 years', () => {
      const result = multiAssetService.calculateTaxByAssetCategory(
        100000,
        'debt_mf',
        1100 // >3 years
      );

      expect(result.gainType).toBe('LONG_TERM');
      expect(result.taxRate).toBe(0.125);
      expect(result.tax).toBe(12500); // 12.5% without indexation
    });

    it('should calculate gold ETF tax', () => {
      // STCG (<3 years)
      const stcg = multiAssetService.calculateTaxByAssetCategory(
        50000,
        'gold_etf',
        500
      );

      expect(stcg.gainType).toBe('SHORT_TERM');
      expect(stcg.taxRate).toBe(0.30);
      expect(stcg.tax).toBe(15000);

      // LTCG (>3 years)
      const ltcg = multiAssetService.calculateTaxByAssetCategory(
        50000,
        'gold_etf',
        1200
      );

      expect(ltcg.gainType).toBe('LONG_TERM');
      expect(ltcg.taxRate).toBe(0.125);
      expect(ltcg.tax).toBe(6250);
    });
  });

  describe('getLTCGHoldingPeriod', () => {
    it('should return correct holding periods', () => {
      expect(multiAssetService.getLTCGHoldingPeriod('equity')).toBe(365);
      expect(multiAssetService.getLTCGHoldingPeriod('mutual_fund')).toBe(365);
      expect(multiAssetService.getLTCGHoldingPeriod('crypto')).toBe(Infinity);
      expect(multiAssetService.getLTCGHoldingPeriod('debt_mf')).toBe(1095);
      expect(multiAssetService.getLTCGHoldingPeriod('gold_etf')).toBe(1095);
      expect(multiAssetService.getLTCGHoldingPeriod('bond')).toBe(1095);
    });
  });

  describe('validateAsset', () => {
    it('should validate MF scheme codes', async () => {
      const valid = await multiAssetService.validateAsset('123456', 'mutual_fund');
      const invalid = await multiAssetService.validateAsset('12345', 'mutual_fund');

      expect(typeof valid).toBe('boolean');
      expect(invalid).toBe(false);
    });

    it('should validate Gold ETF symbols', async () => {
      const validGoldBees = await multiAssetService.validateAsset('GOLDBEES', 'gold_etf');
      const invalidSymbol = await multiAssetService.validateAsset('INVALID', 'gold_etf');

      expect(validGoldBees).toBe(true);
      expect(invalidSymbol).toBe(false);
    });

    it('should validate bond ISIN codes', async () => {
      const valid = await multiAssetService.validateAsset('INE123A01012', 'bond');
      const invalid = await multiAssetService.validateAsset('INVALID', 'bond');

      expect(valid).toBe(true);
      expect(invalid).toBe(false);
    });
  });
});
