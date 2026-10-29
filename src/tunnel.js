import localtunnel from 'localtunnel';

const PORT = process.env.PORT || 3000;

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: PORT });
    console.log(`[Tunnel] Live Public Web URL: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('[Tunnel] Tunnel connection closed. Reconnecting in 3s...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('[Tunnel] Error:', err.message);
      tunnel.close();
    });
  } catch (err) {
    console.error('[Tunnel] Failed to initialize tunnel:', err.message);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();
