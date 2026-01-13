import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import zerodhaService from '../services/zerodha.service';

const router = express.Router();

/**
 * Get Zerodha login URL
 * GET /api/zerodha/login
 */
router.get('/login', authenticate, async (req: Request, res: Response) => {
  try {
    const loginUrl = zerodhaService.getLoginURL((req as any).user.userId);
    res.json({ loginUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle OAuth callback
 * GET /api/zerodha/callback?request_token=xxx
 */
router.get('/callback', authenticate, async (req: Request, res: Response) => {
  try {
    const { request_token } = req.query;
    
    if (!request_token) {
      return res.status(400).json({ error: 'Request token required' });
    }

    const session = await zerodhaService.handleCallback(
      request_token as string,
      (req as any).user.userId
    );

    res.json({ 
      success: true, 
      message: 'Zerodha connected successfully',
      session 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync holdings from Zerodha
 * POST /api/zerodha/sync
 */
router.post('/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await zerodhaService.syncHoldings((req as any).user.userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get connection status
 * GET /api/zerodha/status
 */
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await zerodhaService.getConnectionStatus((req as any).user.userId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Disconnect Zerodha
 * DELETE /api/zerodha/disconnect
 */
router.delete('/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    await zerodhaService.disconnect((req as any).user.userId);
    res.json({ success: true, message: 'Zerodha disconnected' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
