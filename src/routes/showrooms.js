import express from 'express';
import { query } from '../db/index.js';

export function createShowroomsRouter() {
  const router = express.Router();

  /**
   * GET /api/showrooms
   * List all registered showrooms
   */
  router.get('/', async (req, res) => {
    try {
      const result = await query(
        `SELECT s.id, s.name, s.phone, s.address, s.is_active, s.is_approved, s.created_at,
                COALESCE(ac.total_auctions, 0) as total_auctions
         FROM showrooms s
         LEFT JOIN (
           SELECT showroom_id, count(*) as total_auctions
           FROM auctions
           GROUP BY showroom_id
         ) ac ON ac.showroom_id = s.id
         WHERE s.is_approved = true AND s.is_active = true
         ORDER BY s.id ASC`
      );

      return res.json({
        success: true,
        showrooms: result.rows,
      });
    } catch (err) {
      console.error('[API:getShowrooms] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/showrooms/:id
   * Get showroom details and its current active auctions
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const showroomRes = await query('SELECT * FROM showrooms WHERE id = $1', [id]);

      if (showroomRes.rows.length === 0) {
        return res.status(404).json({ error: 'Showroom not found' });
      }

      const auctionsRes = await query(
        `SELECT a.*, b.business_name as highest_bidder_name
         FROM auctions a
         LEFT JOIN buyers b ON a.highest_bidder_id = b.id
         WHERE a.showroom_id = $1
         ORDER BY a.created_at DESC`,
        [id]
      );

      return res.json({
        success: true,
        showroom: showroomRes.rows[0],
        auctions: auctionsRes.rows,
      });
    } catch (err) {
      console.error('[API:getShowroom] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/showrooms/register
   * Real Showroom Dealer onboarding
   */
  router.post('/register', async (req, res) => {
    try {
      const { name, phone, address } = req.body;
      if (!name || !phone || !address) {
        return res.status(400).json({ error: 'Showroom name, phone, and address are required' });
      }

      const check = await query('SELECT id FROM showrooms WHERE phone = $1', [phone.trim()]);
      if (check.rows.length > 0) {
        return res.status(400).json({ error: 'A showroom counter with this phone number is already registered' });
      }

      const insertRes = await query(
        'INSERT INTO showrooms (name, phone, address) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), phone.trim(), address.trim()]
      );

      return res.status(201).json({
        success: true,
        message: 'Showroom branch onboarded successfully',
        showroom: insertRes.rows[0],
      });
    } catch (err) {
      console.error('[API:registerShowroom] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
