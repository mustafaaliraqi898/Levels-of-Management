const crypto = require('crypto');
const db = require('./database.cjs');
const smtpService = require('./smtp-service.cjs');

// In-memory store for active password reset tokens
// Key: username (lowercase, trimmed)
// Value: { hashedCode: string, expiresAt: number, attemptsLeft: number, requestTimestamps: number[] }
const resetTokens = new Map();

function generateSecure6DigitCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function hashPasswordNode(password, salt) {
  return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
}

function generateSaltNode(length = 16) {
  return crypto.randomBytes(length).toString('hex').slice(0, length * 2);
}

async function requestPasswordResetCode(usernameInput) {
  const username = (usernameInput || '').trim().toLowerCase();
  if (!username) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم.' };
  }

  // 1. Check SMTP status first
  if (!smtpService.isSmtpConfigured()) {
    return {
      success: false,
      error: 'خدمة إرسال البريد الإلكتروني (SMTP) غير مجهزة في النظام حالياً. يرجى تهيئة إعدادات البريد الإلكتروني أولاً من قِبل مدير النظام.',
    };
  }

  // 2. Check Rate Limit (max 3 requests per 15 minutes)
  const now = Date.now();
  const existingToken = resetTokens.get(username);
  const fifteenMinutesAgo = now - 15 * 60 * 1000;
  const recentRequests = existingToken && existingToken.requestTimestamps
    ? existingToken.requestTimestamps.filter(t => t > fifteenMinutesAgo)
    : [];

  if (recentRequests.length >= 3) {
    return {
      success: false,
      error: 'تم تجاوز عدد طلبات الاستعادة المسموح بها (3 طلبات خلال 15 دقيقة). يرجى الانتظار والمحاولة لاحقاً.',
    };
  }

  // 3. Find User in SQLite Database
  let user = null;
  try {
    user = await db.get("SELECT * FROM users WHERE LOWER(username) = ?", [username]);
  } catch (err) {
    console.error('Error fetching user for password reset:', err);
  }

  const genericMsg = 'إذا كان اسم المستخدم صحيحاً ومسجلاً له بريد إلكتروني، فسيتم إرسال رمز التحقق إلى بريده الإلكتروني.';

  // If user does not exist, is inactive, or has no email: return generic message without sending email
  if (!user || user.isActive === 0 || !user.email || !user.email.trim()) {
    return {
      success: true,
      message: genericMsg,
    };
  }

  const trustedEmail = user.email.trim();

  // 4. Generate 6-digit code and token
  const code = generateSecure6DigitCode();
  const hashed = hashCode(code);
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes lifetime
  const attemptsLeft = 5;

  // Invalidate previous code and store new token
  resetTokens.set(username, {
    hashedCode: hashed,
    expiresAt,
    attemptsLeft,
    requestTimestamps: [...recentRequests, now],
  });

  // 5. Send Real SMTP Email to Trusted Registered Email
  const sendRes = await smtpService.sendPasswordResetEmail(trustedEmail, user.username, code);
  if (!sendRes.success) {
    // Delete token if sending failed
    const current = resetTokens.get(username);
    if (current) {
      resetTokens.set(username, {
        ...current,
        hashedCode: '',
        expiresAt: 0,
      });
    }
    return {
      success: false,
      error: sendRes.error || 'تعذر إرسال البريد الإلكتروني. يرجى التأكد من الاتصال بالإنترنت وصحة إعدادات البريد.',
    };
  }

  // Mask email for safe user display (e.g., m***a@gmail.com)
  const emailParts = trustedEmail.split('@');
  const localPart = emailParts[0];
  const domainPart = emailParts[1] || '';
  const maskedLocal = localPart.length > 2
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : `${localPart[0]}***`;
  const maskedEmail = `${maskedLocal}@${domainPart}`;

  return {
    success: true,
    maskedEmail,
    message: `تم إرسال رمز التحقق المكون من 6 أرقام بنجاح إلى البريد الإلكتروني الموثوق المسجل بالحساب (${maskedEmail}). الرمز صالح لمدة 5 دقائق.`,
  };
}

async function verifyResetCodeAndChangePassword(usernameInput, codeInput, newPasswordInput) {
  const username = (usernameInput || '').trim().toLowerCase();
  const code = (codeInput || '').trim();
  const newPassword = newPasswordInput || '';

  if (!username || !code) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم ورمز التحقق.' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات/أحرف.' };
  }

  const token = resetTokens.get(username);
  if (!token || !token.hashedCode) {
    return {
      success: false,
      error: 'لا يوجد طلب استعادة فعال لهذا الحساب أو تم إلغاؤه. يرجى طلب رمز جديد.',
    };
  }

  // Check expiration (5 minutes)
  if (Date.now() > token.expiresAt) {
    resetTokens.delete(username);
    return {
      success: false,
      error: 'انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب رمز جديد.',
    };
  }

  // Check attempts limit (max 5)
  if (token.attemptsLeft <= 0) {
    resetTokens.delete(username);
    return {
      success: false,
      error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم إلغاء الرمز، يرجى طلب رمز جديد.',
    };
  }

  // Verify Code Hash
  const inputHashed = hashCode(code);
  if (inputHashed !== token.hashedCode) {
    token.attemptsLeft -= 1;
    if (token.attemptsLeft <= 0) {
      resetTokens.delete(username);
      return {
        success: false,
        error: 'رمز التحقق غير صحيح. تم استنفاد المحاولات وإلغاء الرمز، يرجى طلب رمز جديد.',
      };
    }
    return {
      success: false,
      error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${token.attemptsLeft}`,
    };
  }

  // Code is valid! Update password in SQLite Database
  const user = await db.get("SELECT * FROM users WHERE LOWER(username) = ?", [username]);
  if (!user) {
    resetTokens.delete(username);
    return { success: false, error: 'حساب المستخدم غير موجود.' };
  }

  const newSalt = generateSaltNode(16);
  const newHash = hashPasswordNode(newPassword, newSalt);

  await db.run(
    "UPDATE users SET passwordHash = ?, salt = ?, mustChangePassword = 0 WHERE id = ?",
    [newHash, newSalt, user.id]
  );

  // Invalidate reset code immediately after single use
  resetTokens.delete(username);

  return {
    success: true,
    message: 'تم إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.',
  };
}

module.exports = {
  requestPasswordResetCode,
  verifyResetCodeAndChangePassword,
  // Exported for internal testing
  resetTokens,
  generateSecure6DigitCode,
  hashCode,
  hashPasswordNode,
  generateSaltNode,
};
