import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  minWalletBalanceToBid: parseFloat(process.env.MIN_WALLET_BALANCE_TO_BID || '3000'),
  minBidIncrement: parseFloat(process.env.MIN_BID_INCREMENT || '500'),
  handoverPlatformFee: parseFloat(process.env.HANDOVER_PLATFORM_FEE || '500'),
  defaultAuctionDurationMinutes: parseInt(process.env.DEFAULT_AUCTION_DURATION_MINUTES || '10', 10),
};
