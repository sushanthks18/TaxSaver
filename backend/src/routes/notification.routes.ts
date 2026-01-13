import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../database';

const router = Router();

/**
 * Get user notifications
 * GET /api/notifications
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const result = await db.query(
      `SELECT 
        notification_id,
        user_id,
        title,
        message,
        notification_type as type,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
      },
    });
  })
);

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch(
  '/:id/read',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    await db.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE notification_id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  })
);

/**
 * Create a test notification (for development)
 * POST /api/notifications/test
 */
router.post(
  '/test',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, notification_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        userId,
        '🎉 Test Notification',
        'This is a test notification. Your notification system is working!',
        'info'
      ]
    );

    res.json({
      success: true,
      data: { notification: result.rows[0] },
      message: 'Test notification created',
    });
  })
);

export default router;
