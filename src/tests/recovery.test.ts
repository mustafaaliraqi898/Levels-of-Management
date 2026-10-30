process.env.NODE_ENV = 'test';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Polyfill electron app before requiring modules if running under Node CLI
try {
  const electron = require('electron');
  if (!electron.app) {
    electron.app = { getPath: () => '/tmp/school_test' };
  }
  // Mock safeStorage for container unit tests
  electron.safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string) => Buffer.from(plainText, 'utf8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf8'),
  };
} catch {
  // ignore
}

// In-memory mock DB table for unit test execution in Linux container
const mockUsers = new Map<string, any>();
const mockDb = {
  get: async (sql: string, params: any[]) => {
    if (sql.includes('users WHERE LOWER(username)')) {
      const targetUser = (params[0] || '').toLowerCase();
      return mockUsers.get(targetUser) || null;
    }
    return null;
  },
  run: async (sql: string, params: any[]) => {
    if (sql.includes('UPDATE users SET passwordHash')) {
      const [newHash, newSalt, userId] = params;
      for (const [uname, uObj] of mockUsers.entries()) {
        if (uObj.id === userId) {
          uObj.passwordHash = newHash;
          uObj.salt = newSalt;
          uObj.mustChangePassword = 0;
        }
      }
    } else if (sql.includes('INSERT OR REPLACE INTO users')) {
      const [id, username, passwordHash, salt, role, isActive, mustChangePassword, createdAt, email] = params;
      mockUsers.set(username.toLowerCase(), {
        id,
        username,
        passwordHash,
        salt,
        role,
        isActive,
        mustChangePassword,
        createdAt,
        email,
      });
    }
    return { success: true };
  },
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ TEST FAILED: ${message}`);
  }
  console.log(`  ✅ PASSED: ${message}`);
}

async function runRecoveryTests() {
  console.log('--------------------------------------------------');
  console.log('📧 Running Gmail SMTP Password Recovery Test Suite...');
  console.log('--------------------------------------------------');

  // Load db module and attach mockDb for container test
  const db = require('../../electron/database.cjs');
  db.get = mockDb.get;
  db.run = mockDb.run;

  // Load services
  const resetService = require('../../electron/reset-service.cjs');
  const smtpService = require('../../electron/smtp-service.cjs');

  // 1. Check code generation length and format
  const testCode = resetService.generateSecure6DigitCode();
  assert(/^\d{6}$/.test(testCode), 'توليد رمز أمان عشوائي مكون من 6 أرقام بالضبط');

  // 2. Check hashing helper
  const hash1 = resetService.hashCode('123456');
  const hash2 = resetService.hashCode('123456');
  assert(hash1 === hash2 && hash1.length === 64, 'تشفير رمز التحقق باستخدام بصمة SHA-256 آمنة');

  // 3. Configure mock/dummy SMTP for testing
  smtpService.saveSmtpConfig({
    user: 'test.admin@gmail.com',
    pass: 'abcd efgh ijkl mnop',
    host: 'smtp.gmail.com',
    port: 587,
  });
  assert(smtpService.isSmtpConfigured() === true, 'التحقق من حالة تهيئة خادم Gmail SMTP');

  // Seed test user
  const username = 'testadmin_recovery';
  const initialSalt = resetService.generateSaltNode(16);
  const initialHash = resetService.hashPasswordNode('OldAdminPass123', initialSalt);
  await mockDb.run(
    `INSERT OR REPLACE INTO users (id, username, passwordHash, salt, role, isActive, mustChangePassword, createdAt, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['usr-test-recovery-1', username, initialHash, initialSalt, 'admin', 1, 0, new Date().toISOString(), 'test.admin@gmail.com']
  );

  // Intercept SMTP send so we don't actually hit external network during unit test
  const originalSendEmail = smtpService.sendPasswordResetEmail;
  let lastSentCode = '';
  smtpService.sendPasswordResetEmail = async (toEmail: string, uName: string, code: string) => {
    lastSentCode = code;
    return { success: true };
  };

  // 4. Test rate limiting
  resetService.resetTokens.clear();

  // Test 1st, 2nd, 3rd requests
  const req1 = await resetService.requestPasswordResetCode(username);
  assert(req1.success === true, 'الطلب الأول لإرسال رمز التحقق ينجح');
  const code1 = lastSentCode;

  const req2 = await resetService.requestPasswordResetCode(username);
  assert(req2.success === true, 'الطلب الثاني لإرسال رمز جديد ينجح ويبطل الرمز السابق');
  const code2 = lastSentCode;
  assert(code1 !== code2, 'الرمز الجديد يختلف عن الرمز الأول المبطَل');

  const req3 = await resetService.requestPasswordResetCode(username);
  assert(req3.success === true, 'الطلب الثالث ضمن 15 دقيقة ينجح');

  const req4 = await resetService.requestPasswordResetCode(username);
  assert(req4.success === false && req4.error?.includes('تجاوز عدد طلبات'), 'الطلب الرابع يُرفض بناءً على معدل التكرار (Rate Limit: 3 طلبات/15 دقيقة)');

  // 5. Reset tokens for verification tests
  resetService.resetTokens.clear();
  await resetService.requestPasswordResetCode(username);
  const activeCode = lastSentCode;

  // 6. Verify wrong code decreases attempt limit
  const wrongRes = await resetService.verifyResetCodeAndChangePassword(username, '000000', 'NewPass123!');
  assert(wrongRes.success === false && wrongRes.error?.includes('المحاولات المتبقية: 4'), 'إدخال رمز خاطئ يقلل عدد المحاولات المتبقية (4 من 5)');

  // 7. Verify password too short
  const shortPassRes = await resetService.verifyResetCodeAndChangePassword(username, activeCode, '123');
  assert(shortPassRes.success === false && shortPassRes.error?.includes('6 خانات'), 'رفض كلمة المرور الجديدة إن كانت أقل من 6 خانات');

  // 8. Verify valid code resets password
  const validRes = await resetService.verifyResetCodeAndChangePassword(username, activeCode, 'NewPass123!');
  assert(validRes.success === true, 'تأكيد الرمز صحيح وإعادة تعيين كلمة المرور بنجاح');

  // 9. Verify single-use enforcement (re-using same code must fail)
  const reuseRes = await resetService.verifyResetCodeAndChangePassword(username, activeCode, 'AnotherPass123!');
  assert(reuseRes.success === false, 'إبطال الرمز فور استخدامه ومنع إعادة الاستخدام مرة أخرى (Single-Use)');

  // 10. Verify updated password hash in SQLite
  const updatedUser = await mockDb.get("SELECT * FROM users WHERE LOWER(username) = ?", [username]);
  const newHashCalc = resetService.hashPasswordNode('NewPass123!', updatedUser.salt);
  assert(updatedUser.passwordHash === newHashCalc, 'تحديث كلمة المرور المشفرة مع الملح في قاعدة البيانات بنجاح');

  // Restore original SMTP method
  smtpService.sendPasswordResetEmail = originalSendEmail;

  console.log('--------------------------------------------------');
  console.log('📊 All Gmail SMTP Recovery Tests Passed Successfully!');
  console.log('--------------------------------------------------');
}

runRecoveryTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
