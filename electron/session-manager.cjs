// electron/session-manager.cjs
const crypto = require('crypto');

const path = require('path');
const url = require('url');

// Map to store active sessions per webContents ID (session isolation)
const activeSessions = new Map(); // webContents.id -> session

// Computed canonical production file path: <project_root>/dist/index.html
const EXPECTED_PROD_PATH = path.resolve(__dirname, '../dist/index.html');

function validateSender(event, customExpectedProdPath) {
  if (!event || !event.senderFrame) return false;
  const urlString = event.senderFrame.url;
  if (!urlString || typeof urlString !== 'string') return false;

  try {
    const parsedUrl = new URL(urlString);

    // Reject any query strings or URL hashes to prevent tampering or sub-resource trickery
    if (parsedUrl.search && parsedUrl.search !== '') {
      return false;
    }
    if (parsedUrl.hash && parsedUrl.hash !== '') {
      return false;
    }

    if (process.env.NODE_ENV === 'development') {
      // Strictly allow only local dev server
      return (
        parsedUrl.protocol === 'http:' &&
        parsedUrl.hostname === 'localhost' &&
        parsedUrl.port === '3000' &&
        !parsedUrl.username &&
        !parsedUrl.password &&
        (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html')
      );
    }

    // In production (and test environments checking production URLs)
    if (parsedUrl.protocol !== 'file:') {
      return false;
    }

    // Reject remote file URLs with host (e.g. file://evil-host/share) or credentials
    if (parsedUrl.host || parsedUrl.username || parsedUrl.password) {
      return false;
    }

    // Convert file: URL to actual filesystem path to normalize drive letters and slashes across Windows and POSIX
    let filePath;
    try {
      filePath = url.fileURLToPath(parsedUrl.href);
    } catch {
      return false;
    }

    // Normalize paths (case-insensitive on Windows)
    const targetExpected = customExpectedProdPath ? path.resolve(customExpectedProdPath) : EXPECTED_PROD_PATH;
    const normalizedFilePath = path.normalize(filePath);
    const normalizedExpected = path.normalize(targetExpected);

    if (process.platform === 'win32') {
      return normalizedFilePath.toLowerCase() === normalizedExpected.toLowerCase();
    }
    return normalizedFilePath === normalizedExpected;
  } catch (e) {
    return false;
  }
}

function handleWindowClosed(webContentsId) {
  if (webContentsId !== undefined && webContentsId !== null) {
    activeSessions.delete(webContentsId);
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

function clearSessionsByUserId(userId) {
  if (!userId) return 0;
  let clearedCount = 0;
  for (const [webContentsId, session] of activeSessions.entries()) {
    if (session && session.user && session.user.id === userId) {
      activeSessions.delete(webContentsId);
      clearedCount++;
    }
  }
  return clearedCount;
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
  EXPECTED_PROD_PATH,
  validateSender,
  handleWindowClosed,
  getSession,
  createSession,
  clearSession,
  clearSessionsByUserId,
  requireAuth,
  requireAdminRole
};
