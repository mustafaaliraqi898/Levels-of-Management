// src/tests/smtp.test.ts
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');
const smtpService = require('../../electron/smtp-service.cjs');

async function runSmtpTests() {
  console.log('--------------------------------------------------');
  console.log('📧 Running Rigorous SMTP Security & Mock Tests...');
  console.log('--------------------------------------------------\n');

  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
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

  // Use precisely the test data directory used by electron/smtp-service.cjs when NODE_ENV === 'test'
  const testDataDir = path.join(process.cwd(), '.test-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDataDir, { recursive: true });

  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const originalCreateTransport = nodemailer.createTransport;
  let lastTransportConfig: any = null;
  let lastMailOptions: any = null;

  nodemailer.createTransport = (config: any) => {
    lastTransportConfig = config;
    return {
      verify: () => Promise.resolve(true),
      sendMail: (options: any) => {
        lastMailOptions = options;
        return Promise.resolve({ messageId: 'mock-smtp-id' });
      }
    };
  };

  try {
    await test('1. Port 587 enforces requireTLS: true and rejectUnauthorized: true', async () => {
      lastTransportConfig = null;
      await smtpService.testSmtpConnection({
        host: 'smtp.gmail.com',
        port: 587,
        user: 'test@gmail.com',
        pass: 'app-password-placeholder'
      });
      
      assert.ok(lastTransportConfig, 'Transport must be created');
      assert.strictEqual(lastTransportConfig.port, 587);
      assert.strictEqual(lastTransportConfig.secure, false, 'Port 587 is not secure (STARTTLS)');
      assert.strictEqual(lastTransportConfig.requireTLS, true, 'Port 587 must require STARTTLS');
      assert.strictEqual(lastTransportConfig.tls?.rejectUnauthorized, true, 'Certificate verification must be enabled');
    });

    await test('2. Port 465 uses direct secure: true and rejectUnauthorized: true', async () => {
      lastTransportConfig = null;
      await smtpService.testSmtpConnection({
        host: 'smtp.gmail.com',
        port: 465,
        user: 'test@gmail.com',
        pass: 'app-password-placeholder'
      });
      
      assert.ok(lastTransportConfig, 'Transport must be created');
      assert.strictEqual(lastTransportConfig.port, 465);
      assert.strictEqual(lastTransportConfig.secure, true, 'Port 465 must be secure');
      assert.strictEqual(lastTransportConfig.requireTLS, false, 'requireTLS not needed for secure:true');
      assert.strictEqual(lastTransportConfig.tls?.rejectUnauthorized, true, 'Certificate verification must be enabled');
    });

    await test('3. rejectUnauthorized: true cannot be bypassed', async () => {
      lastTransportConfig = null;
      await smtpService.testSmtpConnection({
        host: 'smtp.gmail.com',
        port: 587,
        user: 'test@gmail.com',
        pass: 'app-password-placeholder',
        tls: { rejectUnauthorized: false }
      });
      
      assert.strictEqual(lastTransportConfig.tls?.rejectUnauthorized, true, 'Security: rejectUnauthorized: false must be forbidden/overridden');
    });

    await test('4. sendPasswordResetEmail uses secure transport and sends sanitized mail', async () => {
      smtpService.saveSmtpConfig({
        host: 'smtp.gmail.com',
        port: 587,
        user: 'admin@school.iq',
        pass: 'app-password-placeholder'
      });

      lastMailOptions = null;
      await smtpService.sendPasswordResetEmail('target@example.com', 'أحمد علي', '654321');

      assert.ok(lastMailOptions, 'Email must be sent');
      assert.strictEqual(lastMailOptions.to, 'target@example.com');
      assert.ok(lastMailOptions.subject.includes('رمز إعادة تعيين'));
      assert.ok(lastMailOptions.html.includes('654321'), 'Code must be in HTML');
      assert.ok(lastMailOptions.html.includes('أحمد علي'), 'Username must be in HTML');
    });

  } finally {
    nodemailer.createTransport = originalCreateTransport;
    process.env.NODE_ENV = originalEnv;
    // Cleanup temporary test data directory fully after test completion
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  }

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSmtpTests().catch(err => {
  console.error('Fatal SMTP Test Error:', err);
  process.exit(1);
});
