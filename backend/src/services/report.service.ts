import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { db } from '../database';
import { logger } from '../utils/logger';

interface ReportData {
  userId: string;
  financialYear: string;
  holdings: any[];
  transactions: any[];
  taxSummary: {
    totalSTCG: number;
    totalLTCG: number;
    totalSTLoss: number;
    totalLTLoss: number;
    netTaxableGains: number;
    taxLiability: number;
    taxSaved: number;
  };
  userInfo: {
    name: string;
    email: string;
    pan?: string;
  };
}

class ReportService {
  private readonly REPORTS_DIR = path.join(__dirname, '../../reports');

  constructor() {
    // Ensure reports directory exists
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }
  }

  /**
   * Generate comprehensive tax report in PDF format
   */
  async generatePDFReport(reportData: ReportData): Promise<string> {
    try {
      const fileName = `tax-report-${reportData.userId}-${reportData.financialYear}-${Date.now()}.pdf`;
      const filePath = path.join(this.REPORTS_DIR, fileName);

      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('TAX LOSS HARVESTING REPORT', { align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Financial Year: ${reportData.financialYear}`, { align: 'center' })
         .moveDown();

      doc.fontSize(10)
         .text(`Generated on: ${new Date().toLocaleDateString('en-IN', { 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric' 
         })}`, { align: 'center' })
         .moveDown(2);

      // User Information
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('INVESTOR DETAILS')
         .moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Name: ${reportData.userInfo.name}`)
         .text(`Email: ${reportData.userInfo.email}`)
         .text(`PAN: ${reportData.userInfo.pan || 'Not Provided'}`)
         .moveDown(2);

      // Tax Summary Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('TAX SUMMARY')
         .moveDown(0.5);

      const summary = reportData.taxSummary;
      
      doc.fontSize(10)
         .font('Helvetica');

      // Short-Term Capital Gains
      doc.font('Helvetica-Bold').text('Short-Term Capital Gains (STCG):', { continued: true })
         .font('Helvetica').text(` ₹${summary.totalSTCG.toLocaleString('en-IN')}`, { align: 'right' });
      
      doc.font('Helvetica-Bold').text('Short-Term Capital Loss:', { continued: true })
         .font('Helvetica').text(` ₹${summary.totalSTLoss.toLocaleString('en-IN')}`, { align: 'right' });

      doc.moveDown(0.5);

      // Long-Term Capital Gains
      doc.font('Helvetica-Bold').text('Long-Term Capital Gains (LTCG):', { continued: true })
         .font('Helvetica').text(` ₹${summary.totalLTCG.toLocaleString('en-IN')}`, { align: 'right' });
      
      doc.font('Helvetica-Bold').text('Long-Term Capital Loss:', { continued: true })
         .font('Helvetica').text(` ₹${summary.totalLTLoss.toLocaleString('en-IN')}`, { align: 'right' });

      doc.moveDown(0.5);

      // Net Tax
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Net Taxable Gains:', { continued: true })
         .text(` ₹${summary.netTaxableGains.toLocaleString('en-IN')}`, { align: 'right' });

      doc.text('Total Tax Liability:', { continued: true })
         .fillColor('red')
         .text(` ₹${summary.taxLiability.toLocaleString('en-IN')}`, { align: 'right' })
         .fillColor('black');

      if (summary.taxSaved > 0) {
        doc.fillColor('green')
           .text('Tax Saved Through TLH:', { continued: true })
           .text(` ₹${summary.taxSaved.toLocaleString('en-IN')}`, { align: 'right' })
           .fillColor('black');
      }

      doc.moveDown(2);

      // Holdings Summary
      if (reportData.holdings.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('CURRENT HOLDINGS')
           .moveDown(0.5);

        doc.fontSize(9).font('Helvetica');

        // Table Headers
        const tableTop = doc.y;
        doc.text('Symbol', 50, tableTop, { width: 80 })
           .text('Type', 130, tableTop, { width: 60 })
           .text('Qty', 190, tableTop, { width: 50 })
           .text('Avg Buy', 240, tableTop, { width: 70 })
           .text('Current', 310, tableTop, { width: 70 })
           .text('P&L', 380, tableTop, { width: 70 })
           .text('P&L%', 450, tableTop, { width: 50 });

        doc.moveDown(0.5);

        // Table Rows
        reportData.holdings.slice(0, 25).forEach((holding: any) => {
          const currentY = doc.y;
          const pnl = holding.profit_loss || 0;
          const pnlPercent = holding.profit_loss_percentage || 0;
          const pnlColor = pnl >= 0 ? 'green' : 'red';

          doc.fillColor('black')
             .text(holding.asset_symbol, 50, currentY, { width: 80 })
             .text(holding.asset_type, 130, currentY, { width: 60 })
             .text(holding.quantity.toString(), 190, currentY, { width: 50 })
             .text(`₹${holding.average_buy_price}`, 240, currentY, { width: 70 })
             .text(`₹${holding.current_price}`, 310, currentY, { width: 70 });

          doc.fillColor(pnlColor)
             .text(`₹${pnl}`, 380, currentY, { width: 70 })
             .text(`${pnlPercent.toFixed(2)}%`, 450, currentY, { width: 50 })
             .fillColor('black');

          doc.moveDown(0.3);
        });

        if (reportData.holdings.length > 25) {
          doc.moveDown()
             .fontSize(8)
             .text(`... and ${reportData.holdings.length - 25} more holdings`, { align: 'center' });
        }
      }

      // Footer
      doc.fontSize(8)
         .text('This report is generated by TaxSaver for informational purposes only. Please consult with a tax professional before making investment decisions.', 
               50, 750, { align: 'center', width: 500 });

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info(`PDF report generated: ${fileName}`);
          resolve(filePath);
        });
        writeStream.on('error', reject);
      });

    } catch (error: any) {
      logger.error('Error generating PDF report:', error);
      throw new Error('Failed to generate PDF report');
    }
  }

  /**
   * Generate tax report in Excel format
   */
  async generateExcelReport(reportData: ReportData): Promise<string> {
    try {
      const fileName = `tax-report-${reportData.userId}-${reportData.financialYear}-${Date.now()}.xlsx`;
      const filePath = path.join(this.REPORTS_DIR, fileName);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TaxSaver';
      workbook.created = new Date();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Tax Summary');
      summarySheet.columns = [
        { header: 'Category', key: 'category', width: 30 },
        { header: 'Amount (₹)', key: 'amount', width: 20 }
      ];

      summarySheet.addRows([
        { category: 'Short-Term Capital Gains', amount: reportData.taxSummary.totalSTCG },
        { category: 'Short-Term Capital Loss', amount: reportData.taxSummary.totalSTLoss },
        { category: 'Long-Term Capital Gains', amount: reportData.taxSummary.totalLTCG },
        { category: 'Long-Term Capital Loss', amount: reportData.taxSummary.totalLTLoss },
        { category: '', amount: '' },
        { category: 'Net Taxable Gains', amount: reportData.taxSummary.netTaxableGains },
        { category: 'Tax Liability', amount: reportData.taxSummary.taxLiability },
        { category: 'Tax Saved (TLH)', amount: reportData.taxSummary.taxSaved }
      ]);

      // Style header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Holdings Sheet
      const holdingsSheet = workbook.addWorksheet('Holdings');
      holdingsSheet.columns = [
        { header: 'Symbol', key: 'symbol', width: 15 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Avg Buy Price', key: 'avgPrice', width: 15 },
        { header: 'Current Price', key: 'currentPrice', width: 15 },
        { header: 'P&L', key: 'pnl', width: 15 },
        { header: 'P&L %', key: 'pnlPercent', width: 12 },
        { header: 'Holding Period', key: 'holdingPeriod', width: 15 },
        { header: 'Term', key: 'term', width: 12 }
      ];

      reportData.holdings.forEach((holding: any) => {
        holdingsSheet.addRow({
          symbol: holding.asset_symbol,
          type: holding.asset_type,
          quantity: holding.quantity,
          avgPrice: holding.average_buy_price,
          currentPrice: holding.current_price,
          pnl: holding.profit_loss || 0,
          pnlPercent: `${(holding.profit_loss_percentage || 0).toFixed(2)}%`,
          holdingPeriod: `${holding.holding_period_days || 0} days`,
          term: holding.is_short_term ? 'SHORT' : 'LONG'
        });
      });

      // Style holdings header
      holdingsSheet.getRow(1).font = { bold: true };
      holdingsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Transactions Sheet
      if (reportData.transactions && reportData.transactions.length > 0) {
        const transactionsSheet = workbook.addWorksheet('Transactions');
        transactionsSheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Symbol', key: 'symbol', width: 15 },
          { header: 'Type', key: 'type', width: 10 },
          { header: 'Action', key: 'action', width: 10 },
          { header: 'Quantity', key: 'quantity', width: 12 },
          { header: 'Price', key: 'price', width: 15 },
          { header: 'Amount', key: 'amount', width: 15 }
        ];

        reportData.transactions.forEach((txn: any) => {
          transactionsSheet.addRow({
            date: new Date(txn.transaction_date).toLocaleDateString('en-IN'),
            symbol: txn.asset_symbol,
            type: txn.asset_type,
            action: txn.transaction_type.toUpperCase(),
            quantity: txn.quantity,
            price: txn.price,
            amount: (txn.quantity * txn.price).toFixed(2)
          });
        });

        transactionsSheet.getRow(1).font = { bold: true };
        transactionsSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
      }

      // Save workbook
      await workbook.xlsx.writeFile(filePath);

      logger.info(`Excel report generated: ${fileName}`);
      return filePath;

    } catch (error: any) {
      logger.error('Error generating Excel report:', error);
      throw new Error('Failed to generate Excel report');
    }
  }

  /**
   * Fetch data and generate complete tax report
   */
  async generateCompleteReport(
    userId: string, 
    financialYear: string,
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<string> {
    try {
      // Fetch user info
      const userResult = await db.query(
        'SELECT first_name, last_name, email, pan_number FROM users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';

      // Fetch holdings
      const holdingsResult = await db.query(
        'SELECT * FROM holdings WHERE user_id = $1 ORDER BY asset_symbol',
        [userId]
      );

      // Fetch transactions for the financial year
      const [fyStart, fyEnd] = this.getFinancialYearDates(financialYear);
      
      const transactionsResult = await db.query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 
         AND transaction_date >= $2 
         AND transaction_date <= $3 
         ORDER BY transaction_date DESC`,
        [userId, fyStart, fyEnd]
      );

      // Calculate tax summary (simplified - should use tax service in real implementation)
      const taxSummary = await this.calculateTaxSummary(userId, financialYear);

      const reportData: ReportData = {
        userId,
        financialYear,
        holdings: holdingsResult.rows,
        transactions: transactionsResult.rows,
        taxSummary,
        userInfo: {
          name: userName,
          email: user.email,
          pan: user.pan_number
        }
      };

      // Generate report in requested format
      if (format === 'pdf') {
        return await this.generatePDFReport(reportData);
      } else {
        return await this.generateExcelReport(reportData);
      }

    } catch (error: any) {
      logger.error('Error generating complete report:', error);
      throw error;
    }
  }

  /**
   * Calculate tax summary for a financial year
   */
  private async calculateTaxSummary(userId: string, financialYear: string): Promise<any> {
    // This is a simplified version - should integrate with tax service
    const result = await db.query(
      `SELECT * FROM tax_reports 
       WHERE user_id = $1 
       AND financial_year = $2 
       ORDER BY generated_at DESC 
       LIMIT 1`,
      [userId, financialYear]
    );

    if (result.rows.length > 0) {
      const report = result.rows[0];
      return {
        totalSTCG: report.total_short_term_gains || 0,
        totalLTCG: report.total_long_term_gains || 0,
        totalSTLoss: report.total_short_term_losses || 0,
        totalLTLoss: report.total_long_term_losses || 0,
        netTaxableGains: report.net_taxable_gains || 0,
        taxLiability: report.tax_liability || 0,
        taxSaved: report.tax_saved || 0
      };
    }

    // Return default values if no report exists
    return {
      totalSTCG: 0,
      totalLTCG: 0,
      totalSTLoss: 0,
      totalLTLoss: 0,
      netTaxableGains: 0,
      taxLiability: 0,
      taxSaved: 0
    };
  }

  /**
   * Get financial year date range
   */
  private getFinancialYearDates(fy: string): [Date, Date] {
    // Format: '2024-25' -> April 1, 2024 to March 31, 2025
    const [startYear] = fy.split('-');
    const fyStartYear = parseInt(startYear);
    
    const startDate = new Date(fyStartYear, 3, 1); // April 1
    const endDate = new Date(fyStartYear + 1, 2, 31); // March 31
    
    return [startDate, endDate];
  }

  /**
   * Delete old reports (cleanup)
   */
  async deleteReport(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Report deleted: ${filePath}`);
      }
    } catch (error: any) {
      logger.error('Error deleting report:', error);
      throw error;
    }
  }
}

export default new ReportService();
