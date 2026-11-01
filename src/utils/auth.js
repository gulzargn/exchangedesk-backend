import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'ExchangeDesk_Production_Super_Secret_Key_2026_Live_B2B';
const JWT_EXPIRES_IN = '30d';

/**
 * Generates signed JWT token for Showroom, Buyer, or Admin
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies JWT token and returns decoded payload, or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware: Enforces valid JWT token in Authorization header
 * Header format: Authorization: Bearer <token>
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session token. Please re-login.' });
  }

  req.user = decoded;
  next();
}

/**
 * Middleware: Optional token parser (attaches req.user if token exists, but doesn't block)
 */
export function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
  next();
}

/**
 * Middleware: Strictly requires Super Administrator role
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  // Fallback for Master Key in X-Admin-Key header or query for direct integrations
  const customKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (customKey === 'Gulzar@1013') {
    req.user = { role: 'admin', id: 0, name: 'Super Administrator' };
    return next();
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Administrator authentication required.' });
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied: Requires Super Administrator privileges.' });
  }

  req.user = decoded;
  next();
}

/**
 * Middleware: Requires Buyer or Admin role
 */
export function requireBuyer(req, res, next) {
  if (!req.user || (req.user.role !== 'buyer' && req.user.role !== 'admin')) {
    return res.status(403).json({ success: false, error: 'Access restricted to authorized verified buyers.' });
  }
  next();
}

/**
 * Middleware: Requires Showroom or Admin role
 */
export function requireShowroom(req, res, next) {
  if (!req.user || (req.user.role !== 'showroom' && req.user.role !== 'admin')) {
    return res.status(403).json({ success: false, error: 'Access restricted to authorized showroom counters.' });
  }
  next();
}

/**
 * Hashes a plaintext PIN with bcrypt
 */
export async function hashPin(pin) {
  return await bcrypt.hash(pin.toString(), 10);
}

/**
 * Compares input PIN against stored PIN (supports both bcrypt hashed and legacy plaintext)
 */
export async function comparePin(inputPin, storedPin) {
  if (!storedPin) return false;
  const input = inputPin.toString().trim();
  const stored = storedPin.toString().trim();

  // If already bcrypt hashed
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return await bcrypt.compare(input, stored);
  }

  // Legacy plaintext match
  return input === stored;
}
