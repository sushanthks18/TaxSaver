import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { portfolioService } from '../services/portfolio.service';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all holdings
router.get(
  '/holdings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const holdings = await portfolioService.getUserHoldings(req.user!.userId);

    res.status(200).json({
      success: true,
      data: { holdings },
    });
  })
);

// Get portfolio summary
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const summary = await portfolioService.getPortfolioSummary(req.user!.userId);

    res.status(200).json({
      success: true,
      data: { summary },
    });
  })
);

// Get single holding
router.get(
  '/holdings/:holdingId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const holding = await portfolioService.getHoldingById(
      req.params.holdingId,
      req.user!.userId
    );

    if (!holding) {
      return res.status(404).json({
        success: false,
        error: { message: 'Holding not found' },
      });
    }

    res.status(200).json({
      success: true,
      data: { holding },
    });
  })
);

// Add manual holding
router.post(
  '/holdings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      assetType,
      assetSymbol,
      assetName,
      quantity,
      averageBuyPrice,
      currentPrice,
      purchaseDate,
      platform,
      exchange,
    } = req.body;

    const holding = await portfolioService.createHolding(req.user!.userId, {
      assetType,
      assetSymbol,
      assetName,
      quantity: parseFloat(quantity),
      averageBuyPrice: parseFloat(averageBuyPrice),
      currentPrice: currentPrice ? parseFloat(currentPrice) : undefined,
      purchaseDate: new Date(purchaseDate),
      platform,
      exchange,
    });

    res.status(201).json({
      success: true,
      data: { holding },
      message: 'Holding created successfully',
    });
  })
);

// Update holding
router.put(
  '/holdings/:holdingId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { quantity, averageBuyPrice, currentPrice } = req.body;

    const data: any = {};
    if (quantity !== undefined) data.quantity = parseFloat(quantity);
    if (averageBuyPrice !== undefined) data.averageBuyPrice = parseFloat(averageBuyPrice);
    if (currentPrice !== undefined) data.currentPrice = parseFloat(currentPrice);

    const holding = await portfolioService.updateHolding(
      req.params.holdingId,
      req.user!.userId,
      data
    );

    res.status(200).json({
      success: true,
      data: { holding },
      message: 'Holding updated successfully',
    });
  })
);

// Delete holding
router.delete(
  '/holdings/:holdingId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await portfolioService.deleteHolding(req.params.holdingId, req.user!.userId);

    res.status(200).json({
      success: true,
      message: 'Holding deleted successfully',
    });
  })
);

// Upload CSV
router.post(
  '/upload-csv',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    const csvData: any[] = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on('data', (row) => {
        csvData.push({
          assetType: row.asset_type || row.AssetType || 'stock',
          assetSymbol: row.symbol || row.Symbol || row.asset_symbol,
          assetName: row.name || row.Name || row.asset_name,
          quantity: parseFloat(row.quantity || row.Quantity),
          buyPrice: parseFloat(row.buy_price || row.BuyPrice || row.price),
          currentPrice: row.current_price
            ? parseFloat(row.current_price)
            : undefined,
          purchaseDate: row.purchase_date || row.PurchaseDate || row.date,
          platform: row.platform || row.Platform,
        });
      })
      .on('end', async () => {
        const result = await portfolioService.importFromCSV(req.user!.userId, csvData);

        res.status(200).json({
          success: true,
          data: result,
          message: `Successfully imported ${result.imported} holdings`,
        });
      })
      .on('error', (error) => {
        res.status(400).json({
          success: false,
          error: { message: 'CSV parsing failed', details: error.message },
        });
      });
  })
);

export default router;
