import express from 'express';
import { query, getClient } from '../db/index.js';
import { generatePickupOtp } from '../utils/otp.js';
import { maskRcNumber, sanitizeAuctionForBuyer } from '../utils/masking.js';
import { config } from '../config.js';
import { optimizeAuctionPhotos } from '../utils/imageStorage.js';
import { optionalAuthenticateToken } from '../utils/auth.js';
import { parseAndVerifyRc } from '../utils/rtoVerification.js';
import { generateRtoAgreementHtml } from '../utils/rtoAgreementGenerator.js';

export function createAuctionsRouter(io) {
  const router = express.Router();

  // High-speed In-Memory Cache for /active feed with automatic invalidation on bids
  const activeAuctionsCache = new Map();

  function invalidateActiveCache() {
    activeAuctionsCache.clear();
  }

  // Periodic background autoClose every 5 seconds (non-blocking)
  setInterval(() => {
    autoCloseExpiredAuctions().catch((err) => {
      console.error('[AutoClose Background] Error:', err.message);
    });
  }, 5000);

  /**
   * Helper: Automatically check and close all expired auctions whose 10-minute timer ended,
   * awarding the win to the highest bidder.
   */
  async function autoCloseExpiredAuctions() {
    try {
      const expiredRes = await query(
        `SELECT a.id, a.vehicle_model, a.current_highest_bid, a.highest_bidder_id,
                a.pickup_otp, a.showroom_id, b.business_name as winner_name,
                s.name as showroom_name
         FROM auctions a
         LEFT JOIN buyers b ON a.highest_bidder_id = b.id
         LEFT JOIN showrooms s ON a.showroom_id = s.id
         WHERE a.status = 'LIVE' AND a.ends_at <= NOW()`
      );

      if (expiredRes.rows.length > 0) {
        for (const auction of expiredRes.rows) {
          await query(
            "UPDATE auctions SET status = 'CLOSED' WHERE id = $1 AND status = 'LIVE'",
            [auction.id]
          );

          // EMD Token Lock: Lock ₹2,000 earnest money deposit from winning buyer
          if (auction.highest_bidder_id) {
            try {
              const emdVal = 2000.00;
              await query(
                `UPDATE buyers SET locked_emd = locked_emd + $1 WHERE id = $2`,
                [emdVal, auction.highest_bidder_id]
              );
              await query(
                `UPDATE auctions SET emd_status = 'LOCKED', emd_amount = $1 WHERE id = $2`,
                [emdVal, auction.id]
              );
              console.log(`[EMD:Locked] ₹${emdVal} EMD locked for Buyer #${auction.highest_bidder_id} on Auction #${auction.id}`);
            } catch (emdErr) {
              console.warn('[AutoClose EMD Lock Warning]:', emdErr.message);
            }
          }

          console.log(`[AutoClose] Auction #${auction.id} (${auction.vehicle_model}) expired. Winner: ${auction.winner_name || 'No bids placed'}`);

          if (io) {
            const closePayload = {
              auctionId: auction.id,
              vehicleModel: auction.vehicle_model,
              finalBid: parseFloat(auction.current_highest_bid),
              highestBidderId: auction.highest_bidder_id,
              winnerName: auction.winner_name || 'Counter (No dealer bids)',
              showroomId: auction.showroom_id,
              showroomName: auction.showroom_name,
              pickupOtp: auction.pickup_otp,
              timestamp: new Date().toISOString(),
            };
            io.emit('auction_closed', closePayload);
            io.emit('feed_auction_closed', closePayload);
          }
        }
        invalidateActiveCache();
      }
    } catch (err) {
      console.error('[AutoClose] Error checking expired auctions:', err.message);
    }
  }

  /**
   * POST /api/auctions/create
   * Accepts bike details from showroom counter, computes authoritative 10-minute
   * countdown ends_at timestamp on server, generates 6-digit pickup_otp.
   */
  router.post('/create', async (req, res) => {
    try {
      const vehicle_model = req.body.vehicle_model || req.body.bike_name;
      const manufacturing_year = req.body.manufacturing_year || req.body.year;
      const km_driven = req.body.km_driven;
      const rc_number = req.body.rc_number;
      const base_price = req.body.base_price || req.body.starting_price;
      const showroom_id = req.body.showroom_id;
      const photos = req.body.photos || [];
      const engine_sound_video = req.body.engine_sound_video || req.body.video || '';
      const duration_minutes = req.body.duration_minutes || config.defaultAuctionDurationMinutes;
      const condition_report = req.body.condition_report || {};

      // Input validations with clear, readable errors
      if (!vehicle_model) {
        return res.status(400).json({ success: false, error: 'Vehicle model name is required' });
      }
      if (!manufacturing_year) {
        return res.status(400).json({ success: false, error: 'Manufacturing year is required' });
      }
      if (km_driven === undefined || km_driven === null || km_driven === '') {
        return res.status(400).json({ success: false, error: 'KM driven is required' });
      }
      if (!rc_number) {
        return res.status(400).json({ success: false, error: 'RC number is required' });
      }
      if (!base_price) {
        return res.status(400).json({ success: false, error: 'Base price is required' });
      }

      let showroomId = parseInt(showroom_id, 10);
      if (!showroomId || isNaN(showroomId)) {
        // Safe fallback to active registered showroom
        const defShowroom = await query('SELECT id, name FROM showrooms WHERE is_active = true AND is_approved = true ORDER BY id ASC LIMIT 1');
        if (defShowroom.rows.length > 0) {
          showroomId = defShowroom.rows[0].id;
        } else {
          showroomId = 1;
        }
      }

      const year = parseInt(manufacturing_year, 10);
      const km = parseInt(km_driven, 10);
      const price = parseFloat(base_price);
      const duration = parseInt(duration_minutes, 10) || 10;

      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Base price must be a valid positive number' });
      }

      if (isNaN(year) || year < 1990 || year > 2030) {
        return res.status(400).json({ error: 'Invalid manufacturing year' });
      }

      if (isNaN(km) || km < 0) {
        return res.status(400).json({ error: 'KM driven must be a non-negative number' });
      }

      // Verify showroom exists and is active, or fallback to first active
      let showroomCheck = await query('SELECT id, name, is_active FROM showrooms WHERE id = $1', [showroomId]);
      if (showroomCheck.rows.length === 0 || showroomCheck.rows[0].is_active === false) {
        const fallbackShowroom = await query('SELECT id, name FROM showrooms WHERE is_active = true AND is_approved = true ORDER BY id ASC LIMIT 1');
        if (fallbackShowroom.rows.length > 0) {
          showroomId = fallbackShowroom.rows[0].id;
          showroomCheck = fallbackShowroom;
        }
      }
      const showroomName = showroomCheck.rows[0]?.name || 'Verified Seller Desk';

      // Authoritative server timestamp calculations
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
      const pickupOtp = generatePickupOtp();

      const processedPhotos = await optimizeAuctionPhotos(photos);
      const photosJson = JSON.stringify(processedPhotos);
      const engineSoundMedia = typeof engine_sound_video === 'string' ? engine_sound_video : '';
      const conditionReportJson = typeof condition_report === 'string' ? condition_report : JSON.stringify(condition_report || {});

      // Automatic Vahan & RTO Verification Engine
      const rtoVerification = parseAndVerifyRc(rc_number.trim(), year);
      const rtoVerified = rtoVerification.valid;
      const rtoDetailsJson = JSON.stringify(rtoVerification.valid ? rtoVerification : {});

      const insertRes = await query(
        `INSERT INTO auctions (
          showroom_id, vehicle_model, manufacturing_year, km_driven,
          rc_number, base_price, current_highest_bid, highest_bidder_id,
          status, starts_at, ends_at, pickup_otp, photos, engine_sound_video, condition_report,
          rto_verified, rto_details, emd_amount, emd_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'LIVE', $8, $9, $10, $11, $12, $13, $14, $15, 2000.00, 'NONE')
        RETURNING *`,
        [
          showroomId,
          vehicle_model.trim(),
          year,
          km,
          rc_number.trim().toUpperCase(),
          price,
          price, // Initial highest bid starts at base reserve price
          startsAt,
          endsAt,
          pickupOtp,
          photosJson,
          engineSoundMedia,
          conditionReportJson,
          rtoVerified,
          rtoDetailsJson,
        ]
      );

      const createdAuction = insertRes.rows[0];
      invalidateActiveCache();

      // Broadcast new auction to global socket feed
      const broadcastData = {
        ...sanitizeAuctionForBuyer(createdAuction),
        showroom_name: showroomName,
      };
      if (io) {
        io.to('auctions_feed').emit('feed_new_auction', broadcastData);
      }

      console.log(`[Auction:Created] ID #${createdAuction.id} for "${vehicle_model}" (Ends at ${endsAt.toISOString()})`);

      return res.status(201).json({
        success: true,
        message: '10-Minute Rapid Flash Auction initiated successfully',
        auction: createdAuction,
      });
    } catch (err) {
      console.error('[API:createAuction] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/auctions/active
   * Returns all active/recent auctions with showroom names and highest bidder details.
   */
  router.get('/active', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const { view = 'buyer', showroom_id, buyer_id } = req.query;

      // Fast in-memory cache check (1.2s TTL for lightning-fast multi-device heartbeat)
      const cacheKey = `${view}:${showroom_id || ''}:${buyer_id || ''}`;
      const cached = activeAuctionsCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < 1200)) {
        return res.json(cached.payload);
      }

      // Query active & recent auctions (including photos and engine sound video)
      let whereClause = `WHERE a.status = 'LIVE'`;
      const queryParams = [];

      if (view === 'showroom' && showroom_id) {
        queryParams.push(parseInt(showroom_id, 10));
        whereClause += ` OR (a.showroom_id = $${queryParams.length} AND a.status IN ('CLOSED', 'COMPLETED') AND a.ends_at >= NOW() - INTERVAL '7 days')`;
      } else if (view === 'buyer' && buyer_id) {
        queryParams.push(parseInt(buyer_id, 10));
        whereClause += ` OR (a.highest_bidder_id = $${queryParams.length} AND a.status IN ('CLOSED', 'COMPLETED') AND a.ends_at >= NOW() - INTERVAL '7 days') OR (a.status IN ('CLOSED', 'COMPLETED') AND a.ends_at >= NOW() - INTERVAL '48 hours')`;
      } else {
        whereClause += ` OR (a.status IN ('CLOSED', 'COMPLETED') AND a.ends_at >= NOW() - INTERVAL '48 hours')`;
      }

      const result = await query(
        `SELECT a.id, a.showroom_id, a.vehicle_model, a.manufacturing_year, a.km_driven,
                a.base_price, a.current_highest_bid, a.highest_bidder_id, a.status,
                a.starts_at, a.ends_at, a.created_at, a.pickup_otp, a.rc_number,
                a.photos, a.engine_sound_video, a.condition_report,
                a.rto_verified, a.rto_details, a.emd_amount, a.emd_status,
                CASE WHEN a.engine_sound_video IS NOT NULL AND a.engine_sound_video != '' THEN true ELSE false END as has_engine_media,
                s.name as showroom_name, s.address as showroom_address,
                b.business_name as highest_bidder_name,
                COALESCE((SELECT count(*) FROM bids WHERE auction_id = a.id), 0) as total_bids
         FROM auctions a
         JOIN showrooms s ON a.showroom_id = s.id
         LEFT JOIN buyers b ON a.highest_bidder_id = b.id
         ${whereClause}
         ORDER BY
           CASE WHEN a.status = 'LIVE' THEN 1
                WHEN a.status = 'CLOSED' THEN 2
                ELSE 3
           END,
           a.ends_at ASC,
           a.created_at DESC
         LIMIT 20`,
        queryParams
      );

      // Fetch recent bids for these auctions so live feeds show bidder names
      const auctionIds = result.rows.map((r) => r.id);
      const bidsMap = {};
      if (auctionIds.length > 0) {
        const bidsRes = await query(
          `SELECT b.id, b.auction_id, b.amount, b.placed_at, buy.business_name as bidder_name
           FROM bids b
           JOIN buyers buy ON b.buyer_id = buy.id
           WHERE b.auction_id = ANY($1::int[])
           ORDER BY b.placed_at DESC`,
          [auctionIds]
        );
        for (const bid of bidsRes.rows) {
          if (!bidsMap[bid.auction_id]) bidsMap[bid.auction_id] = [];
          if (bidsMap[bid.auction_id].length < 10) {
            bidsMap[bid.auction_id].push({
              id: bid.id,
              amount: parseFloat(bid.amount),
              bidder_name: bid.bidder_name,
              placed_at: bid.placed_at,
            });
          }
        }
      }

      // Format response according to caller perspective (Buyer vs Showroom)
      const formatted = result.rows.map((auction) => {
        const isOwnerShowroom =
          view === 'showroom' &&
          showroom_id &&
          parseInt(showroom_id, 10) === auction.showroom_id;

        const recentBids = bidsMap[auction.id] || [];

        // Parse complete photos array
        let listPhotos = [];
        try {
          listPhotos = typeof auction.photos === 'string' ? JSON.parse(auction.photos || '[]') : (auction.photos || []);
        } catch {
          listPhotos = [];
        }

        const totalPhotosCount = listPhotos.length;
        // Deliver 1 primary cover photo thumbnail in feed list for 50x faster load (150KB vs 6MB).
        // Full photos load on demand when tapping zoom via /:id/media.
        const feedPhotos = listPhotos.slice(0, 1);

        const commonAliases = {
          bike_name: auction.vehicle_model,
          model: auction.vehicle_model,
          year: auction.manufacturing_year,
          starting_price: parseFloat(auction.base_price || 0),
          current_highest_bid: parseFloat(auction.current_highest_bid || auction.base_price || 0),
          start_time: auction.starts_at,
          end_time: auction.ends_at,
          highest_bid_buyer_id: auction.highest_bidder_id,
          highest_bid_buyer_name: auction.highest_bidder_name,
          condition_report: auction.condition_report || {},
          total_photos: totalPhotosCount,
          rto_verified: auction.rto_verified || false,
          rto_details: typeof auction.rto_details === 'string' ? JSON.parse(auction.rto_details || '{}') : (auction.rto_details || {}),
          emd_amount: parseFloat(auction.emd_amount || 2000.0),
          emd_status: auction.emd_status || 'NONE',
          has_engine_media: Boolean(auction.engine_sound_video && auction.engine_sound_video.length > 0),
        };

        if (isOwnerShowroom) {
          // Showroom counter sees unmasked RC, Pickup OTP, cover photo, and video
          return {
            ...auction,
            ...commonAliases,
            photos: feedPhotos,
            engine_sound_video: auction.engine_sound_video || '',
            recent_bids: recentBids,
            rc_number_masked: maskRcNumber(auction.rc_number),
          };
        }

        // Used-bike buyers see masked RC, cover photo, and exhaust sound/video
        const sanitized = sanitizeAuctionForBuyer(auction);
        const isWinnerBuyer = (auction.status === 'CLOSED' || auction.status === 'COMPLETED') &&
          buyer_id && parseInt(buyer_id, 10) === auction.highest_bidder_id;

        return {
          ...sanitized,
          ...commonAliases,
          // Securely deliver Pickup OTP strictly to the winning buyer!
          ...(isWinnerBuyer ? { pickup_otp: auction.pickup_otp, is_winner: true } : {}),
          photos: feedPhotos,
          engine_sound_video: auction.engine_sound_video || '',
          recent_bids: recentBids,
        };
      });

      const responsePayload = {
        success: true,
        count: formatted.length,
        serverTime: Date.now(),
        auctions: formatted,
      };

      activeAuctionsCache.set(cacheKey, {
        timestamp: Date.now(),
        payload: responsePayload,
      });

      return res.json(responsePayload);
    } catch (err) {
      console.error('[API:activeAuctions] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/auctions/:id/close
   * Explicitly closes an auction when the 10-minute countdown hits 00:00,
   * finalizing winner and triggering broadcast.
   */
  router.post('/:id/close', async (req, res) => {
    try {
      const { id } = req.params;
      const auctionRes = await query(
        `SELECT a.*, b.business_name as winner_name, s.name as showroom_name
         FROM auctions a
         LEFT JOIN buyers b ON a.highest_bidder_id = b.id
         LEFT JOIN showrooms s ON a.showroom_id = s.id
         WHERE a.id = $1`,
        [id]
      );
      if (auctionRes.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });
      const auction = auctionRes.rows[0];

      // Server clock validation: prevent client clocks or skew from closing active auctions prematurely
      const serverNow = new Date();
      if (auction.status === 'LIVE' && serverNow.getTime() < new Date(auction.ends_at).getTime() - 2000) {
        return res.json({
          success: false,
          message: 'Auction countdown has not expired yet on authoritative server',
          ends_at: auction.ends_at,
        });
      }

      if (auction.status === 'LIVE') {
        await query("UPDATE auctions SET status = 'CLOSED' WHERE id = $1", [id]);

        if (auction.highest_bidder_id) {
          try {
            const emdVal = 2000.00;
            await query(
              `UPDATE buyers SET locked_emd = locked_emd + $1 WHERE id = $2`,
              [emdVal, auction.highest_bidder_id]
            );
            await query(
              `UPDATE auctions SET emd_status = 'LOCKED', emd_amount = $1 WHERE id = $2`,
              [emdVal, auction.id]
            );
            console.log(`[EMD:Locked] ₹${emdVal} EMD locked for Buyer #${auction.highest_bidder_id} on Auction #${auction.id}`);
          } catch (emdErr) {
            console.warn('[Auction Close EMD Lock Warning]:', emdErr.message);
          }
        }

        invalidateActiveCache();
        console.log(`[Auction:Close] #${id} (${auction.vehicle_model}) closed. Winner: ${auction.winner_name || 'Counter'}`);

        if (io) {
          const payload = {
            auctionId: auction.id,
            vehicleModel: auction.vehicle_model,
            finalBid: parseFloat(auction.current_highest_bid),
            highestBidderId: auction.highest_bidder_id,
            winnerName: auction.winner_name || 'Counter (No dealer bids)',
            showroomId: auction.showroom_id,
            showroomName: auction.showroom_name,
            pickupOtp: auction.pickup_otp,
            timestamp: new Date().toISOString(),
          };
          io.emit('auction_closed', payload);
          io.emit('feed_auction_closed', payload);
        }
      }
      return res.json({
        success: true,
        message: `Auction #${id} closed successfully`,
        winnerName: auction.winner_name || 'Counter',
        finalBid: parseFloat(auction.current_highest_bid),
      });
    } catch (err) {
      console.error('[API:closeAuction] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/auctions/:id/media
   * On-demand media endpoint: loads full engine sound / exhaust video only when requested
   */
  router.get('/:id/media', async (req, res) => {
    try {
      const r = await query('SELECT engine_sound_video, photos FROM auctions WHERE id = $1', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });
      let parsedPhotos = [];
      try {
        parsedPhotos = typeof r.rows[0].photos === 'string' ? JSON.parse(r.rows[0].photos || '[]') : (r.rows[0].photos || []);
      } catch {
        parsedPhotos = [];
      }
      return res.json({
        success: true,
        engine_sound_video: r.rows[0].engine_sound_video || '',
        photos: parsedPhotos,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/auctions/:id
   * Returns complete details and bid audit log for an auction
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { view = 'buyer', showroom_id, buyer_id } = req.query;

      const auctionRes = await query(
        `SELECT a.*,
                s.name as showroom_name, s.address as showroom_address, s.phone as showroom_phone,
                b.business_name as highest_bidder_name, b.phone as highest_bidder_phone
         FROM auctions a
         JOIN showrooms s ON a.showroom_id = s.id
         LEFT JOIN buyers b ON a.highest_bidder_id = b.id
         WHERE a.id = $1`,
        [id]
      );

      if (auctionRes.rows.length === 0) {
        return res.status(404).json({ error: 'Auction not found' });
      }

      const auction = auctionRes.rows[0];

      // Fetch bid history
      const bidsRes = await query(
        `SELECT b.id, b.amount, b.placed_at, u.business_name as bidder_name, b.buyer_id
         FROM bids b
         JOIN buyers u ON b.buyer_id = u.id
         WHERE b.auction_id = $1
         ORDER BY b.placed_at DESC`,
        [id]
      );

      const isOwnerShowroom =
        view === 'showroom' &&
        showroom_id &&
        parseInt(showroom_id, 10) === auction.showroom_id;

      const payload = isOwnerShowroom
        ? { ...auction, rc_number_masked: maskRcNumber(auction.rc_number) }
        : sanitizeAuctionForBuyer(auction);

      return res.json({
        success: true,
        auction: payload,
        bids: bidsRes.rows,
        serverTime: Date.now(),
      });
    } catch (err) {
      console.error('[API:getAuction] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/auctions/verify-handover
   * Anti-Bypass & Auto-Monetization Core:
   * Validates auction_id and 6-digit pickup OTP.
   * If valid:
   *   1. Atomically deducts flat ₹500 platform fee from winning buyer's wallet.
   *   2. Inserts platform_transactions audit record.
   *   3. Updates auction status to 'COMPLETED'.
   *   4. Releases vehicle to winning buyer.
   */
  router.post('/verify-handover', async (req, res) => {
    const { auction_id, otp, showroom_id } = req.body;

    if (!auction_id || !otp) {
      return res.status(400).json({ error: 'Missing auction_id or pickup OTP' });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Lock auction record
      const auctionRes = await client.query(
        `SELECT a.*, s.name as showroom_name
         FROM auctions a
         JOIN showrooms s ON a.showroom_id = s.id
         WHERE a.id = $1
         FOR UPDATE`,
        [auction_id]
      );

      if (auctionRes.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const auction = auctionRes.rows[0];

      // Verify showroom permission if specified
      if (showroom_id && parseInt(showroom_id, 10) !== auction.showroom_id) {
        throw new Error('Unauthorized: You can only verify handover for your own showroom');
      }

      // Check current status
      if (auction.status === 'COMPLETED') {
        throw new Error('Vehicle handover has already been completed and verified for this auction');
      }

      if (auction.status === 'CANCELLED') {
        throw new Error('Cannot verify handover for a cancelled auction');
      }

      // Must have a winning bidder
      if (!auction.highest_bidder_id) {
        throw new Error('No winning bidder recorded for this auction');
      }

      // 2. Validate 6-digit Pickup OTP
      const cleanInputOtp = otp.toString().trim();
      if (cleanInputOtp !== auction.pickup_otp.trim()) {
        throw new Error('Invalid 6-digit Pickup OTP. Handover cannot be authenticated.');
      }

      // 3. Lock winning buyer wallet
      const buyerRes = await client.query(
        `SELECT id, business_name, wallet_balance, phone
         FROM buyers
         WHERE id = $1
         FOR UPDATE`,
        [auction.highest_bidder_id]
      );

      if (buyerRes.rows.length === 0) {
        throw new Error('Winning buyer record not found');
      }

      const buyer = buyerRes.rows[0];
      const currentWallet = parseFloat(buyer.wallet_balance);
      const fee = config.handoverPlatformFee; // Flat ₹500

      if (currentWallet < fee) {
        throw new Error(
          `Insufficient winning buyer wallet balance (₹${currentWallet.toFixed(2)}) for platform fee deduction of ₹${fee.toFixed(2)}.`
        );
      }

      const newWalletBalance = currentWallet - fee;

      // 4. Deduct platform fee from winning buyer wallet
      await client.query(
        'UPDATE buyers SET wallet_balance = $1 WHERE id = $2',
        [newWalletBalance, buyer.id]
      );

      // 5. Insert transaction ledger entry
      const txRes = await client.query(
        `INSERT INTO platform_transactions (auction_id, buyer_id, amount, fee_type, created_at)
         VALUES ($1, $2, $3, 'HANDOVER_PLATFORM_FEE', NOW())
         RETURNING id, created_at`,
        [auction.id, buyer.id, fee]
      );

      // 6. Update auction status to 'COMPLETED' and settle locked EMD
      await client.query(
        "UPDATE auctions SET status = 'COMPLETED', emd_status = 'SETTLED' WHERE id = $1",
        [auction.id]
      );

      // Unlock EMD from buyer wallet
      if (auction.emd_status === 'LOCKED') {
        const emdVal = parseFloat(auction.emd_amount || 2000.0);
        await client.query(
          'UPDATE buyers SET locked_emd = GREATEST(0, locked_emd - $1) WHERE id = $2',
          [emdVal, buyer.id]
        );
      }

      // Commit transaction
      await client.query('COMMIT');
      invalidateActiveCache();

      const txRecord = txRes.rows[0];

      // Broadcast completion event to room and feed
      const completionPayload = {
        auctionId: auction.id,
        vehicleModel: auction.vehicle_model,
        winnerId: buyer.id,
        winnerName: buyer.business_name,
        finalAmount: parseFloat(auction.current_highest_bid),
        feeDeducted: fee,
        status: 'COMPLETED',
        completedAt: txRecord.created_at,
      };

      io.to(`auction:${auction.id}`).emit('auction_completed', completionPayload);
      io.to('auctions_feed').emit('feed_auction_completed', completionPayload);

      console.log(`[Handover:Verified] Auction #${auction.id} completed. ₹${fee} fee deducted from buyer #${buyer.id} (${buyer.business_name}).`);

      return res.json({
        success: true,
        message: 'Handover verified successfully. Physical vehicle released.',
        receipt: {
          transactionId: txRecord.id,
          auctionId: auction.id,
          vehicleModel: auction.vehicle_model,
          rcNumber: auction.rc_number,
          winningBid: parseFloat(auction.current_highest_bid),
          winnerName: buyer.business_name,
          platformFeeDeducted: fee,
          buyerRemainingWallet: newWalletBalance,
          verifiedAt: txRecord.created_at,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn(`[Handover:Failed] Error: ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/auctions/bid
   * HTTP REST fallback for placing bids (useful on serverless environments like Vercel)
   */
  router.post('/bid', optionalAuthenticateToken, async (req, res) => {
    const { auctionId, buyerId, incrementAmount } = req.body;

    if (!auctionId || !buyerId || !incrementAmount) {
      return res.status(400).json({ error: 'Missing auctionId, buyerId, or incrementAmount' });
    }

    // Security check: If authenticated as buyer, ensure user is not spoofing another buyer ID
    if (req.user && req.user.role === 'buyer' && parseInt(req.user.id, 10) !== parseInt(buyerId, 10)) {
      return res.status(403).json({ success: false, error: 'Security violation: Cannot place bid for another buyer account' });
    }

    const increment = parseFloat(incrementAmount);
    if (isNaN(increment) || increment < config.minBidIncrement) {
      return res.status(400).json({
        error: `Minimum bid increment is ₹${config.minBidIncrement.toLocaleString('en-IN')}`,
      });
    }

    if (increment % 500 !== 0) {
      return res.status(400).json({
        error: 'Bid amount must be in multiples of ₹500 (e.g. +₹500, +₹1,000, +₹1,500...)',
      });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const auctionRes = await client.query(
        'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
        [auctionId]
      );
      if (auctionRes.rows.length === 0) throw new Error('Auction not found');

      const auction = auctionRes.rows[0];
      if (auction.status !== 'LIVE') throw new Error(`Auction status is '${auction.status}'`);

      const serverNow = new Date();
      if (serverNow.getTime() >= new Date(auction.ends_at).getTime()) {
        await client.query("UPDATE auctions SET status = 'CLOSED' WHERE id = $1", [auctionId]);
        await client.query('COMMIT');
      invalidateActiveCache();
        throw new Error('Auction time has expired');
      }

      const buyerRes = await client.query(
        'SELECT id, business_name, wallet_balance, locked_emd, is_verified, is_active FROM buyers WHERE id = $1 FOR UPDATE',
        [buyerId]
      );
      if (buyerRes.rows.length === 0) throw new Error('Buyer account not found. Please register to bid.');

      const buyer = buyerRes.rows[0];
      if (buyer.is_active === false) throw new Error('Your trading account is blocked/suspended by Exchange Desk');
      if (!buyer.is_verified) throw new Error('Buyer account is pending Exchange Desk verification');

      const wallet = parseFloat(buyer.wallet_balance);
      const lockedEmd = parseFloat(buyer.locked_emd || 0);
      const available = wallet - lockedEmd;
      if (available < config.minWalletBalanceToBid) {
        throw new Error(
          `Insufficient available balance (₹${available.toLocaleString('en-IN')}). Minimum ₹${config.minWalletBalanceToBid.toLocaleString('en-IN')} available balance required (Locked EMD: ₹${lockedEmd.toLocaleString('en-IN')}).`
        );
      }

      const newBid = parseFloat(auction.current_highest_bid) + increment;

      // Anti-Sniping Protection: if bid placed in last 3 minutes, extend by 3 minutes
      const remainingMs = new Date(auction.ends_at).getTime() - serverNow.getTime();
      if (remainingMs < 180000) {
        await client.query(
          "UPDATE auctions SET current_highest_bid = $1, highest_bidder_id = $2, ends_at = NOW() + INTERVAL '3 minutes' WHERE id = $3",
          [newBid, buyerId, auctionId]
        );
      } else {
        await client.query(
          'UPDATE auctions SET current_highest_bid = $1, highest_bidder_id = $2 WHERE id = $3',
          [newBid, buyerId, auctionId]
        );
      }

      const bidLog = await client.query(
        'INSERT INTO bids (auction_id, buyer_id, amount, placed_at) VALUES ($1, $2, $3, NOW()) RETURNING id, placed_at',
        [auctionId, buyerId, newBid]
      );

      await client.query('COMMIT');
      invalidateActiveCache();

      if (io) {
        const bidPayload = {
          auctionId: parseInt(auctionId, 10),
          bidId: bidLog.rows[0].id,
          newHighestBid: newBid,
          incrementAmount: increment,
          highestBidderId: buyer.id,
          highestBidderName: buyer.business_name,
          timestamp: bidLog.rows[0].placed_at,
          vehicleModel: auction.vehicle_model,
        };
        io.to(`auction:${auctionId}`).emit('bid_updated', bidPayload);
        io.to('auctions_feed').emit('feed_bid_tick', bidPayload);
      }

      return res.json({
        success: true,
        bidAmount: newBid,
        highestBidderName: buyer.business_name,
        message: `Bid placed successfully: ₹${newBid.toLocaleString('en-IN')}`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/auctions/verify-rc
   * Instant Vahan & RTO Verification for Indian 2-wheelers
   */
  router.post('/verify-rc', (req, res) => {
    try {
      const { rc_number, manufacturing_year } = req.body;
      if (!rc_number) {
        return res.status(400).json({ success: false, error: 'Vehicle RC number is required' });
      }
      const result = parseAndVerifyRc(rc_number, manufacturing_year);
      return res.json({
        success: true,
        verified: result.valid,
        rtoData: result,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/auctions/:id/rto-agreement
   * Generates statutory RTO Form 29 & 30 sale agreement with pre-filled parties & vehicle data.
   */
  router.get('/:id/rto-agreement', async (req, res) => {
    try {
      const { id } = req.params;
      const { format } = req.query;

      const aRes = await query('SELECT * FROM auctions WHERE id = $1', [id]);
      if (aRes.rows.length === 0) return res.status(404).send('Auction not found');
      const auction = aRes.rows[0];

      const sRes = await query('SELECT * FROM showrooms WHERE id = $1', [auction.showroom_id]);
      const showroom = sRes.rows[0] || {};

      let buyer = {};
      if (auction.highest_bidder_id) {
        const bRes = await query('SELECT * FROM buyers WHERE id = $1', [auction.highest_bidder_id]);
        buyer = bRes.rows[0] || {};
      }

      if (format === 'json') {
        return res.json({
          success: true,
          agreementRef: `ED-RTO-${auction.id}`,
          auction,
          showroom,
          buyer,
        });
      }

      const html = generateRtoAgreementHtml({ auction, showroom, buyer });
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err) {
      return res.status(500).send(`Failed to generate RTO Agreement: ${err.message}`);
    }
  });

  /**
   * POST /api/auctions/rate
   * Deal Completion Rating (Showroom & Buyer mutual reviews)
   */
  router.post('/rate', async (req, res) => {
    try {
      const { auction_id, rater_role, rater_id, target_id, rating, feedback = '' } = req.body;

      if (!auction_id || !rater_role || !rater_id || !target_id || !rating) {
        return res.status(400).json({ error: 'Missing rating required fields' });
      }

      const numRating = parseInt(rating, 10);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5 stars' });
      }

      await query(
        `INSERT INTO ratings (auction_id, rater_role, rater_id, target_id, rating, feedback)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (auction_id, rater_role)
         DO UPDATE SET rating = $5, feedback = $6, created_at = NOW()`,
        [auction_id, rater_role, rater_id, target_id, numRating, feedback.trim()]
      );

      return res.json({
        success: true,
        message: 'Review and rating submitted successfully! Thank you for building platform trust.',
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
