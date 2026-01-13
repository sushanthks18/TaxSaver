import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './database';
import { errorHandler } from './middleware/errorHandler';

// Import routes (will create these next)
import authRoutes from './routes/auth.routes';
import portfolioRoutes from './routes/portfolio.routes';
import taxRoutes from './routes/tax.routes';
import userRoutes from './routes/user.routes';
import priceRoutes from './routes/price.routes';
import reportRoutes from './routes/report.routes';
import transactionRoutes from './routes/transaction.routes';
import insightsRoutes from './routes/insights.routes';
import washSaleRoutes from './routes/washsale.routes';
import taxComparisonRoutes from './routes/taxcomparison.routes';
import healthRoutes from './routes/health.routes';
import zerodhaRoutes from './routes/zerodha.routes';
import notificationRoutes from './routes/notification.routes';

// Import services
import cronService from './services/cron.service';

const app = express();

// Security middleware - disable CSP for development
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/user', userRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/washsale', washSaleRoutes);
app.use('/api/tax-comparison', taxComparisonRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/zerodha', zerodhaRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      path: req.url,
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Start listening
    app.listen(config.port, config.host, () => {
      logger.info(`🚀 TaxSaver API Server running on http://${config.host}:${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🗄️  Database: Connected`);
      
      // Initialize cron jobs
      cronService.initAll();
      logger.info('⏰ Cron jobs initialized');
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

startServer();

export default app;
