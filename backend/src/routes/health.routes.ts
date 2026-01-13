import express, { Request, Response } from 'express';
import { db } from '../database';
import axios from 'axios';

const router = express.Router();

/**
 * ENHANCEMENT 10: Health Check Endpoint
 * GET /api/health
 * 
 * Returns system health status for monitoring
 */
router.get('/', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown',
      yahooFinance: 'unknown',
      coingecko: 'unknown'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    }
  };

  // Check database connectivity
  try {
    await db.query('SELECT 1');
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'degraded';
  }

  // Check CoinGecko API
  try {
    await axios.get('https://api.coingecko.com/api/v3/ping', { timeout: 3000 });
    health.services.coingecko = 'operational';
  } catch (error) {
    health.services.coingecko = 'down';
  }

  // Check Yahoo Finance (by testing a known symbol)
  try {
    await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS', { 
      timeout: 3000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    health.services.yahooFinance = 'operational';
  } catch (error) {
    health.services.yahooFinance = 'down';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Metrics endpoint for monitoring dashboards
 * GET /api/health/metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: {
        totalUsers: 0,
        totalHoldings: 0,
        totalTransactions: 0,
        totalRecommendations: 0
      },
      activity: {
        priceUpdatesLast24h: 0,
        transactionsLast24h: 0,
        loginLast24h: 0
      }
    };

    // Get database metrics
    const [users, holdings, transactions, recommendations] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query('SELECT COUNT(*) as count FROM holdings'),
      db.query('SELECT COUNT(*) as count FROM transactions'),
      db.query('SELECT COUNT(*) as count FROM tax_recommendations')
    ]);

    metrics.database.totalUsers = parseInt(users.rows[0].count);
    metrics.database.totalHoldings = parseInt(holdings.rows[0].count);
    metrics.database.totalTransactions = parseInt(transactions.rows[0].count);
    metrics.database.totalRecommendations = parseInt(recommendations.rows[0].count);

    // Get recent activity
    const priceUpdates = await db.query(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE action = 'price_update' 
      AND created_at > NOW() - INTERVAL '24 hours'
    `);
    metrics.activity.priceUpdatesLast24h = parseInt(priceUpdates.rows[0]?.count || '0');

    const recentTransactions = await db.query(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    metrics.activity.transactionsLast24h = parseInt(recentTransactions.rows[0]?.count || '0');

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch metrics',
      message: error.message 
    });
  }
});

/**
 * Readiness probe (K8s/Docker health checks)
 * GET /api/health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Must be able to query database to be ready
    await db.query('SELECT 1');
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

/**
 * Liveness probe (K8s/Docker health checks)
 * GET /api/health/live
 */
router.get('/live', (req: Request, res: Response) => {
  // If this endpoint responds, the process is alive
  res.status(200).json({ alive: true });
});

export default router;
