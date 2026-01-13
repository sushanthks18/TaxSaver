import { Router, Request, Response } from 'express';
import transactionService from '../services/transaction.service';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/transactions
 * Create a new transaction manually
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const {
      holdingId,
      assetType,
      assetSymbol,
      transactionType,
      quantity,
      price,
      transactionDate,
      fees,
      platform,
      notes
    } = req.body;

    // Validation
    if (!assetType || !assetSymbol || !transactionType || !quantity || !price || !transactionDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (!['stock', 'crypto'].includes(assetType)) {
      return res.status(400).json({
        success: false,
        message: 'assetType must be either "stock" or "crypto"'
      });
    }

    if (!['buy', 'sell'].includes(transactionType)) {
      return res.status(400).json({
        success: false,
        message: 'transactionType must be either "buy" or "sell"'
      });
    }

    const transaction = await transactionService.createTransaction({
      userId,
      holdingId,
      assetType,
      assetSymbol,
      transactionType,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      transactionDate: new Date(transactionDate),
      fees: fees ? parseFloat(fees) : 0,
      platform,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction
    });

  } catch (error: any) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create transaction'
    });
  }
});

/**
 * GET /api/transactions
 * Get all transactions with optional filters
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    
    const filters: any = {};
    
    if (req.query.assetType) filters.assetType = req.query.assetType as string;
    if (req.query.assetSymbol) filters.assetSymbol = req.query.assetSymbol as string;
    if (req.query.transactionType) filters.transactionType = req.query.transactionType as string;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);

    const transactions = await transactionService.getUserTransactions(userId, filters);

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });

  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

/**
 * GET /api/transactions/stats
 * Get transaction statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const financialYear = req.query.financialYear as string;

    const stats = await transactionService.getTransactionStats(userId, financialYear);

    res.json({
      success: true,
      financialYear: financialYear || 'All time',
      stats
    });

  } catch (error: any) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction stats'
    });
  }
});

/**
 * POST /api/transactions/execute-recommendation/:id
 * Execute a tax loss harvesting recommendation
 */
router.post('/execute-recommendation/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const recommendationId = req.params.id;

    if (!recommendationId) {
      return res.status(400).json({
        success: false,
        message: 'Recommendation ID is required'
      });
    }

    const result = await transactionService.executeRecommendation(userId, recommendationId);

    res.json({
      success: true,
      message: 'Recommendation executed successfully',
      ...result
    });

  } catch (error: any) {
    console.error('Error executing recommendation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute recommendation'
    });
  }
});

/**
 * POST /api/transactions/:id/reverse
 * Reverse a transaction (admin/debug feature)
 */
router.post('/:id/reverse', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const transactionId = req.params.id;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    const result = await transactionService.reverseTransaction(userId, transactionId);

    res.json(result);

  } catch (error: any) {
    console.error('Error reversing transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reverse transaction'
    });
  }
});

export default router;
