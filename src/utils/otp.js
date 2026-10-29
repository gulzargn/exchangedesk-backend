import crypto from 'crypto';

/**
 * Generates an authoritative 6-digit numeric Pickup OTP for showroom handover.
 * Rule: Anti-Bypass Mechanism - Vehicle is released only upon entering this 6-digit Pickup OTP.
 *
 * @returns {string} 6-digit OTP (e.g., '489201')
 */
export function generatePickupOtp() {
  // Use crypto for cryptographically strong random integer between 100000 and 999999
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
}
