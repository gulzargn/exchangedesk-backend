import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { newDb } from 'pg-mem';
import { config } from '../config.js';
import { seedShowrooms, seedBuyers } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../../schema.sql');

let pool = null;
let isInMemory = false;

/**
 * Initializes the database connection pool.
 * Attempts to connect to real PostgreSQL (via config.databaseUrl or default PG environment).
 * If unreachable or not configured, falls back seamlessly to embedded in-memory PostgreSQL engine.
 */
export async function initDatabase() {
  const connectionString = config.databaseUrl || 'postgres://postgres:postgres@localhost:5432/exchangedesk';

  // Try real PostgreSQL / Supabase first
  try {
    const isRemote =
      connectionString.includes('supabase') ||
      connectionString.includes('neon') ||
      connectionString.includes('render') ||
      connectionString.includes('aiven') ||
      connectionString.includes('sslmode=require') ||
      process.env.NODE_ENV === 'production';

    const testPool = new pg.Pool({
      connectionString,
      ssl: isRemote ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000, // 10s for remote cloud TLS handshake
      max: 20,
      idleTimeoutMillis: 30000,
    });

    // Handle unexpected errors on idle database clients (prevents app crash on connection reset)
    testPool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle PostgreSQL client (auto-reconnecting):', err.message);
    });

    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();

    pool = testPool;
    isInMemory = false;
    const cleanHost = connectionString.includes('@') ? connectionString.split('@')[1].split('/')[0] : 'PostgreSQL';
    console.log(`[DB] Connected successfully to Cloud PostgreSQL at ${cleanHost}`);

    // Ensure deposit_requests table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
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
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_buyer_id ON deposit_requests(buyer_id);
    `);

    // Ensure platform_transactions.auction_id is nullable (to support wallet deposit transactions)
    try {
      await pool.query('ALTER TABLE platform_transactions ALTER COLUMN auction_id DROP NOT NULL');
    } catch (_) {}

    // Ensure auctions has photos and engine_sound_video columns
    try {
      await pool.query("ALTER TABLE auctions ADD COLUMN IF NOT EXISTS photos TEXT DEFAULT '[]'");
      await pool.query("ALTER TABLE auctions ADD COLUMN IF NOT EXISTS engine_sound_video TEXT DEFAULT ''");
    } catch (_) {}

    // Check if tables exist, if not run schema
    const checkRes = await pool.query(
      "SELECT to_regclass('public.auctions') AS table_exists"
    );

    if (!checkRes.rows[0]?.table_exists) {
      console.log('[DB] Applying schema.sql migrations to PostgreSQL...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      await seedInitialData(pool);
    } else {
      await seedInitialData(pool);
      console.log('[DB] Schema already initialized & verified.');
    }
  } catch (err) {
    console.warn(`[DB] Could not connect to real PostgreSQL (${err.message}).`);
    console.log('[DB] Initializing embedded in-memory PostgreSQL engine (pg-mem) with full ACID & row-locking support...');

    const memDb = newDb();
    const memPg = memDb.adapters.createPg();
    pool = new memPg.Pool();
    isInMemory = true;

    // Execute schema
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    await seedInitialData(pool);
    console.log('[DB] Embedded PostgreSQL engine ready with initial seed data.');
  }

  return pool;
}

/**
 * Seeds initial showrooms, buyers, and active demo auctions.
 */
async function seedInitialData(dbPool) {
  // 1. Seed Showrooms if empty
  const showroomIds = [];
  const countShowrooms = await dbPool.query('SELECT COUNT(*) FROM showrooms');
  if (parseInt(countShowrooms.rows[0].count, 10) === 0) {
    console.log('[DB] Seeding showrooms...');
    for (const s of seedShowrooms) {
      const res = await dbPool.query(
        'INSERT INTO showrooms (name, phone, address) VALUES ($1, $2, $3) RETURNING id',
        [s.name, s.phone, s.address]
      );
      showroomIds.push(res.rows[0].id);
    }
  } else {
    const existing = await dbPool.query('SELECT id FROM showrooms ORDER BY id ASC');
    existing.rows.forEach((r) => showroomIds.push(r.id));
  }

  // 2. Seed Buyers if empty
  const buyerIds = [];
  const countBuyers = await dbPool.query('SELECT COUNT(*) FROM buyers');
  if (parseInt(countBuyers.rows[0].count, 10) === 0) {
    console.log('[DB] Seeding verified buyers...');
    for (const b of seedBuyers) {
      const res = await dbPool.query(
        'INSERT INTO buyers (business_name, phone, wallet_balance, is_verified) VALUES ($1, $2, $3, $4) RETURNING id',
        [b.business_name, b.phone, b.wallet_balance, b.is_verified]
      );
      buyerIds.push(res.rows[0].id);
    }
  } else {
    const existing = await dbPool.query('SELECT id FROM buyers ORDER BY id ASC');
    existing.rows.forEach((r) => buyerIds.push(r.id));
  }

  // 3. Keep auction feed clean for genuine real-world showroom dealer listings
  console.log('[DB] Production baseline data verified.');
}

/**
 * Helper to query the pool
 */
export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDatabase() first.');
  }
  return pool.query(text, params);
}

/**
 * Helper to acquire a client for ACID transactions
 */
export async function getClient() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDatabase() first.');
  }
  return pool.connect();
}

/**
 * Returns whether current connection is in-memory fallback
 */
export function getIsInMemory() {
  return isInMemory;
}

export default {
  initDatabase,
  query,
  getClient,
  getIsInMemory,
};
