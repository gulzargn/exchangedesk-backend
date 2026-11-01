import express from 'express';
import { query, getClient } from '../db/index.js';

export function createBuyersRouter(io) {
  const router = express.Router();

  /**
   * GET /api/buyers
   * Returns list of registered buyers with their current wallet balances
   */
  router.get('/', async (req, res) => {
    try {
      const result = await query(
        `SELECT id, business_name, phone, wallet_balance, locked_emd, is_verified, is_active, is_approved, created_at
         FROM buyers
         WHERE is_approved = true AND is_active = true
         ORDER BY id ASC`
      );

      return res.json({
        success: true,
        buyers: result.rows.map((b) => {
          const wallet = parseFloat(b.wallet_balance || 0);
          const locked = parseFloat(b.locked_emd || 0);
          return {
            ...b,
            wallet_balance: wallet,
            locked_emd: locked,
            available_balance: Math.max(0, wallet - locked),
          };
        }),
      });
    } catch (err) {
      console.error('[API:getBuyers] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/buyers/:id
   * Get single buyer wallet status
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT id, business_name, phone, wallet_balance, locked_emd, is_verified, created_at
         FROM buyers
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Buyer not found' });
      }

      const buyer = result.rows[0];
      const wallet = parseFloat(buyer.wallet_balance || 0);
      const locked = parseFloat(buyer.locked_emd || 0);

      return res.json({
        success: true,
        buyer: {
          ...buyer,
          wallet_balance: wallet,
          locked_emd: locked,
          available_balance: Math.max(0, wallet - locked),
        },
      });
    } catch (err) {
      console.error('[API:getBuyer] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/buyers/:id/deposit-request
   * Buyer requests wallet deposit with UPI UTR or bank reference.
   * Requires Super Admin verification and approval before funds are credited.
   */
  router.post('/:id/deposit-request', async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, payment_method = 'UPI', reference_id = '' } = req.body;
      const depositAmount = parseFloat(amount);

      if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ error: 'Deposit amount must be a positive number' });
      }

      const buyerCheck = await query(
        'SELECT id, business_name, phone, wallet_balance, is_active FROM buyers WHERE id = $1',
        [id]
      );

      if (buyerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Buyer account not found' });
      }

      const buyer = buyerCheck.rows[0];
      if (buyer.is_active === false) {
        return res.status(403).json({ error: 'Your trading account is suspended by Exchange Desk' });
      }

      const insertRes = await query(
        `INSERT INTO deposit_requests (buyer_id, amount, payment_method, reference_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'PENDING', NOW())
         RETURNING *`,
        [buyer.id, depositAmount, payment_method.trim(), reference_id.trim()]
      );

      const request = insertRes.rows[0];

      // Broadcast to Admin via WebSocket
      if (io) {
        io.emit('new_deposit_request', {
          id: request.id,
          buyerId: buyer.id,
          buyerName: buyer.business_name,
          buyerPhone: buyer.phone,
          amount: depositAmount,
          referenceId: reference_id.trim(),
          paymentMethod: payment_method.trim(),
          createdAt: request.created_at,
        });
      }

      return res.status(201).json({
        success: true,
        message: `Deposit request for ₹${depositAmount.toLocaleString('en-IN')} submitted successfully! Exchange Desk verification & approval pending.`,
        depositRequest: {
          ...request,
          amount: parseFloat(request.amount),
        },
      });
    } catch (err) {
      console.error('[API:depositRequest] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/buyers/:id/deposit-requests
   * Returns recent deposit requests and their approval statuses for the buyer
   */
  router.get('/:id/deposit-requests', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT id, amount, payment_method, reference_id, status, admin_notes, created_at, reviewed_at
         FROM deposit_requests
         WHERE buyer_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [id]
      );

      return res.json({
        success: true,
        requests: result.rows.map((r) => ({
          ...r,
          amount: parseFloat(r.amount),
        })),
      });
    } catch (err) {
      console.error('[API:getBuyerDepositRequests] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/buyers/register
   * Real Used-Bike Buyer Trader onboarding
   */
  router.post('/register', async (req, res) => {
    try {
      const { business_name, phone, initial_wallet = 5000 } = req.body;
      if (!business_name || !phone) {
        return res.status(400).json({ error: 'Business name and phone number are required' });
      }

      const check = await query('SELECT id FROM buyers WHERE phone = $1', [phone.trim()]);
      if (check.rows.length > 0) {
        return res.status(400).json({ error: 'A buyer with this phone number is already registered' });
      }

      const deposit = Math.max(parseFloat(initial_wallet) || 0, 0);

      const insertRes = await query(
        'INSERT INTO buyers (business_name, phone, wallet_balance, is_verified) VALUES ($1, $2, $3, true) RETURNING *',
        [business_name.trim(), phone.trim(), deposit]
      );

      return res.status(201).json({
        success: true,
        message: 'Buyer account registered successfully',
        buyer: insertRes.rows[0],
      });
    } catch (err) {
      console.error('[API:registerBuyer] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/buyers/:id/watchlist/toggle
   * Toggles bookmark for an auction
   */
  router.post('/:id/watchlist/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      const { auction_id } = req.body;

      if (!auction_id) {
        return res.status(400).json({ error: 'Auction ID is required' });
      }

      const existing = await query(
        'SELECT id FROM watchlist WHERE buyer_id = $1 AND auction_id = $2',
        [id, auction_id]
      );

      if (existing.rows.length > 0) {
        await query('DELETE FROM watchlist WHERE buyer_id = $1 AND auction_id = $2', [id, auction_id]);
        return res.json({ success: true, watchlisted: false, message: 'Removed from Watchlist' });
      } else {
        await query(
          'INSERT INTO watchlist (buyer_id, auction_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, auction_id]
        );
        return res.json({ success: true, watchlisted: true, message: 'Added to Watchlist ❤️' });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/buyers/:id/watchlist
   * Returns list of bookmarked auction IDs
   */
  router.get('/:id/watchlist', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query(
        'SELECT auction_id FROM watchlist WHERE buyer_id = $1 ORDER BY created_at DESC',
        [id]
      );
      return res.json({
        success: true,
        auctionIds: result.rows.map((r) => r.auction_id),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
