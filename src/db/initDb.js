import { initDatabase, query } from './index.js';

async function main() {
  try {
    console.log('[InitDB] Initializing ExchangeDesk database...');
    await initDatabase();

    const showroomCount = await query('SELECT count(*) FROM showrooms');
    const buyerCount = await query('SELECT count(*) FROM buyers');
    const auctionCount = await query('SELECT count(*) FROM auctions');

    console.log(`[InitDB] Verification:`);
    console.log(`  Showrooms: ${showroomCount.rows[0].count}`);
    console.log(`  Buyers:    ${buyerCount.rows[0].count}`);
    console.log(`  Auctions:  ${auctionCount.rows[0].count}`);
    console.log('[InitDB] Database ready.');
    process.exit(0);
  } catch (err) {
    console.error('[InitDB] Failed:', err);
    process.exit(1);
  }
}

main();
