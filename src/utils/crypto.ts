/**
 * Robust cross-environment cryptographic helpers.
 * Compatible with modern browser crypto.subtle, Electron, and Node.js environments.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${salt}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback for Node.js test scripts if crypto.subtle is not accessible
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
  } catch {
    throw new Error('Crypto environment not available');
  }
}

export function generateSalt(length = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Math.random fallback
  return Array.from({ length }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  plainText: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const calculated = await hashPassword(plainText, salt);
  return calculated.toLowerCase() === expectedHash.toLowerCase();
}
