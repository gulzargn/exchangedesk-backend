import express from 'express';
import { query, getClient } from '../db/index.js';
import { config } from '../config.js';

export function createAdminRouter(io) {
  const router = express.Router();

  /**
   * GET /api/admin/stats
   * Aggregates platform-wide KPIs: Revenue, GMV, Liquidity, Auctions, Bids
   */
  router.get('/stats', async (req, res) => {
    try {
      // 1. Auction counts by status
      const auctionStatsRes = await query(
        `SELECT
           COUNT(*) as total_auctions,
           COUNT(CASE WHEN status = 'LIVE' THEN 1 END) as live_auctions,
           COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_auctions,
           COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_auctions,
           COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_auctions,
           COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN current_highest_bid ELSE 0 END), 0) as total_gmv
         FROM auctions`
      );

      // 2. Revenue collected from flat ₹500 handover fees
      const revenueRes = await query(
        `SELECT
           COUNT(*) as total_transactions,
           COALESCE(SUM(amount), 0) as total_revenue
         FROM platform_transactions`
      );

      // 3. Buyer liquidity and counts
      const buyerStatsRes = await query(
        `SELECT
           COUNT(*) as total_buyers,
           COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_buyers,
           COALESCE(SUM(wallet_balance), 0) as total_wallet_liquidity
         FROM buyers`
      );

      // 4. Showroom counts
      const showroomStatsRes = await query(
        `SELECT COUNT(*) as total_showrooms FROM showrooms`
      );

      // 5. Total bids placed
      const bidStatsRes = await query(
        `SELECT COUNT(*) as total_bids FROM bids`
      );

      // 6. Pending approvals count (including pending wallet deposit requests)
      const pendingRes = await query(
        `SELECT
           (SELECT COUNT(*) FROM buyers WHERE is_approved = false) as pending_buyers,
           (SELECT COUNT(*) FROM showrooms WHERE is_approved = false) as pending_showrooms,
           (SELECT COUNT(*) FROM deposit_requests WHERE status = 'PENDING') as pending_deposits`
      );

      const aStats = auctionStatsRes.rows[0];
      const rStats = revenueRes.rows[0];
      const bStats = buyerStatsRes.rows[0];
      const sStats = showroomStatsRes.rows[0];
      const bidStats = bidStatsRes.rows[0];
      const pStats = pendingRes.rows[0];
      const pendingTotal =
        parseInt(pStats.pending_buyers, 10) +
        parseInt(pStats.pending_showrooms, 10) +
        parseInt(pStats.pending_deposits || 0, 10);

      return res.json({
        success: true,
        stats: {
          totalAuctions: parseInt(aStats.total_auctions, 10),
          liveAuctions: parseInt(aStats.live_auctions, 10),
          closedAuctions: parseInt(aStats.closed_auctions, 10),
          completedAuctions: parseInt(aStats.completed_auctions, 10),
          cancelledAuctions: parseInt(aStats.cancelled_auctions, 10),
          totalGmv: parseFloat(aStats.total_gmv),
          totalRevenue: parseFloat(rStats.total_revenue),
          totalTransactions: parseInt(rStats.total_transactions, 10),
          totalBuyers: parseInt(bStats.total_buyers, 10),
          verifiedBuyers: parseInt(bStats.verified_buyers, 10),
          totalLiquidity: parseFloat(bStats.total_wallet_liquidity),
          totalShowrooms: parseInt(sStats.total_showrooms, 10),
          totalBids: parseInt(bidStats.total_bids, 10),
          pendingApprovals: pendingTotal,
          pendingBuyers: parseInt(pStats.pending_buyers, 10),
          pendingShowrooms: parseInt(pStats.pending_showrooms, 10),
          pendingDeposits: parseInt(pStats.pending_deposits || 0, 10),
          activeConfig: {
            minWalletBalanceToBid: config.minWalletBalanceToBid,
            handoverPlatformFee: config.handoverPlatformFee,
            minBidIncrement: config.minBidIncrement,
            defaultAuctionDurationMinutes: config.defaultAuctionDurationMinutes,
          },
        },
      });
    } catch (err) {
      console.error('[API:adminStats] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/admin/pending
   * Returns all showrooms and buyers pending administrator approval
   */
  router.get('/pending', async (req, res) => {
    try {
      const pendingBuyers = await query(
        `SELECT id, business_name, phone, wallet_balance, is_verified, created_at
         FROM buyers
         WHERE is_approved = false
         ORDER BY created_at DESC`
      );
      const pendingShowrooms = await query(
        `SELECT id, name, phone, address, created_at
         FROM showrooms
         WHERE is_approved = false
         ORDER BY created_at DESC`
      );
      const pendingDeposits = await query(
        `SELECT d.id, d.buyer_id, d.amount, d.payment_method, d.reference_id, d.created_at,
                b.business_name, b.phone, b.wallet_balance as current_wallet
         FROM deposit_requests d
         JOIN buyers b ON d.buyer_id = b.id
         WHERE d.status = 'PENDING'
         ORDER BY d.created_at DESC`
      );

      return res.json({
        success: true,
        pendingBuyers: pendingBuyers.rows.map((b) => ({
          ...b,
          wallet_balance: parseFloat(b.wallet_balance),
        })),
        pendingShowrooms: pendingShowrooms.rows,
        pendingDeposits: pendingDeposits.rows.map((d) => ({
          ...d,
          amount: parseFloat(d.amount),
          current_wallet: parseFloat(d.current_wallet),
        })),
        totalPending:
          pendingBuyers.rows.length +
          pendingShowrooms.rows.length +
          pendingDeposits.rows.length,
      });
    } catch (err) {
      console.error('[API:adminPending] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/deposits/:id/approve
   * Admin verifies & approves buyer deposit request, atomicity crediting their wallet
   */
  router.post('/deposits/:id/approve', async (req, res) => {
    const { id } = req.params;
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const reqRes = await client.query(
        'SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (reqRes.rows.length === 0) throw new Error('Deposit request not found');

      const dReq = reqRes.rows[0];
      if (dReq.status !== 'PENDING') {
        throw new Error(`Deposit request is already ${dReq.status}`);
      }

      const buyerRes = await client.query(
        'SELECT id, business_name, wallet_balance, phone FROM buyers WHERE id = $1 FOR UPDATE',
        [dReq.buyer_id]
      );
      if (buyerRes.rows.length === 0) throw new Error('Buyer account not found');

      const currentBalance = parseFloat(buyerRes.rows[0].wallet_balance);
      const depositAmount = parseFloat(dReq.amount);
      const newBalance = currentBalance + depositAmount;

      await client.query(
        'UPDATE buyers SET wallet_balance = $1 WHERE id = $2',
        [newBalance, dReq.buyer_id]
      );

      await client.query(
        "UPDATE deposit_requests SET status = 'APPROVED', reviewed_at = NOW() WHERE id = $1",
        [id]
      );

      await client.query(
        `INSERT INTO platform_transactions (buyer_id, amount, fee_type, created_at)
         VALUES ($1, $2, 'WALLET_DEPOSIT_APPROVED', NOW())`,
        [dReq.buyer_id, depositAmount]
      );

      await client.query('COMMIT');

      if (io) {
        io.emit('buyer_wallet_updated', {
          buyerId: dReq.buyer_id,
          newBalance,
        });
        io.emit('deposit_request_approved', {
          requestId: parseInt(id, 10),
          buyerId: dReq.buyer_id,
          amount: depositAmount,
          newBalance,
        });
      }

      console.log(`[Admin:DepositApproved] Credited ₹${depositAmount} to buyer #${dReq.buyer_id} (${buyerRes.rows[0].business_name})`);

      return res.json({
        success: true,
        message: `Approved deposit of ₹${depositAmount.toLocaleString('en-IN')} for ${buyerRes.rows[0].business_name}. Wallet credited!`,
        newBalance,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[API:adminApproveDeposit] Error:', err);
      return res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/admin/deposits/:id/reject
   * Admin rejects buyer deposit request
   */
  router.post('/deposits/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { notes = 'Payment verification failed' } = req.body;
      const reqRes = await query('SELECT * FROM deposit_requests WHERE id = $1', [id]);
      if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Deposit request not found' });

      await query(
        "UPDATE deposit_requests SET status = 'REJECTED', admin_notes = $1, reviewed_at = NOW() WHERE id = $2",
        [notes, id]
      );

      if (io) {
        io.emit('deposit_request_rejected', {
          requestId: parseInt(id, 10),
          buyerId: reqRes.rows[0].buyer_id,
          notes,
        });
      }

      return res.json({
        success: true,
        message: `Deposit request #${id} marked REJECTED.`,
      });
    } catch (err) {
      console.error('[API:adminRejectDeposit] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/auctions/:id/extend
   * Extends active 10-minute auction by +5 or +10 minutes
   */
  router.post('/auctions/:id/extend', async (req, res) => {
    try {
      const { id } = req.params;
      const { minutes = 5 } = req.body;
      const check = await query('SELECT * FROM auctions WHERE id = $1', [id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });
      if (check.rows[0].status !== 'LIVE') return res.status(400).json({ error: 'Can only extend LIVE auctions' });

      const currentEndsAt = new Date(check.rows[0].ends_at);
      const newEndsAt = new Date(Math.max(Date.now(), currentEndsAt.getTime()) + minutes * 60 * 1000);

      await query('UPDATE auctions SET ends_at = $1 WHERE id = $2', [newEndsAt, id]);

      if (io) {
        io.emit('auction_extended', {
          auctionId: parseInt(id, 10),
          newEndsAt,
          minutesAdded: minutes,
        });
      }

      return res.json({
        success: true,
        message: `Auction #${id} extended by +${minutes} minutes! New countdown end: ${newEndsAt.toLocaleTimeString()}`,
        newEndsAt,
      });
    } catch (err) {
      console.error('[API:adminExtendAuction] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/admin/live-bids-feed
   * Returns recent real-time bids stream across the entire platform
   */
  router.get('/live-bids-feed', async (req, res) => {
    try {
      const result = await query(
        `SELECT b.id, b.auction_id, b.amount, b.placed_at,
                buy.business_name as bidder_name, buy.phone as bidder_phone,
                a.vehicle_model, a.rc_number, s.name as showroom_name
         FROM bids b
         JOIN buyers buy ON b.buyer_id = buy.id
         JOIN auctions a ON b.auction_id = a.id
         JOIN showrooms s ON a.showroom_id = s.id
         ORDER BY b.placed_at DESC
         LIMIT 30`
      );
      return res.json({
        success: true,
        bids: result.rows.map((b) => ({
          ...b,
          amount: parseFloat(b.amount),
        })),
      });
    } catch (err) {
      console.error('[API:adminLiveBidsFeed] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/approve/:type/:id
   * Admin approves and activates a pending buyer or showroom
   */
  router.post('/approve/:type/:id', async (req, res) => {
    try {
      const { type, id } = req.params;
      if (type === 'buyer') {
        const updateRes = await query(
          'UPDATE buyers SET is_approved = true, is_active = true, is_verified = true WHERE id = $1 RETURNING *',
          [id]
        );
        if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Buyer not found' });

        if (io) {
          io.emit('buyer_status_changed', { buyerId: parseInt(id, 10), isActive: true, isApproved: true });
        }

        return res.json({
          success: true,
          message: `Buyer "${updateRes.rows[0].business_name}" APPROVED & ACTIVATED! ID is now live.`,
          buyer: updateRes.rows[0],
        });
      } else if (type === 'showroom') {
        const updateRes = await query(
          'UPDATE showrooms SET is_approved = true, is_active = true WHERE id = $1 RETURNING *',
          [id]
        );
        if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Showroom not found' });

        if (io) {
          io.emit('showroom_status_changed', { showroomId: parseInt(id, 10), isActive: true, isApproved: true });
        }

        return res.json({
          success: true,
          message: `Showroom "${updateRes.rows[0].name}" APPROVED & ACTIVATED! Branch is now live.`,
          showroom: updateRes.rows[0],
        });
      }
      return res.status(400).json({ error: 'Invalid type (buyer or showroom)' });
    } catch (err) {
      console.error('[API:adminApprove] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/reject/:type/:id
   * Admin rejects and deletes pending registration
   */
  router.post('/reject/:type/:id', async (req, res) => {
    try {
      const { type, id } = req.params;
      if (type === 'buyer') {
        await query('DELETE FROM buyers WHERE id = $1', [id]);
        return res.json({ success: true, message: `Buyer registration #${id} rejected and deleted.` });
      } else if (type === 'showroom') {
        await query('DELETE FROM showrooms WHERE id = $1', [id]);
        return res.json({ success: true, message: `Showroom registration #${id} rejected and deleted.` });
      }
      return res.status(400).json({ error: 'Invalid type (buyer or showroom)' });
    } catch (err) {
      console.error('[API:adminReject] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/admin/transactions
   * Complete immutable fee deduction ledger
   */
  router.get('/transactions', async (req, res) => {
    try {
      const result = await query(
        `SELECT t.id, t.amount, t.fee_type, t.created_at,
                a.id as auction_id, a.vehicle_model, a.rc_number, a.current_highest_bid as final_bid,
                b.id as buyer_id, b.business_name as buyer_name, b.phone as buyer_phone,
                s.name as showroom_name
         FROM platform_transactions t
         JOIN auctions a ON t.auction_id = a.id
         JOIN buyers b ON t.buyer_id = b.id
         JOIN showrooms s ON a.showroom_id = s.id
         ORDER BY t.created_at DESC`
      );

      return res.json({
        success: true,
        transactions: result.rows.map((tx) => ({
          ...tx,
          amount: parseFloat(tx.amount),
          final_bid: parseFloat(tx.final_bid),
        })),
      });
    } catch (err) {
      console.error('[API:adminTransactions] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/admin/buyers
   * Detailed buyers list with bid and win metrics
   */
  router.get('/buyers', async (req, res) => {
    try {
      const result = await query(
        `SELECT b.id, b.business_name, b.phone, b.wallet_balance, b.is_verified, b.is_active, b.is_approved, b.created_at,
                COALESCE(bc.bid_count, 0) as total_bids_placed,
                COALESCE(wc.win_count, 0) as total_auctions_won
         FROM buyers b
         LEFT JOIN (
           SELECT buyer_id, COUNT(*) as bid_count FROM bids GROUP BY buyer_id
         ) bc ON bc.buyer_id = b.id
         LEFT JOIN (
           SELECT highest_bidder_id, COUNT(*) as win_count FROM auctions
           WHERE status IN ('CLOSED', 'COMPLETED')
           GROUP BY highest_bidder_id
         ) wc ON wc.highest_bidder_id = b.id
         ORDER BY b.id ASC`
      );

      return res.json({
        success: true,
        buyers: result.rows.map((b) => ({
          ...b,
          wallet_balance: parseFloat(b.wallet_balance),
          total_bids_placed: parseInt(b.total_bids_placed, 10),
          total_auctions_won: parseInt(b.total_auctions_won, 10),
        })),
      });
    } catch (err) {
      console.error('[API:adminBuyers] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/buyers/:id/toggle-verify
   * Toggles buyer verification status
   */
  router.post('/buyers/:id/toggle-verify', async (req, res) => {
    try {
      const { id } = req.params;
      const checkRes = await query('SELECT id, is_verified FROM buyers WHERE id = $1', [id]);

      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: 'Buyer not found' });
      }

      const currentStatus = checkRes.rows[0].is_verified;
      const newStatus = !currentStatus;

      await query('UPDATE buyers SET is_verified = $1 WHERE id = $2', [newStatus, id]);

      return res.json({
        success: true,
        message: `Buyer #${id} verification set to ${newStatus ? 'VERIFIED' : 'UNVERIFIED'}`,
        is_verified: newStatus,
      });
    } catch (err) {
      console.error('[API:adminToggleVerify] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/buyers/:id/adjust-wallet
   * Admin manual wallet credit/debit
   */
  router.post('/buyers/:id/adjust-wallet', async (req, res) => {
    const { id } = req.params;
    const { amount, action = 'credit' } = req.body;
    const delta = parseFloat(amount);

    if (isNaN(delta) || delta <= 0) {
      return res.status(400).json({ error: 'Adjustment amount must be a positive number' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const buyerRes = await client.query(
        'SELECT id, business_name, wallet_balance FROM buyers WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (buyerRes.rows.length === 0) {
        throw new Error('Buyer not found');
      }

      const current = parseFloat(buyerRes.rows[0].wallet_balance);
      let newBalance = action === 'credit' ? current + delta : current - delta;

      if (newBalance < 0) {
        throw new Error(`Cannot debit ₹${delta.toLocaleString('en-IN')}: Current balance is ₹${current.toLocaleString('en-IN')}`);
      }

      await client.query('UPDATE buyers SET wallet_balance = $1 WHERE id = $2', [newBalance, id]);
      await client.query('COMMIT');

      if (io) {
        io.emit('buyer_wallet_updated', {
          buyerId: parseInt(id, 10),
          newBalance,
        });
      }

      return res.json({
        success: true,
        message: `Wallet ${action}ed by ₹${delta.toLocaleString('en-IN')}. New balance: ₹${newBalance.toLocaleString('en-IN')}`,
        newBalance,
        buyerId: parseInt(id, 10),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[API:adminAdjustWallet] Error:', err);
      return res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/admin/showrooms/create
   * Registers a new showroom branch desk
   */
  router.post('/showrooms/create', async (req, res) => {
    try {
      const { name, phone, address } = req.body;

      if (!name || !phone || !address) {
        return res.status(400).json({ error: 'Missing name, phone, or address' });
      }

      const check = await query('SELECT id FROM showrooms WHERE phone = $1', [phone.trim()]);
      if (check.rows.length > 0) {
        return res.status(400).json({ error: 'A showroom with this phone number already exists' });
      }

      const insertRes = await query(
        'INSERT INTO showrooms (name, phone, address) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), phone.trim(), address.trim()]
      );

      return res.status(201).json({
        success: true,
        message: 'Showroom registered successfully',
        showroom: insertRes.rows[0],
      });
    } catch (err) {
      console.error('[API:adminCreateShowroom] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/auctions/:id/cancel
   * Emergency cancellation of an auction by Super Admin
   */
  router.post('/auctions/:id/cancel', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = 'Cancelled by Platform Administrator' } = req.body;

      const auctionCheck = await query('SELECT id, status, vehicle_model FROM auctions WHERE id = $1', [id]);
      if (auctionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Auction not found' });
      }

      const auction = auctionCheck.rows[0];
      if (auction.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Cannot cancel an already COMPLETED handover deal' });
      }

      await query("UPDATE auctions SET status = 'CANCELLED' WHERE id = $1", [id]);

      // Broadcast cancellation to room and feed
      if (io) {
        io.to(`auction:${id}`).emit('auction_cancelled', {
          auctionId: parseInt(id, 10),
          reason,
        });
        io.to('auctions_feed').emit('feed_auction_cancelled', {
          auctionId: parseInt(id, 10),
          vehicleModel: auction.vehicle_model,
          reason,
        });
      }

      return res.json({
        success: true,
        message: `Auction #${id} has been cancelled`,
      });
    } catch (err) {
      console.error('[API:adminCancelAuction] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/buyers/:id/toggle-status
   * Block / Unblock buyer trading account
   */
  router.post('/buyers/:id/toggle-status', async (req, res) => {
    try {
      const { id } = req.params;
      const bRes = await query('SELECT id, business_name, is_active FROM buyers WHERE id = $1', [id]);
      if (bRes.rows.length === 0) return res.status(404).json({ error: 'Buyer not found' });

      const newStatus = !bRes.rows[0].is_active;
      await query('UPDATE buyers SET is_active = $1 WHERE id = $2', [newStatus, id]);

      if (io) {
        io.emit('buyer_status_changed', { buyerId: parseInt(id, 10), isActive: newStatus });
      }

      return res.json({
        success: true,
        message: `Buyer "${bRes.rows[0].business_name}" is now ${newStatus ? 'ACTIVE' : 'BLOCKED / SUSPENDED'}`,
        is_active: newStatus,
      });
    } catch (err) {
      console.error('[API:adminToggleBuyerStatus] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/admin/buyers/:id
   * Permanently delete / deactivate buyer
   */
  router.delete('/buyers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await query('DELETE FROM buyers WHERE id = $1', [id]);
      return res.json({ success: true, message: `Buyer #${id} removed from platform` });
    } catch (err) {
      console.error('[API:adminDeleteBuyer] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/showrooms/:id/toggle-status
   * Activate / Deactivate showroom branch desk
   */
  router.post('/showrooms/:id/toggle-status', async (req, res) => {
    try {
      const { id } = req.params;
      const sRes = await query('SELECT id, name, is_active FROM showrooms WHERE id = $1', [id]);
      if (sRes.rows.length === 0) return res.status(404).json({ error: 'Showroom not found' });

      const newStatus = !sRes.rows[0].is_active;
      await query('UPDATE showrooms SET is_active = $1 WHERE id = $2', [newStatus, id]);

      if (io) {
        io.emit('showroom_status_changed', { showroomId: parseInt(id, 10), isActive: newStatus });
      }

      return res.json({
        success: true,
        message: `Showroom "${sRes.rows[0].name}" is now ${newStatus ? 'ACTIVE' : 'DEACTIVATED'}`,
        is_active: newStatus,
      });
    } catch (err) {
      console.error('[API:adminToggleShowroomStatus] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/admin/showrooms/:id
   * Remove showroom branch
   */
  router.delete('/showrooms/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await query('DELETE FROM showrooms WHERE id = $1', [id]);
      return res.json({ success: true, message: `Showroom #${id} removed from platform` });
    } catch (err) {
      console.error('[API:adminDeleteShowroom] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/admin/auctions
   * List all auctions with detailed metrics & filtering
   */
  router.get('/auctions', async (req, res) => {
    try {
      const { status } = req.query;
      let sql = `
        SELECT a.*, s.name as showroom_name, s.phone as showroom_phone,
               b.business_name as highest_bidder_name, b.phone as bidder_phone,
               COALESCE(bc.bid_count, 0) as total_bids
        FROM auctions a
        JOIN showrooms s ON a.showroom_id = s.id
        LEFT JOIN buyers b ON a.highest_bidder_id = b.id
        LEFT JOIN (
          SELECT auction_id, count(*) as bid_count FROM bids GROUP BY auction_id
        ) bc ON bc.auction_id = a.id
      `;
      const params = [];

      if (status && status !== 'ALL') {
        sql += ' WHERE a.status = $1';
        params.push(status);
      }
      sql += ' ORDER BY a.created_at DESC LIMIT 100';

      const result = await query(sql, params);
      const auctionIds = result.rows.map((r) => r.id);
      const bidsMap = {};
      if (auctionIds.length > 0) {
        const bidsRes = await query(
          `SELECT b.id, b.auction_id, b.amount, b.placed_at, buy.business_name as bidder_name, buy.phone as bidder_phone
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
              bidder_phone: bid.bidder_phone,
              placed_at: bid.placed_at,
            });
          }
        }
      }

      return res.json({
        success: true,
        serverTime: Date.now(),
        auctions: result.rows.map((a) => ({
          ...a,
          base_price: parseFloat(a.base_price),
          current_highest_bid: parseFloat(a.current_highest_bid),
          total_bids: parseInt(a.total_bids, 10),
          recent_bids: bidsMap[a.id] || [],
        })),
      });
    } catch (err) {
      console.error('[API:adminGetAuctions] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/auctions/:id/force-close
   * Force closes an auction immediately
   */
  router.post('/auctions/:id/force-close', async (req, res) => {
    try {
      const { id } = req.params;
      const aCheck = await query('SELECT * FROM auctions WHERE id = $1', [id]);
      if (aCheck.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });

      const auction = aCheck.rows[0];
      if (auction.status !== 'LIVE') {
        return res.status(400).json({ error: `Cannot force close auction with status '${auction.status}'` });
      }

      await query("UPDATE auctions SET status = 'CLOSED' WHERE id = $1", [id]);

      if (io) {
        io.to(`auction:${id}`).emit('auction_closed', {
          auctionId: parseInt(id, 10),
          reason: 'ADMIN_FORCE_CLOSED',
          finalBid: auction.current_highest_bid,
          highestBidderId: auction.highest_bidder_id,
        });
        io.to('auctions_feed').emit('feed_auction_closed', {
          auctionId: parseInt(id, 10),
          finalBid: auction.current_highest_bid,
        });
      }

      return res.json({ success: true, message: `Auction #${id} has been force-closed` });
    } catch (err) {
      console.error('[API:adminForceClose] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/admin/config
   * Updates platform rules dynamically
   */
  router.post('/config', (req, res) => {
    const {
      minWalletBalanceToBid,
      handoverPlatformFee,
      minBidIncrement,
      defaultAuctionDurationMinutes,
    } = req.body;

    if (minWalletBalanceToBid !== undefined) {
      config.minWalletBalanceToBid = parseFloat(minWalletBalanceToBid);
    }
    if (handoverPlatformFee !== undefined) {
      config.handoverPlatformFee = parseFloat(handoverPlatformFee);
    }
    if (minBidIncrement !== undefined) {
      config.minBidIncrement = parseFloat(minBidIncrement);
    }
    if (defaultAuctionDurationMinutes !== undefined) {
      config.defaultAuctionDurationMinutes = parseInt(defaultAuctionDurationMinutes, 10);
    }

    if (io) {
      io.emit('platform_config_updated', {
        minWalletBalanceToBid: config.minWalletBalanceToBid,
        handoverPlatformFee: config.handoverPlatformFee,
        minBidIncrement: config.minBidIncrement,
      });
    }

    return res.json({
      success: true,
      message: 'Platform configuration updated dynamically',
      config: {
        minWalletBalanceToBid: config.minWalletBalanceToBid,
        handoverPlatformFee: config.handoverPlatformFee,
        minBidIncrement: config.minBidIncrement,
        defaultAuctionDurationMinutes: config.defaultAuctionDurationMinutes,
      },
    });
  });

  return router;
}
