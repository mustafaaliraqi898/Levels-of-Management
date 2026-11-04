// electron/session-manager.cjs
const crypto = require('crypto');

// Map to store active sessions per webContents ID (session isolation)
const activeSessions = new Map(); // webContents.id -> session

function validateSender(event) {
  const frame = event.senderFrame;
  if (!frame) return false;
  const urlString = frame.url;

  try {
    const parsedUrl = new URL(urlString);

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // Strictly allow only local dev server
      return (
        parsedUrl.protocol === 'http:' &&
        parsedUrl.hostname === 'localhost' &&
        parsedUrl.port === '3000' &&
        !parsedUrl.username &&
        !parsedUrl.password
      );
    }

    // In production, strictly allow only the app's local index file
    return (
      parsedUrl.protocol === 'file:' &&
      (parsedUrl.pathname.endsWith('/dist/index.html') || parsedUrl.pathname.endsWith('/index.html')) &&
      !parsedUrl.host &&
      !parsedUrl.username &&
      !parsedUrl.password
    );
  } catch (e) {
    return false;
  }
}

function getSession(webContentsId) {
  return activeSessions.get(webContentsId);
}

function createSession(webContentsId, user) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    user,
    token,
    loginTime: new Date().toISOString()
  };
  activeSessions.set(webContentsId, session);
  return session;
}

function clearSession(webContentsId) {
  activeSessions.delete(webContentsId);
  return true;
}

function requireAuth(event) {
  if (!validateSender(event)) {
    throw new Error('Unauthorized sender origin');
  }
  const session = activeSessions.get(event.sender.id);
  if (!session || !session.user) {
    throw new Error('عفواً، يجب تسجيل الدخول للقيام بهذه العملية.');
  }
  return session;
}

function requireAdminRole(event) {
  const session = requireAuth(event);
  if (session.user.role !== 'admin') {
    throw new Error('عفواً، هذه العملية مرفوضة أمنياً: حساب المعاينة للقراءة فقط ولا يملك صلاحية تعديل قاعدة البيانات SQLite.');
  }
  return session;
}

module.exports = {
  activeSessions,
  validateSender,
  getSession,
  createSession,
  clearSession,
  requireAuth,
  requireAdminRole
};
