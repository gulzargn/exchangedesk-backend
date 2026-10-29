import { getClient, query } from '../db/index.js';
import { config } from '../config.js';
import { maskRcNumber } from '../utils/masking.js';
import { auctionMutex } from '../utils/lock.js';

/**
 * Real-Time Bidding & Concurrency Engine
 * Handles WebSocket subscriptions, atomic ACID transactions with row-level locking,
 * authoritative countdown timer synchronization, and periodic auto-closure heartbeat.
 */
export function setupAuctionSocket(io) {
  // 1. WebSocket Connection Handler
  io.on('connection', (socket) => {
    // console.log(`[Socket] Client connected: ${socket.id}`);

    // Join general feed room to receive new auction alerts and global bid updates
    socket.join('auctions_feed');

    // Authoritative Server Time Sync (compensates for client clock skew)
    socket.on('sync_server_time', (clientTimestamp, callback) => {
      const serverNow = Date.now();
      if (typeof callback === 'function') {
        callback({
          serverTime: serverNow,
          clientTimestamp,
        });
      } else {
        socket.emit('server_time_synced', {
          serverTime: serverNow,
          clientTimestamp,
        });
      }
    });

    // Subscribe to a specific auction room
    socket.on('join_auction', async (auctionId, callback) => {
      const room = `auction:${auctionId}`;
      socket.join(room);
      // console.log(`[Socket] ${socket.id} joined ${room}`);

      try {
        const result = await query(
          `SELECT a.*, s.name as showroom_name, s.address as showroom_address,
                  b.business_name as highest_bidder_name
           FROM auctions a
           LEFT JOIN showrooms s ON a.showroom_id = s.id
           LEFT JOIN buyers b ON a.highest_bidder_id = b.id
           WHERE a.id = $1`,
          [auctionId]
        );

        if (result.rows.length === 0) {
          if (callback) callback({ error: 'Auction not found' });
          return;
        }

        const auction = result.rows[0];
        const bidsRes = await query(
          `SELECT b.id, b.amount, b.placed_at, u.business_name as bidder_name
           FROM bids b
           JOIN buyers u ON b.buyer_id = u.id
           WHERE b.auction_id = $1
           ORDER BY b.placed_at DESC
           LIMIT 20`,
          [auctionId]
        );

        if (callback) {
          callback({
            success: true,
            auction: {
              ...auction,
              rc_number_masked: maskRcNumber(auction.rc_number),
            },
            recentBids: bidsRes.rows,
            serverTime: Date.now(),
          });
        }
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Unsubscribe from a specific auction room
    socket.on('leave_auction', (auctionId) => {
      const room = `auction:${auctionId}`;
      socket.leave(room);
    });

    // Core Bidding Event with PostgreSQL Row-Level Locking (SELECT ... FOR UPDATE)
    socket.on('place_bid', async (payload, callback) => {
      const { auctionId, buyerId, incrementAmount } = payload || {};

      // Basic parameter validations
      if (!auctionId || !buyerId || !incrementAmount) {
        const errMsg = 'Missing auctionId, buyerId, or incrementAmount';
        if (callback) callback({ success: false, error: errMsg });
        return;
      }

      const increment = parseFloat(incrementAmount);
      if (isNaN(increment) || increment < config.minBidIncrement) {
        const errMsg = `Minimum bid increment is ₹${config.minBidIncrement.toLocaleString('en-IN')}`;
        if (callback) callback({ success: false, error: errMsg });
        return;
      }

      await auctionMutex.runExclusive(auctionId, async () => {
        const client = await getClient();

        try {
          // ====================================================================
          // STRICT ACID TRANSACTION WITH ROW-LEVEL LOCKING
          // ====================================================================
          await client.query('BEGIN');

          // 1. Lock the auction row exclusively to eliminate race conditions
          const auctionRes = await client.query(
            `SELECT a.*, s.name as showroom_name
             FROM auctions a
             JOIN showrooms s ON a.showroom_id = s.id
             WHERE a.id = $1
             FOR UPDATE`,
            [auctionId]
          );

          if (auctionRes.rows.length === 0) {
            throw new Error('Auction not found');
          }

          const auction = auctionRes.rows[0];

          // 2. Validate auction status
          if (auction.status !== 'LIVE') {
            throw new Error(`Bidding closed: Auction status is '${auction.status}'`);
          }

          // 3. Validate authoritative server countdown expiration
          const serverNow = new Date();
          const endsAt = new Date(auction.ends_at);
          if (serverNow.getTime() >= endsAt.getTime()) {
            // Auto-mark as CLOSED
            await client.query(
              "UPDATE auctions SET status = 'CLOSED' WHERE id = $1",
              [auctionId]
            );
            await client.query('COMMIT');

            // Notify room of closure
            io.to(`auction:${auctionId}`).emit('auction_closed', {
              auctionId,
              reason: 'TIME_EXPIRED',
              finalBid: auction.current_highest_bid,
              highestBidderId: auction.highest_bidder_id,
            });

            throw new Error('Auction time has expired. Bidding is now closed.');
          }

          // 4. Lock and validate buyer wallet balance & admin status
          // Critical Rule 3: Buyer must have at least ₹3,000 in platform wallet
          const buyerRes = await client.query(
            `SELECT id, business_name, wallet_balance, is_verified, is_active
             FROM buyers
             WHERE id = $1
             FOR UPDATE`,
            [buyerId]
          );

          if (buyerRes.rows.length === 0) {
            throw new Error('Buyer account not found. Please register to bid.');
          }

          const buyer = buyerRes.rows[0];
          if (buyer.is_active === false) {
            throw new Error('Your trading account is blocked/suspended by the Administrator');
          }

          if (!buyer.is_verified) {
            throw new Error('Buyer account is pending Administrator verification');
          }

          const walletBalance = parseFloat(buyer.wallet_balance);
          if (walletBalance < config.minWalletBalanceToBid) {
            throw new Error(
              `Insufficient wallet balance (₹${walletBalance.toLocaleString('en-IN')}). Minimum ₹${config.minWalletBalanceToBid.toLocaleString('en-IN')} required in your pre-funded wallet to place bids.`
            );
          }

          // 5. Calculate new highest bid
          const currentBid = parseFloat(auction.current_highest_bid);
          const newBidAmount = currentBid + increment;

          // 6. Update the auction record
          const updatedAuctionRes = await client.query(
            `UPDATE auctions
             SET current_highest_bid = $1,
                 highest_bidder_id = $2
             WHERE id = $3
             RETURNING *`,
            [newBidAmount, buyerId, auctionId]
          );

          // 7. Insert audit bid log
          const bidInsertRes = await client.query(
            `INSERT INTO bids (auction_id, buyer_id, amount, placed_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, placed_at`,
            [auctionId, buyerId, newBidAmount]
          );

          // Commit transaction
          await client.query('COMMIT');

          const placedBid = bidInsertRes.rows[0];

          // 8. Prepare Real-Time Broadcast Payload
          const broadcastPayload = {
            auctionId: parseInt(auctionId, 10),
            bidId: placedBid.id,
            newHighestBid: newBidAmount,
            incrementAmount: increment,
            highestBidderId: buyer.id,
            highestBidderName: buyer.business_name,
            timestamp: placedBid.placed_at,
            vehicleModel: auction.vehicle_model,
          };

          // Broadcast to specific auction room
          io.to(`auction:${auctionId}`).emit('bid_updated', broadcastPayload);

          // Broadcast to global feed
          io.to('auctions_feed').emit('feed_bid_tick', broadcastPayload);

          if (callback) {
            callback({
              success: true,
              bidAmount: newBidAmount,
              message: `Bid placed successfully: ₹${newBidAmount.toLocaleString('en-IN')}`,
            });
          }
        } catch (err) {
          await client.query('ROLLBACK');
          console.warn(`[Socket:place_bid] Bid rejected: ${err.message}`);
          if (callback) {
            callback({
              success: false,
              error: err.message,
            });
          }
        } finally {
          client.release();
        }
      });
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  // ==========================================================================
  // BACKGROUND HEARTBEAT TIMER (Every 2 seconds)
  // Automatically detects and closes expired 10-minute flash auctions
  // ==========================================================================
  const heartbeatInterval = setInterval(async () => {
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
          // Close the auction atomically
          await query(
            "UPDATE auctions SET status = 'CLOSED' WHERE id = $1 AND status = 'LIVE'",
            [auction.id]
          );

          console.log(`[Heartbeat] Auction #${auction.id} (${auction.vehicle_model}) expired and set to CLOSED.`);

          const closePayload = {
            auctionId: auction.id,
            vehicleModel: auction.vehicle_model,
            finalBid: parseFloat(auction.current_highest_bid),
            highestBidderId: auction.highest_bidder_id,
            winnerName: auction.winner_name || 'No bids placed',
            showroomId: auction.showroom_id,
            showroomName: auction.showroom_name,
            timestamp: new Date(),
          };

          // Notify room and feed
          io.to(`auction:${auction.id}`).emit('auction_closed', closePayload);
          io.to('auctions_feed').emit('feed_auction_closed', closePayload);
        }
      }
    } catch (err) {
      console.error('[Heartbeat] Error checking expired auctions:', err.message);
    }
  }, 2000);

  return { heartbeatInterval };
}
