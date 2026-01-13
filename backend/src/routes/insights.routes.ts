import { Router, Request, Response } from 'express';
import insightsService from '../services/insights.service';
import carryForwardService from '../services/carryforward.service';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/insights
 * Get portfolio insights for a financial year
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const financialYear = (req.query.year as string) || '2025-26';

    const insights = await insightsService.generateInsights(userId, financialYear);

    res.json({
      success: true,
      financialYear,
      insights,
      count: insights.length
    });
  } catch (error: any) {
    console.error('Error fetching insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insights'
    });
  }
});

/**
 * GET /api/insights/performers
 * Get best and worst performing holdings
 */
router.get('/performers', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const limit = parseInt(req.query.limit as string) || 5;

    const performers = await insightsService.getTopPerformers(userId, limit);

    res.json({
      success: true,
      ...performers
    });
  } catch (error: any) {
    console.error('Error fetching performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performers'
    });
  }
});

/**
 * GET /api/insights/carry-forward
 * Get carry forward losses
 */
router.get('/carry-forward', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const financialYear = (req.query.year as string) || '2025-26';

    const carryForward = await carryForwardService.getAvailableCarryForward(userId, financialYear);

    res.json({
      success: true,
      financialYear,
      ...carryForward
    });
  } catch (error: any) {
    console.error('Error fetching carry forward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch carry forward'
    });
  }
});

/**
 * POST /api/insights/calculate-carry-forward
 * Calculate carry forward for a financial year
 */
router.post('/calculate-carry-forward', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const { financialYear } = req.body;

    if (!financialYear) {
      return res.status(400).json({
        success: false,
        message: 'Financial year is required'
      });
    }

    const result = await carryForwardService.calculateCarryForward(userId, financialYear);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error calculating carry forward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate carry forward'
    });
  }
});

export default router;
