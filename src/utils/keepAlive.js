import http from 'http';
import https from 'https';

/**
 * KeepAlive Service
 * Automatically pings the server every 12 minutes to prevent Render free tier from sleeping.
 * Ensures 0ms cold starts 24/7 for all live auctions.
 */
export function startKeepAliveService() {
  const targetUrl = process.env.RENDER_EXTERNAL_URL || 'https://exchangedesk-backend.onrender.com';
  const pingIntervalMs = 12 * 60 * 1000; // 12 minutes

  console.log(`[KeepAlive] Service started. Pinging ${targetUrl}/api/health every 12 minutes.`);

  setInterval(() => {
    try {
      const url = new URL(`${targetUrl}/api/health`);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url, (res) => {
        if (res.statusCode === 200) {
          // Heartbeat success
        } else {
          console.warn(`[KeepAlive] Ping returned status: ${res.statusCode}`);
        }
      });

      req.on('error', (err) => {
        // Silently catch network glitches
      });

      req.setTimeout(15000, () => {
        req.destroy();
      });
    } catch (_) {}
  }, pingIntervalMs);
}
