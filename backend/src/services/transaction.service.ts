import { db } from '../database';
import { logger } from '../utils/logger';

interface Transaction {
  userId: string;
  holdingId?: string;
  assetType: 'stock' | 'crypto';
  assetSymbol: string;
  transactionType: 'buy' | 'sell';
  quantity: number;
  price: number;
  transactionDate: Date;
  fees?: number;
  platform?: string;
  notes?: string;
}

class TransactionService {
  /**
   * Record a new transaction
   */
  async createTransaction(transaction: Transaction): Promise<any> {
    try {
      const result = await db.query(
        `INSERT INTO transactions (
          user_id, holding_id, asset_type, asset_symbol, 
          transaction_type, quantity, price, transaction_date, 
          fees, platform, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          transaction.userId,
          transaction.holdingId || null,
          transaction.assetType,
          transaction.assetSymbol,
          transaction.transactionType,
          transaction.quantity,
          transaction.price,
          transaction.transactionDate,
          transaction.fees || 0,
          transaction.platform || 'manual',
          transaction.notes || null
        ]
      );

      logger.info(`Transaction created: ${transaction.transactionType} ${transaction.quantity} ${transaction.assetSymbol}`);
      return result.rows[0];

    } catch (error: any) {
      logger.error('Error creating transaction:', error);
      throw new Error('Failed to create transaction');
    }
  }

  /**
   * Get all transactions for a user
   */
  async getUserTransactions(
    userId: string,
    filters?: {
      assetType?: 'stock' | 'crypto';
      assetSymbol?: string;
      transactionType?: 'buy' | 'sell';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          t.*,
          h.asset_name
        FROM transactions t
        LEFT JOIN holdings h ON t.holding_id = h.holding_id
        WHERE t.user_id = $1
      `;
      
      const params: any[] = [userId];
      let paramIndex = 2;

      // Apply filters
      if (filters?.assetType) {
        query += ` AND t.asset_type = $${paramIndex}`;
        params.push(filters.assetType);
        paramIndex++;
      }

      if (filters?.assetSymbol) {
        query += ` AND t.asset_symbol = $${paramIndex}`;
        params.push(filters.assetSymbol);
        paramIndex++;
      }

      if (filters?.transactionType) {
        query += ` AND t.transaction_type = $${paramIndex}`;
        params.push(filters.transactionType);
        paramIndex++;
      }

      if (filters?.startDate) {
        query += ` AND t.transaction_date >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters?.endDate) {
        query += ` AND t.transaction_date <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }

      query += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await db.query(query, params);
      return result.rows;

    } catch (error: any) {
      logger.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(userId: string, financialYear?: string): Promise<any> {
    try {
      let dateFilter = '';
      const params: any[] = [userId];

      if (financialYear) {
        const [startYear] = financialYear.split('-');
        const fyStartYear = parseInt(startYear);
        const startDate = new Date(fyStartYear, 3, 1); // April 1
        const endDate = new Date(fyStartYear + 1, 2, 31); // March 31
        
        dateFilter = ' AND transaction_date >= $2 AND transaction_date <= $3';
        params.push(startDate, endDate);
      }

      const result = await db.query(
        `SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN transaction_type = 'buy' THEN 1 END) as total_buys,
          COUNT(CASE WHEN transaction_type = 'sell' THEN 1 END) as total_sells,
          COUNT(CASE WHEN asset_type = 'stock' THEN 1 END) as stock_transactions,
          COUNT(CASE WHEN asset_type = 'crypto' THEN 1 END) as crypto_transactions,
          SUM(CASE WHEN transaction_type = 'buy' THEN quantity * price ELSE 0 END) as total_invested,
          SUM(CASE WHEN transaction_type = 'sell' THEN quantity * price ELSE 0 END) as total_redeemed,
          SUM(fees) as total_fees
        FROM transactions
        WHERE user_id = $1${dateFilter}`,
        params
      );

      return result.rows[0];

    } catch (error: any) {
      logger.error('Error fetching transaction stats:', error);
      throw new Error('Failed to fetch transaction stats');
    }
  }

  /**
   * Execute a tax loss harvesting recommendation
   * Creates a sell transaction and updates the holding
   */
  async executeRecommendation(
    userId: string,
    recommendationId: string
  ): Promise<any> {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Get recommendation details
      const recResult = await client.query(
        `SELECT * FROM tax_recommendations 
         WHERE recommendation_id = $1 AND user_id = $2 AND status = 'pending'`,
        [recommendationId, userId]
      );

      if (recResult.rows.length === 0) {
        throw new Error('Recommendation not found or already executed');
      }

      const recommendation = recResult.rows[0];

      // Get holding details
      const holdingResult = await client.query(
        'SELECT * FROM holdings WHERE holding_id = $1 AND user_id = $2',
        [recommendation.holding_id, userId]
      );

      if (holdingResult.rows.length === 0) {
        throw new Error('Holding not found');
      }

      const holding = holdingResult.rows[0];

      // Create sell transaction
      const transactionResult = await client.query(
        `INSERT INTO transactions (
          user_id, holding_id, asset_type, asset_symbol,
          transaction_type, quantity, price, transaction_date,
          platform, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
        RETURNING *`,
        [
          userId,
          holding.holding_id,
          holding.asset_type,
          holding.asset_symbol,
          'sell',
          recommendation.quantity,
          recommendation.current_price,
          'tlh_execution',
          `Tax loss harvesting: ${recommendation.notes || 'Executed via TaxSaver'}`
        ]
      );

      // Update holding quantity
      const newQuantity = holding.quantity - recommendation.quantity;
      
      if (newQuantity <= 0) {
        // Delete holding if fully sold
        await client.query(
          'DELETE FROM holdings WHERE holding_id = $1',
          [holding.holding_id]
        );
        logger.info(`Holding deleted (fully sold): ${holding.asset_symbol}`);
      } else {
        // Update holding quantity
        await client.query(
          'UPDATE holdings SET quantity = $1, updated_at = NOW() WHERE holding_id = $2',
          [newQuantity, holding.holding_id]
        );
        logger.info(`Holding updated: ${holding.asset_symbol} (${newQuantity} remaining)`);
      }

      // Mark recommendation as executed
      await client.query(
        `UPDATE tax_recommendations 
         SET status = 'accepted', executed_at = NOW(), updated_at = NOW()
         WHERE recommendation_id = $1`,
        [recommendationId]
      );

      await client.query('COMMIT');

      logger.info(`Recommendation executed successfully: ${recommendationId}`);

      return {
        transaction: transactionResult.rows[0],
        recommendation: {
          ...recommendation,
          status: 'accepted',
          executed_at: new Date()
        },
        holding: {
          asset_symbol: holding.asset_symbol,
          remaining_quantity: newQuantity,
          fully_sold: newQuantity <= 0
        }
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error executing recommendation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reverse a transaction (if executed by mistake)
   * NOTE: Use with caution - should have proper authorization
   */
  async reverseTransaction(
    userId: string,
    transactionId: string
  ): Promise<any> {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Get transaction details
      const txnResult = await client.query(
        'SELECT * FROM transactions WHERE transaction_id = $1 AND user_id = $2',
        [transactionId, userId]
      );

      if (txnResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = txnResult.rows[0];

      // If it's a sell transaction, restore the holding
      if (transaction.transaction_type === 'sell' && transaction.holding_id) {
        // Check if holding still exists
        const holdingExists = await client.query(
          'SELECT 1 FROM holdings WHERE holding_id = $1',
          [transaction.holding_id]
        );

        if (holdingExists.rows.length > 0) {
          // Add back the quantity
          await client.query(
            'UPDATE holdings SET quantity = quantity + $1, updated_at = NOW() WHERE holding_id = $2',
            [transaction.quantity, transaction.holding_id]
          );
        } else {
          // Recreate the holding
          await client.query(
            `INSERT INTO holdings (
              holding_id, user_id, asset_type, asset_symbol,
              quantity, average_buy_price, current_price,
              purchase_date, platform
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              transaction.holding_id,
              userId,
              transaction.asset_type,
              transaction.asset_symbol,
              transaction.quantity,
              transaction.price,
              transaction.price,
              transaction.transaction_date,
              transaction.platform
            ]
          );
        }
      }

      // If it's a buy transaction, we need to reduce the holding quantity
      if (transaction.transaction_type === 'buy' && transaction.holding_id) {
        await client.query(
          'UPDATE holdings SET quantity = quantity - $1, updated_at = NOW() WHERE holding_id = $2',
          [transaction.quantity, transaction.holding_id]
        );
      }

      // Mark transaction as reversed (soft delete)
      await client.query(
        `UPDATE transactions 
         SET notes = CONCAT(notes, ' [REVERSED]')
         WHERE transaction_id = $1`,
        [transactionId]
      );

      await client.query('COMMIT');

      logger.info(`Transaction reversed: ${transactionId}`);
      return { success: true, message: 'Transaction reversed successfully' };

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error reversing transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new TransactionService();
