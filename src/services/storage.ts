import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  GradeStage,
  ExemptionSettings,
  UserAccount,
  CertificateTemplateConfig,
  AcademicYearDecisionSettings,
  DecisionGrantRecord,
  StudentPromotionBatchLog,
} from '../types';
import {
  saveTemplateImageToDB,
  loadTemplateImageFromDB,
} from './imageStore';
import {
  recalculateGradeRecord,
  calculateFinalScore,
  calculateSecondRoundFinalScore,
} from './calculations';
import {
  completeDemoSeedData,
} from './seedData';
import { hashPassword, generateSalt } from '../utils/crypto';

// --- Electron API Types ---
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      version: string;
      db: {
        init: () => Promise<{ success: boolean; error?: string }>;
        loadAll: () => Promise<any>;
        saveSettings: (key: string, value: any) => Promise<any>;
        upsertUser: (user: any) => Promise<any>;
        upsertYear: (year: any) => Promise<any>;
        upsertClass: (cls: any) => Promise<any>;
        upsertSection: (sec: any) => Promise<any>;
        upsertSubject: (sub: any) => Promise<any>;
        upsertStudent: (stu: any) => Promise<any>;
        upsertGrade: (grade: any) => Promise<any>;
        saveExemptionSettings: (settings: any) => Promise<any>;
        saveDecisionSettings: (settings: any) => Promise<any>;
        upsertDecisionGrant: (grant: any) => Promise<any>;
        saveCertificateTemplate: (config: any, imageData?: string) => Promise<any>;
        upsertPromotionLog: (log: any) => Promise<any>;
        deleteEntity: (table: string, id: string) => Promise<any>;
        deleteStudentCascade: (studentId: string) => Promise<{ success: boolean, changes: number }>;
        deleteClassCascade: (classId: string) => Promise<{ success: boolean, changes: number }>;
        createBackup: () => Promise<{ success: boolean; path: string }>;
        getBackupsInfo: () => Promise<{ lastBackup: string | null; backupsCount: number }>;
        exportSql: () => Promise<string>;
        restoreDb: (path: string) => Promise<{ success: boolean; message: string }>;
      };
      dialog: {
        openDirectory: () => Promise<string | null>;
        openFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
      };
    };
  }
}

const STORAGE_KEY = 'school_grades_offline_db_v3';

export const INITIAL_DEFAULT_ADMIN: UserAccount = {
  id: 'usr-admin-default',
  username: 'admin',
  passwordHash: '4cb3c70fb1df82313360bf6ef219389c7ccea0bd5061e8a5a39bd8d2085c1cc4',
  salt: 'school_admin_salt_seed_2026',
  role: 'admin',
  isActive: true,
  mustChangePassword: true,
  createdAt: '2026-09-01T08:00:00.000Z',
};

export const DEFAULT_CERTIFICATE_CONFIG: CertificateTemplateConfig = {
  templateImage: undefined,
  elements: {
    officialLogo: { x: 87, y: 13, width: 10, visible: true },
    kuficLogo: { x: 13, y: 13, width: 10, visible: true },
    studentName: { x: 50, y: 53, fontSize: 34, fontWeight: 'bold', fontColor: '#0f172a', fontFamily: 'Cairo', textAlign: 'center', visible: true },
    academicYear: { x: 78, y: 84, fontSize: 16, fontWeight: 'bold', fontColor: '#334155', fontFamily: 'Tajawal', textAlign: 'center', visible: true },
    directorName: { x: 22, y: 84, fontSize: 18, fontWeight: 'bold', fontColor: '#1e293b', fontFamily: 'Tajawal', textAlign: 'center', visible: true },
  },
};

export interface DatabaseState {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
  exemptionSettings?: Record<string, ExemptionSettings>;
  decisionSettings?: Record<string, AcademicYearDecisionSettings>;
  decisionGrants?: Record<string, DecisionGrantRecord>;
  certificateTemplate?: CertificateTemplateConfig;
  users?: UserAccount[];
  promotionLogs?: StudentPromotionBatchLog[];
  version: string;
  lastBackupDate?: string;
  backupsCount?: number;
  lastAutoBackupDate?: string;
}

const INITIAL_SETTINGS: AppSettings = {
  schoolName: '',
  directorName: '',
  examCommitteeHead: '',
  city: '',
  roundingRule: 'standard',
  maxScoreDefault: 100,
  passScoreDefault: 50,
  confirmPreviousTermEdits: true,
  theme: 'dark',
  backupPath: undefined,
  isAccessCodeConfigured: false,
};

export function buildGradeKey(ay: string, cl: string, sec: string, sub: string, st: string) {
  return `${ay}_${cl}_${sec}_${sub}_${st}`;
}

// VIRTUAL_SECTION_PREFIX removed as we are moving to native empty string support for sections

export function buildDecisionKey(ay: string, cl: string, sec: string, st: string, sub: string, rd: string) {
  return `${ay}_${cl}_${sec}_${st}_${sub}_${rd}`;
}

export class LocalStorageEngine {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();
  private isElectron = !!(window.electronAPI && window.electronAPI.isElectron);
  private isReady = false;
  private initPromise: Promise<void>;

  constructor() {
    this.state = this.getInitialEmptyState();
    this.initPromise = this.init();
  }

  private getInitialEmptyState(): DatabaseState {
    return {
      academicYears: [],
      classes: [],
      sections: [],
      subjects: [],
      students: [],
      grades: {},
      settings: INITIAL_SETTINGS,
      exemptionSettings: {},
      decisionSettings: {},
      decisionGrants: {},
      users: [INITIAL_DEFAULT_ADMIN],
      version: '1.0.0',
      lastBackupDate: new Date().toISOString(),
    };
  }

  private async init(): Promise<void> {
    if (this.isElectron) {
      try {
        const initRes = await window.electronAPI!.db.init();
        if (initRes.success) {
          await this.loadFromSqlite();
          await this.syncBackupInfo();
        }
      } catch (e) { console.error('SQLite init error', e); }
    } else {
      this.state = this.loadFromStorage();
      try {
        const img = await loadTemplateImageFromDB();
        if (img && this.state.certificateTemplate) {
          this.state.certificateTemplate.templateImage = img;
          this.notify(false);
        }
      } catch (e) {
        console.warn('Template image load error', e);
      }
    }
    await this.migrateClassesToAcademicYears();
    this.isReady = true;
    this.notify(false);
  }

  private async migrateClassesToAcademicYears() {
    const unmappedClasses = this.state.classes.filter(c => !c.academicYearId);
    if (unmappedClasses.length === 0) return;

    const currentYear = this.state.academicYears.find(y => y.isCurrent) || this.state.academicYears[0];
    const defaultYearId = currentYear?.id || '';

    let needsFullNotify = false;

    for (const oldClass of unmappedClasses) {
      const studentYears = Array.from(new Set(
        this.state.students.filter(s => s.classId === oldClass.id).map(s => s.academicYearId).filter(Boolean)
      ));
      const gradeYears = Array.from(new Set(
        Object.values(this.state.grades).filter(g => g.classId === oldClass.id).map(g => g.academicYearId).filter(Boolean)
      ));

      const usedYears = Array.from(new Set([...studentYears, ...gradeYears]));

      if (usedYears.length === 0) {
        oldClass.academicYearId = defaultYearId;
        needsFullNotify = true;
      } else if (usedYears.length === 1) {
        oldClass.academicYearId = usedYears[0];
        needsFullNotify = true;
      } else {
        const primaryYearId = usedYears[0];
        oldClass.academicYearId = primaryYearId;
        needsFullNotify = true;

        for (let i = 1; i < usedYears.length; i++) {
          const yearId = usedYears[i];
          const newClassId = `cls-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const newClass: SchoolClass = {
            ...oldClass,
            id: newClassId,
            academicYearId: yearId,
          };
          this.state.classes.push(newClass);

          // Sections
          const oldSections = this.state.sections.filter(sec => sec.classId === oldClass.id);
          const sectionIdMap: Record<string, string> = {};
          for (const oldSec of oldSections) {
            const newSecId = `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            sectionIdMap[oldSec.id] = newSecId;
            this.state.sections.push({
              ...oldSec,
              id: newSecId,
              classId: newClassId,
            });
          }

          // Subjects
          const oldSubjects = this.state.subjects.filter(sub => sub.classId === oldClass.id);
          const subjectIdMap: Record<string, string> = {};
          for (const oldSub of oldSubjects) {
            const newSubId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            subjectIdMap[oldSub.id] = newSubId;
            this.state.subjects.push({
              ...oldSub,
              id: newSubId,
              classId: newClassId,
            });
          }

          // Remap students of yearId
          this.state.students.forEach(s => {
            if (s.classId === oldClass.id && s.academicYearId === yearId) {
              s.classId = newClassId;
              if (s.sectionId && sectionIdMap[s.sectionId]) {
                s.sectionId = sectionIdMap[s.sectionId];
              }
            }
          });

          // Remap grades of yearId
          const updatedGradesMap: Record<string, GradeRecord> = {};
          Object.entries(this.state.grades).forEach(([k, g]) => {
            if (g.classId === oldClass.id && g.academicYearId === yearId) {
              const updatedSecId = (g.sectionId && sectionIdMap[g.sectionId]) ? sectionIdMap[g.sectionId] : g.sectionId;
              const updatedSubId = (g.subjectId && subjectIdMap[g.subjectId]) ? subjectIdMap[g.subjectId] : g.subjectId;
              const newKey = buildGradeKey(g.academicYearId, newClassId, updatedSecId, updatedSubId, g.studentId);

              updatedGradesMap[newKey] = {
                ...g,
                id: newKey,
                classId: newClassId,
                sectionId: updatedSecId,
                subjectId: updatedSubId,
              };
            } else {
              updatedGradesMap[k] = g;
            }
          });
          this.state.grades = updatedGradesMap;

          // Remap decision grants of yearId
          if (this.state.decisionGrants) {
            const updatedGrantsMap: Record<string, DecisionGrantRecord> = {};
            Object.entries(this.state.decisionGrants).forEach(([k, g]) => {
              if (g.classId === oldClass.id && g.academicYearId === yearId) {
                const updatedSecId = (g.sectionId && sectionIdMap[g.sectionId]) ? sectionIdMap[g.sectionId] : g.sectionId;
                const updatedSubId = (g.subjectId && subjectIdMap[g.subjectId]) ? subjectIdMap[g.subjectId] : g.subjectId;
                const newKey = buildDecisionKey(g.academicYearId, newClassId, updatedSecId, g.studentId, updatedSubId, g.round);

                updatedGrantsMap[newKey] = {
                  ...g,
                  id: newKey,
                  classId: newClassId,
                  sectionId: updatedSecId,
                  subjectId: updatedSubId,
                };
              } else {
                updatedGrantsMap[k] = g;
              }
            });
            this.state.decisionGrants = updatedGrantsMap;
          }
        }
      }
    }

    if (needsFullNotify) {
      await this.notify(true);
    }
  }

  private async syncBackupInfo() {
    if (!this.isElectron) return;
    try {
      const info = await window.electronAPI!.db.getBackupsInfo();
      this.state.lastAutoBackupDate = info.lastBackup || undefined;
      this.state.backupsCount = info.backupsCount;
    } catch (e) { console.error('Backup info sync error', e); }
  }

  private async loadFromSqlite() {
    const db = window.electronAPI!.db;
    try {
      const data = await db.loadAll();
      if (data.users?.length) {
        this.state.users = data.users.map((u: any) => ({ ...u, isActive: !!u.isActive, mustChangePassword: !!u.mustChangePassword }));
      }
      this.state.academicYears = (data.academicYears || []).map((y: any) => ({ ...y, isCurrent: !!y.isCurrent }));
      this.state.classes = data.classes || [];
      this.state.sections = data.sections || [];
      this.state.subjects = data.subjects || [];
      this.state.students = (data.students || []).map((s: any) => ({ ...s, isGeneralExempt: !!s.isGeneralExempt, individualExemptions: s.individualExemptions ? JSON.parse(s.individualExemptions) : [] }));
      const gradeMap: Record<string, GradeRecord> = {};
      (data.grades || []).forEach((g: any) => {
        gradeMap[g.id] = { ...g, auditHistory: g.auditHistory ? JSON.parse(g.auditHistory) : [], isIndividualExempt: !!g.isIndividualExempt };
      });
      this.state.grades = gradeMap;
      (data.settings || []).forEach((row: any) => {
        if (row.key === 'app_settings') {
          try {
            const parsed = JSON.parse(row.value);
            this.state.settings = { ...this.state.settings, ...parsed };
          } catch (e) {
            console.warn('Failed parsing app_settings from SQLite', e);
          }
        } else if (row.key === 'database_version') {
          this.state.version = row.value;
        } else if (row.key === 'security_access_code') {
          try {
            const sec = JSON.parse(row.value);
            if (sec && sec.isConfigured) {
              this.state.settings.isAccessCodeConfigured = true;
              this.state.settings.accessCodeHash = sec.hash;
              this.state.settings.accessCodeSalt = sec.salt;
              this.state.settings.accessCodeCreatedAt = sec.createdAt;
            }
          } catch (e) {
            console.warn('Failed parsing security_access_code', e);
          }
        }
      });

      // Secondary check from localStorage if present
      if (!this.state.settings.isAccessCodeConfigured) {
        try {
          if (localStorage.getItem('school_app_access_code_configured') === 'true') {
            this.state.settings.isAccessCodeConfigured = true;
          }
        } catch {
          // ignore
        }
      }

      const exMap: Record<string, ExemptionSettings> = {};
      (data.exemptionSettings || []).forEach((s: any) => {
        exMap[s.academicYearId] = { 
          academicYearId: s.academicYearId,
          generalMinAverage: Number(s.generalMinAverage) || 85,
          generalMinSubjectScore: Number(s.generalMinSubjectScore) || 75,
          enableGeneralJabr: !!s.enableGeneralJabr, 
          isGeneralExemptionEnabled: s.isGeneralExemptionEnabled !== false && s.isGeneralExemptionEnabled !== 0,
          individualMinScore: Number(s.individualMinScore) || 90,
          isIndividualExemptionEnabled: s.isIndividualExemptionEnabled !== false && s.isIndividualExemptionEnabled !== 0,
          isConfigured: !!s.isConfigured,
          updatedAt: s.updatedAt,
        };
      });
      this.state.exemptionSettings = exMap;
      const decSettingsMap: Record<string, AcademicYearDecisionSettings> = {};
      (data.decisionSettings || []).forEach((s: any) => { decSettingsMap[s.academicYearId] = s; });
      this.state.decisionSettings = decSettingsMap;
      const grantsMap: Record<string, DecisionGrantRecord> = {};
      (data.decisionGrants || []).forEach((g: any) => { grantsMap[g.id] = g; });
      this.state.decisionGrants = grantsMap;
      const templateRow = (data.certificateTemplates || []).find((r: any) => r.id === 'default');
      if (templateRow) {
        this.state.certificateTemplate = JSON.parse(templateRow.config);
        if (templateRow.imageData && this.state.certificateTemplate) {
          this.state.certificateTemplate.templateImage = templateRow.imageData;
        }
      }
      this.state.promotionLogs = data.promotionLogs || [];
    } catch (e) { console.error('Load from SQLite error', e); }
  }

  private async persistToSqlite(state: DatabaseState, updatedEntity?: { type: 'grade', data: GradeRecord }) {
    if (!this.isElectron || !this.isReady) return;
    const db = window.electronAPI!.db;
    try {
      // OPTIMIZATION: If we have a specific entity to update, only update that one for performance
      if (updatedEntity && updatedEntity.type === 'grade') {
        await db.upsertGrade(updatedEntity.data);
        return;
      }

      await db.saveSettings('app_settings', state.settings);
      await db.saveSettings('database_version', state.version);
      if (state.settings.isAccessCodeConfigured) {
        await db.saveSettings('security_access_code', {
          isConfigured: true,
          hash: state.settings.accessCodeHash,
          salt: state.settings.accessCodeSalt,
          createdAt: state.settings.accessCodeCreatedAt,
        });
      }
      for (const u of state.users || []) await db.upsertUser(u);
      for (const y of state.academicYears) await db.upsertYear(y);
      for (const c of state.classes) await db.upsertClass(c);
      for (const s of state.sections) await db.upsertSection(s);
      for (const sub of state.subjects) await db.upsertSubject(sub);
      for (const stu of state.students) await db.upsertStudent(stu);
      for (const g of Object.values(state.grades)) await db.upsertGrade(g);
      for (const s of Object.values(state.exemptionSettings || {})) await db.saveExemptionSettings(s);
      for (const s of Object.values(state.decisionSettings || {})) await db.saveDecisionSettings(s);
      for (const g of Object.values(state.decisionGrants || {})) await db.upsertDecisionGrant(g);
      if (state.certificateTemplate) {
        const { templateImage, ...configOnly } = state.certificateTemplate;
        await db.saveCertificateTemplate(configOnly, templateImage);
      }
      for (const l of state.promotionLogs || []) await db.upsertPromotionLog(l);
    } catch (e) {
      console.error('SQLite persist error', e);
      throw new Error(`فشل الحفظ في قاعدة البيانات: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`);
    }
  }

  private loadFromStorage(): DatabaseState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.academicYears && parsed.grades) {
          if (localStorage.getItem('school_app_access_code_configured') === 'true') {
            if (parsed.settings) parsed.settings.isAccessCodeConfigured = true;
          }
          return parsed;
        }
      }
    } catch (e) { console.warn('localStorage load error', e); }
    const empty = this.getInitialEmptyState();
    try {
      if (localStorage.getItem('school_app_access_code_configured') === 'true') {
        empty.settings.isAccessCodeConfigured = true;
      }
    } catch {
      // ignore
    }
    return empty;
  }

  private async notify(persistOrEntity: { type: 'grade', data: GradeRecord } | boolean = true) {
    const shouldPersist = persistOrEntity !== false;
    const entity = typeof persistOrEntity === 'object' ? persistOrEntity : undefined;
    
    if (shouldPersist) {
      await this.persistToDisk(this.state, entity);
    }
    requestAnimationFrame(() => this.listeners.forEach(cb => cb()));
  }

  private async persistToDisk(state: DatabaseState, updatedEntity?: { type: 'grade', data: GradeRecord }) {
    if (this.isElectron) {
      await this.persistToSqlite(state, updatedEntity);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, certificateTemplate: state.certificateTemplate ? { ...state.certificateTemplate, templateImage: undefined } : undefined }));
    }
  }

  public subscribe(cb: () => void) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  public getState(): DatabaseState { return { ...this.state, grades: { ...this.state.grades }, decisionGrants: { ...(this.state.decisionGrants || {}) } }; }

  public getGradeRecord(key: string) { return this.state.grades[key]; }
  public async saveGradeField(ay: string, cl: string, sec: string, sub: string, st: string, field: string, fieldAr: string, val: number | null, reason?: string) {
    const key = buildGradeKey(ay, cl, sec, sub, st);
    const existing = this.state.grades[key] || { id: key, academicYearId: ay, classId: cl, sectionId: sec, subjectId: sub, studentId: st, term1Score: null, midtermScore: null, term2Score: null, termYearlyScore: null, finalExamScore: null, finalScore: null, secondRoundScore: null, secondRoundFinalScore: null, lastUpdated: new Date().toISOString(), auditHistory: [] };
    const oldVal = (existing as any)[field];
    const updated: GradeRecord = { ...existing, [field]: val, lastUpdated: new Date().toISOString(), auditHistory: existing.auditHistory ? [...existing.auditHistory] : [] };
    if (oldVal !== val) updated.auditHistory?.push({ field: field as any, fieldArabic: fieldAr, oldValue: oldVal, newValue: val, timestamp: new Date().toISOString(), reason });
    const { termYearlyScore, finalScore, secondRoundFinalScore } = recalculateGradeRecord(updated, this.state.settings.roundingRule);
    updated.termYearlyScore = termYearlyScore; updated.finalScore = finalScore; updated.secondRoundFinalScore = secondRoundFinalScore;
    
    // Safety check: Don't overwrite with invalid keys (sectionId can be empty string for classes without sections)
    if (!ay || !cl || !sub || !st) {
      return { success: false, error: 'بيانات السجل غير مكتملة (العام، الصف، المادة، أو الطالب مفقود)' };
    }

    const prevState = { ...this.state.grades };
    try {
      this.state.grades = { ...this.state.grades, [key]: updated };
      this.revalidateStudentDecisionGrants(st, ay);
      await this.notify({ type: 'grade', data: updated });
      return { success: true, record: updated };
    } catch (error) {
      // Rollback memory state if persistence fails
      this.state.grades = prevState;
      console.error('Failed to save grade:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'فشل الحفظ في قاعدة البيانات' 
      };
    }
  }

  public updateSettings(s: Partial<AppSettings>) { this.state.settings = { ...this.state.settings, ...s }; this.notify(); }

  public whenReady(): Promise<void> {
    return this.initPromise;
  }

  public isAccessCodeConfigured(): boolean {
    return !!(
      this.state.settings?.isAccessCodeConfigured ||
      localStorage.getItem('school_app_access_code_configured') === 'true'
    );
  }

  public async saveAccessCode(code: string, newAdminPassword?: string): Promise<{ success: boolean; error?: string }> {
    const cleanCode = code ? code.trim() : '';
    if (cleanCode.length < 4) {
      return { success: false, error: 'يجب ألا يقل رمز الدخول عن 4 خانات أو أرقام.' };
    }

    try {
      const salt = generateSalt();
      const hash = await hashPassword(cleanCode, salt);

      this.state.settings = {
        ...this.state.settings,
        isAccessCodeConfigured: true,
        accessCodeHash: hash,
        accessCodeSalt: salt,
        accessCodeCreatedAt: new Date().toISOString(),
      };

      // Ensure default admin does not get stuck in mustChangePassword loop
      if (this.state.users) {
        this.state.users = this.state.users.map((u) => {
          if (u.username === 'admin') {
            return { ...u, mustChangePassword: false };
          }
          return u;
        });
      }

      // If new admin password provided, update it
      if (newAdminPassword && newAdminPassword.length >= 6) {
        const adminUser = this.state.users?.find((u) => u.username === 'admin');
        if (adminUser) {
          const pSalt = generateSalt();
          const pHash = await hashPassword(newAdminPassword, pSalt);
          adminUser.passwordHash = pHash;
          adminUser.salt = pSalt;
          adminUser.mustChangePassword = false;
        }
      }

      try {
        localStorage.setItem('school_app_access_code_configured', 'true');
      } catch (e) {
        console.warn(e);
      }

      if (this.isElectron && window.electronAPI?.db) {
        await window.electronAPI.db.saveSettings('app_settings', this.state.settings);
        await window.electronAPI.db.saveSettings('security_access_code', {
          isConfigured: true,
          hash,
          salt,
          createdAt: new Date().toISOString(),
        });
        const adminUser = this.state.users?.find((u) => u.username === 'admin');
        if (adminUser) {
          await window.electronAPI.db.upsertUser(adminUser);
        }
      }

      this.notify(true);
      return { success: true };
    } catch (err: any) {
      console.error('Failed to save access code:', err);
      return { success: false, error: err.message || 'حدث خطأ أثناء حفظ رمز الدخول' };
    }
  }

  public async verifyAccessCode(inputCode: string): Promise<boolean> {
    if (!this.state.settings.accessCodeHash || !this.state.settings.accessCodeSalt) {
      return false;
    }
    const clean = inputCode ? inputCode.trim() : '';
    const hash = await hashPassword(clean, this.state.settings.accessCodeSalt);
    return hash.toLowerCase() === this.state.settings.accessCodeHash.toLowerCase();
  }
  public getExemptionSettings(ay: string): ExemptionSettings {
    const s = this.state.exemptionSettings?.[ay];
    if (!s) return this.getDefaultExemptionSettings(ay);
    return {
      academicYearId: ay,
      generalMinAverage: typeof s.generalMinAverage === 'number' ? s.generalMinAverage : 85,
      generalMinSubjectScore: typeof s.generalMinSubjectScore === 'number' ? s.generalMinSubjectScore : 75,
      enableGeneralJabr: !!s.enableGeneralJabr,
      isGeneralExemptionEnabled: s.isGeneralExemptionEnabled !== false && (s.isGeneralExemptionEnabled as any) !== 0,
      individualMinScore: typeof s.individualMinScore === 'number' ? s.individualMinScore : 90,
      isIndividualExemptionEnabled: s.isIndividualExemptionEnabled !== false && (s.isIndividualExemptionEnabled as any) !== 0,
      isConfigured: !!s.isConfigured,
      updatedAt: s.updatedAt,
    };
  }
  public saveExemptionSettings(s: ExemptionSettings) {
    if (!this.state.exemptionSettings) this.state.exemptionSettings = {};
    const normalized: ExemptionSettings = {
      academicYearId: s.academicYearId,
      generalMinAverage: typeof s.generalMinAverage === 'number' ? s.generalMinAverage : 85,
      generalMinSubjectScore: typeof s.generalMinSubjectScore === 'number' ? s.generalMinSubjectScore : 75,
      enableGeneralJabr: !!s.enableGeneralJabr,
      isGeneralExemptionEnabled: s.isGeneralExemptionEnabled !== false && (s.isGeneralExemptionEnabled as any) !== 0,
      individualMinScore: typeof s.individualMinScore === 'number' ? s.individualMinScore : 90,
      isIndividualExemptionEnabled: s.isIndividualExemptionEnabled !== false && (s.isIndividualExemptionEnabled as any) !== 0,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };
    this.state.exemptionSettings[s.academicYearId] = normalized;
    this.notify();
  }
  public getDefaultExemptionSettings(ay: string): ExemptionSettings {
    return {
      academicYearId: ay,
      generalMinAverage: 85,
      generalMinSubjectScore: 75,
      enableGeneralJabr: false,
      isGeneralExemptionEnabled: true,
      individualMinScore: 90,
      isIndividualExemptionEnabled: true,
      isConfigured: false,
    };
  }
  public getDecisionSettings(ay: string) { return this.state.decisionSettings?.[ay] || { academicYearId: ay, maxFailedSubjectsAllowed: 4, primaryAssistanceMarks: 10, secondRoundAdditionalAssistanceMarks: 0, notes: 'إعدادات القرار الوزاري', updatedAt: new Date().toISOString() }; }
  public saveDecisionSettings(s: AcademicYearDecisionSettings) { if (!this.state.decisionSettings) this.state.decisionSettings = {}; this.state.decisionSettings[s.academicYearId] = { ...s, updatedAt: new Date().toISOString() }; this.notify(); }
  
  public getDecisionGrants(): Record<string, DecisionGrantRecord> { return this.state.decisionGrants || {}; }
  public getDecisionGrant(ay: string, cl: string, sec: string, st: string, sub: string, rd: string) { return this.getDecisionGrants()[buildDecisionKey(ay, cl, sec, st, sub, rd)]; }
  public getStudentDecisionGrants(st: string, ay: string, rd?: string) { return Object.values(this.getDecisionGrants()).filter(g => g.studentId === st && g.academicYearId === ay && (!rd || g.round === rd)); }
  public getStudentDecisionBalance(st: string, ay: string, rd: string) {
    const s = this.getDecisionSettings(ay); const r1g = this.getStudentDecisionGrants(st, ay, 'round1'); const pUsed = r1g.reduce((sum, g) => sum + g.appliedMarks, 0); const pPool = s.primaryAssistanceMarks; const pRem = Math.max(0, pPool - pUsed);
    const r2a = s.secondRoundAdditionalAssistanceMarks || 0; const r2p = pRem + r2a; const r2g = this.getStudentDecisionGrants(st, ay, 'round2'); const r2u = r2g.reduce((sum, g) => sum + g.appliedMarks, 0); const r2r = Math.max(0, r2p - r2u);
    return rd === 'round1' ? { totalPool: pPool, usedMarks: pUsed, remainingMarks: pRem, primaryPool: pPool, primaryUsed: pUsed, primaryRemaining: pRem, secondRoundAdditional: r2a } : { totalPool: r2p, usedMarks: r2u, remainingMarks: r2r, primaryPool: pPool, primaryUsed: pUsed, primaryRemaining: pRem, secondRoundAdditional: r2a };
  }

  public grantDecision(p: any): { success: boolean; grant?: DecisionGrantRecord; error?: string } {
    const key = buildDecisionKey(p.academicYearId, p.classId, p.sectionId, p.studentId, p.subjectId, p.round);
    if (this.state.decisionGrants?.[key]) return { success: false, error: 'ممنوح مسبقاً' };
    const grade = this.state.grades[buildGradeKey(p.academicYearId, p.classId, p.sectionId, p.subjectId, p.studentId)];
    if (!grade) return { success: false, error: 'لا يوجد درجات' };
    const sub = this.state.subjects.find(s => s.id === p.subjectId); if (!sub) return { success: false, error: 'المادة غير موجودة' };
    const score = p.round === 'round1' ? calculateFinalScore(grade.termYearlyScore!, grade.finalExamScore!, this.state.settings.roundingRule) : calculateSecondRoundFinalScore(grade.termYearlyScore!, grade.secondRoundScore!, this.state.settings.roundingRule);
    if (score === null || score >= sub.passScore) return { success: false, error: 'لا حاجة للقرار' };
    const needed = sub.passScore - score; const bal = this.getStudentDecisionBalance(p.studentId, p.academicYearId, p.round);
    if (bal.remainingMarks < needed) return { success: false, error: 'رصيد غير كافٍ' };
    const newGrant: DecisionGrantRecord = { id: key, ...p, originalScore: score, appliedMarks: needed, finalScoreAfterDecision: sub.passScore, requiredPassScore: sub.passScore, grantedAt: new Date().toISOString() };
    this.state.decisionGrants = { ...this.state.decisionGrants, [key]: newGrant };
    this.notify(); return { success: true, grant: newGrant };
  }

  public revokeDecision(ay: string, cl: string, sec: string, st: string, sub: string, rd: string) {
    const key = buildDecisionKey(ay, cl, sec, st, sub, rd);
    if (!this.state.decisionGrants?.[key]) return { success: false, message: 'القرار غير موجود' };
    delete this.state.decisionGrants[key];
    if (this.isElectron) window.electronAPI!.db.deleteEntity('decision_grants', key).catch(e => console.error(e));
    this.notify(); return { success: true, message: 'تم الإلغاء' };
  }

  public revalidateStudentDecisionGrants(st: string, ay: string) {
    if (!this.state.decisionGrants) return; let changed = false;
    Object.values(this.state.decisionGrants).forEach(g => {
      if (g.studentId === st && g.academicYearId === ay) {
        const grade = this.state.grades[buildGradeKey(ay, g.classId, g.sectionId, g.subjectId, st)];
        const score = g.round === 'round1' ? calculateFinalScore(grade?.termYearlyScore || 0, grade?.finalExamScore || 0, this.state.settings.roundingRule) : calculateSecondRoundFinalScore(grade?.termYearlyScore || 0, grade?.secondRoundScore || 0, this.state.settings.roundingRule);
        const pass = this.state.subjects.find(s => s.id === g.subjectId)?.passScore || 50;
        if (score === null || score >= pass) {
          delete this.state.decisionGrants![g.id]; if (this.isElectron) window.electronAPI!.db.deleteEntity('decision_grants', g.id).catch(e => console.error(e));
          changed = true;
        }
      }
    });
    if (changed) this.notify();
  }

  public addStudent(s: any) {
    const id = s.id || `stu-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const reg = s.registrationNumber ? String(s.registrationNumber).trim() : undefined;
    const phone = s.fatherPhone ? String(s.fatherPhone).trim() : undefined;
    const sec = s.sectionId ? String(s.sectionId).trim() : '';
    const res: Student = {
      ...s,
      id,
      seatNumber: s.seatNumber || (this.state.students.length + 1),
      registrationNumber: reg || undefined,
      fatherPhone: phone || undefined,
      sectionId: sec,
    };
    this.state.students.push(res);
    this.notify();
    return res;
  }
  public updateStudent(s: Student) {
    const reg = s.registrationNumber ? String(s.registrationNumber).trim() : undefined;
    const phone = s.fatherPhone ? String(s.fatherPhone).trim() : undefined;
    const sec = s.sectionId ? String(s.sectionId).trim() : '';
    const cleanStudent: Student = {
      ...s,
      registrationNumber: reg || undefined,
      fatherPhone: phone || undefined,
      sectionId: sec,
    };
    this.state.students = this.state.students.map(x => x.id === s.id ? cleanStudent : x);
    this.notify();
  }
  public async deleteStudent(id: string) {
    const prevState = { 
      students: [...this.state.students], 
      grades: { ...this.state.grades },
      decisionGrants: { ...(this.state.decisionGrants || {}) }
    };

    try {
      // 1. Persistence: atomic cascade delete in SQLite if running in Electron
      if (this.isElectron) {
        const result = await window.electronAPI!.db.deleteStudentCascade(id);
        if (result && result.success === false) {
          throw new Error('فشل تنفيذ حذف الطالب وسجلاته من قاعدة البيانات SQLite');
        }
      }

      // 2. Memory update: remove student
      this.state.students = this.state.students.filter(s => s.id !== id);
      
      // 3. Memory update: remove linked grades
      const remainingGrades: Record<string, GradeRecord> = {};
      Object.entries(this.state.grades).forEach(([k, g]) => { 
        if (g.studentId !== id) remainingGrades[k] = g; 
      });
      this.state.grades = remainingGrades;

      // 4. Memory update: remove linked decision grants
      const remainingGrants: Record<string, DecisionGrantRecord> = {};
      if (this.state.decisionGrants) {
        Object.entries(this.state.decisionGrants).forEach(([k, g]) => {
          if (g.studentId !== id) remainingGrants[k] = g;
        });
        this.state.decisionGrants = remainingGrants;
      }

      if (!this.isElectron) {
        // LocalStorage fallback (notify will handle full persistence to localStorage)
        await this.notify();
      } else {
        // Electron mode: notify UI listeners to update React components without re-saving
        this.notify(false);
      }

      return { success: true };
    } catch (error) {
      // Rollback memory state on failure
      this.state.students = prevState.students;
      this.state.grades = prevState.grades;
      this.state.decisionGrants = prevState.decisionGrants;
      console.error('Failed to delete student:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'فشل حذف الطالب من قاعدة البيانات' 
      };
    }
  }
  public isRegistrationNumberTaken(n?: string, id?: string, ay?: string): { isTaken: boolean; existingStudent?: Student } {
    const clean = (n || '').trim();
    if (!clean) return { isTaken: false };
    const s = this.state.students.find(x => x.registrationNumber && x.registrationNumber.trim() === clean && x.id !== id && (!ay || x.academicYearId === ay));
    return { isTaken: !!s, existingStudent: s };
  }
  public transferStudent(id: string, cl: string, sec: string, options?: { isCorrection?: boolean }) {
    const s = this.state.students.find(x => x.id === id);
    if (s) {
      const oldClassId = s.classId;
      s.classId = cl;
      s.sectionId = (sec || '').trim();

      if (options?.isCorrection && oldClassId !== cl) {
        const updatedGrades: Record<string, GradeRecord> = {};
        Object.entries(this.state.grades).forEach(([k, g]) => {
          if (g.studentId === id && g.classId === oldClassId && g.academicYearId === s.academicYearId) {
            const newKey = buildGradeKey(g.academicYearId, cl, (sec || '').trim(), g.subjectId, id);
            updatedGrades[newKey] = {
              ...g,
              id: newKey,
              classId: cl,
              sectionId: (sec || '').trim()
            };
          } else {
            updatedGrades[k] = g;
          }
        });
        this.state.grades = updatedGrades;
      }
      this.notify(true);
    }
    return { success: true, message: 'تم النقل بنجاح' };
  }

  public addStudentsBatch(list: any[]) {
    list.forEach(s => this.addStudent(s));
    return { addedCount: list.length, rejectedCount: 0, errors: [] };
  }

  public addClass(c: Partial<SchoolClass>) {
    const id = `cls-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const currentYear = this.state.academicYears.find(y => y.isCurrent) || this.state.academicYears[0];
    const res: SchoolClass = {
      id,
      name: (c.name || '').trim(),
      stage: c.stage || 'إعدادي',
      order: c.order || (this.state.classes.length + 1),
      academicYearId: c.academicYearId || currentYear?.id || '',
      isArchived: false,
    };
    this.state.classes.push(res);
    this.notify(true);
    return res;
  }

  public updateClass(c: SchoolClass) {
    this.state.classes = this.state.classes.map(x => x.id === c.id ? c : x);
    this.notify(true);
    return { success: true, message: 'تم التعديل' };
  }

  public archiveClass(classId: string, isArchived: boolean = true) {
    const cls = this.state.classes.find(c => c.id === classId);
    if (cls) {
      cls.isArchived = isArchived;
      this.notify(true);
      return { success: true, message: isArchived ? 'تم أرشفة الصف وإغلاقه بنجاح' : 'تم تفعيل الصف' };
    }
    return { success: false, error: 'الصف غير موجود' };
  }

  public async deleteClassCascade(classId: string) {
    const prevState = {
      classes: [...this.state.classes],
      sections: [...this.state.sections],
      subjects: [...this.state.subjects],
      students: [...this.state.students],
      grades: { ...this.state.grades },
      decisionGrants: { ...(this.state.decisionGrants || {}) },
    };

    try {
      if (this.isElectron) {
        const res = await window.electronAPI!.db.deleteClassCascade(classId);
        if (res && res.success === false) {
          throw new Error('فشل تنفيذ حذف الصف وسجلاته من SQLite');
        }
      }

      this.state.classes = this.state.classes.filter(c => c.id !== classId);
      this.state.sections = this.state.sections.filter(s => s.classId !== classId);
      this.state.subjects = this.state.subjects.filter(s => s.classId !== classId);
      this.state.students = this.state.students.filter(s => s.classId !== classId);

      const remainingGrades: Record<string, GradeRecord> = {};
      Object.entries(this.state.grades).forEach(([k, g]) => {
        if (g.classId !== classId) remainingGrades[k] = g;
      });
      this.state.grades = remainingGrades;

      if (this.state.decisionGrants) {
        const remainingGrants: Record<string, DecisionGrantRecord> = {};
        Object.entries(this.state.decisionGrants).forEach(([k, g]) => {
          if (g.classId !== classId) remainingGrants[k] = g;
        });
        this.state.decisionGrants = remainingGrants;
      }

      if (!this.isElectron) {
        await this.notify(true);
      } else {
        this.notify(false);
      }

      return { success: true };
    } catch (err) {
      this.state.classes = prevState.classes;
      this.state.sections = prevState.sections;
      this.state.subjects = prevState.subjects;
      this.state.students = prevState.students;
      this.state.grades = prevState.grades;
      this.state.decisionGrants = prevState.decisionGrants;
      return { success: false, error: err instanceof Error ? err.message : 'فشل حذف الصف' };
    }
  }

  public isClassNameTaken(n: string, id?: string, academicYearId?: string) {
    return this.state.classes.some(c =>
      c.name.trim().toLowerCase() === n.trim().toLowerCase() &&
      c.id !== id &&
      (!academicYearId || c.academicYearId === academicYearId)
    );
  }

  // --- Academic Years ---
  public addAcademicYear(y: { name: string; isCurrent?: boolean }) {
    const id = `ay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newYear: AcademicYear = {
      id,
      name: y.name.trim(),
      isCurrent: !!y.isCurrent,
    };
    if (newYear.isCurrent) {
      this.state.academicYears.forEach(x => x.isCurrent = false);
    }
    this.state.academicYears.push(newYear);
    this.notify(true);
    return { success: true, year: newYear, message: 'تمت إضافة العام الدراسي بنجاح' };
  }

  public setCurrentYear(id: string) {
    this.state.academicYears.forEach(x => x.isCurrent = x.id === id);
    this.notify(true);
    return { success: true, message: 'تم تعيين العام الدراسي الحالي بنجاح' };
  }

  public updateAcademicYear(idOrYear: string | AcademicYear, newName?: string) {
    const yearId = typeof idOrYear === 'string' ? idOrYear : idOrYear.id;
    const name = typeof idOrYear === 'string' ? newName || '' : idOrYear.name;

    const existing = this.state.academicYears.find(x => x.id === yearId);
    if (!existing) {
      return { success: false, message: 'العام الدراسي غير موجود' };
    }

    if (typeof idOrYear === 'object') {
      this.state.academicYears = this.state.academicYears.map(x => x.id === yearId ? idOrYear : x);
    } else {
      existing.name = name.trim();
    }

    this.notify(true);
    return { success: true, message: 'تم تعديل العام الدراسي بنجاح' };
  }

  public canDeleteAcademicYear(id: string) {
    const studentCount = this.state.students.filter(s => s.academicYearId === id).length;
    const gradeCount = Object.values(this.state.grades).filter(g => g.academicYearId === id).length;
    const isBlocked = studentCount > 0 || gradeCount > 0;

    return {
      allowed: !isBlocked,
      canDelete: !isBlocked,
      reason: isBlocked ? 'العام الدراسي يحتوي على طلاب أو سجلات درجات مسجلة.' : undefined,
      message: isBlocked ? 'العام الدراسي يحتوي على طلاب أو سجلات درجات مسجلة.' : undefined,
      counts: { students: studentCount, grades: gradeCount },
    };
  }

  public deleteAcademicYear(id: string) {
    const check = this.canDeleteAcademicYear(id);
    if (!check.allowed) return { success: false, message: check.reason };
    this.state.academicYears = this.state.academicYears.filter(x => x.id !== id);
    if (this.isElectron) window.electronAPI!.db.deleteEntity('academic_years', id).catch(e => console.error(e));
    this.notify(true);
    return { success: true, message: 'تم حذف العام الدراسي بنجاح' };
  }

  // --- Classes ---
  public deleteClass(classId: string) {
    const hasSections = this.state.sections.some(s => s.classId === classId);
    const hasStudents = this.state.students.some(s => s.classId === classId);
    const hasSubjects = this.state.subjects.some(s => s.classId === classId);
    const hasGrades = Object.values(this.state.grades).some(g => g.classId === classId);

    if (hasSections || hasStudents || hasSubjects || hasGrades) {
      return { success: false, message: 'تعذر حذف الصف لوجود بيانات وسجلات شعب أو طلاب أو مواد مرتبطة به.' };
    }

    this.state.classes = this.state.classes.filter(c => c.id !== classId);
    if (this.isElectron) window.electronAPI!.db.deleteEntity('classes', classId).catch(e => console.error(e));
    this.notify(true);
    return { success: true };
  }

  // --- Sections ---
  public isSectionNameTaken(classId: string, name: string, id?: string) {
    return this.state.sections.some(s =>
      s.classId === classId &&
      s.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      s.id !== id
    );
  }

  public addSection(s: { classId: string; name: string }) {
    const id = `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newSection: Section = {
      id,
      classId: s.classId,
      name: s.name.trim(),
    };
    this.state.sections.push(newSection);
    this.notify(true);
    return newSection;
  }

  public updateSection(s: Section) {
    this.state.sections = this.state.sections.map(x => x.id === s.id ? s : x);
    this.notify(true);
    return { success: true, message: 'تم تعديل اسم الشعبة' };
  }

  public deleteSection(sectionId: string) {
    const hasStudents = this.state.students.some(s => s.sectionId === sectionId);
    const hasGrades = Object.values(this.state.grades).some(g => g.sectionId === sectionId);
    if (hasStudents || hasGrades) {
      return { success: false, message: 'تعذر حذف الشعبة لاحتوائها على طلاب أو سجلات درجات' };
    }

    this.state.sections = this.state.sections.filter(s => s.id !== sectionId);
    if (this.isElectron) window.electronAPI!.db.deleteEntity('sections', sectionId).catch(e => console.error(e));
    this.notify(true);
    return { success: true };
  }

  // --- Subjects ---
  public addSubject(s: { classId: string; name: string; maxScore?: number; passScore?: number; order?: number }) {
    const id = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newSubject: Subject = {
      id,
      classId: s.classId,
      name: s.name.trim(),
      maxScore: s.maxScore || 100,
      passScore: s.passScore || 50,
      order: s.order || (this.state.subjects.filter(sub => sub.classId === s.classId).length + 1),
    };
    this.state.subjects.push(newSubject);
    this.notify(true);
    return newSubject;
  }

  public updateSubject(s: Subject) {
    this.state.subjects = this.state.subjects.map(x => x.id === s.id ? s : x);
    this.notify(true);
    return { success: true, message: 'تم تعديل المادة' };
  }

  public deleteSubject(subjectId: string) {
    this.state.subjects = this.state.subjects.filter(s => s.id !== subjectId);
    if (this.isElectron) window.electronAPI!.db.deleteEntity('subjects', subjectId).catch(e => console.error(e));
    this.notify(true);
    return { success: true };
  }

  public reorderSubjects(classId: string, orderedSubjectIds: string[]) {
    orderedSubjectIds.forEach((id, index) => {
      const sub = this.state.subjects.find(s => s.id === id);
      if (sub) {
        sub.order = index + 1;
      }
    });
    this.notify(true);
    return { success: true };
  }

  public copyClassesAndSubjectsFromYear(sourceYearId: string, targetYearId: string) {
    const sourceClasses = this.state.classes.filter(c => c.academicYearId === sourceYearId && !c.isArchived);
    if (sourceClasses.length === 0) {
      return { success: false, message: 'لا توجد صفوف مسجلة في العام المصدر لنقلها.' };
    }

    let addedClassesCount = 0;
    let addedSubjectsCount = 0;

    sourceClasses.forEach(sClass => {
      let targetClass = this.state.classes.find(c => c.academicYearId === targetYearId && c.name === sClass.name);
      if (!targetClass) {
        const newClassId = `cls-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        targetClass = {
          id: newClassId,
          name: sClass.name,
          stage: sClass.stage,
          order: sClass.order,
          academicYearId: targetYearId,
          isArchived: false,
        };
        this.state.classes.push(targetClass);
        addedClassesCount++;
      }

      // Copy sections
      const sourceSections = this.state.sections.filter(s => s.classId === sClass.id);
      const targetSections = this.state.sections.filter(s => s.classId === targetClass!.id);
      sourceSections.forEach(sSec => {
        if (!targetSections.some(ts => ts.name === sSec.name)) {
          this.state.sections.push({
            id: `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            classId: targetClass!.id,
            name: sSec.name,
          });
        }
      });

      // Copy subjects
      const sourceSubjects = this.state.subjects.filter(s => s.classId === sClass.id);
      const targetSubjects = this.state.subjects.filter(s => s.classId === targetClass!.id);
      sourceSubjects.forEach(sSub => {
        if (!targetSubjects.some(ts => ts.name === sSub.name)) {
          this.state.subjects.push({
            id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            classId: targetClass!.id,
            name: sSub.name,
            maxScore: sSub.maxScore,
            passScore: sSub.passScore,
            order: sSub.order,
          });
          addedSubjectsCount++;
        }
      });
    });

    this.notify(true);
    return {
      success: true,
      message: `تم نسخ هيكلية الصفوف والمواد بنجاح: تم إنشاء ${addedClassesCount} صفوف و ${addedSubjectsCount} مواد دراسية للعام الجديد.`
    };
  }

  public executeStudentPromotion(p: {
    sourceYearId: string;
    targetYearId: string;
    promotions: Array<{
      sourceStudentId: string;
      studentName: string;
      registrationNumber?: string;
      fatherPhone?: string;
      nationalId?: string;
      gender?: 'male' | 'female';
      notes?: string;
      targetClassId: string | null;
      targetSectionId: string;
      action: 'promote' | 'repeat' | 'graduate' | 'exclude';
      reason: string;
    }>;
    executedBy?: string;
  }) {
    let promotedCount = 0;
    let repeatingCount = 0;
    let graduatedCount = 0;
    let excludedCount = 0;
    let skippedDuplicatesCount = 0;

    const targetYearStudents = this.state.students.filter(s => s.academicYearId === p.targetYearId);

    p.promotions.forEach(item => {
      if (item.action === 'graduate') {
        graduatedCount++;
        return;
      }
      if (item.action === 'exclude') {
        excludedCount++;
        return;
      }

      if (!item.targetClassId) {
        excludedCount++;
        return;
      }

      const cleanReg = item.registrationNumber?.trim();
      const cleanName = item.studentName.trim().toLowerCase();

      const exists = targetYearStudents.some(s => {
        if (cleanReg && s.registrationNumber && s.registrationNumber.trim() === cleanReg) return true;
        if (s.name.trim().toLowerCase() === cleanName && s.classId === item.targetClassId) return true;
        return false;
      });

      if (exists) {
        skippedDuplicatesCount++;
        return;
      }

      const newStudentId = `stu-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const targetClassStudents = targetYearStudents.filter(s => s.classId === item.targetClassId);

      const newStudent: Student = {
        id: newStudentId,
        name: item.studentName.trim(),
        registrationNumber: item.registrationNumber,
        fatherPhone: item.fatherPhone,
        nationalId: item.nationalId,
        seatNumber: targetClassStudents.length + 1,
        academicYearId: p.targetYearId,
        classId: item.targetClassId,
        sectionId: item.targetSectionId || '',
        gender: item.gender || 'male',
        notes: item.notes,
      };

      this.state.students.push(newStudent);
      targetYearStudents.push(newStudent);

      if (item.action === 'promote') promotedCount++;
      if (item.action === 'repeat') repeatingCount++;
    });

    const logId = `log-${Date.now()}`;
    const sourceYear = this.state.academicYears.find(y => y.id === p.sourceYearId)?.name || '';
    const targetYear = this.state.academicYears.find(y => y.id === p.targetYearId)?.name || '';

    const newLog: StudentPromotionBatchLog = {
      id: logId,
      date: new Date().toISOString(),
      sourceYearId: p.sourceYearId,
      sourceYearName: sourceYear,
      targetYearId: p.targetYearId,
      targetYearName: targetYear,
      promotedCount,
      repeatingCount,
      graduatedCount,
      excludedCount,
      totalProcessedCount: p.promotions.length,
      executedBy: p.executedBy || 'النظام',
    };

    if (!this.state.promotionLogs) this.state.promotionLogs = [];
    this.state.promotionLogs.unshift(newLog);

    this.notify(true);

    return {
      success: true,
      message: `تمت عملية الترحيل بنجاح: تم ترفيع ${promotedCount} طالب، وتسجيل ${repeatingCount} معيد، وتخرج ${graduatedCount} طالب (تم تجنب ${skippedDuplicatesCount} مكرر).`,
      promotedCount,
      repeatingCount,
      graduatedCount,
      excludedCount,
      skippedDuplicatesCount,
    };
  }

  public getUsers() { return this.state.users || []; }
  public getUserById(id: string) { return this.state.users?.find(u => u.id === id); }
  public addUser(u: any) { this.state.users = [...(this.state.users || []), u]; this.notify(); return { success: true, user: u, error: undefined }; }
  public updateUser(id: string, updates: any) { this.state.users = this.state.users?.map(u => u.id === id ? { ...u, ...updates } : u); this.notify(); return { success: true, error: undefined }; }
  public deleteUser(id: string) { this.state.users = this.state.users?.filter(u => u.id !== id); if (this.isElectron) window.electronAPI!.db.deleteEntity('users', id).catch(e => console.error(e)); this.notify(); return { success: true, error: undefined }; }
  public toggleUserStatus(id: string) { const u = this.getUserById(id); if (u) { u.isActive = !u.isActive; this.notify(); } return { success: true, newStatus: u?.isActive, error: undefined }; }
  public getActiveAdminsCount() { return this.state.users?.filter(u => u.role === 'admin' && u.isActive).length || 0; }
  public canDeleteUser(id: string) { return { allowed: true, reason: undefined }; }
  public updateUserLastLogin(id: string) { const u = this.getUserById(id); if (u) { u.lastLogin = new Date().toISOString(); this.notify(); } }

  public getPromotionLogs() { return this.state.promotionLogs || []; }
  public getCertificateTemplate() { if (!this.state.certificateTemplate) this.state.certificateTemplate = JSON.parse(JSON.stringify(DEFAULT_CERTIFICATE_CONFIG)); return this.state.certificateTemplate!; }
  public saveCertificateTemplate(c: any) { 
    this.state.certificateTemplate = { ...c, lastUpdated: new Date().toISOString() }; 
    this.notify(); 
  }
  public resetCertificateTemplate() { this.state.certificateTemplate = { ...JSON.parse(JSON.stringify(DEFAULT_CERTIFICATE_CONFIG)), templateImage: this.state.certificateTemplate?.templateImage }; this.notify(); return this.state.certificateTemplate!; }

  public async createManualBackup() {
    if (!this.isElectron) return { success: false, error: 'Not Electron' };
    const res = await window.electronAPI!.db.createBackup();
    await this.syncBackupInfo();
    this.notify(false);
    return res;
  }

  public exportJSON() { 
    return JSON.stringify({ 
      ...this.state, 
      lastBackupDate: new Date().toISOString(),
      exportType: 'school_grades_backup_v3'
    }, null, 2); 
  }

  public async importJSON(json: string) { 
    try { 
      const parsed = JSON.parse(json);
      // Basic validation
      if (!parsed.academicYears || !parsed.classes || !parsed.students) {
        return { success: false, message: 'ملف غير صالح أو بيانات ناقصة' };
      }

      // Safety backup if in electron
      if (this.isElectron) {
        await this.createManualBackup();
      }

      this.state = {
        ...parsed,
        version: parsed.version || '1.0.0',
        lastBackupDate: new Date().toISOString()
      }; 

      this.notify(true); // This will persist to SQLite if in electron
      return { success: true, message: 'تم استيراد البيانات بنجاح وتحديث النظام.' }; 
    } catch(e) { 
      return { success: false, message: 'خطأ في معالجة الملف.' }; 
    } 
  }

  public async exportSQLiteScript() { 
    if (this.isElectron) {
      return await window.electronAPI!.db.exportSql();
    }
    return "-- SQL export is only available in Desktop version\nSELECT 'N/A';"; 
  }

  public async restoreDbFromFile() {
    if (!this.isElectron) return { success: false, message: 'متاح فقط في نسخة ويندوز' };
    
    const filePath = await window.electronAPI!.dialog.openFile([
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }
    ]);
    
    if (!filePath) return { success: false, message: 'تم إلغاء العملية' };
    
    const res = await window.electronAPI!.db.restoreDb(filePath);
    if (res.success) {
      await this.loadFromSqlite();
      this.notify(false);
    }
    return res;
  }

  public completeSeedData() { return { newSubjectsCount: 0, newStudentsCount: 0, newGradesCount: 0 }; }
}

export const db = new LocalStorageEngine();
