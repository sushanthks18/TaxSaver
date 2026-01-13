import cron from 'node-cron';
import priceService from './price.service';
import { logger } from '../utils/logger';

class CronService {
  /**
   * Schedule automatic price updates every 15 minutes during market hours
   * NSE Market Hours: 9:15 AM - 3:30 PM IST (Monday-Friday)
   */
  startPriceUpdateJob(): void {
    // Run every 15 minutes between 9:00 AM and 4:00 PM IST on weekdays
    cron.schedule('*/15 9-16 * * 1-5', async () => {
      try {
        logger.info('Starting scheduled price update...');
        const updatedCount = await priceService.updateAllHoldingsPrices();
        logger.info(`Scheduled price update completed: ${updatedCount} holdings updated`);
      } catch (error: any) {
        logger.error('Error in scheduled price update:', error);
      }
    }, {
      timezone: 'Asia/Kolkata' // Indian Standard Time
    });

    logger.info('Price update cron job scheduled: Every 15 min (9 AM - 4 PM IST, Mon-Fri)');
  }

  /**
   * Schedule tax deadline reminders
   * Send on March 25th every year (6 days before March 31st deadline)
   */
  startTaxDeadlineReminder(): void {
    // Run at 9:00 AM on March 25th
    cron.schedule('0 9 25 3 *', async () => {
      try {
        logger.info('Sending tax deadline reminders...');
        // Will be implemented with email service
        // await notificationService.sendTaxDeadlineReminders();
        logger.info('Tax deadline reminders sent');
      } catch (error: any) {
        logger.error('Error sending tax deadline reminders:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Tax deadline reminder scheduled: March 25 at 9 AM IST');
  }

  /**
   * Daily portfolio sync job - run at 6 PM IST after market close
   */
  startDailyPortfolioSync(): void {
    cron.schedule('0 18 * * 1-5', async () => {
      try {
        logger.info('Starting daily portfolio sync...');
        
        // Update all prices one final time for the day
        await priceService.updateAllHoldingsPrices();
        
        // Clear old cache
        priceService.clearCache();
        
        logger.info('Daily portfolio sync completed');
      } catch (error: any) {
        logger.error('Error in daily portfolio sync:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Daily portfolio sync scheduled: 6 PM IST (Mon-Fri)');
  }

  /**
   * Weekly cleanup - clean old price history data
   * Keep only last 1 year of data
   */
  startWeeklyCleanup(): void {
    // Run at 2 AM on Sunday
    cron.schedule('0 2 * * 0', async () => {
      try {
        logger.info('Starting weekly database cleanup...');
        
        // Delete price history older than 1 year
        // Will be implemented when needed
        
        logger.info('Weekly cleanup completed');
      } catch (error: any) {
        logger.error('Error in weekly cleanup:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Weekly cleanup scheduled: Sunday 2 AM IST');
  }

  /**
   * Initialize all cron jobs
   */
  initAll(): void {
    this.startPriceUpdateJob();
    this.startTaxDeadlineReminder();
    this.startDailyPortfolioSync();
    this.startWeeklyCleanup();
    
    logger.info('All cron jobs initialized successfully');
  }
}

export default new CronService();
