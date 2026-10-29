-- ============================================================================
-- ExchangeDesk: Database Schema
-- 10-Minute Rapid Used Two-Wheeler Exchange Bidding Engine
-- ============================================================================

-- Clean up existing tables if dropping/re-creating (in order of FK dependencies)
DROP TABLE IF EXISTS platform_transactions CASCADE;
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS auctions CASCADE;
DROP TABLE IF EXISTS buyers CASCADE;
DROP TABLE IF EXISTS showrooms CASCADE;

-- 1. Showrooms: Authorized two-wheeler showroom counters & sub-dealers
CREATE TABLE showrooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    pin VARCHAR(100) DEFAULT '1234',
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Buyers: Pre-verified private network of hyper-local buyers, mechanics, scrap dealers
CREATE TABLE buyers (
    id SERIAL PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0),
    pin VARCHAR(100) DEFAULT '1234',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Auctions: 10-Minute Flash Bidding Sessions for incoming exchange vehicles
CREATE TABLE auctions (
    id SERIAL PRIMARY KEY,
    showroom_id INTEGER NOT NULL REFERENCES showrooms(id) ON DELETE RESTRICT,
    vehicle_model VARCHAR(255) NOT NULL,
    manufacturing_year INTEGER NOT NULL CHECK (manufacturing_year >= 1990 AND manufacturing_year <= 2030),
    km_driven INTEGER NOT NULL CHECK (km_driven >= 0),
    rc_number VARCHAR(50) NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price > 0),
    current_highest_bid NUMERIC(12, 2) NOT NULL CHECK (current_highest_bid >= base_price),
    highest_bidder_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'LIVE' CHECK (status IN ('LIVE', 'CLOSED', 'COMPLETED', 'CANCELLED')),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    pickup_otp VARCHAR(6) NOT NULL,
    photos TEXT DEFAULT '[]',
    engine_sound_video TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bids: Immutable audit log of all bids placed during flash auctions
CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    auction_id INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Platform Transactions: Audit ledger for ₹500 auto-monetization fee deductions
CREATE TABLE platform_transactions (
    id SERIAL PRIMARY KEY,
    auction_id INTEGER REFERENCES auctions(id),
    buyer_id INTEGER NOT NULL REFERENCES buyers(id),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 500.00,
    fee_type VARCHAR(50) NOT NULL DEFAULT 'HANDOVER_PLATFORM_FEE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Deposit Requests: Buyer wallet pre-funding requests pending Admin verification & approval
CREATE TABLE deposit_requests (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) DEFAULT 'UPI',
    reference_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Indices for performance and real-time concurrency lookups
CREATE INDEX idx_auctions_status_ends_at ON auctions(status, ends_at);
CREATE INDEX idx_auctions_showroom_id ON auctions(showroom_id);
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_placed_at ON bids(placed_at DESC);
CREATE INDEX idx_buyers_wallet_balance ON buyers(wallet_balance);
CREATE INDEX idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX idx_deposit_requests_buyer_id ON deposit_requests(buyer_id);
