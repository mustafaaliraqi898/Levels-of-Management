// src/tests/smtp.test.ts
import assert from 'node:assert';
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

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res.then(() => {
          console.log(`  ✅ PASSED: ${name}`);
          passedCount++;
        }).catch(err => {
          console.error(`  ❌ FAILED: ${name}`);
          console.error(`     ${err.stack || err.message}\n`);
          failedCount++;
        });
      } else {
        console.log(`  ✅ PASSED: ${name}`);
        passedCount++;
      }
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     ${err.stack || err.message}\n`);
      failedCount++;
    }
  }

  const originalCreateTransport = nodemailer.createTransport;
  let lastTransportConfig: any = null;
  let lastMailOptions: any = null;

  // Mock nodemailer
  nodemailer.createTransport = (config: any) => {
    lastTransportConfig = config;
    return {
      verify: () => Promise.resolve(true),
      sendMail: (options: any) => {
        lastMailOptions = options;
        return Promise.resolve({ messageId: 'mock-id' });
      }
    };
  };

  try {
    await test('1. Port 587 enforces requireTLS: true', async () => {
      lastTransportConfig = null;
      await smtpService.testSmtpConnection({
        host: 'smtp.gmail.com',
        port: 587,
        user: 'test@gmail.com',
        pass: 'somepass'
      });
      
      assert.ok(lastTransportConfig, 'Transport must be created');
      assert.strictEqual(lastTransportConfig.port, 587);
      assert.strictEqual(lastTransportConfig.secure, false, 'Port 587 is not secure (STARTTLS)');
      assert.strictEqual(lastTransportConfig.requireTLS, true, 'Port 587 must require TLS');
      assert.strictEqual(lastTransportConfig.tls?.rejectUnauthorized, true, 'Certificate verification must be enabled');
    });

    await test('2. Port 465 uses direct secure: true', async () => {
      lastTransportConfig = null;
      await smtpService.testSmtpConnection({
        host: 'smtp.gmail.com',
        port: 465,
        user: 'test@gmail.com',
        pass: 'somepass'
      });
      
      assert.ok(lastTransportConfig, 'Transport must be created');
      assert.strictEqual(lastTransportConfig.port, 465);
      assert.strictEqual(lastTransportConfig.secure, true, 'Port 465 must be secure');
      assert.strictEqual(lastTransportConfig.requireTLS, false, 'requireTLS not needed for secure:true');
      assert.strictEqual(lastTransportConfig.tls?.rejectUnauthorized, true, 'Certificate verification must be enabled');
    });

    await test('3. rejectUnauthorized: true is always enforced regardless of config input', async () => {
      lastTransportConfig = null;
      // Even if user tries to pass an insecure config (though the UI doesn't allow it, the IPC might)
      await smtpService.testSmtpConnection({
        host: 'smtp.gmail.com',
        port: 587,
        user: 'test@gmail.com',
        pass: 'somepass',
        tls: { rejectUnauthorized: false } // Attempted bypass
      });
      
      assert.strictEqual(lastTransportConfig.tls?.rejectUnauthorized, true, 'Security: rejectUnauthorized: false must be overridden/disallowed');
    });

    await test('4. sendPasswordResetEmail uses correct transport and mail options', async () => {
      // Setup mock config in file
      process.env.NODE_ENV = 'test';
      smtpService.saveSmtpConfig({
        host: 'smtp.gmail.com',
        port: 587,
        user: 'admin@school.iq',
        pass: 'adminpass123'
      });

      lastMailOptions = null;
      await smtpService.sendPasswordResetEmail('target@example.com', 'أحمد علي', '123456');

      assert.ok(lastMailOptions, 'Email must be sent');
      assert.strictEqual(lastMailOptions.to, 'target@example.com');
      assert.ok(lastMailOptions.subject.includes('رمز إعادة تعيين'));
      assert.ok(lastMailOptions.html.includes('123456'), 'Code must be in HTML');
      assert.ok(lastMailOptions.html.includes('أحمد علي'), 'Username must be in HTML');
      assert.ok(lastMailOptions.from.includes('admin@school.iq'), 'Sender must be the configured user');
    });

  } finally {
    // Restore original
    nodemailer.createTransport = originalCreateTransport;
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
