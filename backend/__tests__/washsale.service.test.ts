import washSaleService from '../src/services/washsale.service';
import { db } from '../src/database';

jest.mock('../src/database');

describe('Wash Sale Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkWashSale', () => {
    it('should return no wash sale if no recent sells', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await washSaleService.checkWashSale('user123', 'TCS');

      expect(result.isWashSale).toBe(false);
      expect(result.daysRemaining).toBe(0);
      expect(result.warning).toBeNull();
    });

    it('should detect wash sale if sold within 30 days', async () => {
      const sellDate = new Date();
      sellDate.setDate(sellDate.getDate() - 15); // Sold 15 days ago

      (db.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            transaction_id: 'tx1',
            asset_symbol: 'TCS',
            type: 'sell',
            price: 3500,
            transaction_date: sellDate
          }
        ]
      });

      const result = await washSaleService.checkWashSale('user123', 'TCS');

      expect(result.isWashSale).toBe(true);
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(result.daysRemaining).toBeLessThanOrEqual(15);
      expect(result.warning).toContain('To avoid wash sale');
    });

    it('should allow purchase after 30 days', async () => {
      const sellDate = new Date();
      sellDate.setDate(sellDate.getDate() - 35); // Sold 35 days ago

      (db.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            transaction_id: 'tx1',
            asset_symbol: 'TCS',
            type: 'sell',
            price: 3500,
            transaction_date: sellDate
          }
        ]
      });

      const result = await washSaleService.checkWashSale('user123', 'TCS');

      expect(result.isWashSale).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });
  });

  describe('getWashSaleHistory', () => {
    it('should identify completed wash sales', async () => {
      const sellDate = new Date('2025-01-01');
      const buyDate = new Date('2025-01-15');

      // Mock sells
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            asset_symbol: 'INFY',
            type: 'sell',
            transaction_date: sellDate,
            price: 1500,
            quantity: 10
          }
        ]
      });

      // Mock repurchase
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            asset_symbol: 'INFY',
            type: 'buy',
            transaction_date: buyDate,
            price: 1480,
            quantity: 10
          }
        ]
      });

      const result = await washSaleService.getWashSaleHistory('user123', '2024-25');

      expect(result).toHaveLength(1);
      expect(result[0].assetSymbol).toBe('INFY');
      expect(result[0].daysBetween).toBe(14);
    });
  });
});
