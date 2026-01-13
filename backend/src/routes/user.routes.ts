import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { authService } from '../services/auth.service';

const router = Router();

// Get user profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  })
);

// Update user profile
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // TODO: Implement profile update
    res.status(200).json({
      success: true,
      message: 'Profile update endpoint - To be implemented',
    });
  })
);

// Update user settings (PAN, tax regime, notifications)
router.put(
  '/settings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { firstName, lastName, pan, taxRegime, emailAlerts, priceAlerts } = req.body;
    const userId = req.user!.userId;

    try {
      // Update user settings in database
      const { db } = await import('../database');
      
      const updateQuery = `
        UPDATE users 
        SET 
          first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          pan_number = COALESCE($3, pan_number),
          tax_regime = COALESCE($4, tax_regime),
          email_alerts = COALESCE($5, email_alerts),
          price_alerts = COALESCE($6, price_alerts),
          updated_at = NOW()
        WHERE user_id = $7
        RETURNING user_id, email, first_name, last_name, pan_number, tax_regime, email_alerts, price_alerts
      `;

      const result = await db.query(updateQuery, [
        firstName || null,
        lastName || null,
        pan || null,
        taxRegime || null,
        emailAlerts !== undefined ? emailAlerts : null,
        priceAlerts !== undefined ? priceAlerts : null,
        userId
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }

      res.status(200).json({
        success: true,
        data: { user: result.rows[0] },
        message: 'Settings updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to update settings' },
      });
    }
  })
);

export default router;
