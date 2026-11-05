// src/tests/dbIntegration.test.ts
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../electron/database.cjs');
const passwordHasher = require('../../electron/password-hasher.cjs');

async function runDbIntegrationTests() {
  console.log('--------------------------------------------------');
  console.log('🗄️ Running SQLite Database Integration Tests...');
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
      console.error(`     ${err.stack || err.message}\n`);
      failedCount++;
    }
  }

  // Set test environment and data path
  process.env.NODE_ENV = 'test';
  await db._closeDb();
  const testDataDir = path.join(process.cwd(), '.test-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDataDir, { recursive: true });
  db._reopenDb();

  await test('1. Real SQLite Initialization', async () => {
    await db.initDb();
    const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map((t: any) => t.name);
    const required = ['users', 'academic_years', 'classes', 'sections', 'subjects', 'students', 'grades'];
    for (const r of required) {
      assert.ok(tableNames.includes(r), `Table ${r} must exist`);
    }
  });

  await test('2. upsertUser: Preserve passwordHash and salt on update', async () => {
    const userId = `usr-test-${Date.now()}`;
    const salt = passwordHasher.generateSalt();
    const hash = passwordHasher.hashPasswordScrypt('Secret123!', salt);

    // Initial insert
    await db.upsertUser({
      id: userId,
      username: 'test_user',
      passwordHash: hash,
      salt: salt,
      role: 'user',
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    });

    const inserted = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    assert.ok(inserted, 'User must be inserted');
    assert.strictEqual(inserted.passwordHash, hash);
    assert.strictEqual(inserted.salt, salt);

    // Update without password (stripped by Renderer)
    await db.upsertUser({
      id: userId,
      username: 'test_user_renamed',
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
      email: 'test@example.com'
    });

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    assert.strictEqual(updated.username, 'test_user_renamed');
    assert.strictEqual(updated.role, 'admin');
    assert.strictEqual(updated.email, 'test@example.com');
    assert.strictEqual(updated.passwordHash, hash, 'passwordHash must be preserved');
    assert.strictEqual(updated.salt, salt, 'salt must be preserved');

    // Verify login still works
    const loginRes = await db.verifyCredentials('test_user_renamed', 'Secret123!');
    assert.strictEqual(loginRes.success, true);
  });

  await test('3. upsertUser: Update password works', async () => {
    const userId = `usr-pass-test-${Date.now()}`;
    const oldSalt = passwordHasher.generateSalt();
    const oldHash = passwordHasher.hashPasswordScrypt('OldPass!', oldSalt);

    await db.upsertUser({
      id: userId,
      username: 'pass_test',
      passwordHash: oldHash,
      salt: oldSalt,
      role: 'user',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Use official method to update password
    await db.updateUserPassword(userId, 'NewPass123!');

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    assert.notStrictEqual(updated.passwordHash, oldHash);
    assert.notStrictEqual(updated.salt, oldSalt);
    assert.ok(updated.passwordHash.startsWith('scrypt$'));

    const loginRes = await db.verifyCredentials('pass_test', 'NewPass123!');
    assert.strictEqual(loginRes.success, true);
  });

  await test('4. Access Code: Lockout after 5 failed attempts', async () => {
    db._resetAccessCodeRateLimitState();
    await db.setAccessCode('112233');

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await db.verifyAccessCode('000000');
      assert.strictEqual(res.success, false);
      if (i < 4) {
        assert.strictEqual(res.isLockedOut, undefined);
      } else {
        assert.strictEqual(res.isLockedOut, true);
      }
    }

    // 6th attempt (even if correct) must be rejected
    const res6 = await db.verifyAccessCode('112233');
    assert.strictEqual(res6.success, false);
    assert.strictEqual(res6.isLockedOut, true);
    assert.ok(res6.error.includes('تم قفل'));

    // Reset and try correct one
    db._resetAccessCodeRateLimitState();
    const resValid = await db.verifyAccessCode('112233');
    assert.strictEqual(resValid.success, true);
  });

  await test('5. restoreDb: Reject active DB and invalid files', async () => {
    const activeDbPath = path.join(testDataDir, 'school-grades.db');
    
    // Test active DB rejection
    const resActive = await db.restoreDb(activeDbPath);
    assert.strictEqual(resActive.success, false);
    if (!resActive.error.includes('النشطة')) {
       console.log('DEBUG ACTIVE DB ERROR:', resActive.error);
    }
    assert.ok(resActive.error.includes('النشطة'));

    // Test non-existent file
    const resNone = await db.restoreDb(path.join(testDataDir, 'ghost.db'));
    assert.strictEqual(resNone.success, false);

    // Test empty file
    const emptyPath = path.join(testDataDir, 'empty.db');
    fs.writeFileSync(emptyPath, '');
    const resEmpty = await db.restoreDb(emptyPath);
    assert.strictEqual(resEmpty.success, false);
    assert.ok(resEmpty.error.includes('0 بايت'));

    // Test invalid format
    const invalidPath = path.join(testDataDir, 'invalid.db');
    fs.writeFileSync(invalidPath, 'NOT SQLITE');
    const resInvalid = await db.restoreDb(invalidPath);
    assert.strictEqual(resInvalid.success, false);
    assert.ok(resInvalid.error.includes('ليس قاعدة بيانات SQLite صالحة'));
    
    fs.unlinkSync(emptyPath);
    fs.unlinkSync(invalidPath);
  });

  await test('6. restoreDb: Success and Data Verification', async () => {
    // 1. Create a valid external DB to restore from
    const externalDbPath = path.join(testDataDir, 'external.db');
    const sqlite3 = require('sqlite3').verbose();
    
    await new Promise((resolve, reject) => {
      const ext = new sqlite3.Database(externalDbPath);
      ext.serialize(() => {
        // Create tables with FULL schema to avoid breaking other tests
        ext.run('CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, passwordHash TEXT, salt TEXT, role TEXT, isActive INTEGER, mustChangePassword INTEGER, createdAt TEXT, email TEXT, lastLogin TEXT)');
        ext.run('CREATE TABLE academic_years (id TEXT PRIMARY KEY, name TEXT, isCurrent INTEGER)');
        ext.run('CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT, stage TEXT, "order" INTEGER, academicYearId TEXT, isArchived INTEGER)');
        ext.run('CREATE TABLE sections (id TEXT PRIMARY KEY, classId TEXT, name TEXT)');
        ext.run('CREATE TABLE subjects (id TEXT PRIMARY KEY, classId TEXT, name TEXT, maxScore REAL, passScore REAL, "order" INTEGER)');
        ext.run('CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT, registrationNumber TEXT, fatherPhone TEXT, seatNumber INTEGER, academicYearId TEXT, classId TEXT, sectionId TEXT, gender TEXT, notes TEXT, status TEXT, isGeneralExempt INTEGER, individualExemptions TEXT)');
        ext.run('CREATE TABLE grades (id TEXT PRIMARY KEY, academicYearId TEXT, classId TEXT, sectionId TEXT, subjectId TEXT, studentId TEXT, term1Score REAL, midtermScore REAL, term2Score REAL, termYearlyScore REAL, finalExamScore REAL, finalScore REAL, lastUpdated TEXT)');
        ext.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)');
        
        // Seed some data
        ext.run('INSERT INTO students (id, name) VALUES (?, ?)', ['st-999', 'Restored Student']);
        ext.close((err: any) => err ? reject(err) : resolve(null));
      });
    });

    // 2. Perform restore
    const res = await db.restoreDb(externalDbPath);
    assert.strictEqual(res.success, true);

    // 3. Verify data
    const student = await db.get('SELECT name FROM students WHERE id = ?', ['st-999']);
    assert.ok(student);
    assert.strictEqual(student.name, 'Restored Student');

    fs.unlinkSync(externalDbPath);
  });

  await test('7. restoreDb: Rollback on Missing Tables', async () => {
    // 1. Save original student name
    const userId = `usr-orig-${Date.now()}`;
    await db.run('INSERT INTO users (id, username) VALUES (?, ?)', [userId, 'Original User']);

    // 2. Create an invalid DB (missing grades table)
    const invalidDbPath = path.join(testDataDir, 'missing_tables.db');
    const sqlite3 = require('sqlite3').verbose();
    await new Promise((resolve, reject) => {
      const ext = new sqlite3.Database(invalidDbPath);
      ext.serialize(() => {
        ext.run('CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT)');
        ext.close((err: any) => err ? reject(err) : resolve(null));
      });
    });

    // 3. Attempt restore
    const res = await db.restoreDb(invalidDbPath);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('يفتقر إلى الجداول'));

    // 4. Verify original data still exists (Rollback success)
    const original = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
    assert.ok(original);
    assert.strictEqual(original.username, 'Original User');

    fs.unlinkSync(invalidDbPath);
  });

  await test('8. restoreDb: Reject Corrupted SQLite File (Integrity Failure)', async () => {
    // 1. Create a valid DB then corrupt it
    const corruptDbPath = path.join(testDataDir, 'corrupt.db');
    const sqlite3 = require('sqlite3').verbose();
    await new Promise((resolve, reject) => {
      const ext = new sqlite3.Database(corruptDbPath);
      ext.serialize(() => {
        ext.run('CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT)');
        ext.run('CREATE TABLE grades (id TEXT PRIMARY KEY)');
        ext.close((err: any) => err ? reject(err) : resolve(null));
      });
    });

    // Overwrite some bytes to corrupt it
    const fd = fs.openSync(corruptDbPath, 'r+');
    fs.writeSync(fd, Buffer.from('CORRUPT_BYTES'), 0, 13, 100);
    fs.closeSync(fd);

    // 2. Attempt restore
    const res = await db.restoreDb(corruptDbPath);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('تالف') || res.error.includes('integrity_check'));

    fs.unlinkSync(corruptDbPath);
  });

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDbIntegrationTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
