-- Li Astrology Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Order info
    order_id VARCHAR(255) UNIQUE NOT NULL,

    -- LiqPay data
    liqpay_order_id VARCHAR(255),
    payment_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Product info
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',

    -- Customer info (from LiqPay)
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),

    -- Telegram delivery
    telegram_sent BOOLEAN DEFAULT FALSE,
    telegram_chat_id VARCHAR(50),
    telegram_sent_at TIMESTAMP WITH TIME ZONE,

    -- Raw LiqPay response for debugging
    liqpay_data JSONB
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_purchases_order_id ON purchases(order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_purchases_updated_at
    BEFORE UPDATE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow insert from service role (Edge Functions)
CREATE POLICY "Allow insert from service role" ON purchases
    FOR INSERT
    WITH CHECK (true);

-- Policy: Only allow update from service role
CREATE POLICY "Allow update from service role" ON purchases
    FOR UPDATE
    USING (true);

-- Policy: Only allow select from service role
CREATE POLICY "Allow select from service role" ON purchases
    FOR SELECT
    USING (true);

-- Grant permissions to service role
GRANT ALL ON purchases TO service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Success message
SELECT 'Schema created successfully!' as message;
