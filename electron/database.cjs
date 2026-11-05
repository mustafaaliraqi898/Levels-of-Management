let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.warn('SQLite3 native addon omitted in container execution environment:', e.message);
}

const path = require('path');
let app = null;
if (process.versions && process.versions.electron) {
  try {
    app = require('electron').app;
  } catch {
    // Fallback
  }
}
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const sessionManager = require('./session-manager.cjs');

function resolveUserDataPath() {
  if (app && typeof app.getPath === 'function') {
    try {
      return app.getPath('userData');
    } catch {
      // Fallback if app.getPath fails
    }
  }
  if (process.env.NODE_ENV === 'test') {
    return path.join(process.cwd(), '.test-data');
  }
  return path.join(os.homedir(), '.school-app-data');
}

function verifyDatabaseMigrationSync(legacyPath, targetPath) {
  if (!fs.existsSync(targetPath) || !fs.existsSync(legacyPath)) {
    throw new Error('أحد ملفات قاعدة البيانات غير موجود أثناء التحقق من النقل');
  }

  const srcStat = fs.statSync(legacyPath);
  const destStat = fs.statSync(targetPath);
  if (destStat.size === 0 || destStat.size < srcStat.size) {
    throw new Error(`حجم الملف المنقول (${destStat.size} بايت) لا يطابق أو أصغر من قاعدة البيانات الأصلية (${srcStat.size} بايت)`);
  }

  const fd = fs.openSync(targetPath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);
  if (buffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
    throw new Error('تنسيق الملف المنقول غير صالح ولا يطابق ترويسة SQLite الرسمية');
  }

  return true;
}

function verifyDatabaseIntegrityAndCounts(legacyPath, targetPath) {
  verifyDatabaseMigrationSync(legacyPath, targetPath);

  if (!sqlite3) {
    return Promise.resolve(true);
  }

  return new Promise((resolve, reject) => {
    const dbTarget = new sqlite3.Database(targetPath, sqlite3.OPEN_READONLY, (err1) => {
      if (err1) return reject(new Error(`تعذر فتح قاعدة البيانات المنقولة: ${err1.message}`));

      dbTarget.get('PRAGMA integrity_check', (err2, row) => {
        if (err2 || !row || Object.values(row)[0] !== 'ok') {
          dbTarget.close();
          return reject(new Error('فشل فحص السلامة الهيكلية لقاعدة البيانات PRAGMA integrity_check'));
        }

        const dbLegacy = new sqlite3.Database(legacyPath, sqlite3.OPEN_READONLY, (err3) => {
          if (err3) {
            dbTarget.close();
            return reject(new Error(`تعذر فتح القاعدة الأصلية للمقارنة: ${err3.message}`));
          }

          const tables = ['users', 'students', 'grades', 'academic_years', 'classes', 'sections', 'subjects'];
          let pending = tables.length;
          let hasMismatch = false;
          let mismatchDetails = '';

          tables.forEach((tableName) => {
            const countSql = `SELECT count(*) as cnt FROM ${tableName}`;
            dbLegacy.get(countSql, (errLeg, rowLeg) => {
              dbTarget.get(countSql, (errTar, rowTar) => {
                pending--;
                if (!errLeg && !errTar && rowLeg && rowTar) {
                  if (rowLeg.cnt !== rowTar.cnt) {
                    hasMismatch = true;
                    mismatchDetails += ` [جدول ${tableName}: الأصلي ${rowLeg.cnt} != المنقول ${rowTar.cnt}]`;
                  }
                }
                if (pending === 0) {
                  dbLegacy.close();
                  dbTarget.close();
                  if (hasMismatch) {
                    return reject(new Error(`عدم تطابق أعداد السجلات بين القاعدة الأصلية والقاعدة المنقولة:${mismatchDetails}`));
                  }
                  resolve(true);
                }
              });
            });
          });
        });
      });
    });
  });
}

function getDatabasePath() {
  const targetDir = resolveUserDataPath();
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    } catch (e) {
      console.error('Failed to create user data directory:', e);
    }
  }

  const targetDbPath = path.join(targetDir, 'school-grades.db');
  const legacyPublicDbPath = path.join('/tmp', 'school-app', 'school-grades.db');

  if (!fs.existsSync(targetDbPath) && fs.existsSync(legacyPublicDbPath)) {
    try {
      console.log('Migrating legacy database from public temp directory to user data folder...');
      fs.copyFileSync(legacyPublicDbPath, targetDbPath);
      verifyDatabaseMigrationSync(legacyPublicDbPath, targetDbPath);
      console.log('Legacy database migrated and verified successfully.');
    } catch (migErr) {
      if (fs.existsSync(targetDbPath)) {
        try { fs.unlinkSync(targetDbPath); } catch {}
      }
      console.error('Failed to migrate legacy database:', migErr.message);
      throw new Error(`فشل نقل قاعدة البيانات القديمة: ${migErr.message}. تم إيقاف التهيئة لحماية بياناتك الأصلية.`);
    }
  }

  return targetDbPath;
}

const dbPath = getDatabasePath();
let db = sqlite3 ? new sqlite3.Database(dbPath) : null;

const passwordHasher = require('./password-hasher.cjs');

function hashPasswordNode(password, salt) {
  return passwordHasher.hashPasswordSha256(password, salt);
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve([]);
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve({ id: 0, changes: 0 });
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this ? this.lastID : 0, changes: this ? this.changes : 0 });
    });
  });
}

async function initDb() {
  if (!db) return;

  // Enforce foreign key constraints in SQLite
  await run('PRAGMA foreign_keys = ON;');

  // 1. Create Core Tables
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    passwordHash TEXT,
    salt TEXT,
    role TEXT,
    isActive INTEGER,
    mustChangePassword INTEGER,
    createdAt TEXT,
    email TEXT,
    lastLogin TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS academic_years (
    id TEXT PRIMARY KEY,
    name TEXT,
    isCurrent INTEGER
  )`);

  await run(`CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT,
    stage TEXT,
    "order" INTEGER,
    academicYearId TEXT,
    isArchived INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    classId TEXT,
    name TEXT,
    FOREIGN KEY(classId) REFERENCES classes(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    classId TEXT,
    name TEXT,
    maxScore REAL,
    passScore REAL,
    "order" INTEGER,
    FOREIGN KEY(classId) REFERENCES classes(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT,
    registrationNumber TEXT,
    fatherPhone TEXT,
    seatNumber INTEGER,
    academicYearId TEXT,
    classId TEXT,
    sectionId TEXT,
    gender TEXT,
    notes TEXT,
    status TEXT DEFAULT 'regular',
    isGeneralExempt INTEGER,
    individualExemptions TEXT,
    FOREIGN KEY(academicYearId) REFERENCES academic_years(id),
    FOREIGN KEY(classId) REFERENCES classes(id),
    FOREIGN KEY(sectionId) REFERENCES sections(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    academicYearId TEXT,
    classId TEXT,
    sectionId TEXT,
    subjectId TEXT,
    studentId TEXT,
    term1Score REAL,
    midtermScore REAL,
    term2Score REAL,
    termYearlyScore REAL,
    finalExamScore REAL,
    finalScore REAL,
    secondRoundScore REAL,
    secondRoundFinalScore REAL,
    secondRoundDate TEXT,
    lastUpdated TEXT,
    auditHistory TEXT,
    isIndividualExempt INTEGER,
    FOREIGN KEY(academicYearId) REFERENCES academic_years(id),
    FOREIGN KEY(classId) REFERENCES classes(id),
    FOREIGN KEY(sectionId) REFERENCES sections(id),
    FOREIGN KEY(subjectId) REFERENCES subjects(id),
    FOREIGN KEY(studentId) REFERENCES students(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS exemption_settings (
    academicYearId TEXT PRIMARY KEY,
    generalMinAverage REAL,
    generalMinSubjectScore REAL,
    enableGeneralJabr INTEGER,
    isGeneralExemptionEnabled INTEGER DEFAULT 1,
    individualMinScore REAL,
    isIndividualExemptionEnabled INTEGER DEFAULT 1,
    isConfigured INTEGER,
    updatedAt TEXT,
    FOREIGN KEY(academicYearId) REFERENCES academic_years(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS decision_settings (
    academicYearId TEXT PRIMARY KEY,
    maxFailedSubjectsAllowed INTEGER,
    primaryAssistanceMarks INTEGER,
    secondRoundAdditionalAssistanceMarks INTEGER,
    notes TEXT,
    updatedAt TEXT,
    FOREIGN KEY(academicYearId) REFERENCES academic_years(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS decision_grants (
    id TEXT PRIMARY KEY,
    academicYearId TEXT,
    classId TEXT,
    sectionId TEXT,
    studentId TEXT,
    subjectId TEXT,
    round TEXT,
    originalScore REAL,
    appliedMarks REAL,
    finalScoreAfterDecision REAL,
    requiredPassScore REAL,
    grantedAt TEXT,
    grantedBy TEXT,
    notes TEXT,
    FOREIGN KEY(academicYearId) REFERENCES academic_years(id),
    FOREIGN KEY(classId) REFERENCES classes(id),
    FOREIGN KEY(sectionId) REFERENCES sections(id),
    FOREIGN KEY(studentId) REFERENCES students(id),
    FOREIGN KEY(subjectId) REFERENCES subjects(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS certificate_templates (
    id TEXT PRIMARY KEY,
    config TEXT,
    imageData TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS promotion_logs (
    id TEXT PRIMARY KEY,
    date TEXT,
    sourceYearId TEXT,
    sourceYearName TEXT,
    targetYearId TEXT,
    targetYearName TEXT,
    promotedCount INTEGER,
    repeatingCount INTEGER,
    graduatedCount INTEGER,
    excludedCount INTEGER,
    totalProcessedCount INTEGER,
    executedBy TEXT
  )`);

  // 2. Idempotent Schema Migrations
  const userCols = await query("PRAGMA table_info(users)");
  if (userCols && userCols.length > 0) {
    if (!userCols.some(r => r.name === 'email')) {
      await run("ALTER TABLE users ADD COLUMN email TEXT;");
    }
    if (!userCols.some(r => r.name === 'lastLogin')) {
      await run("ALTER TABLE users ADD COLUMN lastLogin TEXT;");
    }
  }

  const classCols = await query("PRAGMA table_info(classes)");
  if (classCols && classCols.length > 0) {
    if (!classCols.some(r => r.name === 'academicYearId')) {
      await run("ALTER TABLE classes ADD COLUMN academicYearId TEXT;");
    }
    if (!classCols.some(r => r.name === 'isArchived')) {
      await run("ALTER TABLE classes ADD COLUMN isArchived INTEGER DEFAULT 0;");
    }
  }

  const exemptionCols = await query("PRAGMA table_info(exemption_settings)");
  if (exemptionCols && exemptionCols.length > 0) {
    if (!exemptionCols.some(r => r.name === 'isGeneralExemptionEnabled')) {
      await run("ALTER TABLE exemption_settings ADD COLUMN isGeneralExemptionEnabled INTEGER DEFAULT 1;");
    }
    if (!exemptionCols.some(r => r.name === 'isIndividualExemptionEnabled')) {
      await run("ALTER TABLE exemption_settings ADD COLUMN isIndividualExemptionEnabled INTEGER DEFAULT 1;");
    }
  }

  const studentCols = await query("PRAGMA table_info(students)");
  if (studentCols && studentCols.length > 0) {
    if (!studentCols.some(r => r.name === 'notes')) {
      await run("ALTER TABLE students ADD COLUMN notes TEXT;");
    }
    if (!studentCols.some(r => r.name === 'status')) {
      await run("ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'regular';");
    }
  }

  const row = await get("SELECT count(*) as count FROM users");
  if (row && row.count === 0) {
    console.log('[SECURITY] Database is empty. First-run setup required.');
  }
}

async function getBackupDir() {
  const defaultDir = path.join(app.getPath('userData'), 'backups');
  try {
    const row = await get("SELECT value FROM settings WHERE key = 'app_settings'");
    if (row && row.value) {
      const settings = JSON.parse(row.value);
      if (settings.backupPath && fs.existsSync(settings.backupPath)) {
        // Verify write permission
        try {
          const testFile = path.join(settings.backupPath, '.write-test');
          fs.writeFileSync(testFile, '');
          fs.unlinkSync(testFile);
          return settings.backupPath;
        } catch (e) {
          console.warn('Custom backup path not writable, falling back to default:', e);
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch backup path from settings:', err);
  }
  return defaultDir;
}

async function createBackup() {
  const backupsDir = await getBackupDir();
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `backup-${timestamp}.db`);

  return new Promise((resolve, reject) => {
    // Using VACUUM INTO for a consistent online backup
    db.run(`VACUUM INTO ?`, [backupPath], async (err) => {
      if (err) {
        console.error('Backup failed:', err);
        return resolve({ success: false, error: `فشل إنشاء النسخة الاحتياطية: ${err.message}` });
      }

      // Perform Post-Backup Integrity & Schema Verification
      try {
        const stat = fs.statSync(backupPath);
        if (stat.size === 0) {
          if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
          return resolve({ success: false, error: 'حجم النسخة الاحتياطية المُنشأة 0 بايت.' });
        }

        // Verify SQLite Header
        const fd = fs.openSync(backupPath, 'r');
        const buf = Buffer.alloc(16);
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        if (buf.toString('utf8', 0, 15) !== 'SQLite format 3') {
          if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
          return resolve({ success: false, error: 'النسخة الاحتياطية ليست قاعدة بيانات SQLite صالحة.' });
        }

        // Open read-only and verify PRAGMA integrity_check and required tables
        const sqliteAddon = sqlite3 || require('sqlite3').verbose();
        await new Promise((resVal, rejVal) => {
          const testDb = new sqliteAddon.Database(backupPath, sqliteAddon.OPEN_READONLY, (err1) => {
            if (err1) return rejVal(new Error(`تعذر فتح النسخة للتحقق: ${err1.message}`));
            testDb.get('PRAGMA integrity_check', (err2, row) => {
              if (err2 || !row || Object.values(row)[0] !== 'ok') {
                testDb.close();
                return rejVal(new Error('فشل فحص PRAGMA integrity_check للنسخة الاحتياطية.'));
              }
              testDb.all("SELECT name FROM sqlite_master WHERE type='table'", (err3, tables) => {
                testDb.close();
                if (err3) return rejVal(err3);
                const tableNames = (tables || []).map(t => t.name);
                const required = ['users', 'academic_years', 'classes', 'sections', 'subjects', 'students', 'grades'];
                const missing = required.filter(t => !tableNames.includes(t));
                if (missing.length > 0) {
                  return rejVal(new Error(`النسخة الاحتياطية تفتقر للجداول الأساسية: ${missing.join(', ')}`));
                }
                resVal(true);
              });
            });
          });
        });

        // Verification succeeded! Safe to clean up old backups and save timestamp
        await cleanupOldBackups(backupsDir);
        await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_auto_backup', JSON.stringify(new Date().toISOString())]);
        resolve({ success: true, path: backupPath });
      } catch (valErr) {
        console.error('Backup verification failed:', valErr.message);
        if (fs.existsSync(backupPath)) {
          try { fs.unlinkSync(backupPath); } catch {}
        }
        resolve({ success: false, error: `فشل التحقق من سلامة النسخة الاحتياطية: ${valErr.message}` });
      }
    });
  });
}

async function cleanupOldBackups(backupsDir) {
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 30) {
    const toDelete = files.slice(30);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(backupsDir, file.name));
    }
  }
}

// Access Code Rate Limiting State & Helpers
const ACCESS_CODE_MAX_ATTEMPTS = 5;
const ACCESS_CODE_LOCKOUT_MS = 5 * 60 * 1000;

let accessCodeRateLimitState = {
  failedAttempts: 0,
  lockoutUntil: 0,
};

function getAccessCodeRateLimitStatus() {
  const now = Date.now();
  if (accessCodeRateLimitState.lockoutUntil > now) {
    const remainingMs = accessCodeRateLimitState.lockoutUntil - now;
    const remainingSec = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSec / 60);
    const seconds = remainingSec % 60;
    const timeStr = minutes > 0 ? `${minutes} دقيقة و ${seconds} ثانية` : `${seconds} ثانية`;
    return {
      allowed: false,
      error: `تم قفل محاولات رمز الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار (${timeStr}) قبل المحاولة مجدداً.`,
      isLockedOut: true,
      remainingSec
    };
  }

  if (accessCodeRateLimitState.lockoutUntil > 0 && accessCodeRateLimitState.lockoutUntil <= now) {
    accessCodeRateLimitState.failedAttempts = 0;
    accessCodeRateLimitState.lockoutUntil = 0;
  }

  return { allowed: true };
}

function recordAccessCodeAttempt(success) {
  if (success) {
    accessCodeRateLimitState.failedAttempts = 0;
    accessCodeRateLimitState.lockoutUntil = 0;
  } else {
    accessCodeRateLimitState.failedAttempts++;
    if (accessCodeRateLimitState.failedAttempts >= ACCESS_CODE_MAX_ATTEMPTS) {
      accessCodeRateLimitState.lockoutUntil = Date.now() + ACCESS_CODE_LOCKOUT_MS;
    }
  }
}

function _resetAccessCodeRateLimitState() {
  accessCodeRateLimitState = { failedAttempts: 0, lockoutUntil: 0 };
}

// Domain-specific methods for safety
const dbActions = {
  loadAll: async () => {
    const data = {};
    // SECURITY: Never return passwordHash or salt to the renderer
    data.users = await query('SELECT id, username, role, isActive, mustChangePassword, createdAt, email FROM users');
    data.academicYears = await query('SELECT * FROM academic_years');
    data.classes = await query('SELECT * FROM classes');
    data.sections = await query('SELECT * FROM sections');
    data.subjects = await query('SELECT * FROM subjects');
    data.students = await query('SELECT * FROM students');
    data.grades = await query('SELECT * FROM grades');
    data.settings = await query('SELECT * FROM settings');
    data.exemptionSettings = await query('SELECT * FROM exemption_settings');
    data.decisionSettings = await query('SELECT * FROM decision_settings');
    data.decisionGrants = await query('SELECT * FROM decision_grants');
    data.certificateTemplates = await query('SELECT * FROM certificate_templates');
    data.promotionLogs = await query('SELECT * FROM promotion_logs');
    return data;
  },

  getSetupStatus: async () => {
    const row = await get("SELECT count(*) as count FROM users");
    return { setupRequired: row.count === 0 };
  },

  verifyCredentials: async (username, password) => {
    const user = await get("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [username.trim()]);
    if (!user) return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    if (!user.isActive) return { success: false, error: 'هذا الحساب معطل حالياً من قبل الإدارة.' };

    const verifyRes = passwordHasher.verifyPassword(password, user.salt, user.passwordHash);
    if (!verifyRes.valid) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // Transparently upgrade legacy SHA-256 hash to scrypt upon successful login
    if (verifyRes.needsMigration) {
      try {
        const newSalt = passwordHasher.generateSalt();
        const newHash = passwordHasher.hashPasswordScrypt(password, newSalt);
        await run("UPDATE users SET passwordHash = ?, salt = ? WHERE id = ?", [newHash, newSalt, user.id]);
        user.passwordHash = newHash;
        user.salt = newSalt;
      } catch (migrationErr) {
        console.error('Failed to migrate password hash to scrypt:', migrationErr);
      }
    }

    // Return safe user object
    const { passwordHash, salt, ...safeUser } = user;
    return { success: true, user: { ...safeUser, isActive: !!safeUser.isActive, mustChangePassword: !!safeUser.mustChangePassword } };
  },

  setupFirstAdmin: async (username, password) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Use BEGIN IMMEDIATE to lock the database for writing immediately
        db.run('BEGIN IMMEDIATE', (err) => {
          if (err) return resolve({ success: false, error: 'تعذر بدء عملية الإعداد: قاعدة البيانات مشغولة.' });

          db.get("SELECT count(*) as count FROM users", async (countErr, row) => {
            if (countErr || !row || row.count > 0) {
              db.run('ROLLBACK');
              return resolve({ success: false, error: 'عفواً، لا يمكن إتمام الإعداد الأولي: النظام يحتوي بالفعل على حسابات مستخدمين.' });
            }

            try {
              const id = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
              const salt = passwordHasher.generateSalt();
              const hash = passwordHasher.hashPasswordScrypt(password, salt);
              
              db.run('INSERT INTO users (id, username, passwordHash, salt, role, isActive, mustChangePassword, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [id, username.trim(), hash, salt, 'admin', 1, 0, new Date().toISOString()],
                (insertErr) => {
                  if (insertErr) {
                    db.run('ROLLBACK');
                    return resolve({ success: false, error: 'فشل حفظ بيانات المدير في قاعدة البيانات.' });
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      db.run('ROLLBACK');
                      return resolve({ success: false, error: 'فشل تأكيد عملية حفظ البيانات.' });
                    }

                    resolve({ 
                      success: true, 
                      user: { id, username: username.trim(), role: 'admin', isActive: true, mustChangePassword: false, createdAt: new Date().toISOString() } 
                    });
                  });
                }
              );
            } catch (ex) {
              db.run('ROLLBACK');
              resolve({ success: false, error: 'حدث خطأ غير متوقع أثناء المعالجة التشفيرية.' });
            }
          });
        });
      });
    });
  },

  updateUserLastLogin: (id) => run('UPDATE users SET lastLogin = ? WHERE id = ?', [new Date().toISOString(), id]),

  updateUser: (id, updates) => {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (['passwordHash', 'salt'].includes(key)) continue; // Don't allow updating these via general update
      fields.push(`${key} = ?`);
      values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
    if (fields.length === 0) return Promise.resolve({ changes: 0 });
    values.push(id);
    return run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  updateUserPassword: async (id, newPassword) => {
    const salt = passwordHasher.generateSalt();
    const hash = passwordHasher.hashPasswordScrypt(newPassword, salt);
    return run('UPDATE users SET passwordHash = ?, salt = ?, mustChangePassword = 0 WHERE id = ?', [hash, salt, id]);
  },

  deleteEntity: async (table, id) => {
    const allowedTables = ['academic_years', 'classes', 'sections', 'subjects', 'students', 'grades', 'users', 'promotion_logs'];
    if (!allowedTables.includes(table)) throw new Error('Unauthorized table deletion');

    if (table === 'users') {
      const user = await get("SELECT role, isActive FROM users WHERE id = ?", [id]);
      if (user && user.role === 'admin' && user.isActive === 1) {
        const activeAdmins = await get("SELECT count(*) as cnt FROM users WHERE role = 'admin' AND isActive = 1 AND id != ?", [id]);
        if (!activeAdmins || activeAdmins.cnt === 0) {
          throw new Error('لا يمكن حذف مدير النظام الوحيد النشط في التطبيق.');
        }
      }
      const res = await run("DELETE FROM users WHERE id = ?", [id]);
      sessionManager.clearSessionsByUserId(id);
      return res;
    }

    if (table === 'academic_years') {
      const year = await get("SELECT isCurrent FROM academic_years WHERE id = ?", [id]);
      if (year && year.isCurrent === 1) {
        throw new Error('لا يمكن حذف العام الدراسي الحالي.');
      }
      const studentsCount = await get("SELECT count(*) as cnt FROM students WHERE academicYearId = ?", [id]);
      if (studentsCount && studentsCount.cnt > 0) {
        throw new Error('لا يمكن حذف العام الدراسي لأنه يحتوي على طلاب مسجلين.');
      }
    }

    if (table === 'classes') {
      const studentsCount = await get("SELECT count(*) as cnt FROM students WHERE classId = ?", [id]);
      if (studentsCount && studentsCount.cnt > 0) {
        throw new Error('لا يمكن حذف الصف لأنه مرتبط بسجلات طلاب.');
      }
    }

    if (table === 'sections') {
      const studentsCount = await get("SELECT count(*) as cnt FROM students WHERE sectionId = ?", [id]);
      if (studentsCount && studentsCount.cnt > 0) {
        throw new Error('لا يمكن حذف الشعبة لأنها مرتبطة بسجلات طلاب.');
      }
    }

    if (table === 'subjects') {
      const gradesCount = await get("SELECT count(*) as cnt FROM grades WHERE subjectId = ?", [id]);
      if (gradesCount && gradesCount.cnt > 0) {
        throw new Error('لا يمكن حذف المادة لأنها مرتبطة بدرجات مسجلة للطلاب.');
      }
    }

    return run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  },

  saveSettings: (key, value) => run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]),
  
  upsertUser: async (u) => {
    if (!u || !u.id) throw new Error('معرف المستخدم مطلوب');
    const existing = await get("SELECT passwordHash, salt, role, isActive, createdAt FROM users WHERE id = ?", [u.id]);

    // Protect last active admin from being disabled or demoted
    if (existing && existing.role === 'admin' && existing.isActive === 1) {
      const isDisabling = (u.isActive === false || u.isActive === 0);
      const isChangingRole = (u.role && u.role !== 'admin');
      if (isDisabling || isChangingRole) {
        const activeAdmins = await get("SELECT count(*) as cnt FROM users WHERE role = 'admin' AND isActive = 1 AND id != ?", [u.id]);
        if (!activeAdmins || activeAdmins.cnt === 0) {
          throw new Error('لا يمكن تعطيل أو تغيير دور مدير النظام الوحيد النشط.');
        }
      }
    }

    const passwordHash = (u.passwordHash !== undefined && u.passwordHash !== null && u.passwordHash !== '') 
      ? u.passwordHash 
      : (existing ? existing.passwordHash : null);
    const salt = (u.salt !== undefined && u.salt !== null && u.salt !== '') 
      ? u.salt 
      : (existing ? existing.salt : null);
    const createdAt = u.createdAt || (existing ? existing.createdAt : new Date().toISOString());

    const res = await run(
      `INSERT INTO users (id, username, passwordHash, salt, role, isActive, mustChangePassword, createdAt, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         passwordHash = COALESCE(excluded.passwordHash, users.passwordHash),
         salt = COALESCE(excluded.salt, users.salt),
         role = excluded.role,
         isActive = excluded.isActive,
         mustChangePassword = excluded.mustChangePassword,
         createdAt = COALESCE(users.createdAt, excluded.createdAt),
         email = excluded.email`,
      [u.id, u.username.trim(), passwordHash, salt, u.role, u.isActive ? 1 : 0, u.mustChangePassword ? 1 : 0, createdAt, u.email || null]
    );

    // If user was disabled or role changed, clear active sessions
    if (u.isActive === 0 || u.isActive === false || (existing && existing.role !== u.role)) {
      sessionManager.clearSessionsByUserId(u.id);
    }

    return res;
  },
  setAccessCode: async (code, newAdminPassword) => {
    if (!code || typeof code !== 'string') {
      return { success: false, error: 'رمز الدخول مطلوب' };
    }
    const cleanCode = code.trim();
    if (cleanCode.length < 4 || cleanCode.length > 8) {
      return { success: false, error: 'يجب أن يتكون رمز الدخول من 4 إلى 8 أرقام/أحرف' };
    }

    const salt = passwordHasher.generateSalt();
    const hash = passwordHasher.hashPasswordScrypt(cleanCode, salt);

    await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      'security_access_code',
      JSON.stringify({
        isConfigured: true,
        hash,
        salt,
        createdAt: new Date().toISOString()
      })
    ]);

    if (newAdminPassword && newAdminPassword.length >= 6) {
      const adminUser = await get("SELECT id FROM users WHERE username = 'admin'");
      if (adminUser) {
        await dbActions.updateUserPassword(adminUser.id, newAdminPassword);
        sessionManager.clearSessionsByUserId(adminUser.id);
      }
    }

    return { success: true };
  },

  verifyAccessCode: async (inputCode) => {
    const rateCheck = getAccessCodeRateLimitStatus();
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error, isLockedOut: true, remainingAttempts: 0 };
    }

    if (!inputCode || typeof inputCode !== 'string') {
      recordAccessCodeAttempt(false);
      const postStatus = getAccessCodeRateLimitStatus();
      if (!postStatus.allowed) return { success: false, error: postStatus.error, isLockedOut: true, remainingAttempts: 0 };
      const rem = Math.max(0, ACCESS_CODE_MAX_ATTEMPTS - accessCodeRateLimitState.failedAttempts);
      return { success: false, error: `رمز الدخول غير صالح. المحاولات المتبقية: ${rem}`, remainingAttempts: rem };
    }

    const clean = inputCode.trim();
    const row = await get("SELECT value FROM settings WHERE key = 'security_access_code'");
    if (!row || !row.value) {
      recordAccessCodeAttempt(false);
      const postStatus = getAccessCodeRateLimitStatus();
      if (!postStatus.allowed) return { success: false, error: postStatus.error, isLockedOut: true, remainingAttempts: 0 };
      const rem = Math.max(0, ACCESS_CODE_MAX_ATTEMPTS - accessCodeRateLimitState.failedAttempts);
      return { success: false, error: 'رمز الدخول غير مهيأ بعد.', remainingAttempts: rem };
    }

    try {
      const sec = JSON.parse(row.value);
      if (!sec || !sec.isConfigured || !sec.hash || !sec.salt) {
        recordAccessCodeAttempt(false);
        const postStatus = getAccessCodeRateLimitStatus();
        if (!postStatus.allowed) return { success: false, error: postStatus.error, isLockedOut: true, remainingAttempts: 0 };
        const rem = Math.max(0, ACCESS_CODE_MAX_ATTEMPTS - accessCodeRateLimitState.failedAttempts);
        return { success: false, error: 'رمز الدخول غير مهيأ بعد.', remainingAttempts: rem };
      }

      const verifyRes = passwordHasher.verifyPassword(clean, sec.salt, sec.hash);
      if (verifyRes.valid) {
        recordAccessCodeAttempt(true);
        return { success: true, remainingAttempts: ACCESS_CODE_MAX_ATTEMPTS };
      } else {
        recordAccessCodeAttempt(false);
        const postStatus = getAccessCodeRateLimitStatus();
        if (!postStatus.allowed) {
          return { success: false, error: postStatus.error, isLockedOut: true, remainingAttempts: 0 };
        }
        const rem = Math.max(0, ACCESS_CODE_MAX_ATTEMPTS - accessCodeRateLimitState.failedAttempts);
        return { success: false, error: `رمز الدخول غير صحيح. المحاولات المتبقية: ${rem}`, remainingAttempts: rem };
      }
    } catch (e) {
      recordAccessCodeAttempt(false);
      return { success: false, error: 'حدث خطأ أثناء معالجة رمز الدخول.' };
    }
  },

  isAccessCodeConfigured: async () => {
    const row = await get("SELECT value FROM settings WHERE key = 'security_access_code'");
    if (!row || !row.value) return { isConfigured: false };
    try {
      const sec = JSON.parse(row.value);
      return { isConfigured: !!(sec && sec.isConfigured) };
    } catch (e) {
      return { isConfigured: false };
    }
  },

  upsertYear: (y) => run('INSERT OR REPLACE INTO academic_years (id, name, isCurrent) VALUES (?, ?, ?)', [y.id, y.name, y.isCurrent ? 1 : 0]),

  upsertClass: (c) => run('INSERT OR REPLACE INTO classes (id, name, stage, "order", academicYearId, isArchived) VALUES (?, ?, ?, ?, ?, ?)', 
    [c.id, c.name, c.stage, c.order, c.academicYearId || null, c.isArchived ? 1 : 0]),

  deleteClassCascade: async (classId) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let errorOccurred = false;
        const errorHandler = (err) => {
          if (err && !errorOccurred) {
            errorOccurred = true;
            db.run('ROLLBACK');
            reject(err);
          }
        };

        db.run('DELETE FROM grades WHERE classId = ?', [classId], errorHandler);
        db.run('DELETE FROM decision_grants WHERE classId = ?', [classId], errorHandler);
        db.run('DELETE FROM students WHERE classId = ?', [classId], errorHandler);
        db.run('DELETE FROM subjects WHERE classId = ?', [classId], errorHandler);
        db.run('DELETE FROM sections WHERE classId = ?', [classId], errorHandler);
        db.run('DELETE FROM classes WHERE id = ?', [classId], function(err) {
          if (err) return errorHandler(err);
          
          if (!errorOccurred) {
            const changes = this.changes;
            db.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve({ success: true, changes });
            });
          }
        });
      });
    });
  },

  upsertSection: (s) => run('INSERT OR REPLACE INTO sections (id, classId, name) VALUES (?, ?, ?)', [s.id, s.classId, s.name]),

  upsertSubject: (s) => run('INSERT OR REPLACE INTO subjects (id, classId, name, maxScore, passScore, "order") VALUES (?, ?, ?, ?, ?, ?)', 
    [s.id, s.classId, s.name, s.maxScore, s.passScore, s.order]),

  upsertStudent: (s) => run(`INSERT OR REPLACE INTO students (id, name, registrationNumber, fatherPhone, seatNumber, academicYearId, classId, sectionId, gender, notes, status, isGeneralExempt, individualExemptions) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [s.id, s.name, (s.registrationNumber !== undefined && s.registrationNumber !== null) ? s.registrationNumber : null, s.fatherPhone ?? null, s.seatNumber, s.academicYearId, s.classId, s.sectionId ?? '', s.gender ?? 'male', s.notes ?? null, s.status || 'regular', s.isGeneralExempt ? 1 : 0, JSON.stringify(s.individualExemptions || [])]),

  upsertGrade: (g) => run(`INSERT OR REPLACE INTO grades (id, academicYearId, classId, sectionId, subjectId, studentId, term1Score, midtermScore, term2Score, termYearlyScore, finalExamScore, finalScore, secondRoundScore, secondRoundFinalScore, secondRoundDate, lastUpdated, auditHistory, isIndividualExempt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [g.id, g.academicYearId, g.classId, g.sectionId, g.subjectId, g.studentId, g.term1Score, g.midtermScore, g.term2Score, g.termYearlyScore, g.finalExamScore, g.finalScore, g.secondRoundScore, g.secondRoundFinalScore, g.secondRoundDate, g.lastUpdated, JSON.stringify(g.auditHistory || []), g.isIndividualExempt ? 1 : 0]),

  saveExemptionSettings: (s) => run(`INSERT OR REPLACE INTO exemption_settings (academicYearId, generalMinAverage, generalMinSubjectScore, enableGeneralJabr, isGeneralExemptionEnabled, individualMinScore, isIndividualExemptionEnabled, isConfigured, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [s.academicYearId, s.generalMinAverage, s.generalMinSubjectScore, s.enableGeneralJabr ? 1 : 0, s.isGeneralExemptionEnabled !== false ? 1 : 0, s.individualMinScore, s.isIndividualExemptionEnabled !== false ? 1 : 0, s.isConfigured ? 1 : 0, s.updatedAt]),

  saveDecisionSettings: (s) => run(`INSERT OR REPLACE INTO decision_settings (academicYearId, maxFailedSubjectsAllowed, primaryAssistanceMarks, secondRoundAdditionalAssistanceMarks, notes, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?)`, 
    [s.academicYearId, s.maxFailedSubjectsAllowed, s.primaryAssistanceMarks, s.secondRoundAdditionalAssistanceMarks, s.notes, s.updatedAt]),

  upsertDecisionGrant: (g) => run(`INSERT OR REPLACE INTO decision_grants (id, academicYearId, classId, sectionId, studentId, subjectId, round, originalScore, appliedMarks, finalScoreAfterDecision, requiredPassScore, grantedAt, grantedBy, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [g.id, g.academicYearId, g.classId, g.sectionId, g.studentId, g.subjectId, g.round, g.originalScore, g.appliedMarks, g.finalScoreAfterDecision, g.requiredPassScore, g.grantedAt, g.grantedBy, g.notes]),

  saveCertificateTemplate: (config, imageData = null) => run('INSERT OR REPLACE INTO certificate_templates (id, config, imageData) VALUES (?, ?, ?)', ['default', JSON.stringify(config), imageData]),

  upsertPromotionLog: (l) => run(`INSERT OR REPLACE INTO promotion_logs (id, date, sourceYearId, sourceYearName, targetYearId, targetYearName, promotedCount, repeatingCount, graduatedCount, excludedCount, totalProcessedCount, executedBy) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [l.id, l.date, l.sourceYearId, l.sourceYearName, l.targetYearId, l.targetYearName, l.promotedCount, l.repeatingCount, l.graduatedCount, l.excludedCount, l.totalProcessedCount, l.executedBy]),

  executeStudentPromotionBatch: async (students, promotionLog) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);

          let hasSettled = false;
          const errorHandler = (err) => {
            if (!hasSettled) {
              hasSettled = true;
              db.run('ROLLBACK', () => {
                reject(err);
              });
            }
          };

          const stuSql = `INSERT OR REPLACE INTO students (id, name, registrationNumber, fatherPhone, seatNumber, academicYearId, classId, sectionId, gender, notes, status, isGeneralExempt, individualExemptions) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          let pendingWrites = students.length + (promotionLog ? 1 : 0);
          if (pendingWrites === 0) {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) return errorHandler(commitErr);
              if (!hasSettled) {
                hasSettled = true;
                return resolve({ success: true });
              }
            });
            return;
          }

          const checkDone = () => {
            pendingWrites--;
            if (pendingWrites === 0 && !hasSettled) {
              db.run('COMMIT', (commitErr) => {
                if (commitErr) return errorHandler(commitErr);
                if (!hasSettled) {
                  hasSettled = true;
                  resolve({ success: true });
                }
              });
            }
          };

          for (const s of students) {
            if (hasSettled) break;
            const regVal = (s.registrationNumber !== undefined && s.registrationNumber !== null) ? s.registrationNumber : null;
            db.run(
              stuSql,
              [s.id, s.name, regVal, s.fatherPhone ?? null, s.seatNumber, s.academicYearId, s.classId, s.sectionId || '', s.gender || 'male', s.notes ?? null, s.status || 'regular', s.isGeneralExempt ? 1 : 0, JSON.stringify(s.individualExemptions || [])],
              function(err) {
                if (err) return errorHandler(err);
                checkDone();
              }
            );
          }

          if (promotionLog && !hasSettled) {
            const logSql = `INSERT OR REPLACE INTO promotion_logs (id, date, sourceYearId, sourceYearName, targetYearId, targetYearName, promotedCount, repeatingCount, graduatedCount, excludedCount, totalProcessedCount, executedBy) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const l = promotionLog;
            db.run(
              logSql,
              [l.id, l.date, l.sourceYearId, l.sourceYearName, l.targetYearId, l.targetYearName, l.promotedCount, l.repeatingCount, l.graduatedCount, l.excludedCount, l.totalProcessedCount, l.executedBy],
              function(err) {
                if (err) return errorHandler(err);
                checkDone();
              }
            );
          }
        });
      });
    });
  },

  deleteStudentCascade: async (studentId) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let errorOccurred = false;
        const errorHandler = (err) => {
          if (err && !errorOccurred) {
            errorOccurred = true;
            db.run('ROLLBACK');
            reject(err);
          }
        };

        db.run('DELETE FROM grades WHERE studentId = ?', [studentId], errorHandler);
        db.run('DELETE FROM decision_grants WHERE studentId = ?', [studentId], errorHandler);
        db.run('DELETE FROM students WHERE id = ?', [studentId], function(err) {
          if (err) return errorHandler(err);
          
          if (!errorOccurred) {
            const changes = this.changes;
            db.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve({ success: true, changes });
            });
          }
        });
      });
    });
  },

  deleteEntity: (table, id) => {
    const allowedTables = ['users', 'academic_years', 'classes', 'sections', 'subjects', 'students', 'grades', 'decision_grants', 'promotion_logs'];
    if (!allowedTables.includes(table)) throw new Error('Unauthorized table deletion');
    return run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  },

  createBackup,
  getBackupsInfo: async () => {
    const backupsDir = await getBackupDir();
    let lastBackup = null;
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.toISOString() }))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      
      if (files.length > 0) {
        lastBackup = files[0].time;
      }
    }
    return { lastBackup, backupsCount: fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter(f => f.startsWith('backup-')).length : 0 };
  },

  exportSql: async () => {
    const tables = [
      'users', 'academic_years', 'classes', 'sections', 'subjects', 
      'students', 'grades', 'settings', 'exemption_settings', 
      'decision_settings', 'decision_grants', 'certificate_templates', 
      'promotion_logs'
    ];
    let sql = `-- School Grades Database Export\n-- Generated: ${new Date().toISOString()}\n\nPRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n\n`;
    
    for (const table of tables) {
      const rows = await query(`SELECT * FROM ${table}`);
      if (rows.length === 0) continue;
      
      sql += `-- Table: ${table}\n`;
      for (const row of rows) {
        if (table === 'users') {
          delete row.passwordHash;
          delete row.salt;
        }
        if (table === 'settings' && row.key === 'security_access_code') {
          row.value = JSON.stringify({ isConfigured: false });
        }

        const columns = Object.keys(row);
        const values = Object.values(row).map(val => {
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return val;
          return "'" + val.toString().replace(/'/g, "''") + "'";
        });
        sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      sql += '\n';
    }
    
    sql += 'COMMIT;';
    return sql;
  },

  restoreDb: async (filePath) => {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return { success: false, error: 'ملف قاعدة البيانات غير موجود أو تعذر الوصول إليه.' };
    }

    if (dbPath && path.resolve(filePath) === path.resolve(dbPath)) {
      return { success: false, error: 'لا يمكن استعادة ملف قاعدة البيانات النشطة نفسها.' };
    }

    // 1. Check file size > 0
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return { success: false, error: 'تعذر القراءة من المسار المحدد.' };
    }
    if (stat.size === 0) {
      return { success: false, error: 'ملف قاعدة البيانات فارغ (0 بايت).' };
    }

    // 2. Check SQLite format 3 header
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(16);
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);
      if (buffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
        return { success: false, error: 'الملف المحدد ليس قاعدة بيانات SQLite صالحة (الترويسة غير مطابقة).' };
      }
    } catch (e) {
      return { success: false, error: 'فشل فحص ترويسة ملف قاعدة البيانات.' };
    }

    // 3. Verify SQLite integrity and required tables using a temporary connection
    if (sqlite3) {
      try {
        await new Promise((res, rej) => {
          const testDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err1) => {
            if (err1) return rej(new Error(`تعذر فتح الملف للتحقق: ${err1.message}`));
            testDb.get('PRAGMA integrity_check', (err2, row) => {
              if (err2 || !row || Object.values(row)[0] !== 'ok') {
                testDb.close();
                return rej(new Error('الملف غير صالح أو تالف (فشل فحص PRAGMA integrity_check).'));
              }
              testDb.all("SELECT name FROM sqlite_master WHERE type='table'", (err3, tables) => {
                testDb.close();
                if (err3) return rej(err3);
                const tableNames = (tables || []).map(t => t.name);
                const required = ['users', 'academic_years', 'classes', 'sections', 'subjects', 'students', 'grades'];
                const missing = required.filter(t => !tableNames.includes(t));
                if (missing.length > 0) {
                  return rej(new Error(`الملف يفتقر إلى الجداول الأساسية للتطبيق: ${missing.join(', ')}`));
                }
                res(true);
              });
            });
          });
        });
      } catch (valErr) {
        return { success: false, error: valErr.message || 'فشل التحقق من سلامة قاعدة البيانات المراد استعادتها.' };
      }
    }

    // 4. Create temp backup of current active DB
    const tempBackupPath = `${dbPath}.temp-backup-${Date.now()}`;
    try {
      fs.copyFileSync(dbPath, tempBackupPath);
    } catch (backupErr) {
      return { success: false, error: `تعذر عمل نسخة مؤقتة لقاعدة البيانات الحالية: ${backupErr.message}` };
    }

    // 5. Close current connection and copy replacement
    return new Promise((resolve, reject) => {
      db.close(async (closeErr) => {
        if (closeErr) {
          if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
          return resolve({ success: false, error: 'تعذر إغلاق قاعدة البيانات الحالية للبدء بالاستعادة.' });
        }

        try {
          fs.copyFileSync(filePath, dbPath);

          // Reopen DB connection
          const sqliteAddon = sqlite3 || require('sqlite3').verbose();
          db = new sqliteAddon.Database(dbPath);
          await initDb();

          if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);

          resolve({ success: true, message: 'تمت استعادة قاعدة البيانات وتأكيد سلامة الهيكل بنجاح.' });
        } catch (restoreErr) {
          console.error('Restore failed, rolling back to active DB copy:', restoreErr);
          try {
            if (fs.existsSync(tempBackupPath)) {
              fs.copyFileSync(tempBackupPath, dbPath);
              fs.unlinkSync(tempBackupPath);
            }
            const sqliteAddon = sqlite3 || require('sqlite3').verbose();
            db = new sqliteAddon.Database(dbPath);
            await initDb();
          } catch (rollbackErr) {
            console.error('Fatal rollback error during restore failure:', rollbackErr);
          }
          resolve({ success: false, error: `فشلت عملية الاستعادة وتم التراجع عن التغييرات: ${restoreErr.message}` });
        }
      });
    });
  }
};

function _closeDb() {
  return new Promise((resolve) => {
    if (db) {
      db.close(() => {
        db = null;
        resolve(true);
      });
    } else {
      resolve(true);
    }
  });
}

function _reopenDb() {
  const sqliteAddon = sqlite3 || require('sqlite3').verbose();
  db = new sqliteAddon.Database(dbPath);
}

module.exports = {
  initDb,
  ...dbActions,
  get,
  run,
  query,
  _resetAccessCodeRateLimitState,
  _closeDb,
  _reopenDb,
  _getDbPath: () => dbPath,
};
