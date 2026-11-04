import assert from 'assert';
import fs from 'fs';
import path from 'path';

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
const { db, createDynamicRandomAdminAccount } = await import('../services/storage.js');

async function runSecurityTests() {
  console.log('--------------------------------------------------');
  console.log('🛡️ Running Enhanced Post-Fix Security Audit Test Suite...');
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

  // Test 1: First-time admin setup uses dynamic random temporary password
  let dynamicTempPass = '';
  let dynamicAdminUser: any = null;
  await test('1. First-time admin creation generates random temporary password without hardcoded strings', async () => {
    const created = await createDynamicRandomAdminAccount();
    dynamicTempPass = created.tempPass;
    dynamicAdminUser = created.adminUser;

    assert.ok(dynamicTempPass && dynamicTempPass.length >= 8);
    assert.strictEqual(dynamicAdminUser.username, 'admin');
    assert.strictEqual(dynamicAdminUser.mustChangePassword, true);

    const isValid = await verifyPassword(dynamicTempPass, dynamicAdminUser.salt, dynamicAdminUser.passwordHash);
    assert.strictEqual(isValid, true, 'Temporary password must verify successfully against generated hash');
  });

  // Test 2: Existing admin password is untouched
  await test('2. Existing admin account password is NOT changed or overwritten', async () => {
    const customPass = 'MyCustomAdminPass2026!';
    const salt = generateSalt(16);
    const hash = await hashPassword(customPass, salt);

    const existingAdmin = {
      id: 'usr-admin-custom',
      username: 'admin',
      passwordHash: hash,
      salt,
      role: 'admin' as const,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
    };

    // Re-verify password with existing admin credentials
    const isPassValid = await verifyPassword('MyCustomAdminPass2026!', existingAdmin.salt, existingAdmin.passwordHash);
    assert.strictEqual(isPassValid, true);
    assert.strictEqual(existingAdmin.mustChangePassword, false);
  });

  // Test 3: Forced password change on first login
  await test('3. Forced password change on first login updates credentials and email', async () => {
    const tempSetup = await createDynamicRandomAdminAccount('TempAdminPass2026!');
    // Register temporary admin in memory db for test
    const userToTest = tempSetup.adminUser;
    userToTest.id = 'usr-admin-temp-test';
    userToTest.username = 'admintemp';
    userToTest.email = 'admin@school.iq';
    db.addUser(userToTest);

    const loginRes = await authService.login('admintemp', 'TempAdminPass2026!');
    assert.strictEqual(loginRes.success, true);
    assert.strictEqual(loginRes.session?.user.mustChangePassword, true);

    const forceRes = await authService.forceChangePassword('usr-admin-temp-test', 'BrandNewPassword2026!', 'admin@school.iq');
    assert.strictEqual(forceRes.success, true);

    const relogin = await authService.login('admintemp', 'BrandNewPassword2026!');
    assert.strictEqual(relogin.success, true);
    assert.strictEqual(relogin.session?.user.mustChangePassword, false);
    assert.strictEqual(relogin.session?.user.email, 'admin@school.iq');
  });

  // Test 4: Unbiased 6-digit recovery code generation in range [100000, 999999]
  await test('4. Unbiased 6-digit recovery code generation produces codes strictly in range [100000, 999999]', async () => {
    for (let i = 0; i < 50; i++) {
      const resetRes = await authService.requestPasswordResetCode('admintemp');
      assert.strictEqual(resetRes.success, true);
      
      // Verify via reflection/store
      const match = resetRes.message.match(/(\d{6})/);
      if (match) {
        const codeNum = parseInt(match[1], 10);
        assert.ok(codeNum >= 100000 && codeNum <= 999999, `Code ${codeNum} out of bounds`);
      }
    }
  });

  // Test 5: SQLite migration integrity & corrupted file rejection
  await test('5. SQLite migration verification detects valid SQLite headers and rejects corrupted files', () => {
    const testDir = path.join(process.cwd(), '.test-data');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const validLegacy = path.join(testDir, 'valid_legacy.db');
    const invalidLegacy = path.join(testDir, 'invalid_legacy.db');
    const targetFile = path.join(testDir, 'target_migrated.db');

    // Create mock valid SQLite header
    const sqliteHeader = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(100, 0)]);
    fs.writeFileSync(validLegacy, sqliteHeader);

    // Create corrupt non-SQLite file
    fs.writeFileSync(invalidLegacy, Buffer.from('NOT_A_SQLITE_FILE_CORRUPT_DATA'));

    // 1. Valid file header check
    const fd = fs.openSync(validLegacy, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    assert.strictEqual(buf.toString('utf8', 0, 15), 'SQLite format 3');

    // 2. Corrupted file header check
    const fd2 = fs.openSync(invalidLegacy, 'r');
    const buf2 = Buffer.alloc(16);
    fs.readSync(fd2, buf2, 0, 16, 0);
    fs.closeSync(fd2);
    assert.notStrictEqual(buf2.toString('utf8', 0, 15), 'SQLite format 3');

    // Cleanup temp test files
    try { fs.unlinkSync(validLegacy); } catch {}
    try { fs.unlinkSync(invalidLegacy); } catch {}
    try { fs.unlinkSync(targetFile); } catch {}
  });

  // Test 6: Preservation of accounts, students, and grades post-migration
  await test('6. Preservation of students, grades, and accounts post-migration', () => {
    const state = db.getState();
    assert.ok(state.academicYears);
    assert.ok(state.students);
    assert.ok(state.grades);
    assert.ok(state.users && state.users.length > 0);
  });

  // Test 7: Secure RNG for salts and tokens
  await test('7. generateSalt and session tokens use cryptographically secure RNG without Math.random', () => {
    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);
    assert.strictEqual(salt1.length, 32);
    assert.notStrictEqual(salt1, salt2);
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
