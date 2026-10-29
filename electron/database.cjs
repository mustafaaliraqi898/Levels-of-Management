const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

const dbPath = path.join(app.getPath('userData'), 'school-grades.db');
let db = new sqlite3.Database(dbPath);

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        passwordHash TEXT,
        salt TEXT,
        role TEXT,
        isActive INTEGER,
        mustChangePassword INTEGER,
        createdAt TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY,
        name TEXT,
        isCurrent INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT,
        stage TEXT,
        "order" INTEGER,
        academicYearId TEXT,
        isArchived INTEGER DEFAULT 0
      )`);

      // Ensure columns exist on existing SQLite databases
      db.all("PRAGMA table_info(classes)", (err, rows) => {
        if (!err && rows) {
          const hasYearId = rows.some(r => r.name === 'academicYearId');
          if (!hasYearId) {
            db.run("ALTER TABLE classes ADD COLUMN academicYearId TEXT");
          }
          const hasArchived = rows.some(r => r.name === 'isArchived');
          if (!hasArchived) {
            db.run("ALTER TABLE classes ADD COLUMN isArchived INTEGER DEFAULT 0");
          }
        }
      });

      db.all("PRAGMA table_info(exemption_settings)", (err, rows) => {
        if (!err && rows && rows.length > 0) {
          const hasGenEnabled = rows.some(r => r.name === 'isGeneralExemptionEnabled');
          if (!hasGenEnabled) {
            db.run("ALTER TABLE exemption_settings ADD COLUMN isGeneralExemptionEnabled INTEGER DEFAULT 1");
          }
          const hasIndivEnabled = rows.some(r => r.name === 'isIndividualExemptionEnabled');
          if (!hasIndivEnabled) {
            db.run("ALTER TABLE exemption_settings ADD COLUMN isIndividualExemptionEnabled INTEGER DEFAULT 1");
          }
        }
      });

      db.all("PRAGMA table_info(students)", (err, rows) => {
        if (!err && rows && rows.length > 0) {
          const hasNotes = rows.some(r => r.name === 'notes');
          if (!hasNotes) {
            db.run("ALTER TABLE students ADD COLUMN notes TEXT");
          }
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        classId TEXT,
        name TEXT,
        FOREIGN KEY(classId) REFERENCES classes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        classId TEXT,
        name TEXT,
        maxScore REAL,
        passScore REAL,
        "order" INTEGER,
        FOREIGN KEY(classId) REFERENCES classes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS students (
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
        isGeneralExempt INTEGER,
        individualExemptions TEXT,
        FOREIGN KEY(academicYearId) REFERENCES academic_years(id),
        FOREIGN KEY(classId) REFERENCES classes(id),
        FOREIGN KEY(sectionId) REFERENCES sections(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS grades (
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

      db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exemption_settings (
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

      db.run(`CREATE TABLE IF NOT EXISTS decision_settings (
        academicYearId TEXT PRIMARY KEY,
        maxFailedSubjectsAllowed INTEGER,
        primaryAssistanceMarks INTEGER,
        secondRoundAdditionalAssistanceMarks INTEGER,
        notes TEXT,
        updatedAt TEXT,
        FOREIGN KEY(academicYearId) REFERENCES academic_years(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS decision_grants (
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

      db.run(`CREATE TABLE IF NOT EXISTS certificate_templates (
        id TEXT PRIMARY KEY,
        config TEXT,
        imageData TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS promotion_logs (
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

      db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
          db.run(`INSERT INTO users (id, username, passwordHash, salt, role, isActive, mustChangePassword, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['usr-admin-default', 'admin', '4cb3c70fb1df82313360bf6ef219389c7ccea0bd5061e8a5a39bd8d2085c1cc4', 'school_admin_salt_seed_2026', 'admin', 1, 1, new Date().toISOString()]
          );
        }
      });

      resolve();
    });
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
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
        reject(err);
      } else {
        console.log('Backup created at:', backupPath);
        try {
          await cleanupOldBackups(backupsDir);
          // Save last backup timestamp in settings
          await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_auto_backup', JSON.stringify(new Date().toISOString())]);
          resolve({ success: true, path: backupPath });
        } catch (cleanupErr) {
          console.warn('Cleanup failed but backup succeeded:', cleanupErr);
          resolve({ success: true, path: backupPath });
        }
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

// Domain-specific methods for safety
const dbActions = {
  loadAll: async () => {
    const data = {};
    data.users = await query('SELECT * FROM users');
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

  saveSettings: (key, value) => run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]),
  
  upsertUser: (u) => run('INSERT OR REPLACE INTO users (id, username, passwordHash, salt, role, isActive, mustChangePassword, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [u.id, u.username, u.passwordHash, u.salt, u.role, u.isActive ? 1 : 0, u.mustChangePassword ? 1 : 0, u.createdAt]),

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

  upsertStudent: (s) => run(`INSERT OR REPLACE INTO students (id, name, registrationNumber, fatherPhone, seatNumber, academicYearId, classId, sectionId, gender, notes, isGeneralExempt, individualExemptions) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [s.id, s.name, (s.registrationNumber !== undefined && s.registrationNumber !== null) ? s.registrationNumber : null, s.fatherPhone ?? null, s.seatNumber, s.academicYearId, s.classId, s.sectionId ?? '', s.gender ?? 'male', s.notes ?? null, s.isGeneralExempt ? 1 : 0, JSON.stringify(s.individualExemptions || [])]),

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

          const stuSql = `INSERT OR REPLACE INTO students (id, name, registrationNumber, fatherPhone, seatNumber, academicYearId, classId, sectionId, gender, notes, isGeneralExempt, individualExemptions) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
              [s.id, s.name, regVal, s.fatherPhone ?? null, s.seatNumber, s.academicYearId, s.classId, s.sectionId || '', s.gender || 'male', s.notes ?? null, s.isGeneralExempt ? 1 : 0, JSON.stringify(s.individualExemptions || [])],
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
        const columns = Object.keys(row);
        const values = Object.values(row).map(val => {
          if (val === null) return 'NULL';
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
    return new Promise((resolve, reject) => {
      // 1. Create a safety backup of current state
      createBackup().then(() => {
        // 2. Close current connection
        db.close(async (err) => {
          if (err) {
            console.error('Error closing database for restore:', err);
            return reject(err);
          }
          
          try {
            // 3. Replace file
            fs.copyFileSync(filePath, dbPath);
            
            // 4. Reopen connection
            const sqlite3 = require('sqlite3').verbose();
            db = new sqlite3.Database(dbPath);
            
            resolve({ success: true, message: 'تمت استعادة قاعدة البيانات بنجاح. قد تحتاج لإعادة تشغيل البرنامج لتنشيط كافة التغييرات.' });
          } catch (copyErr) {
            console.error('Error copying database file:', copyErr);
            // Try to reopen at least
            const sqlite3 = require('sqlite3').verbose();
            db = new sqlite3.Database(dbPath);
            reject(copyErr);
          }
        });
      }).catch(reject);
    });
  }
};

module.exports = {
  initDb,
  ...dbActions,
  get
};
