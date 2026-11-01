import https from 'https';

/**
 * Image storage & optimization utility.
 * Optimizes photos to keep database lean and prevent storage bloat.
 * Supports automatic Cloudinary upload if CLOUDINARY_URL is present in environment.
 */
export async function optimizeAuctionPhotos(photos = []) {
  if (!Array.isArray(photos)) {
    if (typeof photos === 'string') {
      try {
        photos = JSON.parse(photos);
      } catch {
        photos = [photos];
      }
    } else {
      return [];
    }
  }

  const optimized = [];

  for (let i = 0; i < photos.length; i++) {
    const raw = (photos[i] || '').toString().trim();
    if (!raw) continue;

    // 1. If already an HTTP/HTTPS URL, preserve directly
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      optimized.push(raw);
      continue;
    }

    // 2. If Cloudinary credentials configured in process.env, upload to Cloudinary
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const cdnUrl = await uploadToCloudinary(raw);
        if (cdnUrl) {
          optimized.push(cdnUrl);
          continue;
        }
      } catch (_) {}
    }

    // 3. Fallback: Store standardized base64 Data URI
    if (raw.startsWith('data:image')) {
      optimized.push(raw);
    } else if (raw.length > 50) {
      optimized.push(`data:image/jpeg;base64,${raw}`);
    }
  }

  return optimized;
}

/**
 * Optional Cloudinary direct uploader
 */
function uploadToCloudinary(base64Data) {
  return new Promise((resolve, reject) => {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) return resolve(null);

      // Simple upload via Cloudinary REST API
      const timestamp = Math.round(new Date().getTime() / 1000);
      const postData = JSON.stringify({
        file: base64Data,
        timestamp: timestamp,
        api_key: apiKey,
      });

      const options = {
        hostname: 'api.cloudinary.com',
        path: `/v1_1/${cloudName}/image/upload`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.secure_url || null);
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.write(postData);
      req.end();
    } catch {
      resolve(null);
    }
  });
}
