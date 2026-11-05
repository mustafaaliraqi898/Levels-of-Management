// electron/password-hasher.cjs
const crypto = require('crypto');

/**
 * Standard scrypt options for secure, offline password storage.
 * N = 16384 (CPU/memory cost)
 * r = 8 (block size)
 * p = 1 (parallelization)
 * keylen = 64 bytes (128 hex chars)
 */
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};
const KEY_LENGTH = 64;
const SCRYPT_PREFIX = 'scrypt$';

/**
 * Generate a cryptographically secure random salt (hex).
 */
function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password using scrypt.
 * Returns a prefixed string `scrypt$<hex>` to unambiguously identify the algorithm.
 */
function hashPasswordScrypt(password, salt) {
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${SCRYPT_PREFIX}${derivedKey.toString('hex')}`;
}

/**
 * Legacy SHA-256 hash calculation for backward compatibility.
 */
function hashPasswordSha256(password, salt) {
  return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
}

/**
 * Verify a plain password against stored salt and stored hash.
 * 
 * Returns:
 * {
 *   valid: boolean,
 *   needsMigration: boolean
 * }
 */
function verifyPassword(password, salt, storedHash) {
  if (!password || !salt || !storedHash) {
    return { valid: false, needsMigration: false };
  }

  // 1. Scrypt check
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const expectedHex = storedHash.slice(SCRYPT_PREFIX.length);
    const calculatedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    const expectedBuffer = Buffer.from(expectedHex, 'hex');

    if (calculatedKey.length !== expectedBuffer.length) {
      return { valid: false, needsMigration: false };
    }

    const match = crypto.timingSafeEqual(calculatedKey, expectedBuffer);
    return { valid: match, needsMigration: false };
  }

  // 2. Legacy SHA-256 check
  const calculatedSha = hashPasswordSha256(password, salt);
  const match = calculatedSha.toLowerCase() === storedHash.toLowerCase();

  return {
    valid: match,
    needsMigration: match, // If password matched on legacy SHA-256, it must be migrated to scrypt!
  };
}

module.exports = {
  generateSalt,
  hashPasswordScrypt,
  hashPasswordSha256,
  verifyPassword,
  SCRYPT_PREFIX,
};
