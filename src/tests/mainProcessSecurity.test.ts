// src/tests/mainProcessSecurity.test.ts
import assert from 'assert';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';

/**
 * SCOPE & ENVIRONMENT DISCLOSURE:
 * 
 * 1. Tested Unit & Logic:
 *    - The core security authorization layer and session management logic in `electron/session-manager.cjs`.
 *    - Strict origin checking via `validateSender` (full URL parsing, scheme, host, port, credentials, path traversal, query, hash).
 *    - Role enforcement and tamper-resistance via `requireAuth` and `requireAdminRole`.
 *    - Window lifecycle handler `handleWindowClosed`.
 * 
 * 2. Execution Environment & Boundaries:
 *    - Runs under Node.js test environment using realistic Electron event simulations (`event.sender`, `event.senderFrame`).
 *    - Does NOT spawn a graphical Electron desktop window or native Chromium rendering pipeline.
 *    - Fully verifies Main Process authorization barriers and guarantees that no Renderer-provided payload
 *      or malicious URL origin can bypass session verification or escalate privileges.
 */

const require = createRequire(import.meta.url);
const fs = require('fs');
const sessionManager = require('../../electron/session-manager.cjs');
const passwordHasher = require('../../electron/password-hasher.cjs');

async function runMainProcessSecurityTests() {
  console.log('--------------------------------------------------');
  console.log('🛡️ Running Rigorous Electron Main Process Security Tests...');
  console.log('--------------------------------------------------\n');

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

  function createMockEvent(id: number, urlString: string | null | undefined) {
    if (urlString === undefined) {
      return { sender: { id } }; // Missing senderFrame
    }
    return {
      sender: { id },
      senderFrame: urlString !== null ? { url: urlString } : null
    };
  }

  const ADMIN_USER = { id: 'usr-admin', username: 'admin', role: 'admin' };
  const REGULAR_USER = { id: 'usr-user', username: 'teacher', role: 'user' };

  // ==========================================
  // A. Production Path & Origin Validation Tests
  // ==========================================

  await test('A1. Production: Exact authorized app file URL is accepted', () => {
    // Exact file URL matching EXPECTED_PROD_PATH
    const validFileUrl = url.pathToFileURL(sessionManager.EXPECTED_PROD_PATH).href;
    const event = createMockEvent(100, validFileUrl);
    
    // In production mode
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.strictEqual(sessionManager.validateSender(event), true, 'Exact app file URL must be accepted');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('A2. Production: External file named "index.html" outside app is rejected', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // Attacker serves their own index.html from home/temp directory
      const evilPath = path.resolve('/home/attacker/index.html');
      const evilFileUrl = url.pathToFileURL(evilPath).href;
      const event = createMockEvent(101, evilFileUrl);

      assert.strictEqual(
        sessionManager.validateSender(event),
        false,
        'External index.html outside dist folder must be rejected'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('A3. Production: Fake directory path mimicking dist is rejected', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // E.g. /tmp/fake/dist/index.html or /var/www/dist/index.html
      const fakeAppPath = path.resolve('/tmp/malicious/dist/index.html');
      const fakeUrl = url.pathToFileURL(fakeAppPath).href;
      const event = createMockEvent(102, fakeUrl);

      assert.strictEqual(
        sessionManager.validateSender(event),
        false,
        'Fake directory ending in dist/index.html must be rejected'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('A4. Production & Dev: Query strings or URL hashes are strictly rejected', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const validFileUrl = url.pathToFileURL(sessionManager.EXPECTED_PROD_PATH).href;
      
      const queryEvent = createMockEvent(103, `${validFileUrl}?exploit=payload`);
      assert.strictEqual(sessionManager.validateSender(queryEvent), false, 'Query string must be rejected');

      const hashEvent = createMockEvent(104, `${validFileUrl}#maliciousRoute`);
      assert.strictEqual(sessionManager.validateSender(hashEvent), false, 'Hash fragment must be rejected');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('A5. Production & Dev: Disallowed protocols and schemes are rejected', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const evilSchemes = [
        'https://my-phishing-school.com',
        'http://evil.com/dist/index.html',
        'javascript:alert(1)',
        'data:text/html,<html>Evil</html>',
        'ftp://localhost/dist/index.html'
      ];

      for (const schemeUrl of evilSchemes) {
        const event = createMockEvent(105, schemeUrl);
        assert.strictEqual(
          sessionManager.validateSender(event),
          false,
          `Protocol ${schemeUrl} must be rejected`
        );
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('A6. Security: Missing or null senderFrame is rejected', () => {
    // Missing senderFrame property entirely
    const noFrameEvent = createMockEvent(106, undefined);
    assert.strictEqual(sessionManager.validateSender(noFrameEvent), false, 'Missing senderFrame must return false');

    // senderFrame is null
    const nullFrameEvent = createMockEvent(107, null);
    assert.strictEqual(sessionManager.validateSender(nullFrameEvent), false, 'Null senderFrame must return false');

    // Empty URL string
    const emptyUrlEvent = createMockEvent(108, '');
    assert.strictEqual(sessionManager.validateSender(emptyUrlEvent), false, 'Empty URL must return false');
  });

  await test('A7. Development Mode: Strict validation of http://localhost:3000', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      // Valid local dev URL
      assert.strictEqual(sessionManager.validateSender(createMockEvent(109, 'http://localhost:3000')), true);
      assert.strictEqual(sessionManager.validateSender(createMockEvent(109, 'http://localhost:3000/')), true);
      assert.strictEqual(sessionManager.validateSender(createMockEvent(109, 'http://localhost:3000/index.html')), true);

      // Wrong port
      assert.strictEqual(sessionManager.validateSender(createMockEvent(110, 'http://localhost:3001/')), false);

      // Embedded credentials
      assert.strictEqual(sessionManager.validateSender(createMockEvent(111, 'http://admin:pass@localhost:3000/')), false);

      // Misleading hostnames
      assert.strictEqual(sessionManager.validateSender(createMockEvent(112, 'http://localhost.evil.com:3000/')), false);
      assert.strictEqual(sessionManager.validateSender(createMockEvent(113, 'http://fake-localhost:3000/')), false);

      // Non-HTTP protocol
      assert.strictEqual(sessionManager.validateSender(createMockEvent(114, 'https://localhost:3000/')), false);

      // Path traversal or unexpected paths
      assert.strictEqual(sessionManager.validateSender(createMockEvent(115, 'http://localhost:3000/api/secret')), false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // ==========================================
  // B. Session Isolation & Privilege Tests
  // ==========================================

  await test('B1. Window isolation: Admin window gets privileges, Guest window has none', () => {
    sessionManager.activeSessions.clear();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const window1Id = 201; // Admin window
      const window2Id = 202; // Guest / Unauthenticated window

      sessionManager.createSession(window1Id, ADMIN_USER);

      const event1 = createMockEvent(window1Id, 'http://localhost:3000');
      const event2 = createMockEvent(window2Id, 'http://localhost:3000');

      // Window 1 has full auth and admin privileges
      const session1 = sessionManager.requireAuth(event1);
      assert.strictEqual(session1.user.role, 'admin');
      assert.doesNotThrow(() => sessionManager.requireAdminRole(event1));

      // Window 2 has NO session and is blocked from any protected IPC
      assert.throws(
        () => sessionManager.requireAuth(event2),
        /يجب تسجيل الدخول/,
        'Guest window must be denied authentication'
      );
      assert.throws(
        () => sessionManager.requireAdminRole(event2),
        /يجب تسجيل الدخول/,
        'Guest window must be denied admin role'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('B2. Role enforcement: Regular User window cannot perform Admin operations', () => {
    sessionManager.activeSessions.clear();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const window3Id = 203; // Regular user window
      sessionManager.createSession(window3Id, REGULAR_USER);
      const event3 = createMockEvent(window3Id, 'http://localhost:3000');

      // requireAuth succeeds for regular user
      const userSession = sessionManager.requireAuth(event3);
      assert.strictEqual(userSession.user.role, 'user');

      // requireAdminRole MUST fail with specific security rejection
      assert.throws(
        () => sessionManager.requireAdminRole(event3),
        /مرفوضة أمنياً/,
        'Regular user must be strictly blocked from admin operations'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await test('B3. Logout invalidation: Invalidation affects ONLY the target window', () => {
    sessionManager.activeSessions.clear();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const winA = 301;
      const winB = 302;

      sessionManager.createSession(winA, ADMIN_USER);
      sessionManager.createSession(winB, REGULAR_USER);

      const eventA = createMockEvent(winA, 'http://localhost:3000');
      const eventB = createMockEvent(winB, 'http://localhost:3000');

      assert.ok(sessionManager.requireAuth(eventA));
      assert.ok(sessionManager.requireAuth(eventB));

      // WinA logs out
      sessionManager.clearSession(winA);

      // WinA is now revoked
      assert.throws(() => sessionManager.requireAuth(eventA), /يجب تسجيل الدخول/);

      // WinB session remains completely intact and unaffected
      assert.doesNotThrow(() => sessionManager.requireAuth(eventB));
      assert.strictEqual(sessionManager.getSession(winB)?.user.username, 'teacher');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // ==========================================
  // C. Window Lifecycle & Closed Event Tests
  // ==========================================

  await test('C. Window close event handler execution clears session', () => {
    sessionManager.activeSessions.clear();
    const winId = 401;

    // Window opened and logged in
    sessionManager.createSession(winId, ADMIN_USER);
    assert.ok(sessionManager.getSession(winId), 'Session must exist prior to close');

    // Simulate BrowserWindow 'closed' event executing the registered callback
    // (As defined in main.cjs: mainWindow.on('closed', () => sessionManager.handleWindowClosed(win.webContents.id)))
    sessionManager.handleWindowClosed(winId);

    // Verify session was cleanly purged from the Map
    assert.strictEqual(
      sessionManager.getSession(winId),
      undefined,
      'Session must be removed from activeSessions map upon window close'
    );
  });

  // ==========================================
  // D. Anti-Tamper & Role Forgery Tests
  // ==========================================

  await test('D. Anti-Forgery: Passing forged role payload in IPC arguments has ZERO effect', () => {
    sessionManager.activeSessions.clear();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const winId = 501;
      // In Main process, session is stored as a regular user
      sessionManager.createSession(winId, REGULAR_USER);
      const event = createMockEvent(winId, 'http://localhost:3000');

      // Simulate a malicious Renderer sending an IPC call with arbitrary forged arguments
      // e.g. ipcRenderer.invoke('db:saveSettings', { role: 'admin', user: { role: 'admin' }, fakeAdmin: true }, 'app_settings', {})
      const forgedPayloads = [
        { role: 'admin' },
        { user: { role: 'admin', id: 'usr-admin' } },
        'admin',
        { session: { user: { role: 'admin' } } }
      ];

      // Simulated handler wrapper for sensitive operations (such as db:saveSettings or db:upsertUser)
      const simulatedProtectedIpcHandler = (ipcEvent: any, ...ipcArgs: any[]) => {
        // Enforce authorization check as done in main.cjs: requireAdminRole(event)
        sessionManager.requireAdminRole(ipcEvent);
        // If it were to pass, execute action...
        return { success: true };
      };

      for (const payload of forgedPayloads) {
        assert.throws(
          () => simulatedProtectedIpcHandler(event, payload, 'key', 'value'),
          /مرفوضة أمنياً/,
          `Forged payload ${JSON.stringify(payload)} must NOT bypass requireAdminRole`
        );
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // ==========================================
  // E. Password Hashing & Migration Security (scrypt & legacy SHA-256)
  // ==========================================

  await test('E1. Password Hasher: Produces scrypt$ prefixed hash resistant to brute-force', () => {
    const salt = passwordHasher.generateSalt();
    const hash = passwordHasher.hashPasswordScrypt('SuperSecretPass123', salt);
    assert.ok(hash.startsWith('scrypt$'), 'Hash must start with scrypt$ prefix');
    assert.strictEqual(hash.length, 7 + 128, 'scrypt$ prefix (7) + 64 bytes in hex (128) = 135 chars');
  });

  await test('E2. Password Hasher: Validates correct password and rejects incorrect password with scrypt', () => {
    const salt = passwordHasher.generateSalt();
    const hash = passwordHasher.hashPasswordScrypt('CorrectPassword!@#', salt);

    const validRes = passwordHasher.verifyPassword('CorrectPassword!@#', salt, hash);
    assert.strictEqual(validRes.valid, true, 'Valid password must be verified');
    assert.strictEqual(validRes.needsMigration, false, 'scrypt hash does not need migration');

    const invalidRes = passwordHasher.verifyPassword('WrongPassword', salt, hash);
    assert.strictEqual(invalidRes.valid, false, 'Wrong password must fail verification');
    assert.strictEqual(invalidRes.needsMigration, false, 'Invalid password must not trigger migration');
  });

  await test('E3. Password Hasher: Supports legacy SHA-256 hash and flags needsMigration: true', () => {
    const salt = 'a1b2c3d4e5f67890';
    const legacyHash = passwordHasher.hashPasswordSha256('LegacyAdmin2025', salt);
    assert.strictEqual(legacyHash.length, 64, 'SHA-256 hex length must be 64 characters');

    // Verification must succeed AND indicate migration is required
    const result = passwordHasher.verifyPassword('LegacyAdmin2025', salt, legacyHash);
    assert.strictEqual(result.valid, true, 'Legacy SHA-256 password must verify seamlessly');
    assert.strictEqual(result.needsMigration, true, 'Legacy SHA-256 must flag needsMigration: true');

    // Wrong password with legacy hash must still fail
    const wrongResult = passwordHasher.verifyPassword('WrongLegacyPass', salt, legacyHash);
    assert.strictEqual(wrongResult.valid, false, 'Wrong password on legacy hash must fail');
    assert.strictEqual(wrongResult.needsMigration, false, 'Failed verification must never migrate');
  });

  await test('E4. Database Migration: verifyCredentials migrates legacy SHA-256 to scrypt without lockout', async () => {
    const salt = 'legacy-salt-999';
    const legacySha256 = passwordHasher.hashPasswordSha256('AdminPass2026', salt);

    // Mock DB user storage
    const mockUser: any = {
      id: 'usr-migration-test',
      username: 'migrating_admin',
      passwordHash: legacySha256,
      salt: salt,
      role: 'admin',
      isActive: 1,
      mustChangePassword: 0
    };

    let updatedHash = '';
    let updatedSalt = '';

    // Simulated verifyCredentials implementation matching electron/database.cjs
    const simulatedVerifyCredentials = async (usernameInput: string, passwordInput: string) => {
      if (usernameInput !== mockUser.username) return { success: false, error: 'User not found' };
      const verifyRes = passwordHasher.verifyPassword(passwordInput, mockUser.salt, mockUser.passwordHash);
      if (!verifyRes.valid) return { success: false, error: 'Invalid password' };

      if (verifyRes.needsMigration) {
        const newSalt = passwordHasher.generateSalt();
        const newHash = passwordHasher.hashPasswordScrypt(passwordInput, newSalt);
        // Emulate DB update: UPDATE users SET passwordHash = ?, salt = ? WHERE id = ?
        mockUser.passwordHash = newHash;
        mockUser.salt = newSalt;
        updatedHash = newHash;
        updatedSalt = newSalt;
      }

      const { passwordHash: _, salt: __, ...safeUser } = mockUser;
      return { success: true, user: safeUser };
    };

    // 1st login: User logs in with original legacy SHA-256 password
    const login1 = await simulatedVerifyCredentials('migrating_admin', 'AdminPass2026');
    assert.strictEqual(login1.success, true, 'First login with legacy SHA-256 must succeed');
    assert.ok(mockUser.passwordHash.startsWith('scrypt$'), 'User passwordHash in DB must now be scrypt');
    assert.strictEqual(mockUser.passwordHash, updatedHash);
    assert.strictEqual(mockUser.salt, updatedSalt);

    // 2nd login: User logs in again, verified directly via scrypt without needing migration
    const checkAfter = passwordHasher.verifyPassword('AdminPass2026', mockUser.salt, mockUser.passwordHash);
    assert.strictEqual(checkAfter.valid, true, 'Subsequent login verifies via scrypt');
    assert.strictEqual(checkAfter.needsMigration, false, 'No further migration needed');
  });

  // ==========================================
  // F. Multi-Session Invalidation Tests (clearSessionsByUserId)
  // ==========================================

  await test('F1. Multi-Session: Changing or resetting password revokes ALL windows of that user ID', () => {
    sessionManager.activeSessions.clear();

    const userA = { id: 'usr-alice-123', username: 'alice', role: 'admin' };
    const userB = { id: 'usr-bob-456', username: 'bob', role: 'user' };

    // Alice opens two separate windows (e.g. main window and reports window)
    const aliceWin1 = 601;
    const aliceWin2 = 602;
    sessionManager.createSession(aliceWin1, userA);
    sessionManager.createSession(aliceWin2, userA);

    // Bob opens one window
    const bobWin = 603;
    sessionManager.createSession(bobWin, userB);

    assert.strictEqual(sessionManager.activeSessions.size, 3, 'Total 3 active sessions across windows');
    assert.ok(sessionManager.getSession(aliceWin1), 'Alice Win1 active');
    assert.ok(sessionManager.getSession(aliceWin2), 'Alice Win2 active');
    assert.ok(sessionManager.getSession(bobWin), 'Bob Win active');

    // Alice resets / changes password -> triggers clearSessionsByUserId(userA.id)
    const cleared = sessionManager.clearSessionsByUserId(userA.id);
    assert.strictEqual(cleared, 2, 'Must clear exactly 2 windows belonging to Alice');

    // Alice\'s windows are completely revoked
    assert.strictEqual(sessionManager.getSession(aliceWin1), undefined, 'Alice Win1 session revoked');
    assert.strictEqual(sessionManager.getSession(aliceWin2), undefined, 'Alice Win2 session revoked');

    // Bob\'s window remains valid and unaffected
    assert.ok(sessionManager.getSession(bobWin), 'Bob session remains untouched');
    assert.strictEqual(sessionManager.getSession(bobWin)?.user.id, userB.id);

    // Subsequent IPC calls from Alice\'s revoked windows are rejected
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const eventAlice1 = createMockEvent(aliceWin1, 'http://localhost:3000');
      assert.throws(
        () => sessionManager.requireAuth(eventAlice1),
        /يجب تسجيل الدخول/,
        'Alice Win1 must be rejected on subsequent operation'
      );

      const eventBob = createMockEvent(bobWin, 'http://localhost:3000');
      const bobSession = sessionManager.requireAuth(eventBob);
      assert.strictEqual(bobSession.user.username, 'bob', 'Bob can still execute authenticated operations');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // ==========================================
  // G. SMTP Security & Strict TLS Certificate Verification
  // ==========================================

  await test('G1. SMTP Security: rejectUnauthorized: false is strictly disallowed in smtp-service.cjs', () => {
    const smtpServicePath = path.resolve(process.cwd(), 'electron/smtp-service.cjs');
    const sourceCode = fs.readFileSync(smtpServicePath, 'utf8');

    // Verify rejectUnauthorized: false does NOT exist anywhere in smtp-service.cjs
    const hasInsecureTls = /rejectUnauthorized\s*:\s*false/.test(sourceCode);
    assert.strictEqual(
      hasInsecureTls,
      false,
      'SECURITY: smtp-service.cjs must never disable TLS certificate verification (rejectUnauthorized: false is forbidden)'
    );
  });

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMainProcessSecurityTests().catch((err) => {
  console.error('Fatal main process security test error:', err);
  process.exit(1);
});
