-- ====================================================================
-- ENHANCEMENT 2: DATABASE PERFORMANCE OPTIMIZATION
-- Critical indexes for production scalability (10,000+ users)
-- ====================================================================

-- Drop existing indexes if recreating
DROP INDEX IF EXISTS idx_holdings_user_id;
DROP INDEX IF EXISTS idx_holdings_symbol;
DROP INDEX IF EXISTS idx_holdings_updated;
DROP INDEX IF EXISTS idx_holdings_user_type;
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_symbol;
DROP INDEX IF EXISTS idx_transactions_user_date;
DROP INDEX IF EXISTS idx_recommendations_user_status;
DROP INDEX IF EXISTS idx_recommendations_priority;
DROP INDEX IF EXISTS idx_tax_reports_user_fy;
DROP INDEX IF EXISTS idx_audit_logs_user_date;
DROP INDEX IF EXISTS idx_price_history_symbol_date;

-- ====================================================================
-- Holdings Table Indexes (Most Queried)
-- ====================================================================

-- Primary lookup: Get all holdings for a user (Dashboard, Portfolio pages)
CREATE INDEX idx_holdings_user_id ON holdings(user_id);

-- Symbol lookup: Price updates, validation
CREATE INDEX idx_holdings_symbol ON holdings(asset_symbol);

-- Sort by last updated: Recently updated holdings
CREATE INDEX idx_holdings_updated ON holdings(updated_at DESC);

-- Composite: Filter by user and asset type (Stocks vs Crypto charts)
CREATE INDEX idx_holdings_user_type ON holdings(user_id, asset_type);

-- ====================================================================
-- Transactions Table Indexes (History & Analytics)
-- ====================================================================

-- User transactions: Transaction history page
CREATE INDEX idx_transactions_user_id ON transactions(user_id);

-- Date sorting: Recent transactions first
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);

-- Symbol tracking: Wash sale detection
CREATE INDEX idx_transactions_symbol ON transactions(asset_symbol);

-- Composite: User transactions with date range filter
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

-- ====================================================================
-- Recommendations Table Indexes (TLH Algorithm)
-- ====================================================================

-- Composite: Get pending recommendations for user
CREATE INDEX idx_recommendations_user_status ON tax_recommendations(user_id, status) 
WHERE status = 'pending';

-- Priority sorting: Show highest priority first
CREATE INDEX idx_recommendations_priority ON tax_recommendations(priority_score DESC, created_at DESC);

-- ====================================================================
-- Tax Reports Table Indexes (Report Generation)
-- ====================================================================

-- Composite: Get user's reports by financial year
CREATE INDEX idx_tax_reports_user_fy ON tax_reports(user_id, financial_year);

-- ====================================================================
-- Audit Logs Table Indexes (Compliance & Monitoring)
-- ====================================================================

-- Composite: User activity logs with date filter
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);

-- ====================================================================
-- Price History Table Indexes (Charts & Caching)
-- ====================================================================

-- Composite: Get price history for a symbol with date sort
CREATE INDEX idx_price_history_symbol_date ON price_history(asset_symbol, recorded_at DESC);

-- ====================================================================
-- Verify Indexes Created
-- ====================================================================

-- Query to list all indexes on important tables
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM 
    pg_indexes 
WHERE 
    schemaname = 'public' 
    AND tablename IN ('holdings', 'transactions', 'tax_recommendations', 'tax_reports', 'audit_logs', 'price_history')
ORDER BY 
    tablename, indexname;

-- ====================================================================
-- ANALYZE Tables for Query Planner
-- ====================================================================

ANALYZE holdings;
ANALYZE transactions;
ANALYZE tax_recommendations;
ANALYZE tax_reports;
ANALYZE audit_logs;
ANALYZE price_history;
