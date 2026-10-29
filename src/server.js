import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase, getIsInMemory, getClient } from './db/index.js';
import { setupAuctionSocket } from './socket/auctionSocket.js';
import { createAuctionsRouter } from './routes/auctions.js';
import { createBuyersRouter } from './routes/buyers.js';
import { createShowroomsRouter } from './routes/showrooms.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { auctionMutex } from './utils/lock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with permissive CORS for development
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

// Health & Diagnostic Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ExchangeDesk Bidding Engine',
    version: '1.0.0',
    dbMode: getIsInMemory() ? 'embedded-postgresql (pg-mem)' : 'production-postgresql',
    serverTime: new Date().toISOString(),
  });
});

// Mount Core API Modules
app.use('/api/auth', createAuthRouter());
app.use('/api/auctions', createAuctionsRouter(io));
app.use('/api/buyers', createBuyersRouter(io));
app.use('/api/showrooms', createShowroomsRouter());
app.use('/api/admin', createAdminRouter(io));

// In-App Auto-Update Version Endpoint
app.get(['/api/version', '/api/app/version', '/version'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    version: '2.2.0',
    versionCode: 220,
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

// Dedicated Super Admin Portal Route
app.get(['/admin', '/admin.html', '/admin/*'], (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/admin.html'));
});

// Fallback to index.html for SPA navigation
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

// Start Server
async function start() {
  try {
    await initDatabase();
    setupAuctionSocket(io);

    server.listen(config.port, () => {
      console.log('================================================================');
      console.log(`🚀 ExchangeDesk Engine running on http://localhost:${config.port}`);
      console.log(`⚡ Real-Time Layer: Socket.io connected`);
      console.log(`🔒 Anti-Bypass & Pre-Funded Wallet Rule: Active (Min ₹${config.minWalletBalanceToBid})`);
      console.log(`💰 Handover Auto-Monetization: Active (₹${config.handoverPlatformFee} fee per transaction)`);
      console.log('================================================================');
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();

export { app, server, io };
