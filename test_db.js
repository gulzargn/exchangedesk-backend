import pg from 'pg';
import { config } from './src/config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT count(*) as buyers_count FROM buyers');
    console.log('✅ Supabase Connection SUCCESS! Total registered buyers:', res.rows[0].buyers_count);
    const auctions = await pool.query('SELECT count(*) as auctions_count FROM auctions');
    console.log('✅ Auctions in DB:', auctions.rows[0].auctions_count);
    const showrooms = await pool.query('SELECT id, name, phone FROM showrooms LIMIT 3');
    console.log('✅ Showrooms:', showrooms.rows);
  } catch (err) {
    console.error('❌ DB Error:', err);
  } finally {
    await pool.end();
  }
}

test();
