import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import washSaleService from '../services/washsale.service';

const router = express.Router();

/**
 * Check if buying an asset would trigger wash sale
 * GET /api/washsale/check/:symbol
 */
router.get('/check/:symbol', authenticate, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const check = await washSaleService.checkWashSale((req as any).user.id, symbol);
    res.json(check);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all wash sale warnings for user
 * GET /api/washsale/warnings
 */
router.get('/warnings', authenticate, async (req: Request, res: Response) => {
  try {
    const warnings = await washSaleService.getAllWashSaleWarnings((req as any).user.id);
    res.json({ warnings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get wash sale history for financial year
 * GET /api/washsale/history?fy=2025-26
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const { fy } = req.query;
    const history = await washSaleService.getWashSaleHistory(
      (req as any).user.id,
      fy as string || '2025-26'
    );
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
