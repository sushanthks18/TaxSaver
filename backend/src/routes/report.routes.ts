import { Router, Request, Response } from 'express';
import reportService from '../services/report.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import fs from 'fs';

const router = Router();

/**
 * POST /api/reports/generate
 * Generate tax report in PDF or Excel format
 */
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = ((req as AuthRequest).user as any).userId;
    const { financialYear, format } = req.body;

    if (!financialYear) {
      return res.status(400).json({
        success: false,
        message: 'Financial year is required (e.g., "2024-25")'
      });
    }

    if (format && !['pdf', 'excel'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Format must be either "pdf" or "excel"'
      });
    }

    const filePath = await reportService.generateCompleteReport(
      userId,
      financialYear,
      format || 'pdf'
    );

    res.json({
      success: true,
      message: 'Report generated successfully',
      filePath,
      downloadUrl: `/api/reports/download/${filePath.split('/').pop()}`
    });

  } catch (error: any) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate report'
    });
  }
});

/**
 * GET /api/reports/download/:filename
 * Download generated report
 */
router.get('/download/:filename', authenticate, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const userId = ((req as AuthRequest).user as any).userId;

    // Security: Verify filename belongs to the user
    if (!filename.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filePath = require('path').join(__dirname, '../../reports', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Set appropriate headers
    const ext = filename.split('.').pop();
    const mimeType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Delete file after download (optional - comment out to keep reports)
    fileStream.on('end', () => {
      setTimeout(() => {
        reportService.deleteReport(filePath).catch(console.error);
      }, 5000); // Delete after 5 seconds
    });

  } catch (error: any) {
    console.error('Error downloading report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download report'
    });
  }
});

export default router;
