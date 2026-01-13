import { db } from '../database';
import { logger } from '../utils/logger';

interface AuditLog {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

class AuditService {
  /**
   * Log user action for audit trail
   */
  async log(auditData: AuditLog): Promise<void> {
    try {
      await db.query(
        `INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, 
          ip_address, user_agent, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          auditData.userId || null,
          auditData.action,
          auditData.entityType || null,
          auditData.entityId || null,
          auditData.ipAddress || null,
          auditData.userAgent || null,
          auditData.metadata ? JSON.stringify(auditData.metadata) : null
        ]
      );

      logger.info(`Audit: ${auditData.action}`, {
        userId: auditData.userId,
        entityType: auditData.entityType
      });
    } catch (error: any) {
      logger.error('Failed to create audit log:', error);
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserLogs(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const result = await db.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    } catch (error: any) {
      logger.error('Failed to fetch audit logs:', error);
      return [];
    }
  }

  /**
   * Clean old audit logs (keep last 90 days)
   */
  async cleanOldLogs(): Promise<number> {
    try {
      const result = await db.query(
        `DELETE FROM audit_logs 
         WHERE created_at < NOW() - INTERVAL '90 days'`
      );
      logger.info(`Cleaned ${result.rowCount} old audit logs`);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Failed to clean audit logs:', error);
      return 0;
    }
  }
}

export default new AuditService();
