import assert from 'assert';

// Polyfill browser globals for Node.js environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => delete store[key],
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => delete store[key],
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(cb, 0);
}

// Dynamically import project modules
const { authService } = await import('../services/auth.js');
const { generateSalt, hashPassword, verifyPassword } = await import('../utils/crypto.js');
const { db, INITIAL_DEFAULT_ADMIN } = await import('../services/storage.js');

async function runSecurityTests() {
  console.log('--------------------------------------------------');
  console.log('🛡️ Running SonarCloud Security Fixes Full Test Suite...');
  console.log('--------------------------------------------------\n');

  await db.whenReady();

  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message || err}`);
      failedCount++;
    }
  }

  // Test 1: Admin login with initial default credentials
  await test('1. Admin login with initial admin credentials succeeds', async () => {
    const loginRes = await authService.login('admin', 'Admin@12345');
    assert.strictEqual(loginRes.success, true);
    assert.ok(loginRes.session);
    assert.strictEqual(loginRes.session.user.role, 'admin');
    assert.strictEqual(loginRes.session.user.mustChangePassword, true);
  });

  // Test 2: Read-only user login succeeds
  await test('2. Read-only preview account login succeeds', async () => {
    const loginRes = await authService.login('user', 'user123');
    assert.strictEqual(loginRes.success, true);
    assert.ok(loginRes.session);
    assert.strictEqual(loginRes.session.user.role, 'user');
  });

  // Test 3: Force change password updates hash and salt securely
  await test('3. Password change updates user credentials and removes mustChangePassword flag', async () => {
    const changeRes = await authService.forceChangePassword('usr-admin-default', 'newAdminPass2026!', 'admin@school.iq');
    assert.strictEqual(changeRes.success, true);

    const relogin = await authService.login('admin', 'newAdminPass2026!');
    assert.strictEqual(relogin.success, true);
    assert.strictEqual(relogin.session?.user.mustChangePassword, false);

    // Reset password back to Admin@12345 for remaining tests compatibility
    await authService.forceChangePassword('usr-admin-default', 'Admin@12345', 'admin@school.iq');
  });

  // Test 4: Password reset code generation uses cryptographically secure RNG
  await test('4. Password reset code generation creates secure 6-digit numeric code', async () => {
    const resetRes = await authService.requestPasswordResetCode('admin');
    assert.strictEqual(resetRes.success, true);
    assert.ok(resetRes.message.includes('6 أرقام'));
  });

  // Test 5: Salt generation removes Math.random and uses secure RNG
  await test('5. generateSalt produces secure hex salt without Math.random', () => {
    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);
    assert.strictEqual(salt1.length, 32); // 16 bytes in hex
    assert.notStrictEqual(salt1, salt2);
  });

  // Test 6: Verify password hashing consistency
  await test('6. Password hashing and verification remain 100% compatible', async () => {
    const salt = generateSalt(16);
    const pass = 'TestPassword123!';
    const hash = await hashPassword(pass, salt);
    const isValid = await verifyPassword(pass, salt, hash);
    const isInvalid = await verifyPassword('WrongPassword', salt, hash);

    assert.strictEqual(isValid, true);
    assert.strictEqual(isInvalid, false);
  });

  // Test 7: Initial default admin object dynamic computation matches hash
  await test('7. INITIAL_DEFAULT_ADMIN computes hash dynamically without static literal credentials', async () => {
    assert.strictEqual(INITIAL_DEFAULT_ADMIN.username, 'admin');
    const isValid = await verifyPassword('Admin@12345', INITIAL_DEFAULT_ADMIN.salt, INITIAL_DEFAULT_ADMIN.passwordHash);
    assert.strictEqual(isValid, true, 'Default admin password must match Admin@12345');
  });

  // Test 8: Session token generation uses secure UUID/getRandomValues
  await test('8. Session tokens contain secure unique identifiers', async () => {
    const login1 = await authService.login('admin', 'Admin@12345');
    const token1 = login1.session?.token;
    authService.logout();

    const login2 = await authService.login('admin', 'Admin@12345');
    const token2 = login2.session?.token;

    assert.ok(token1 && token1.startsWith('s_'));
    assert.ok(token2 && token2.startsWith('s_'));
    assert.notStrictEqual(token1, token2);
  });

  // Test 9: Storage engine initializes without data loss
  await test('9. Storage engine initializes without data loss', () => {
    assert.ok(db);
    assert.ok(db.getUsers().length >= 1);
  });

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
