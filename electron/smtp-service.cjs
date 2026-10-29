const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getSmtpConfigFile() {
  const userDataPath = (app && typeof app.getPath === 'function') ? app.getPath('userData') : '/tmp/school_app_userData';
  if (!fs.existsSync(userDataPath)) {
    try { fs.mkdirSync(userDataPath, { recursive: true }); } catch { /* ignore */ }
  }
  return path.join(userDataPath, 'smtp-config.json');
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
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || fileConfig.pass || '';
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
    pass: (config.pass !== undefined ? config.pass : current.pass).trim(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf8');
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
      const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
      maskedEmail = `${maskedLocal}@${parts[1]}`;
    }
  }

  return {
    isConfigured,
    host: config.host,
    port: config.port,
    userEmail: maskedEmail,
    rawEmail: config.user,
  };
}

async function testSmtpConnection(testConfig) {
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
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
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
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 12000,
    });

    const mailOptions = {
      from: `"نظام إدارة الدرجات المدرسية" <${config.user}>`,
      to: toEmail,
      subject: `رمز تحقق استعادة كلمة المرور - (${code})`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #10b981; margin-top: 0; text-align: center;">نظام إدارة الدرجات المدرسية</h2>
          <hr style="border: none; border-top: 1px solid #334155; margin: 16px 0;" />
          <p style="font-size: 14px; line-height: 1.6;">مرحباً <strong>${username}</strong>،</p>
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
