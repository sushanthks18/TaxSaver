import sgMail from '@sendgrid/mail';
import { config } from '../config';
import { logger } from '../utils/logger';

class EmailService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      logger.info('SendGrid initialized');
    } else {
      logger.warn('SENDGRID_API_KEY not set - emails will be logged only');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const apiKey = process.env.SENDGRID_API_KEY;
      
      if (!apiKey) {
        logger.info(`[EMAIL] To: ${to} | Subject: ${subject}`);
        logger.debug(`[EMAIL CONTENT] ${html}`);
        return true;
      }

      await sgMail.send({
        to,
        from: process.env.EMAIL_FROM || 'noreply@taxsaver.com',
        subject,
        html
      });

      logger.info(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error: any) {
      logger.error('Email sending failed:', error);
      return false;
    }
  }

  async sendTaxDeadlineReminder(email: string, name: string, taxAmount: number): Promise<boolean> {
    const subject = '⏰ Tax Deadline Reminder - March 31st Approaching';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Tax Deadline Reminder</h2>
        <p>Dear ${name},</p>
        <p>This is a friendly reminder that the financial year end is approaching on <strong>March 31st</strong>.</p>
        <p>Your current estimated tax liability: <strong>₹${taxAmount.toLocaleString('en-IN')}</strong></p>
        <p>Consider reviewing your tax loss harvesting recommendations to optimize your tax savings.</p>
        <p><a href="${config.corsOrigin}/recommendations" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Recommendations</a></p>
        <p>Best regards,<br/>TaxSaver Team</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendRecommendationAlert(email: string, name: string, count: number): Promise<boolean> {
    const subject = '📊 New Tax Loss Harvesting Opportunities';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Tax Saving Opportunities</h2>
        <p>Dear ${name},</p>
        <p>We found <strong>${count} new tax loss harvesting opportunities</strong> in your portfolio.</p>
        <p>Review these recommendations to potentially reduce your tax liability.</p>
        <p><a href="${config.corsOrigin}/recommendations" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Recommendations</a></p>
        <p>Best regards,<br/>TaxSaver Team</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendPriceAlert(email: string, name: string, symbol: string, price: number, change: number): Promise<boolean> {
    const subject = `📈 Price Alert: ${symbol}`;
    const direction = change >= 0 ? '↑' : '↓';
    const color = change >= 0 ? 'green' : 'red';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Price Alert</h2>
        <p>Dear ${name},</p>
        <p><strong>${symbol}</strong> has moved significantly:</p>
        <p style="font-size: 24px; color: ${color};">₹${price.toLocaleString('en-IN')} <span style="font-size: 18px;">${direction} ${Math.abs(change).toFixed(2)}%</span></p>
        <p><a href="${config.corsOrigin}/portfolio" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Portfolio</a></p>
        <p>Best regards,<br/>TaxSaver Team</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const subject = '🎉 Welcome to TaxSaver!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to TaxSaver!</h2>
        <p>Dear ${name},</p>
        <p>Thank you for joining TaxSaver - your intelligent tax loss harvesting platform.</p>
        <h3>Get Started:</h3>
        <ol>
          <li>Add your stock and crypto holdings</li>
          <li>Review tax loss harvesting recommendations</li>
          <li>Generate tax reports</li>
          <li>Optimize your tax savings</li>
        </ol>
        <p><a href="${config.corsOrigin}/portfolio" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Add Holdings</a></p>
        <p>Best regards,<br/>TaxSaver Team</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }
}

export default new EmailService();
