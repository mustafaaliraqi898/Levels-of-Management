const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
let electron = null;
if (process.versions && process.versions.electron) {
  try {
    electron = require('electron');
  } catch {
    // Fallback
  }
}
const app = electron ? electron.app : null;
const safeStorage = electron ? electron.safeStorage : null;

const os = require('os');

function getSmtpConfigFile() {
  let userDataPath;
  if (app && typeof app.getPath === 'function') {
    try {
      userDataPath = app.getPath('userData');
    } catch {
      userDataPath = path.join(os.homedir(), '.school-app-data');
    }
  } else if (process.env.NODE_ENV === 'test') {
    userDataPath = path.join(process.cwd(), '.test-data');
  } else {
    userDataPath = path.join(os.homedir(), '.school-app-data');
  }

  if (!fs.existsSync(userDataPath)) {
    try {
      fs.mkdirSync(userDataPath, { recursive: true, mode: 0o700 });
    } catch { /* ignore */ }
  }

  const targetFile = path.join(userDataPath, 'smtp-config.json');
  const legacyFile = path.join('/tmp', 'school_app_userData', 'smtp-config.json');

  if (!fs.existsSync(targetFile) && fs.existsSync(legacyFile)) {
    try {
      fs.copyFileSync(legacyFile, targetFile);
      fs.chmodSync(targetFile, 0o600);
    } catch (e) {
      console.error('Failed to migrate legacy SMTP config:', e);
    }
  }

  return targetFile;
}

/**
 * Safely decrypt a password string if it's encrypted.
 */
function decryptPassword(encryptedHex) {
  if (!encryptedHex) return '';
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedHex, 'hex');
      return safeStorage.decryptString(buffer);
    } catch (e) {
      console.error('Failed to decrypt SMTP password:', e.message);
      return '';
    }
  }
  // Fallback for container unit tests
  if (process.env.NODE_ENV === 'test') {
    return Buffer.from(encryptedHex, 'hex').toString('utf8');
  }
  return '';
}

/**
 * Safely encrypt a password string.
 */
function encryptPassword(plainText) {
  if (!plainText) return '';
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = safeStorage.encryptString(plainText);
      return buffer.toString('hex');
    } catch (e) {
      console.error('Failed to encrypt SMTP password:', e.message);
      return '';
    }
  }
  // Fallback for container unit tests
  if (process.env.NODE_ENV === 'test') {
    return Buffer.from(plainText, 'utf8').toString('hex');
  }
  return '';
}

function loadSmtpConfig() {
  const configFile = getSmtpConfigFile();
  let fileConfig = {};
  if (fs.existsSync(configFile)) {
    try {
      const content = fs.readFileSync(configFile, 'utf8');
      fileConfig = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse smtp-config.json:', e);
    }
  }

  // Priority: environment variables -> configFile
  const user = process.env.GMAIL_USER || fileConfig.user || '';
  
  // Use environment variable if present, otherwise decrypt from file
  let pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || '';
  if (!pass && fileConfig.encryptedPass) {
    pass = decryptPassword(fileConfig.encryptedPass);
  } else if (!pass && fileConfig.pass) {
    // Legacy support for plain text (if any exists), though we aim to eliminate it
    pass = fileConfig.pass;
  }

  const host = process.env.GMAIL_HOST || fileConfig.host || 'smtp.gmail.com';
  const port = parseInt(process.env.GMAIL_PORT || fileConfig.port || '587', 10);
  const secure = fileConfig.secure !== undefined ? fileConfig.secure : (port === 465);

  return { host, port, secure, user, pass };
}

function saveSmtpConfig(config) {
  const configFile = getSmtpConfigFile();
  const current = loadSmtpConfig();
  
  const updated = {
    host: config.host || 'smtp.gmail.com',
    port: parseInt(config.port || '587', 10),
    secure: config.port === 465 || config.secure === true,
    user: (config.user !== undefined ? config.user : current.user).trim(),
    updatedAt: new Date().toISOString(),
  };

  // Encrypt password before saving
  const plainPass = (config.pass !== undefined ? config.pass : current.pass).trim();
  if (plainPass) {
    updated.encryptedPass = encryptPassword(plainPass);
  }

  // Never save plain text 'pass' to file and set mode 0o600
  fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), { encoding: 'utf8', mode: 0o600 });
  return { success: true };
}

function isSmtpConfigured() {
  const config = loadSmtpConfig();
  return Boolean(config.user && config.pass);
}

function getSmtpStatus() {
  const config = loadSmtpConfig();
  const isConfigured = Boolean(config.user && config.pass);
  let maskedEmail = '';
  if (config.user) {
    const parts = config.user.split('@');
    if (parts.length === 2) {
      const local = parts[0];
      const maskedLocal = local.length > 2 ? `${local[0]}•••••${local[local.length - 1]}` : `${local[0]}•••••`;
      maskedEmail = `${maskedLocal}@${parts[1]}`;
    }
  }

  // CRITICAL: NEVER return config.pass or rawEmail secrets to Renderer via IPC
  return {
    isConfigured,
    host: config.host,
    port: config.port,
    userEmail: maskedEmail,
  };
}

async function testSmtpConnection(testConfig) {
  // Use passed config for testing new credentials before saving, or load existing
  const config = testConfig ? {
    host: testConfig.host || 'smtp.gmail.com',
    port: parseInt(testConfig.port || '587', 10),
    secure: testConfig.port === 465 || testConfig.secure === true,
    user: testConfig.user ? testConfig.user.trim() : '',
    pass: testConfig.pass ? testConfig.pass.trim() : '',
  } : loadSmtpConfig();

  if (!config.user || !config.pass) {
    return { success: false, error: 'عنوان البريد الإلكتروني وكلمة مرور التطبيق (App Password) مطلوبان لتهيئة الاتصال.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure, // Ensure STARTTLS is used if not using explicit TLS
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: true, // Strictly enforce certificate verification
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();
    return { success: true, message: 'تم الاتصال بخدمة Gmail SMTP واختبار الاعتماد بنجاح!' };
  } catch (err) {
    let errorMsg = 'تعذر الاتصال برابط SMTP.';
    if (err.code === 'EAUTH' || (err.message && err.message.includes('Invalid login'))) {
      errorMsg = 'فشل المصادقة مع Gmail: يرجى التأكد من اسم المستخدم وكلمة مرور التطبيقات (App Password) المكونة من 16 حرفاً.';
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      errorMsg = 'تعذر الوصول إلى خادم Gmail SMTP: يرجى التأكد من الاتصال بالإنترنت وعدم حظر المنفذ 587.';
    } else if (err.message) {
      errorMsg = `خطأ في الاتصال: ${err.message}`;
    }
    return { success: false, error: errorMsg };
  }
}

async function sendPasswordResetEmail(toEmail, username, code) {
  const config = loadSmtpConfig();
  if (!config.user || !config.pass) {
    return { success: false, error: 'خدمة البريد الإلكتروني غير مجهزة في النظام.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: true,
      },
      connectionTimeout: 12000,
    });

    const safeUsername = String(username || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const mailOptions = {
      from: `"نظام إدارة الدرجات المدرسية" <${config.user}>`,
      to: toEmail,
      subject: 'رمز إعادة تعيين كلمة المرور - نظام إدارة الدرجات المدرسية',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #10b981; margin-top: 0; text-align: center;">نظام إدارة الدرجات المدرسية</h2>
          <hr style="border: none; border-top: 1px solid #334155; margin: 16px 0;" />
          <p style="font-size: 14px; line-height: 1.6;">مرحباً <strong>${safeUsername}</strong>،</p>
          <p style="font-size: 14px; line-height: 1.6;">تم استلام طلب لإعادة تعيين كلمة المرور لحسابك. رمز التحقق الخاص بك هو:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #34d399; background-color: #1e293b; padding: 12px 24px; border-radius: 12px; border: 1px solid #059669; display: inline-block;">
              ${code}
            </span>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; text-align: center;">
            * هذا الرمز صالح لمدة <strong>5 دقائق</strong> فقط للاستخدام لمرة واحدة.<br/>
            * الحد الأقصى للمحاولات الخاطئة هو 5 محاولات.<br/>
            * إذا لم تطلب هذا الرمز، يرجى يتجاهل هذه الرسالة.
          </p>
          <hr style="border: none; border-top: 1px solid #334155; margin: 16px 0;" />
          <p style="font-size: 11px; color: #64748b; text-align: center; margin-bottom: 0;">
            هذه رسالة تلقائية صادرة من نظام إدارة الدرجات المدرسية المحلي.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    let errorMsg = 'تعذر إرسال البريد الإلكتروني.';
    if (err.code === 'EAUTH') {
      errorMsg = 'فشل المصادقة مع Gmail. يرجى التحقق من كلمة مرور التطبيق (App Password).';
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      errorMsg = 'تعذر الاتصال بالإنترنت لإرسال البريد الإلكتروني. يرجى التأكد من شبكة الاتصال.';
    } else if (err.message) {
      errorMsg = `فشل إرسال البريد: ${err.message}`;
    }
    return { success: false, error: errorMsg };
  }
}

module.exports = {
  loadSmtpConfig,
  saveSmtpConfig,
  isSmtpConfigured,
  getSmtpStatus,
  testSmtpConnection,
  sendPasswordResetEmail,
};

