import { Router, Request, Response } from 'express';
import priceService from '../services/price.service';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/prices/refresh
 * Manually refresh all prices for current user's holdings
 */
router.get('/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    
    const updatedCount = await priceService.updateAllHoldingsPrices(userId);
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} holdings`,
      updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error refreshing prices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh prices',
      error: error.message
    });
  }
});

/**
 * GET /api/prices/stock/:symbol
 * Get current price for a specific stock
 */
router.get('/stock/:symbol', authenticate, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Symbol is required'
      });
    }

    const price = await priceService.getStockPrice(symbol);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      price,
      currency: 'INR',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`Error fetching stock price for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock price'
    });
  }
});

/**
 * GET /api/prices/crypto/:symbol
 * Get current price for a specific cryptocurrency
 */
router.get('/crypto/:symbol', authenticate, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Symbol is required'
      });
    }

    const price = await priceService.getCryptoPrice(symbol);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      price,
      currency: 'INR',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`Error fetching crypto price for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch crypto price'
    });
  }
});

/**
 * POST /api/prices/validate
 * Validate if a symbol exists and can be traded
 */
router.post('/validate', authenticate, async (req: Request, res: Response) => {
  try {
    const { symbol, assetType } = req.body;
    
    if (!symbol || !assetType) {
      return res.status(400).json({
        success: false,
        message: 'Symbol and assetType are required'
      });
    }

    if (!['stock', 'crypto'].includes(assetType)) {
      return res.status(400).json({
        success: false,
        message: 'assetType must be either "stock" or "crypto"'
      });
    }

    const isValid = await priceService.validateSymbol(symbol, assetType as 'stock' | 'crypto');
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      assetType,
      isValid,
      message: isValid ? 'Symbol is valid' : 'Symbol not found or invalid'
    });
  } catch (error: any) {
    console.error('Error validating symbol:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate symbol'
    });
  }
});

/**
 * GET /api/prices/history/:symbol
 * Get price history for charting
 */
router.get('/history/:symbol', authenticate, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Symbol is required'
      });
    }

    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: 'Days must be between 1 and 365'
      });
    }

    const history = await priceService.getPriceHistory(symbol, days);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      days,
      data: history,
      count: history.length
    });
  } catch (error: any) {
    console.error('Error fetching price history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch price history'
    });
  }
});

/**
 * POST /api/prices/clear-cache
 * Clear price cache (for testing/debugging)
 */
router.post('/clear-cache', authenticate, async (_req: Request, res: Response) => {
  try {
    priceService.clearCache();
    
    res.json({
      success: true,
      message: 'Price cache cleared successfully'
    });
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

export default router;
