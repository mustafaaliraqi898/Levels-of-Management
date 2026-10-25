const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

const dbPath = path.join(app.getPath('userData'), 'school-grades.db');
const db = new sqlite3.Database(dbPath);

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
        "order" INTEGER
      )`);

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
        individualMinScore REAL,
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
        config TEXT
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

  upsertClass: (c) => run('INSERT OR REPLACE INTO classes (id, name, stage, "order") VALUES (?, ?, ?, ?)', [c.id, c.name, c.stage, c.order]),

  upsertSection: (s) => run('INSERT OR REPLACE INTO sections (id, classId, name) VALUES (?, ?, ?)', [s.id, s.classId, s.name]),

  upsertSubject: (s) => run('INSERT OR REPLACE INTO subjects (id, classId, name, maxScore, passScore, "order") VALUES (?, ?, ?, ?, ?, ?)', 
    [s.id, s.classId, s.name, s.maxScore, s.passScore, s.order]),

  upsertStudent: (s) => run(`INSERT OR REPLACE INTO students (id, name, registrationNumber, fatherPhone, seatNumber, academicYearId, classId, sectionId, gender, isGeneralExempt, individualExemptions) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [s.id, s.name, s.registrationNumber, s.fatherPhone, s.seatNumber, s.academicYearId, s.classId, s.sectionId, s.gender, s.isGeneralExempt ? 1 : 0, JSON.stringify(s.individualExemptions || [])]),

  upsertGrade: (g) => run(`INSERT OR REPLACE INTO grades (id, academicYearId, classId, sectionId, subjectId, studentId, term1Score, midtermScore, term2Score, termYearlyScore, finalExamScore, finalScore, secondRoundScore, secondRoundFinalScore, secondRoundDate, lastUpdated, auditHistory, isIndividualExempt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [g.id, g.academicYearId, g.classId, g.sectionId, g.subjectId, g.studentId, g.term1Score, g.midtermScore, g.term2Score, g.termYearlyScore, g.finalExamScore, g.finalScore, g.secondRoundScore, g.secondRoundFinalScore, g.secondRoundDate, g.lastUpdated, JSON.stringify(g.auditHistory || []), g.isIndividualExempt ? 1 : 0]),

  saveExemptionSettings: (s) => run(`INSERT OR REPLACE INTO exemption_settings (academicYearId, generalMinAverage, generalMinSubjectScore, enableGeneralJabr, individualMinScore, isConfigured, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [s.academicYearId, s.generalMinAverage, s.generalMinSubjectScore, s.enableGeneralJabr ? 1 : 0, s.individualMinScore, s.isConfigured ? 1 : 0, s.updatedAt]),

  saveDecisionSettings: (s) => run(`INSERT OR REPLACE INTO decision_settings (academicYearId, maxFailedSubjectsAllowed, primaryAssistanceMarks, secondRoundAdditionalAssistanceMarks, notes, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?)`, 
    [s.academicYearId, s.maxFailedSubjectsAllowed, s.primaryAssistanceMarks, s.secondRoundAdditionalAssistanceMarks, s.notes, s.updatedAt]),

  upsertDecisionGrant: (g) => run(`INSERT OR REPLACE INTO decision_grants (id, academicYearId, classId, sectionId, studentId, subjectId, round, originalScore, appliedMarks, finalScoreAfterDecision, requiredPassScore, grantedAt, grantedBy, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [g.id, g.academicYearId, g.classId, g.sectionId, g.studentId, g.subjectId, g.round, g.originalScore, g.appliedMarks, g.finalScoreAfterDecision, g.requiredPassScore, g.grantedAt, g.grantedBy, g.notes]),

  saveCertificateTemplate: (config) => run('INSERT OR REPLACE INTO certificate_templates (id, config) VALUES (?, ?)', ['default', JSON.stringify(config)]),

  upsertPromotionLog: (l) => run(`INSERT OR REPLACE INTO promotion_logs (id, date, sourceYearId, sourceYearName, targetYearId, targetYearName, promotedCount, repeatingCount, graduatedCount, excludedCount, totalProcessedCount, executedBy) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [l.id, l.date, l.sourceYearId, l.sourceYearName, l.targetYearId, l.targetYearName, l.promotedCount, l.repeatingCount, l.graduatedCount, l.excludedCount, l.totalProcessedCount, l.executedBy]),

  deleteEntity: (table, id) => {
    const allowedTables = ['users', 'academic_years', 'classes', 'sections', 'subjects', 'students', 'grades', 'decision_grants', 'promotion_logs'];
    if (!allowedTables.includes(table)) throw new Error('Unauthorized table deletion');
    return run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }
};

module.exports = {
  initDb,
  ...dbActions,
  get
};
