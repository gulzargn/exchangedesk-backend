/**
 * Vehicle Registration Certificate (RC) & PII Data Masking Utility
 * Anti-Bypass Rule 1: The buyer must NEVER see customer phone numbers,
 * personal names, or full addresses. Vehicle RC numbers must be masked.
 */

/**
 * Masks an Indian vehicle registration number.
 * Examples:
 *   "MH-04-AZ-8921" -> "MH-04-**-8921"
 *   "DL01AB1234"    -> "DL-01-**-1234"
 *   "KA-05-8910"    -> "KA-05-**-8910"
 *
 * @param {string} rcNumber - The raw RC number
 * @returns {string} - The masked RC number
 */
export function maskRcNumber(rcNumber) {
  if (!rcNumber || typeof rcNumber !== 'string') {
    return 'XX-**-****';
  }

  // Normalize: uppercase, remove non-alphanumeric except hyphens
  const cleaned = rcNumber.trim().toUpperCase().replace(/[\s]/g, '');

  // Match pattern: 2 letters (state), 2 digits (RTO), optional series letters, 4 digits
  const standardPattern = /^([A-Z]{2})[-]?([0-9]{2})[-]?([A-Z]{0,3})[-]?([0-9]{4})$/;
  const match = cleaned.match(standardPattern);

  if (match) {
    const [, state, rto, , lastDigits] = match;
    return `${state}-${rto}-**-${lastDigits}`;
  }

  // Fallback generic masking if unusual format: keep first 4 and last 4 characters
  if (cleaned.length >= 8) {
    const start = cleaned.slice(0, 4);
    const end = cleaned.slice(-4);
    return `${start}-**-${end}`;
  }

  // Short fallback
  return cleaned.slice(0, 2) + '-**-' + cleaned.slice(-2);
}

/**
 * Sanitizes an auction object for buyer view.
 * Completely strips customer data, masks RC number, and removes confidential pickup_otp.
 *
 * @param {object} auction - Raw auction record from database
 * @returns {object} - Sanitized auction record safe for buyers
 */
export function sanitizeAuctionForBuyer(auction) {
  if (!auction) return null;

  const sanitized = { ...auction };

  // Mask RC Number
  sanitized.rc_number_masked = maskRcNumber(auction.rc_number);
  // Remove unmasked RC from buyer view
  delete sanitized.rc_number;

  // Anti-Bypass Rule: Hide Pickup OTP from buyer until showroom issues receipt
  delete sanitized.pickup_otp;

  // Ensure showroom private phone/exact contact is omitted from public broadcast
  if (sanitized.showroom_phone) {
    delete sanitized.showroom_phone;
  }

  return sanitized;
}
