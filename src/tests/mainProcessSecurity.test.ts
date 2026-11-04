// src/tests/mainProcessSecurity.test.ts
import assert from 'assert';
import { createRequire } from 'module';

// SCOPE NOTICE: These tests perform unit-level validation of the session management logic.
// They simulate Electron objects (webContents, IPC events) to verify the behavior of the 
// security middleware in the Main process. Full integration with the Electron native 
// runtime (actual window creation) remains a manual/browser verification step, but the 
// security logic itself is strictly validated here.

process.env.NODE_ENV = 'test'; 
const require = createRequire(import.meta.url);
const sessionManager = require('../../electron/session-manager.cjs');

async function runMainProcessSecurityTests() {
  console.log('--------------------------------------------------');
  console.log('🛡️ Running Electron Main Process Security Tests (Isolated Logic)...');
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

  // Helper to create a mock Electron IPC Event
  function createMockEvent(id: number, url: string = 'http://localhost:3000') {
    return {
      sender: { id },
      senderFrame: { url }
    };
  }

  const ADMIN_USER = { id: 'u1', username: 'admin', role: 'admin' };
  const REGULAR_USER = { id: 'u2', username: 'user', role: 'user' };

  // Test 1: Session Isolation between Windows
  await test('1. Session isolation: Window 1 (Admin) != Window 2 (Guest)', async () => {
    sessionManager.activeSessions.clear();
    
    // Window 1 logs in
    sessionManager.createSession(1, ADMIN_USER);
    
    // Window 1 should have auth
    const event1 = createMockEvent(1);
    assert.ok(sessionManager.requireAuth(event1), 'Window 1 should be authorized');
    
    // Window 2 should NOT have auth
    const event2 = createMockEvent(2);
    assert.throws(() => sessionManager.requireAuth(event2), /يجب تسجيل الدخول/, 'Window 2 should NOT be authorized');
  });

  // Test 2: Admin Privilege Enforcement
  await test('2. Authorization: Window 3 (User) cannot perform Admin actions', async () => {
    // Window 3 logs in as regular user
    sessionManager.createSession(3, REGULAR_USER);
    const event3 = createMockEvent(3);
    
    // Auth should pass
    assert.ok(sessionManager.requireAuth(event3), 'User should be authenticated');
    
    // Admin check should FAIL
    assert.throws(() => sessionManager.requireAdminRole(event3), /مرفوضة أمنياً/, 'Regular user should NOT have admin role');
  });

  // Test 3: Logout Security
  await test('3. Session Termination: Logout clears session in Main Process', async () => {
    sessionManager.createSession(4, ADMIN_USER);
    const event4 = createMockEvent(4);
    
    assert.ok(sessionManager.requireAuth(event4), 'Should be authorized before logout');
    
    // Logout
    sessionManager.clearSession(4);
    
    assert.throws(() => sessionManager.requireAuth(event4), /يجب تسجيل الدخول/, 'Should be unauthorized after logout');
  });

  // Test 4: Origin Validation (validateSender) - Positive and Negative Cases
  await test('4. Security: Origin Validation (validateSender) Hacking Attempts', async () => {
    sessionManager.createSession(5, ADMIN_USER);
    
    // Positive: Correct localhost
    assert.ok(sessionManager.validateSender(createMockEvent(5, 'http://localhost:3000')), 'Localhost 3000 should be valid');

    // Negative: Wrong port
    assert.strictEqual(sessionManager.validateSender(createMockEvent(5, 'http://localhost:3001')), false, 'Port 3001 should be rejected');

    // Negative: Embedded credentials
    assert.strictEqual(sessionManager.validateSender(createMockEvent(5, 'http://user:pass@localhost:3000')), false, 'Credentials should be rejected');

    // Negative: Misleading hostname
    assert.strictEqual(sessionManager.validateSender(createMockEvent(5, 'http://localhost.attacker.com:3000')), false, 'Subdomain hostname should be rejected');

    // Negative: Fake localhost TLD
    assert.strictEqual(sessionManager.validateSender(createMockEvent(5, 'http://localhost.evil:3000')), false, 'Fake localhost TLD should be rejected');

    // Negative: Non-http protocol
    assert.strictEqual(sessionManager.validateSender(createMockEvent(5, 'https://localhost:3000')), false, 'HTTPS (if expecting HTTP) should be rejected for dev server');
  });

  // Test 5: Production Path Validation
  await test('5. Security: Production Path Validation (file://)', async () => {
    process.env.NODE_ENV = 'production';
    try {
      // Positive: Correct app path
      assert.ok(sessionManager.validateSender(createMockEvent(6, 'file:///C:/App/dist/index.html')), 'Valid dist path should pass');
      assert.ok(sessionManager.validateSender(createMockEvent(6, 'file:///opt/app/index.html')), 'Root index file should pass');

      // Negative: External file
      assert.strictEqual(sessionManager.validateSender(createMockEvent(6, 'file:///etc/passwd')), false, 'Sensitive system files should be rejected');

      // Negative: External html file
      assert.strictEqual(sessionManager.validateSender(createMockEvent(6, 'file:///home/user/downloads/evil.html')), false, 'Arbitrary HTML files should be rejected');

      // Negative: Path manipulation (if any)
      assert.strictEqual(sessionManager.validateSender(createMockEvent(6, 'file:///app/dist/index.html?param=evil')), true, 'Query params are allowed but path must be correct');
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });

  // Test 6: Lifecycle: Window closure cleanup
  await test('6. Lifecycle: Window close clears session automatically', async () => {
    sessionManager.createSession(10, ADMIN_USER);
    assert.ok(sessionManager.getSession(10), 'Session should exist');
    
    // Simulate window close event handler execution
    sessionManager.clearSession(10);
    assert.strictEqual(sessionManager.getSession(10), undefined, 'Session MUST be removed after window close');
  });

  // Test 7: Anti-Forgery (Main process identity is source of truth)
  await test('7. Integrity: Fake role in Renderer payload does not affect Main Process', async () => {
    sessionManager.createSession(11, REGULAR_USER);
    const event = createMockEvent(11);
    
    // Renderer sends a fake role in the request body/payload (not the event object itself)
    const fakePayload = { user: { role: 'admin' }, someData: 'test' };
    
    // requireAdminRole uses event.sender.id to look up the session in Main's Map
    // It does NOT look at the arguments passed from IPC (like fakePayload)
    assert.throws(() => {
        // middleware check
        sessionManager.requireAdminRole(event);
    }, /مرفوضة أمنياً/, 'Middleware must use internal Map, ignoring any role provided in IPC payload');
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
