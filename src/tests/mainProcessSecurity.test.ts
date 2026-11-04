// src/tests/mainProcessSecurity.test.ts
import assert from 'assert';
import path from 'path';
import { createRequire } from 'module';

process.env.NODE_ENV = 'test'; // Ensure we don't trigger development-only permissive checks or strict dev URL checks
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
  function createMockEvent(id: number, url: string = 'file:///app/dist/index.html') {
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

  // Test 4: Origin Validation (validateSender)
  await test('4. Security: Rejects IPC from unauthorized origins', async () => {
    sessionManager.createSession(5, ADMIN_USER);
    
    // Valid origin
    const validEvent = createMockEvent(5, 'file:///path/to/app/dist/index.html');
    assert.ok(sessionManager.validateSender(validEvent), 'Origin dist/index.html should be valid');

    // Invalid origin (Evil website)
    const evilEvent = createMockEvent(5, 'https://evil-attacker.com');
    assert.strictEqual(sessionManager.validateSender(evilEvent), false, 'Origin evil-attacker.com should be rejected');
    
    // Verification that middleware catches it
    assert.throws(() => sessionManager.requireAuth(evilEvent), /Unauthorized sender origin/, 'Middleware should reject unauthorized origin');
  });

  // Test 5: Window Closing cleanup
  await test('5. Lifecycle: Window close clears session automatically', async () => {
    sessionManager.createSession(6, ADMIN_USER);
    assert.ok(sessionManager.getSession(6), 'Session should exist');
    
    // Simulate window close logic (which calls clearSession in main.cjs)
    sessionManager.clearSession(6);
    assert.strictEqual(sessionManager.getSession(6), undefined, 'Session should be removed after window close');
  });

  // Test 6: Anti-Forgery (Main process identity is source of truth)
  await test('6. Integrity: Renderer cannot overwrite its role in Main process', async () => {
    // Renderer sends its own "role: admin" in a payload? 
    // We test that Main process ignore any "role" passed in event if we were to have a channel that accepted it.
    // In our implementation, we DON'T even have a channel for that.
    // Here we verify that requireAdminRole ONLY looks at the session stored in Main.
    
    sessionManager.createSession(7, REGULAR_USER);
    const event7 = createMockEvent(7);
    
    // Even if Renderer claimed to be admin in some payload, requireAdminRole uses the internal Map
    assert.throws(() => sessionManager.requireAdminRole(event7), /مرفوضة أمنياً/);
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
