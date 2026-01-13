 -- TaxSaver Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    pan_number VARCHAR(255), -- Encrypted
    phone_number VARCHAR(20),
    tax_regime VARCHAR(20) DEFAULT 'new' CHECK (tax_regime IN ('old', 'new')),
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- API Credentials Table
CREATE TABLE api_credentials (
    credential_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'zerodha', 'wazirx', 'coindcx', 'groww', 'upstox', 'binance'
    api_key TEXT, -- Encrypted
    api_secret TEXT, -- Encrypted
    access_token TEXT, -- Encrypted
    refresh_token TEXT, -- Encrypted
    is_active BOOLEAN DEFAULT TRUE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform)
);

-- Holdings Table
CREATE TABLE holdings (
    holding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('stock', 'crypto')),
    asset_symbol VARCHAR(50) NOT NULL, -- 'RELIANCE', 'BTC', etc.
    asset_name VARCHAR(255),
    quantity DECIMAL(20, 8) NOT NULL,
    average_buy_price DECIMAL(20, 2) NOT NULL,
    current_price DECIMAL(20, 2),
    purchase_date DATE NOT NULL,
    platform VARCHAR(50), -- 'zerodha', 'wazirx', 'manual', etc.
    exchange VARCHAR(50), -- 'NSE', 'BSE', 'Binance', etc.
    isin VARCHAR(50), -- For stocks
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    holding_id UUID REFERENCES holdings(holding_id) ON DELETE SET NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('stock', 'crypto')),
    asset_symbol VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    fees DECIMAL(20, 2) DEFAULT 0,
    platform VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Reports Table
CREATE TABLE tax_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    financial_year VARCHAR(10) NOT NULL, -- '2025-26'
    report_type VARCHAR(50) NOT NULL, -- 'capital_gains', 'tax_savings', 'itr_prefill'
    total_short_term_gains DECIMAL(20, 2) DEFAULT 0,
    total_long_term_gains DECIMAL(20, 2) DEFAULT 0,
    total_short_term_losses DECIMAL(20, 2) DEFAULT 0,
    total_long_term_losses DECIMAL(20, 2) DEFAULT 0,
    net_taxable_gains DECIMAL(20, 2) DEFAULT 0,
    tax_liability DECIMAL(20, 2) DEFAULT 0,
    tax_saved DECIMAL(20, 2) DEFAULT 0,
    report_url TEXT, -- S3 URL or local path
    report_data JSONB, -- Detailed report data
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Optimization Recommendations Table
CREATE TABLE tax_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    holding_id UUID REFERENCES holdings(holding_id) ON DELETE SET NULL,
    asset_symbol VARCHAR(50) NOT NULL,
    recommendation_type VARCHAR(50) NOT NULL, -- 'harvest_loss', 'defer_gain', 'sell_partial'
    current_price DECIMAL(20, 2),
    purchase_price DECIMAL(20, 2),
    quantity DECIMAL(20, 8),
    potential_loss DECIMAL(20, 2),
    tax_savings DECIMAL(20, 2),
    priority_score INT, -- 1-10, higher is more urgent
    deadline DATE, -- March 31st typically
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price History Table (for caching and charting)
CREATE TABLE price_history (
    price_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_symbol VARCHAR(50) NOT NULL,
    price DECIMAL(20, 2) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'auto', -- 'coingecko', 'yahoo_finance', 'manual', 'auto'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_symbol, recorded_at)
);

-- Notifications Table
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'tax_deadline', 'price_alert', 'new_recommendation'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'login', 'upload_csv', 'generate_report', etc.
    entity_type VARCHAR(50), -- 'holding', 'transaction', 'report'
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON api_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_recommendations_updated_at BEFORE UPDATE ON tax_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_holdings_user_asset ON holdings(user_id, asset_symbol);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_price_history_symbol_date ON price_history(asset_symbol, price_date DESC);

-- Insert default tax configuration (optional)
CREATE TABLE tax_config (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_year VARCHAR(10) NOT NULL UNIQUE,
    short_term_equity_rate DECIMAL(5, 2) DEFAULT 15.00,
    long_term_equity_rate DECIMAL(5, 2) DEFAULT 10.00,
    long_term_equity_exemption DECIMAL(20, 2) DEFAULT 100000.00,
    crypto_short_term_rate DECIMAL(5, 2) DEFAULT 30.00,
    crypto_long_term_rate DECIMAL(5, 2) DEFAULT 20.00,
    surcharge_threshold DECIMAL(20, 2) DEFAULT 5000000.00,
    surcharge_rate DECIMAL(5, 2) DEFAULT 10.00,
    cess_rate DECIMAL(5, 2) DEFAULT 4.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert current year tax rates
INSERT INTO tax_config (financial_year, short_term_equity_rate, long_term_equity_rate, long_term_equity_exemption, crypto_short_term_rate, crypto_long_term_rate)
VALUES ('2025-26', 15.00, 10.00, 100000.00, 30.00, 20.00);
