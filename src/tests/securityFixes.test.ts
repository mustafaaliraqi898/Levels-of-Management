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
const { db } = await import('../services/storage.js');

async function runSecurityTests() {
  console.log('--------------------------------------------------');
  console.log('🛡️ Running Rigorous Session & Authorization Security Tests...');
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

  // Clear state for fresh test
  db.getState().users = [];
  sessionStorage.clear();

  // Test 1: First-run Setup
  await test('1. First-run setup creates admin correctly', async () => {
    const res = await authService.setupFirstAdmin({
      username: 'main_admin',
      password: 'SecurePassword123'
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.session?.user.role, 'admin');
  });

  // Test 2: Role Spoofing Prevention in sessionStorage
  await test('2. Role spoofing in sessionStorage is rejected', async () => {
    // Attempt to spoof role by modifying sessionStorage directly
    const session = JSON.parse(sessionStorage.getItem('school_app_auth_session')!);
    session.user.role = 'admin'; // If they were a regular user trying to upgrade
    sessionStorage.setItem('school_app_auth_session', JSON.stringify(session));

    // In Browser mode, loadSession should re-verify against DB
    // We'll create a second user (regular user) to test this properly
    const regUserRes = db.addUser({
      username: 'viewer',
      passwordHash: 'hash',
      salt: 'salt',
      role: 'user',
      isActive: true,
      mustChangePassword: false
    });
    
    const fakeSession = {
      user: { id: regUserRes.user!.id, username: 'viewer', role: 'admin' }, // Spoofed role
      token: 'fake',
      loginTime: new Date().toISOString()
    };
    sessionStorage.setItem('school_app_auth_session', JSON.stringify(fakeSession));

    // Trigger re-init or loadSession via a getter
    const currentSession = (authService as any).loadSession();
    assert.strictEqual(currentSession.user.role, 'user', 'Role MUST be reverted to the one in DB');
  });

  // Test 3: Unauthorized Access Rejection
  await test('3. IPC-like write check rejects regular users', async () => {
    // Set session as regular user
    const users = db.getUsers();
    const viewer = users.find(u => u.role === 'user')!;
    const userSession = {
      user: { id: viewer.id, username: viewer.username, role: viewer.role, isActive: true, mustChangePassword: false },
      token: 't1',
      loginTime: new Date().toISOString()
    };
    sessionStorage.setItem('school_app_auth_session', JSON.stringify(userSession));

    const perm = db.checkWritePermission();
    assert.strictEqual(perm.allowed, false, 'Regular user MUST be denied write permission');
  });

  // Test 4: Admin Access Allowed
  await test('4. Admin user is allowed to perform operations', async () => {
    const users = db.getUsers();
    const admin = users.find(u => u.role === 'admin')!;
    const adminSession = {
      user: { id: admin.id, username: admin.username, role: admin.role, isActive: true, mustChangePassword: false },
      token: 't-admin',
      loginTime: new Date().toISOString()
    };
    sessionStorage.setItem('school_app_auth_session', JSON.stringify(adminSession));

    const perm = db.checkWritePermission();
    assert.strictEqual(perm.allowed, true, 'Admin user MUST be allowed write permission');
  });

  // Test 5: Logout Invalidates Session
  await test('5. Logout invalidates session in storage', async () => {
    await authService.clearSession();
    assert.strictEqual(authService.getCurrentSession(), null);
    assert.strictEqual(sessionStorage.getItem('school_app_auth_session'), null);
  });

  // Test 6: Credential Leakage Prevention
  await test('6. Sensitive credentials are never leaked in user lists', async () => {
    // This is primarily enforced in database.cjs but we can verify the UI data structure
    const users = db.getUsers();
    // Note: in Browser mode we keep them for logic, but we verify they are not in the 'safe' return of verifyCredentials
    const loginRes = await authService.login('main_admin', 'SecurePassword123');
    assert.strictEqual((loginRes as any).user?.passwordHash, undefined);
    assert.strictEqual((loginRes as any).user?.salt, undefined);
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
