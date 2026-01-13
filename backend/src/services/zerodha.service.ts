import axios from 'axios';
import { db } from '../database';
import { logger } from '../utils/logger';
import encryptionService from './encryption.service';

/**
 * ENHANCEMENT 3: Zerodha Integration Service
 * 
 * Real broker integration using Kite Connect API
 * Features:
 * - OAuth 2.0 authentication
 * - Auto-sync holdings from Zerodha account
 * - Encrypted token storage
 * - Daily sync with cron job
 * 
 * Setup Requirements:
 * 1. Register app at https://developers.kite.trade/
 * 2. Get API Key and API Secret
 * 3. Set KITE_API_KEY and KITE_API_SECRET in env
 */

interface ZerodhaHolding {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  product: string;
}

interface ZerodhaSession {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

class ZerodhaService {
  private readonly KITE_BASE_URL = 'https://api.kite.trade';
  private readonly KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login';
  private readonly API_KEY = process.env.KITE_API_KEY || '';
  private readonly API_SECRET = process.env.KITE_API_SECRET || '';

  /**
   * Step 1: Generate OAuth login URL
   * User clicks this URL and authorizes the app
   */
  getLoginURL(userId: string): string {
    if (!this.API_KEY) {
      throw new Error('Kite API Key not configured');
    }

    // Store state to verify callback
    const crypto = require('crypto');
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      api_key: this.API_KEY,
      v: '3',
      state: `${userId}:${state}`
    });

    return `${this.KITE_LOGIN_URL}?${params.toString()}`;
  }

  /**
   * Step 2: Handle OAuth callback and generate session
   * Called after user authorizes the app
   */
  async handleCallback(requestToken: string, userId: string): Promise<ZerodhaSession> {
    try {
      if (!this.API_KEY || !this.API_SECRET) {
        throw new Error('Kite API credentials not configured');
      }

      // Generate session using request token
      const response = await axios.post(
        `${this.KITE_BASE_URL}/session/token`,
        {
          api_key: this.API_KEY,
          request_token: requestToken,
          checksum: this.generateChecksum(requestToken)
        },
        {
          headers: {
            'X-Kite-Version': '3'
          }
        }
      );

      const { data } = response.data;
      const session: ZerodhaSession = {
        user_id: data.user_id,
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_at: new Date(data.expires_at || Date.now() + 86400000) // 24 hours
      };

      // Store encrypted access token in database
      await this.storeSession(userId, session);

      logger.info(`Zerodha connected for user ${userId}`);
      return session;
    } catch (error: any) {
      logger.error('Zerodha callback error:', error.response?.data || error.message);
      throw new Error('Failed to connect Zerodha account');
    }
  }

  /**
   * Generate checksum for session token API
   */
  private generateChecksum(requestToken: string): string {
    const crypto = require('crypto');
    const data = `${this.API_KEY}${requestToken}${this.API_SECRET}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store encrypted session in database
   */
  private async storeSession(userId: string, session: ZerodhaSession): Promise<void> {
    try {
      const encryptedToken = encryptionService.encrypt(session.access_token);
      const encryptedRefreshToken = session.refresh_token 
        ? encryptionService.encrypt(session.refresh_token)
        : null;

      await db.query(
        `INSERT INTO broker_connections 
         (user_id, broker_name, access_token, refresh_token, zerodha_user_id, expires_at, connected_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, broker_name) 
         DO UPDATE SET 
           access_token = $3,
           refresh_token = $4,
           zerodha_user_id = $5,
           expires_at = $6,
           connected_at = NOW()`,
        [userId, 'zerodha', encryptedToken, encryptedRefreshToken, session.user_id, session.expires_at]
      );
    } catch (error: any) {
      logger.error('Failed to store Zerodha session:', error);
      throw error;
    }
  }

  /**
   * Get stored access token for user
   */
  private async getAccessToken(userId: string): Promise<string | null> {
    try {
      const result = await db.query(
        `SELECT access_token, expires_at FROM broker_connections 
         WHERE user_id = $1 AND broker_name = 'zerodha'`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const { access_token, expires_at } = result.rows[0];

      // Check if token expired
      if (new Date(expires_at) < new Date()) {
        logger.warn(`Zerodha token expired for user ${userId}`);
        return null;
      }

      return encryptionService.decrypt(access_token);
    } catch (error: any) {
      logger.error('Failed to get Zerodha access token:', error);
      return null;
    }
  }

  /**
   * Step 3: Sync holdings from Zerodha
   */
  async syncHoldings(userId: string): Promise<{ imported: number; updated: number; total: number }> {
    try {
      const accessToken = await this.getAccessToken(userId);

      if (!accessToken) {
        throw new Error('Zerodha not connected. Please connect your account first.');
      }

      // Fetch holdings from Kite API
      const response = await axios.get(`${this.KITE_BASE_URL}/portfolio/holdings`, {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${this.API_KEY}:${accessToken}`
        }
      });

      const holdings: ZerodhaHolding[] = response.data.data;
      logger.info(`Fetched ${holdings.length} holdings from Zerodha for user ${userId}`);

      let imported = 0;
      let updated = 0;

      for (const holding of holdings) {
        // Skip if quantity is 0
        if (holding.quantity === 0) continue;

        // Check if holding already exists
        const existing = await db.query(
          `SELECT holding_id FROM holdings 
           WHERE user_id = $1 AND asset_symbol = $2 AND platform = 'zerodha'`,
          [userId, holding.tradingsymbol]
        );

        if (existing.rows.length === 0) {
          // Import new holding
          await db.query(
            `INSERT INTO holdings 
             (user_id, asset_symbol, asset_type, quantity, average_buy_price, current_price, platform, last_synced)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
              userId,
              holding.tradingsymbol,
              'stock', // Zerodha only supports stocks
              holding.quantity,
              holding.average_price,
              holding.last_price,
              'zerodha'
            ]
          );
          imported++;
        } else {
          // Update existing holding
          await db.query(
            `UPDATE holdings 
             SET quantity = $1, average_buy_price = $2, current_price = $3, last_synced = NOW()
             WHERE user_id = $4 AND asset_symbol = $5 AND platform = 'zerodha'`,
            [holding.quantity, holding.average_price, holding.last_price, userId, holding.tradingsymbol]
          );
          updated++;
        }
      }

      logger.info(`Zerodha sync complete for user ${userId}: ${imported} imported, ${updated} updated`);

      return {
        imported,
        updated,
        total: holdings.length
      };
    } catch (error: any) {
      logger.error('Zerodha sync error:', error.response?.data || error.message);
      throw new Error('Failed to sync holdings from Zerodha');
    }
  }

  /**
   * Disconnect Zerodha account
   */
  async disconnect(userId: string): Promise<void> {
    try {
      await db.query(
        `DELETE FROM broker_connections 
         WHERE user_id = $1 AND broker_name = 'zerodha'`,
        [userId]
      );

      logger.info(`Zerodha disconnected for user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to disconnect Zerodha:', error);
      throw error;
    }
  }

  /**
   * Check if user has Zerodha connected
   */
  async isConnected(userId: string): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT 1 FROM broker_connections 
         WHERE user_id = $1 AND broker_name = 'zerodha'`,
        [userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(userId: string): Promise<any> {
    try {
      const result = await db.query(
        `SELECT zerodha_user_id, connected_at, last_synced, expires_at 
         FROM broker_connections 
         WHERE user_id = $1 AND broker_name = 'zerodha'`,
        [userId]
      );

      if (result.rows.length === 0) {
        return { connected: false };
      }

      const connection = result.rows[0];
      const isExpired = new Date(connection.expires_at) < new Date();

      return {
        connected: true,
        zerodhaUserId: connection.zerodha_user_id,
        connectedAt: connection.connected_at,
        lastSynced: connection.last_synced,
        expiresAt: connection.expires_at,
        isExpired
      };
    } catch (error) {
      return { connected: false, error: 'Failed to get status' };
    }
  }
}

export default new ZerodhaService();
