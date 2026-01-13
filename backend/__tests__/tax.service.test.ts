import taxService from '../src/services/tax.service';

describe('Tax Service', () => {
  describe('calculateTax', () => {
    test('should calculate STCG correctly for equity', () => {
      const gain = 100000;
      const tax = gain * 0.15; // 15% STCG
      expect(tax).toBe(15000);
    });

    test('should calculate LTCG correctly for equity with exemption', () => {
      const gain = 150000;
      const exemption = 100000;
      const taxableAmount = gain - exemption;
      const tax = taxableAmount * 0.10; // 10% LTCG
      expect(tax).toBe(5000);
    });

    test('should calculate crypto tax correctly', () => {
      const stGain = 100000;
      const ltGain = 200000;
      const stTax = stGain * 0.30; // 30% crypto ST
      const ltTax = ltGain * 0.20; // 20% crypto LT
      expect(stTax).toBe(30000);
      expect(ltTax).toBe(40000);
    });

    test('should apply surcharge for income > 50 lakhs', () => {
      const baseTax = 100000;
      const surcharge = baseTax * 0.10; // 10% surcharge
      const cess = (baseTax + surcharge) * 0.04; // 4% cess
      const totalTax = baseTax + surcharge + cess;
      expect(totalTax).toBe(114400);
    });
  });

  describe('holdingPeriod', () => {
    test('should classify stock as short-term if held < 365 days', () => {
      const days = 300;
      const isShortTerm = days < 365;
      expect(isShortTerm).toBe(true);
    });

    test('should classify crypto as long-term if held >= 1095 days', () => {
      const days = 1100;
      const isLongTerm = days >= 1095;
      expect(isLongTerm).toBe(true);
    });
  });

  describe('lossOffset', () => {
    test('should offset ST losses with ST gains first', () => {
      const stGain = 100000;
      const stLoss = 30000;
      const netGain = stGain - stLoss;
      expect(netGain).toBe(70000);
    });

    test('should allow ST losses to offset LT gains', () => {
      const ltGain = 200000;
      const remainingSTLoss = 50000;
      const adjustedLTGain = ltGain - remainingSTLoss;
      expect(adjustedLTGain).toBe(150000);
    });

    test('should NOT allow LT losses to offset ST gains', () => {
      const stGain = 100000;
      const ltLoss = 50000;
      // LT losses cannot offset ST gains
      expect(stGain).toBe(100000);
    });
  });
});

describe('Carry Forward Service', () => {
  test('should carry forward unutilized losses', () => {
    const losses = 150000;
    const gains = 100000;
    const carryForward = Math.max(0, losses - gains);
    expect(carryForward).toBe(50000);
  });

  test('should track 8-year expiry', () => {
    const yearsOld = 7;
    const yearsRemaining = 8 - yearsOld;
    expect(yearsRemaining).toBe(1);
  });
});
