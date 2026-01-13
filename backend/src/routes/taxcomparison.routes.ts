import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import taxComparisonService from '../services/taxcomparison.service';

const router = express.Router();

/**
 * Compare Old vs New Tax Regime
 * POST /api/tax-comparison/compare
 */
router.post('/compare', authenticate, async (req: Request, res: Response) => {
  try {
    const comparison = await taxComparisonService.compareRegimes(req.body);
    res.json(comparison);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Quick estimate (simplified)
 * GET /api/tax-comparison/quick?income=1000000&deductions=150000
 */
router.get('/quick', authenticate, async (req: Request, res: Response) => {
  try {
    const income = parseInt(req.query.income as string) || 0;
    const deductions = parseInt(req.query.deductions as string) || 0;
    
    const estimate = await taxComparisonService.quickEstimate(income, deductions);
    res.json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
