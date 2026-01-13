import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { taxService } from '../services/tax.service';

const router = Router();

// Calculate tax liability
router.get(
  '/calculate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const financialYear = (req.query.year as string) || taxService.getCurrentFinancialYear();

    const taxSummary = await taxService.calculateTax(req.user!.userId, financialYear);

    res.status(200).json({
      success: true,
      data: { taxSummary },
    });
  })
);

// Get current financial year
router.get(
  '/current-year',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const currentYear = taxService.getCurrentFinancialYear();

    res.status(200).json({
      success: true,
      data: { financialYear: currentYear },
    });
  })
);

// Get tax loss harvesting recommendations
router.get(
  '/recommendations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;

    const recommendations = await taxService.getRecommendations(req.user!.userId, status);

    res.status(200).json({
      success: true,
      data: { recommendations },
    });
  })
);

// Generate new recommendations
router.post(
  '/recommendations/generate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const financialYear = req.body.financialYear || taxService.getCurrentFinancialYear();

    const recommendations = await taxService.generateRecommendations(
      req.user!.userId,
      financialYear
    );

    res.status(201).json({
      success: true,
      data: { recommendations },
      message: `Generated ${recommendations.length} recommendations`,
    });
  })
);

// Update recommendation status
router.patch(
  '/recommendations/:recommendationId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Status must be either accepted or rejected' },
      });
    }

    await taxService.updateRecommendationStatus(
      req.params.recommendationId,
      req.user!.userId,
      status
    );

    res.status(200).json({
      success: true,
      message: 'Recommendation status updated successfully',
    });
  })
);

// Generate tax report (placeholder for now)
router.post(
  '/reports',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { financialYear, reportType } = req.body;

    // TODO: Implement PDF/Excel report generation
    res.status(201).json({
      success: true,
      message: 'Report generation - To be fully implemented',
      data: {
        financialYear: financialYear || taxService.getCurrentFinancialYear(),
        reportType: reportType || 'capital_gains',
      },
    });
  })
);

export default router;
