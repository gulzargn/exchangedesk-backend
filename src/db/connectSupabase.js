import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedShowrooms, seedBuyers } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../../schema.sql');
const envPath = path.resolve(__dirname, '../../.env');

async function connectAndInitSupabase(connectionUri) {
  let uri = connectionUri || process.env.DATABASE_URL;

  if (!uri) {
    console.error('❌ Error: No Supabase connection URI provided.');
    console.log('\nUsage:');
    console.log('  node src/db/connectSupabase.js "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"');
    console.log('OR set DATABASE_URL in .env');
    process.exit(1);
  }

  // Ensure SSL is handled for Supabase
  uri = uri.trim();
  console.log('Connecting to Supabase PostgreSQL...');

  const pool = new pg.Pool({
    connectionString: uri,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    const client = await pool.connect();
    console.log('✓ Successfully connected to Supabase PostgreSQL cluster!');

    const versionRes = await client.query('SELECT version();');
    console.log(`✓ PostgreSQL Server: ${versionRes.rows[0].version.split(',')[0]}`);

    console.log('\nApplying schema.sql to Supabase database...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('✓ Schema and indices applied successfully!');

    console.log('\nSeeding initial showrooms, verified buyers, and demo auctions...');
    
    // Seed showrooms
    for (const s of seedShowrooms) {
      await client.query(
        'INSERT INTO showrooms (name, phone, address) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [s.name, s.phone, s.address]
      );
    }
    
    // Seed buyers
    for (const b of seedBuyers) {
      await client.query(
        'INSERT INTO buyers (business_name, phone, wallet_balance, is_verified) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [b.business_name, b.phone, b.wallet_balance, b.is_verified]
      );
    }

    const showroomCount = await client.query('SELECT count(*) FROM showrooms');
    const buyerCount = await client.query('SELECT count(*) FROM buyers');

    console.log(`✓ Showrooms in Supabase: ${showroomCount.rows[0].count}`);
    console.log(`✓ Buyers in Supabase:    ${buyerCount.rows[0].count}`);

    client.release();
    await pool.end();

    // Save to .env file locally
    const envContent = `PORT=3000
DATABASE_URL=${uri}
MIN_WALLET_BALANCE_TO_BID=3000
MIN_BID_INCREMENT=500
HANDOVER_PLATFORM_FEE=500
DEFAULT_AUCTION_DURATION_MINUTES=10
`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('\n✓ Saved DATABASE_URL to local .env file.');

    console.log('\n===============================================================');
    console.log('🎉 Supabase PostgreSQL is fully connected, initialized, & seeded!');
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ Connection or Migration failed:', err.message);
    process.exit(1);
  }
}

const inputUri = process.argv[2];
connectAndInitSupabase(inputUri);
