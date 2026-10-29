import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from '../src/db/index.js';
import { createAuctionsRouter } from '../src/routes/auctions.js';
import { createBuyersRouter } from '../src/routes/buyers.js';
import { createShowroomsRouter } from '../src/routes/showrooms.js';
import { createAdminRouter } from '../src/routes/admin.js';
import { createAuthRouter } from '../src/routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dummy mock IO for serverless REST routes (WebSocket updates handled when running on persistent host)
const dummyIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
};

// Lazy DB initialization
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error('Vercel DB Init Error:', err);
    }
  }
  next();
});

// Mount Routes
app.use('/api/auth', createAuthRouter());
app.use('/api/auctions', createAuctionsRouter(dummyIo));
app.use('/api/buyers', createBuyersRouter(dummyIo));
app.use('/api/showrooms', createShowroomsRouter());
app.use('/api/admin', createAdminRouter(dummyIo));

// In-App Auto-Update Version Endpoint
app.get(['/api/version', '/api/app/version', '/version'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    version: '2.2.0',
    versionCode: 220,
    build: '20261024_12',
    releaseDate: '2026-10-24',
    title: 'Naya ExchangeDesk Update Available!',
    notes: [
      '⚡ Bid Confirmation Modal (Accidental Click Protection)',
      'Direct 1-Click In-App APK Updates',
      '0-Second Instant Live Bidding Engine',
      'Auto Winner & Instant Delivery OTP',
      'Exchange Desk Verified Counter Approvals'
    ],
    apkUrl: 'https://exchangedesk-five.vercel.app/ExchangeDesk.apk',
    isMandatory: false
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: 'vercel-serverless',
    timestamp: new Date().toISOString(),
  });
});

export default app;
