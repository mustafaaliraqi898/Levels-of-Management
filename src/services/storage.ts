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
  CANONICAL_SUBJECTS,
  ADDITIONAL_DEMO_STUDENTS,
} from './seedData';

const STORAGE_KEY = 'school_grades_offline_db_v1';

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
    officialLogo: {
      x: 87,
      y: 13,
      width: 10,
      visible: true,
    },
    kuficLogo: {
      x: 13,
      y: 13,
      width: 10,
      visible: true,
    },
    studentName: {
      x: 50,
      y: 53,
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#0f172a',
      fontFamily: 'Cairo',
      textAlign: 'center',
      visible: true,
    },
    academicYear: {
      x: 78,
      y: 84,
      fontSize: 16,
      fontWeight: 'bold',
      fontColor: '#334155',
      fontFamily: 'Tajawal',
      textAlign: 'center',
      visible: true,
    },
    directorName: {
      x: 22,
      y: 84,
      fontSize: 18,
      fontWeight: 'bold',
      fontColor: '#1e293b',
      fontFamily: 'Tajawal',
      textAlign: 'center',
      visible: true,
    },
  },
};

export interface DatabaseState {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>; // key: `${academicYearId}_${classId}_${sectionId}_${subjectId}_${studentId}`
  settings: AppSettings;
  exemptionSettings?: Record<string, ExemptionSettings>; // key: academicYearId
  decisionSettings?: Record<string, AcademicYearDecisionSettings>; // key: academicYearId
  decisionGrants?: Record<string, DecisionGrantRecord>; // key: `${academicYearId}_${classId}_${sectionId}_${studentId}_${subjectId}_${round}`
  certificateTemplate?: CertificateTemplateConfig;
  users?: UserAccount[];
  promotionLogs?: StudentPromotionBatchLog[];
  version: string;
  lastBackupDate?: string;
}

// Initial realistic default data for an Arabic/Iraqi secondary school
const INITIAL_YEARS: AcademicYear[] = [
  { id: 'ay-2026-2027', name: '2026–2027', isCurrent: true },
  { id: 'ay-2025-2026', name: '2025–2026', isCurrent: false },
];

const INITIAL_CLASSES: SchoolClass[] = [
  { id: 'cls-5-sci', name: 'الخامس العلمي', stage: 'إعدادي', order: 1 },
  { id: 'cls-6-sci', name: 'السادس العلمي', stage: 'إعدادي', order: 2 },
  { id: 'cls-4-sci', name: 'الرابع العلمي', stage: 'إعدادي', order: 3 },
  { id: 'cls-3-mid', name: 'الثالث المتوسط', stage: 'متوسط', order: 4 },
];

const INITIAL_SECTIONS: Section[] = [
  { id: 'sec-5sci-a', classId: 'cls-5-sci', name: 'أ' },
  { id: 'sec-5sci-b', classId: 'cls-5-sci', name: 'ب' },
  { id: 'sec-5sci-c', classId: 'cls-5-sci', name: 'ج' },
  { id: 'sec-6sci-a', classId: 'cls-6-sci', name: 'أ' },
  { id: 'sec-6sci-b', classId: 'cls-6-sci', name: 'ب' },
  { id: 'sec-4sci-a', classId: 'cls-4-sci', name: 'أ' },
  { id: 'sec-3mid-a', classId: 'cls-3-mid', name: 'أ' },
];

const INITIAL_SUBJECTS: Subject[] = [
  { id: 'sub-math', classId: 'cls-5-sci', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 1 },
  { id: 'sub-arabic', classId: 'cls-5-sci', name: 'اللغة العربية', maxScore: 100, passScore: 50, order: 2 },
  { id: 'sub-english', classId: 'cls-5-sci', name: 'اللغة الإنكليزية', maxScore: 100, passScore: 50, order: 3 },
  { id: 'sub-physics', classId: 'cls-5-sci', name: 'الفيزياء', maxScore: 100, passScore: 50, order: 4 },
  { id: 'sub-chemistry', classId: 'cls-5-sci', name: 'الكيمياء', maxScore: 100, passScore: 50, order: 5 },
  { id: 'sub-biology', classId: 'cls-5-sci', name: 'الأحياء', maxScore: 100, passScore: 50, order: 6 },
  { id: 'sub-islamic', classId: 'cls-5-sci', name: 'التربية الإسلامية', maxScore: 100, passScore: 50, order: 7 },

  // For 6th Science
  { id: 'sub-6-math', classId: 'cls-6-sci', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 1 },
  { id: 'sub-6-arabic', classId: 'cls-6-sci', name: 'اللغة العربية', maxScore: 100, passScore: 50, order: 2 },
  { id: 'sub-6-english', classId: 'cls-6-sci', name: 'اللغة الإنكليزية', maxScore: 100, passScore: 50, order: 3 },
  { id: 'sub-6-physics', classId: 'cls-6-sci', name: 'الفيزياء', maxScore: 100, passScore: 50, order: 4 },
  { id: 'sub-6-chem', classId: 'cls-6-sci', name: 'الكيمياء', maxScore: 100, passScore: 50, order: 5 },
  { id: 'sub-6-bio', classId: 'cls-6-sci', name: 'الأحياء', maxScore: 100, passScore: 50, order: 6 },
];

const INITIAL_STUDENTS_5SCI_A: Student[] = [
  { id: 'stu-101', registrationNumber: '1001', fatherPhone: '07701234501', seatNumber: 1, nationalId: '109823441', name: 'أحمد محمد علي التميمي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-102', registrationNumber: '1002', fatherPhone: '07701234502', seatNumber: 2, nationalId: '109823442', name: 'باقر حيدر شاكر الحسني', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-103', registrationNumber: '1003', fatherPhone: '07701234503', seatNumber: 3, nationalId: '109823443', name: 'جعفر جاسم حميد الكعبي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-104', registrationNumber: '1004', fatherPhone: '07701234504', seatNumber: 4, nationalId: '109823444', name: 'حسين علي عبد الزهرة الخفاجي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-105', registrationNumber: '1005', fatherPhone: '07701234505', seatNumber: 5, nationalId: '109823445', name: 'حمزة كاظم جواد العبيدي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-106', registrationNumber: '1006', fatherPhone: '07701234506', seatNumber: 6, nationalId: '109823446', name: 'ذو الفقار صلاح مهدي الزاملي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-107', registrationNumber: '1007', fatherPhone: '07701234507', seatNumber: 7, nationalId: '109823447', name: 'رضا مهند نوري الربيعي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-108', registrationNumber: '1008', fatherPhone: '07701234508', seatNumber: 8, nationalId: '109823448', name: 'زيد فراس عبد الكريم الدليمي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-109', registrationNumber: '1009', fatherPhone: '07701234509', seatNumber: 9, nationalId: '109823449', name: 'سجاد قاسم هاشم الشمري', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-110', registrationNumber: '1010', fatherPhone: '07701234510', seatNumber: 10, nationalId: '109823450', name: 'سيف الدين ماجد صبري الموسوي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-111', registrationNumber: '1011', fatherPhone: '07701234511', seatNumber: 11, nationalId: '109823451', name: 'صادق جعفر عطية العامري', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-112', registrationNumber: '1012', fatherPhone: '07701234512', seatNumber: 12, nationalId: '109823452', name: 'ضياء عمار عبد الحسين المالكي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-113', registrationNumber: '1013', fatherPhone: '07701234513', seatNumber: 13, nationalId: '109823453', name: 'طه ياسين عبد الله السعدي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-114', registrationNumber: '1014', fatherPhone: '07701234514', seatNumber: 14, nationalId: '109823454', name: 'عباس فاضل راضي الجبوري', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-115', registrationNumber: '1015', fatherPhone: '07701234515', seatNumber: 15, nationalId: '109823455', name: 'عبد الله رائد كمال البياتي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-116', registrationNumber: '1016', fatherPhone: '07701234516', seatNumber: 16, nationalId: '109823456', name: 'علي رضا عبد الأمير اللامي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-117', registrationNumber: '1017', fatherPhone: '07701234517', seatNumber: 17, nationalId: '109823457', name: 'عمر عثمان فاروق الحديثي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-118', registrationNumber: '1018', fatherPhone: '07701234518', seatNumber: 18, nationalId: '109823458', name: 'كرار وسام نجم الساعدي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-119', registrationNumber: '1019', fatherPhone: '07701234519', seatNumber: 19, nationalId: '109823459', name: 'محمد باقر إحسان الحسيني', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-120', registrationNumber: '1020', fatherPhone: '07701234520', seatNumber: 20, nationalId: '109823460', name: 'مصطفى علاء خضير العاني', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-121', registrationNumber: '1021', fatherPhone: '07701234521', seatNumber: 21, nationalId: '109823461', name: 'مهدي ناصر سعيد الغراوي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-122', registrationNumber: '1022', fatherPhone: '07701234522', seatNumber: 22, nationalId: '109823462', name: 'مؤمل ثائر سلمان البديري', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-123', registrationNumber: '1023', fatherPhone: '07701234523', seatNumber: 23, nationalId: '109823463', name: 'يحيى مروان حامد المشهداني', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
  { id: 'stu-124', registrationNumber: '1024', fatherPhone: '07701234524', seatNumber: 24, nationalId: '109823464', name: 'يوسف دريد منذر القيسي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-a', gender: 'male' },
];

const INITIAL_SETTINGS: AppSettings = {
  schoolName: 'ثانوية المتميزين النموذجية للبنين',
  directorName: 'أ. د. علي حسين الموسوي',
  examCommitteeHead: 'أ. مصطفى عبد السلام الكرخي',
  city: 'بغداد / الكرخ الأولى',
  roundingRule: 'standard',
  maxScoreDefault: 100,
  passScoreDefault: 50,
  confirmPreviousTermEdits: true,
  theme: 'dark',
};

// Generate realistic pre-existing grade records for demonstration & immediate functionality
function generateInitialGrades(students: Student[], subjects: Subject[], settings: AppSettings): Record<string, GradeRecord> {
  const grades: Record<string, GradeRecord> = {};

  students.forEach((stu, index) => {
    // Generate scores for Math (sub-math)
    const mathKey = `ay-2026-2027_cls-5-sci_sec-5sci-a_sub-math_${stu.id}`;
    
    // Some students have full grades, some have up to midterm, some missing to demonstrate indicators
    let term1: number | null = null;
    let midterm: number | null = null;
    let term2: number | null = null;
    let finalExam: number | null = null;

    if (index < 20) {
      // term 1 entered
      term1 = 70 + ((index * 7) % 28);
    }
    if (index < 16) {
      // midterm entered
      midterm = 65 + ((index * 5) % 32);
    }
    if (index < 12) {
      // term 2 entered
      term2 = 72 + ((index * 6) % 26);
    }
    if (index < 8) {
      // final exam entered
      finalExam = 68 + ((index * 4) % 30);
    }

    const { termYearlyScore, finalScore } = recalculateGradeRecord({
      term1Score: term1,
      midtermScore: midterm,
      term2Score: term2,
      finalExamScore: finalExam,
    }, settings.roundingRule);

    grades[mathKey] = {
      id: mathKey,
      academicYearId: 'ay-2026-2027',
      classId: 'cls-5-sci',
      sectionId: 'sec-5sci-a',
      subjectId: 'sub-math',
      studentId: stu.id,
      term1Score: term1,
      midtermScore: midterm,
      term2Score: term2,
      termYearlyScore,
      finalExamScore: finalExam,
      finalScore,
      secondRoundScore: null,
      secondRoundFinalScore: null,
      lastUpdated: new Date().toISOString(),
    };

    // Arabic Subject (sub-arabic)
    const arabicKey = `ay-2026-2027_cls-5-sci_sec-5sci-a_sub-arabic_${stu.id}`;
    const aTerm1 = index < 22 ? 75 + ((index * 3) % 22) : null;
    const aMidterm = index < 18 ? 80 + ((index * 4) % 18) : null;
    const aTerm2 = index < 14 ? 78 + ((index * 5) % 20) : null;
    const aFinal = index < 9 ? 82 + ((index * 2) % 16) : null;
    const arabicCalculated = recalculateGradeRecord({
      term1Score: aTerm1,
      midtermScore: aMidterm,
      term2Score: aTerm2,
      finalExamScore: aFinal,
    }, settings.roundingRule);

    grades[arabicKey] = {
      id: arabicKey,
      academicYearId: 'ay-2026-2027',
      classId: 'cls-5-sci',
      sectionId: 'sec-5sci-a',
      subjectId: 'sub-arabic',
      studentId: stu.id,
      term1Score: aTerm1,
      midtermScore: aMidterm,
      term2Score: aTerm2,
      termYearlyScore: arabicCalculated.termYearlyScore,
      finalExamScore: aFinal,
      finalScore: arabicCalculated.finalScore,
      secondRoundScore: null,
      secondRoundFinalScore: null,
      lastUpdated: new Date().toISOString(),
    };
  });

  return grades;
}

export function buildGradeKey(
  academicYearId: string,
  classId: string,
  sectionId: string,
  subjectId: string,
  studentId: string
): string {
  return `${academicYearId}_${classId}_${sectionId}_${subjectId}_${studentId}`;
}

export function buildDecisionKey(
  academicYearId: string,
  classId: string,
  sectionId: string,
  studentId: string,
  subjectId: string,
  round: 'round1' | 'round2'
): string {
  return `${academicYearId}_${classId}_${sectionId}_${studentId}_${subjectId}_${round}`;
}

export class LocalStorageEngine {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadFromStorage();
    loadTemplateImageFromDB().then((img) => {
      if (img) {
        if (!this.state.certificateTemplate) {
          this.state.certificateTemplate = JSON.parse(JSON.stringify(DEFAULT_CERTIFICATE_CONFIG));
        }
        if (this.state.certificateTemplate) {
          this.state.certificateTemplate.templateImage = img;
        }
        this.listeners.forEach((cb) => cb());
      }
    });
  }

  private loadFromStorage(): DatabaseState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: DatabaseState = JSON.parse(data);
        if (parsed.academicYears && parsed.grades) {
          // Normalize existing students so registrationNumber and fatherPhone are always populated
          if (Array.isArray(parsed.students)) {
            parsed.students = parsed.students.map((s, idx) => ({
              ...s,
              registrationNumber: s.registrationNumber || String(1001 + idx),
              fatherPhone: s.fatherPhone || `0770${1000000 + idx}`,
            }));
          }

          // Normalize subjects order per class so ordering is strictly preserved and reliable
          if (Array.isArray(parsed.subjects)) {
            const subjectsByClass = new Map<string, Subject[]>();
            parsed.subjects.forEach((sub, idx) => {
              if (!subjectsByClass.has(sub.classId)) {
                subjectsByClass.set(sub.classId, []);
              }
              subjectsByClass.get(sub.classId)!.push({
                ...sub,
                order: typeof sub.order === 'number' && sub.order > 0 ? sub.order : idx + 1,
              });
            });

            const normalizedSubjects: Subject[] = [];
            subjectsByClass.forEach((list) => {
              list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              list.forEach((sub, idx) => {
                sub.order = idx + 1;
                normalizedSubjects.push(sub);
              });
            });
            parsed.subjects = normalizedSubjects;
          }

          if (!parsed.exemptionSettings) {
            parsed.exemptionSettings = {};
          }

          if (!parsed.decisionSettings) {
            parsed.decisionSettings = {};
          }

          if (!parsed.decisionGrants) {
            parsed.decisionGrants = {};
          }

          // Ensure default admin exists if no users are found
          let stateNeedsPersist = false;
          if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
            parsed.users = [INITIAL_DEFAULT_ADMIN];
            stateNeedsPersist = true;
          }

          // Idempotently complete any missing demo subjects, students, or grade records
          const { newSubjectsCount, newStudentsCount, newGradesCount } = completeDemoSeedData(parsed);
          if (newSubjectsCount > 0 || newStudentsCount > 0 || newGradesCount > 0 || stateNeedsPersist) {
            this.persistToDisk(parsed);
          }

          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load database from localStorage, initializing fresh', e);
    }

    const defaultState: DatabaseState = {
      academicYears: INITIAL_YEARS,
      classes: INITIAL_CLASSES,
      sections: INITIAL_SECTIONS,
      subjects: [...CANONICAL_SUBJECTS],
      students: [...INITIAL_STUDENTS_5SCI_A, ...ADDITIONAL_DEMO_STUDENTS],
      grades: {},
      settings: INITIAL_SETTINGS,
      exemptionSettings: {},
      decisionSettings: {},
      decisionGrants: {},
      users: [INITIAL_DEFAULT_ADMIN],
      version: '1.0.0',
      lastBackupDate: new Date().toISOString(),
    };

    // Populate all grades completely and realistically
    completeDemoSeedData(defaultState);

    this.persistToDisk(defaultState);
    return defaultState;
  }

  public completeSeedData(): { newSubjectsCount: number; newStudentsCount: number; newGradesCount: number } {
    const res = completeDemoSeedData(this.state);
    if (res.newSubjectsCount > 0 || res.newStudentsCount > 0 || res.newGradesCount > 0) {
      this.notify();
    }
    return res;
  }

  private persistToDisk(state: DatabaseState): void {
    try {
      const sanitizedState = {
        ...state,
        certificateTemplate: state.certificateTemplate
          ? {
              ...state.certificateTemplate,
              templateImage: undefined, // Stripped from localStorage to prevent QuotaExceededError
            }
          : undefined,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedState));
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }
  }

  private notify() {
    this.persistToDisk(this.state);
    // Use requestAnimationFrame to defer notification to the next task/paint
    // preventing "Cannot update component while rendering" errors.
    requestAnimationFrame(() => {
      this.listeners.forEach((cb) => cb());
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getState(): DatabaseState {
    return {
      ...this.state,
      grades: { ...this.state.grades },
      decisionGrants: { ...(this.state.decisionGrants || {}) },
    };
  }

  // --- Grade Operations ---
  public getGradeRecord(key: string): GradeRecord | undefined {
    return this.state.grades[key];
  }

  public saveGradeField(
    academicYearId: string,
    classId: string,
    sectionId: string,
    subjectId: string,
    studentId: string,
    field: 'term1Score' | 'midtermScore' | 'term2Score' | 'finalExamScore' | 'secondRoundScore',
    fieldArabic: string,
    newValue: number | null,
    reason?: string
  ): { success: boolean; record: GradeRecord; error?: string } {
    const key = buildGradeKey(academicYearId, classId, sectionId, subjectId, studentId);
    const existing = this.state.grades[key] || {
      id: key,
      academicYearId,
      classId,
      sectionId,
      subjectId,
      studentId,
      term1Score: null,
      midtermScore: null,
      term2Score: null,
      termYearlyScore: null,
      finalExamScore: null,
      finalScore: null,
      secondRoundScore: null,
      secondRoundFinalScore: null,
      lastUpdated: new Date().toISOString(),
      auditHistory: [],
    };

    const oldValue = existing[field];
    const updatedRecord: GradeRecord = {
      ...existing,
      [field]: newValue,
      lastUpdated: new Date().toISOString(),
      auditHistory: existing.auditHistory ? [...existing.auditHistory] : [],
    };

    if (field === 'secondRoundScore') {
      if (newValue !== null && newValue !== undefined) {
        updatedRecord.secondRoundDate = new Date().toISOString();
      } else {
        updatedRecord.secondRoundDate = undefined;
      }
    }

    if (oldValue !== newValue) {
      updatedRecord.auditHistory?.push({
        field,
        fieldArabic,
        oldValue,
        newValue,
        timestamp: new Date().toISOString(),
        reason,
      });
    }

    // Recompute dependent yearly & final scores
    const { termYearlyScore, finalScore, secondRoundFinalScore } = recalculateGradeRecord(
      updatedRecord,
      this.state.settings.roundingRule
    );
    updatedRecord.termYearlyScore = termYearlyScore;
    updatedRecord.finalScore = finalScore;
    updatedRecord.secondRoundFinalScore = secondRoundFinalScore;

    this.state.grades = {
      ...this.state.grades,
      [key]: updatedRecord,
    };
    this.revalidateStudentDecisionGrants(studentId, academicYearId);
    this.notify();

    return { success: true, record: updatedRecord };
  }

  // --- Settings & Re-calculations ---
  public updateSettings(settings: Partial<AppSettings>): void {
    this.state.settings = { ...this.state.settings, ...settings };
    
    // Recalculate all grades immutably if rounding rule changed
    const updatedGrades: Record<string, GradeRecord> = {};
    Object.keys(this.state.grades).forEach((key) => {
      const g = this.state.grades[key];
      const recalculated = recalculateGradeRecord(g, this.state.settings.roundingRule);
      updatedGrades[key] = {
        ...g,
        termYearlyScore: recalculated.termYearlyScore,
        finalScore: recalculated.finalScore,
        secondRoundFinalScore: recalculated.secondRoundFinalScore,
      };
    });
    this.state.grades = updatedGrades;

    this.notify();
  }

  // --- Exemption Settings per Academic Year ---
  public getDefaultExemptionSettings(academicYearId: string): ExemptionSettings {
    return {
      academicYearId,
      generalMinAverage: 85,
      generalMinSubjectScore: 75,
      enableGeneralJabr: false,
      individualMinScore: 90,
      isConfigured: false,
    };
  }

  public getExemptionSettings(academicYearId: string): ExemptionSettings {
    if (!this.state.exemptionSettings) {
      this.state.exemptionSettings = {};
    }
    if (this.state.exemptionSettings[academicYearId]) {
      return this.state.exemptionSettings[academicYearId];
    }
    return this.getDefaultExemptionSettings(academicYearId);
  }

  public saveExemptionSettings(settings: ExemptionSettings): void {
    if (!this.state.exemptionSettings) {
      this.state.exemptionSettings = {};
    }
    this.state.exemptionSettings[settings.academicYearId] = {
      ...settings,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };
    this.notify();
  }

  // --- Administrative Decision Settings (Assistance & Failing Rules) per Academic Year ---
  public getDefaultDecisionSettings(academicYearId: string): AcademicYearDecisionSettings {
    return {
      academicYearId,
      maxFailedSubjectsAllowed: 4,
      primaryAssistanceMarks: 10,
      secondRoundAdditionalAssistanceMarks: 0,
      notes: 'إعدادات القرار الوزاري المعتمدة',
      updatedAt: new Date().toISOString(),
    };
  }

  public getDecisionSettings(academicYearId: string): AcademicYearDecisionSettings {
    if (!this.state.decisionSettings) {
      this.state.decisionSettings = {};
    }
    if (this.state.decisionSettings[academicYearId]) {
      return this.state.decisionSettings[academicYearId];
    }
    return this.getDefaultDecisionSettings(academicYearId);
  }

  public saveDecisionSettings(settings: AcademicYearDecisionSettings): void {
    if (!this.state.decisionSettings) {
      this.state.decisionSettings = {};
    }
    this.state.decisionSettings[settings.academicYearId] = {
      ...settings,
      maxFailedSubjectsAllowed: Math.max(1, Math.floor(settings.maxFailedSubjectsAllowed || 4)),
      primaryAssistanceMarks: Math.max(0, Math.floor(settings.primaryAssistanceMarks || 0)),
      secondRoundAdditionalAssistanceMarks: Math.max(0, Math.floor(settings.secondRoundAdditionalAssistanceMarks || 0)),
      updatedAt: new Date().toISOString(),
    };
    this.notify();
  }

  // --- Decision Grants Management (منح وسجل قرارات المساعدة الوزارية) ---
  public getDecisionGrants(): Record<string, DecisionGrantRecord> {
    if (!this.state.decisionGrants) {
      this.state.decisionGrants = {};
    }
    return this.state.decisionGrants;
  }

  public getDecisionGrant(
    academicYearId: string,
    classId: string,
    sectionId: string,
    studentId: string,
    subjectId: string,
    round: 'round1' | 'round2'
  ): DecisionGrantRecord | undefined {
    const key = buildDecisionKey(academicYearId, classId, sectionId, studentId, subjectId, round);
    return this.getDecisionGrants()[key];
  }

  public getStudentDecisionGrants(
    studentId: string,
    academicYearId: string,
    round?: 'round1' | 'round2'
  ): DecisionGrantRecord[] {
    const grants = Object.values(this.getDecisionGrants());
    return grants.filter((g) => {
      if (g.studentId !== studentId || g.academicYearId !== academicYearId) return false;
      if (round && g.round !== round) return false;
      return true;
    });
  }

  public getStudentDecisionBalance(
    studentId: string,
    academicYearId: string,
    round: 'round1' | 'round2'
  ): {
    totalPool: number;
    usedMarks: number;
    remainingMarks: number;
    primaryPool: number;
    primaryUsed: number;
    primaryRemaining: number;
    secondRoundAdditional: number;
  } {
    const decSettings = this.getDecisionSettings(academicYearId);
    const round1Grants = this.getStudentDecisionGrants(studentId, academicYearId, 'round1');
    const primaryUsed = round1Grants.reduce((sum, g) => sum + g.appliedMarks, 0);
    const primaryPool = Math.max(0, decSettings.primaryAssistanceMarks);
    const primaryRemaining = Math.max(0, primaryPool - primaryUsed);

    const secondRoundAdditional = Math.max(0, decSettings.secondRoundAdditionalAssistanceMarks || 0);
    const round2Pool = primaryRemaining + secondRoundAdditional;

    const round2Grants = this.getStudentDecisionGrants(studentId, academicYearId, 'round2');
    const round2Used = round2Grants.reduce((sum, g) => sum + g.appliedMarks, 0);
    const round2Remaining = Math.max(0, round2Pool - round2Used);

    if (round === 'round1') {
      return {
        totalPool: primaryPool,
        usedMarks: primaryUsed,
        remainingMarks: primaryRemaining,
        primaryPool,
        primaryUsed,
        primaryRemaining,
        secondRoundAdditional,
      };
    } else {
      return {
        totalPool: round2Pool,
        usedMarks: round2Used,
        remainingMarks: round2Remaining,
        primaryPool,
        primaryUsed,
        primaryRemaining,
        secondRoundAdditional,
      };
    }
  }

  public grantDecision(params: {
    academicYearId: string;
    classId: string;
    sectionId: string;
    studentId: string;
    subjectId: string;
    round: 'round1' | 'round2';
    grantedBy?: string;
    notes?: string;
  }): { success: boolean; grant?: DecisionGrantRecord; error?: string } {
    if (!this.state.decisionGrants) {
      this.state.decisionGrants = {};
    }

    const key = buildDecisionKey(
      params.academicYearId,
      params.classId,
      params.sectionId,
      params.studentId,
      params.subjectId,
      params.round
    );

    // Prevent duplicate grant & deduction
    if (this.state.decisionGrants[key]) {
      return {
        success: false,
        grant: this.state.decisionGrants[key],
        error: 'تم منح القرار مسبقاً لهذه المادة ولن يتم خصم الرصيد مرة أخرى.',
      };
    }

    const student = this.state.students.find((s) => s.id === params.studentId);
    if (!student) {
      return { success: false, error: 'لم يتم العثور على بيانات الطالب.' };
    }

    const subject = this.state.subjects.find((s) => s.id === params.subjectId);
    if (!subject) {
      return { success: false, error: 'لم يتم العثور على المادة الدراسية.' };
    }

    const gradeKey = buildGradeKey(
      params.academicYearId,
      params.classId,
      params.sectionId,
      params.subjectId,
      params.studentId
    );
    const gradeRec = this.state.grades[gradeKey];
    if (!gradeRec) {
      return { success: false, error: 'لا يوجد سجل درجات لهذه المادة.' };
    }

    const passScore = subject.passScore || 50;
    const balance = this.getStudentDecisionBalance(params.studentId, params.academicYearId, params.round);

    let originalScore: number | null = null;
    if (params.round === 'round1') {
      if (gradeRec.termYearlyScore === null || gradeRec.finalExamScore === null) {
        return { success: false, error: 'درجات السعي والامتحان النهائي غير مكتملة لهذه المادة.' };
      }
      originalScore = calculateFinalScore(
        gradeRec.termYearlyScore,
        gradeRec.finalExamScore,
        this.state.settings.roundingRule
      );
    } else {
      if (gradeRec.termYearlyScore === null || gradeRec.secondRoundScore === null) {
        return { success: false, error: 'درجة السعي السنوي أو درجة الإكمال (الدور الثاني) غير متوفرة.' };
      }
      originalScore = calculateSecondRoundFinalScore(
        gradeRec.termYearlyScore,
        gradeRec.secondRoundScore,
        this.state.settings.roundingRule
      );
    }

    if (originalScore === null) {
      return { success: false, error: 'تعذر حساب الدرجة النهائية الأصلية للمادة.' };
    }

    if (originalScore >= passScore) {
      return {
        success: false,
        error: `الطالب ناجح أصلاً في هذه المادة (الدرجة: ${originalScore} من ${passScore}). لا داعي لمنح القرار.`,
      };
    }

    const neededMarks = passScore - originalScore;
    if (neededMarks <= 0) {
      return { success: false, error: 'الدرجة لا تحتاج مساعدة للنجاح.' };
    }

    if (balance.remainingMarks < neededMarks) {
      return {
        success: false,
        error: `رصيد المساعدة المتاح (${balance.remainingMarks} درجات) غير كافٍ لإيصال المادة إلى درجة النجاح ${passScore} (تحتاج ${neededMarks} درجات). لا يُسمح بمنح مساعدة جزئية.`,
      };
    }

    const newGrant: DecisionGrantRecord = {
      id: key,
      academicYearId: params.academicYearId,
      classId: params.classId,
      sectionId: params.sectionId,
      studentId: params.studentId,
      subjectId: params.subjectId,
      round: params.round,
      originalScore,
      appliedMarks: neededMarks,
      finalScoreAfterDecision: passScore,
      requiredPassScore: passScore,
      grantedAt: new Date().toISOString(),
      grantedBy: params.grantedBy || 'مدير المدرسة',
      notes: params.notes || `منح قرار وزاري (${neededMarks} درجات) بموافقة المدير`,
    };

    this.state.decisionGrants = {
      ...this.state.decisionGrants,
      [key]: newGrant,
    };

    this.notify();
    return { success: true, grant: newGrant };
  }

  public revokeDecision(
    academicYearId: string,
    classId: string,
    sectionId: string,
    studentId: string,
    subjectId: string,
    round: 'round1' | 'round2'
  ): { success: boolean; message?: string } {
    if (!this.state.decisionGrants) return { success: false, message: 'لا توجد قرارات مسجلة.' };

    const key = buildDecisionKey(academicYearId, classId, sectionId, studentId, subjectId, round);
    if (!this.state.decisionGrants[key]) {
      return { success: false, message: 'لم يتم العثور على قرار مسجل لهذه المادة.' };
    }

    const updated = { ...this.state.decisionGrants };
    delete updated[key];
    this.state.decisionGrants = updated;

    this.notify();
    return { success: true, message: 'تم إلغاء القرار وإعادة الرصيد بنجاح.' };
  }

  public revalidateStudentDecisionGrants(studentId: string, academicYearId: string): void {
    if (!this.state.decisionGrants) return;

    let hasChanges = false;
    const updatedGrants = { ...this.state.decisionGrants };
    const grants = this.getStudentDecisionGrants(studentId, academicYearId);

    for (const grant of grants) {
      const subject = this.state.subjects.find((s) => s.id === grant.subjectId);
      const passScore = subject?.passScore || 50;
      const gKey = buildGradeKey(academicYearId, grant.classId, grant.sectionId, grant.subjectId, studentId);
      const rec = this.state.grades[gKey];

      let currentRawScore: number | null = null;
      if (grant.round === 'round1') {
        currentRawScore =
          rec && rec.termYearlyScore !== null && rec.finalExamScore !== null
            ? calculateFinalScore(rec.termYearlyScore, rec.finalExamScore, this.state.settings.roundingRule)
            : null;
      } else {
        currentRawScore =
          rec && rec.termYearlyScore !== null && rec.secondRoundScore !== null
            ? calculateSecondRoundFinalScore(rec.termYearlyScore, rec.secondRoundScore, this.state.settings.roundingRule)
            : null;
      }

      // If scores were cleared or student is now naturally passing >= passScore without decision
      if (currentRawScore === null || currentRawScore >= passScore) {
        delete updatedGrants[grant.id];
        hasChanges = true;
      } else if (currentRawScore !== grant.originalScore) {
        // Original score changed: re-evaluate if remaining balance can still cover the new needed marks
        const needed = passScore - currentRawScore;
        const otherGrantsSum = grants
          .filter((g) => g.id !== grant.id && g.round === grant.round)
          .reduce((sum, g) => sum + g.appliedMarks, 0);

        const pool =
          grant.round === 'round1'
            ? this.getDecisionSettings(academicYearId).primaryAssistanceMarks
            : this.getStudentDecisionBalance(studentId, academicYearId, 'round1').remainingMarks +
              (this.getDecisionSettings(academicYearId).secondRoundAdditionalAssistanceMarks || 0);

        const available = Math.max(0, pool - otherGrantsSum);
        if (available >= needed && needed > 0) {
          updatedGrants[grant.id] = {
            ...grant,
            originalScore: currentRawScore,
            appliedMarks: needed,
            grantedAt: new Date().toISOString(),
          };
          hasChanges = true;
        } else {
          // Cannot cover new deficit -> revoke grant
          delete updatedGrants[grant.id];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      this.state.decisionGrants = updatedGrants;
    }
  }

  // --- Student Exemption Management ---
  public setStudentGeneralExempt(studentId: string, isExempt: boolean): void {
    const student = this.state.students.find((s) => s.id === studentId);
    if (!student) return;
    student.isGeneralExempt = isExempt;
    this.notify();
  }

  public toggleStudentSubjectIndividualExempt(studentId: string, subjectId: string, isExempt?: boolean): void {
    const student = this.state.students.find((s) => s.id === studentId);
    if (!student) return;
    const current = new Set(student.individualExemptions || []);
    const shouldExempt = isExempt !== undefined ? isExempt : !current.has(subjectId);
    if (shouldExempt) {
      current.add(subjectId);
    } else {
      current.delete(subjectId);
    }
    student.individualExemptions = Array.from(current);

    // Also sync the GradeRecord immutably if it exists
    const updatedGrades: Record<string, GradeRecord> = { ...this.state.grades };
    let hasGradeChange = false;
    Object.keys(this.state.grades).forEach((k) => {
      const g = this.state.grades[k];
      if (g.studentId === studentId && g.subjectId === subjectId) {
        updatedGrades[k] = { ...g, isIndividualExempt: shouldExempt };
        hasGradeChange = true;
      }
    });
    if (hasGradeChange) {
      this.state.grades = updatedGrades;
    }

    this.notify();
  }

  // --- Certificate Template Designer Operations ---
  public getCertificateTemplate(): CertificateTemplateConfig {
    if (!this.state.certificateTemplate) {
      this.state.certificateTemplate = JSON.parse(JSON.stringify(DEFAULT_CERTIFICATE_CONFIG));
    }
    return this.state.certificateTemplate || DEFAULT_CERTIFICATE_CONFIG;
  }

  public saveCertificateTemplate(config: CertificateTemplateConfig): void {
    this.state.certificateTemplate = {
      ...config,
      lastUpdated: new Date().toISOString(),
    };
    saveTemplateImageToDB(config.templateImage);
    this.notify();
  }

  public resetCertificateTemplate(): CertificateTemplateConfig {
    const currentTemplateImage = this.state.certificateTemplate?.templateImage;
    const fresh: CertificateTemplateConfig = {
      ...JSON.parse(JSON.stringify(DEFAULT_CERTIFICATE_CONFIG)),
      templateImage: currentTemplateImage, // Keep uploaded template image on layout reset
      lastUpdated: new Date().toISOString(),
    };
    this.state.certificateTemplate = fresh;
    saveTemplateImageToDB(currentTemplateImage);
    this.notify();
    return fresh;
  }

  // --- Entities Management ---
  public isRegistrationNumberTaken(
    regNum: string,
    excludeStudentId?: string,
    academicYearId?: string
  ): { isTaken: boolean; existingStudent?: Student } {
    if (!regNum || !regNum.trim()) return { isTaken: false };
    const cleanReg = regNum.trim();
    const existing = this.state.students.find((s) => {
      if (excludeStudentId && s.id === excludeStudentId) return false;
      if (academicYearId && s.academicYearId !== academicYearId) return false;
      return s.registrationNumber && s.registrationNumber.trim() === cleanReg;
    });
    return { isTaken: !!existing, existingStudent: existing };
  }

  public addStudent(student: Omit<Student, 'id' | 'seatNumber'> & { seatNumber?: number }): Student {
    const id = `stu-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const seatNumber = student.seatNumber || (this.state.students.filter(s => s.classId === student.classId && s.sectionId === student.sectionId).length + 1);
    const newStudent: Student = {
      ...student,
      id,
      seatNumber,
      registrationNumber: student.registrationNumber?.trim() || `${1000 + this.state.students.length + 1}`,
      fatherPhone: student.fatherPhone?.trim() || '',
    };
    this.state.students.push(newStudent);
    this.notify();
    return newStudent;
  }

  public updateStudent(student: Student): void {
    const oldStudent = this.state.students.find((s) => s.id === student.id);
    const oldClassId = oldStudent?.classId;
    const oldSectionId = oldStudent?.sectionId;

    this.state.students = this.state.students.map((s) => (s.id === student.id ? student : s));

    // If section or class changed during edit, safely migrate grades as well
    if (oldStudent && (oldClassId !== student.classId || oldSectionId !== student.sectionId)) {
      this.migrateStudentGrades(student.id, student.academicYearId, student.classId, student.sectionId);
    }

    this.notify();
  }

  public transferStudent(
    studentId: string,
    newClassId: string,
    newSectionId: string
  ): { success: boolean; message?: string } {
    const student = this.state.students.find((s) => s.id === studentId);
    if (!student) {
      return { success: false, message: 'لم يتم العثور على الطالب في السجلات.' };
    }

    student.classId = newClassId;
    student.sectionId = newSectionId;

    // Migrate all student's grades to new section/class keys without losing any past scores
    this.migrateStudentGrades(studentId, student.academicYearId, newClassId, newSectionId);

    this.notify();
    return { success: true };
  }

  public migrateStudentGrades(
    studentId: string,
    academicYearId: string,
    newClassId: string,
    newSectionId: string
  ): void {
    const updatedGrades: Record<string, GradeRecord> = { ...this.state.grades };
    Object.keys(this.state.grades).forEach((key) => {
      const g = this.state.grades[key];
      if (g.studentId === studentId && g.academicYearId === academicYearId) {
        delete updatedGrades[key];
        const newKey = buildGradeKey(
          academicYearId,
          newClassId,
          newSectionId,
          g.subjectId,
          studentId
        );
        updatedGrades[newKey] = {
          ...g,
          id: newKey,
          classId: newClassId,
          sectionId: newSectionId,
          lastUpdated: new Date().toISOString(),
        };
      }
    });
    this.state.grades = updatedGrades;
  }

  public addStudentsBatch(
    studentsToImport: Array<{
      name: string;
      registrationNumber?: string;
      fatherPhone?: string;
      academicYearId: string;
      classId: string;
      sectionId: string;
    }>
  ): { addedCount: number; rejectedCount: number; errors: string[] } {
    const errors: string[] = [];
    let addedCount = 0;
    let rejectedCount = 0;

    const currentSectionStudents = this.state.students.filter(
      (s) => studentsToImport.length > 0 && s.classId === studentsToImport[0].classId && s.sectionId === studentsToImport[0].sectionId
    );
    let nextSeat = currentSectionStudents.length + 1;

    studentsToImport.forEach((item, index) => {
      const rowNum = index + 1;
      const cleanName = item.name ? item.name.trim() : '';
      if (!cleanName) {
        errors.push(`الصف ${rowNum}: اسم الطالب فارغ.`);
        rejectedCount++;
        return;
      }

      const cleanReg = item.registrationNumber ? item.registrationNumber.trim() : '';
      if (cleanReg) {
        const check = this.isRegistrationNumberTaken(cleanReg, undefined, item.academicYearId);
        if (check.isTaken) {
          errors.push(
            `الصف ${rowNum}: رقم القيد «${cleanReg}» مسجل مسبقاً للطالب «${check.existingStudent?.name}».`
          );
          rejectedCount++;
          return;
        }
      }

      const id = `stu-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
      const newStudent: Student = {
        id,
        name: cleanName,
        registrationNumber: cleanReg || String(1000 + this.state.students.length + 1),
        fatherPhone: item.fatherPhone ? item.fatherPhone.trim() : '',
        seatNumber: nextSeat++,
        academicYearId: item.academicYearId,
        classId: item.classId,
        sectionId: item.sectionId,
        gender: 'male',
      };

      this.state.students.push(newStudent);
      addedCount++;
    });

    if (addedCount > 0) {
      this.notify();
    }

    return { addedCount, rejectedCount, errors };
  }

  public deleteStudent(id: string): void {
    this.state.students = this.state.students.filter((s) => s.id !== id);
    // Remove student grades immutably
    const remainingGrades: Record<string, GradeRecord> = {};
    Object.entries(this.state.grades).forEach(([k, g]) => {
      if (g.studentId !== id) {
        remainingGrades[k] = g;
      }
    });
    this.state.grades = remainingGrades;
    this.notify();
  }

  public isClassNameTaken(name: string, excludeId?: string): boolean {
    const clean = name.trim().toLowerCase();
    return this.state.classes.some(
      (c) => c.name.trim().toLowerCase() === clean && c.id !== excludeId
    );
  }

  public isSectionNameTaken(classId: string, name: string, excludeId?: string): boolean {
    const clean = name.trim().toLowerCase();
    return this.state.sections.some(
      (s) => s.classId === classId && s.name.trim().toLowerCase() === clean && s.id !== excludeId
    );
  }

  public addClass(schoolClass: Omit<SchoolClass, 'id'>): SchoolClass {
    const id = `cls-${Date.now()}`;
    const newClass: SchoolClass = { ...schoolClass, id };
    this.state.classes.push(newClass);
    this.notify();
    return newClass;
  }

  public updateClass(schoolClass: SchoolClass): { success: boolean; message?: string } {
    if (!schoolClass.name || !schoolClass.name.trim()) {
      return { success: false, message: 'اسم الصف الدراسي مطلوب.' };
    }
    if (this.isClassNameTaken(schoolClass.name, schoolClass.id)) {
      return { success: false, message: `اسم الصف «${schoolClass.name.trim()}» مسجل بالفعل.` };
    }

    const idx = this.state.classes.findIndex((c) => c.id === schoolClass.id);
    if (idx === -1) {
      return { success: false, message: 'لم يتم العثور على الصف الدراسي المطلوب.' };
    }

    this.state.classes[idx] = {
      ...this.state.classes[idx],
      name: schoolClass.name.trim(),
      stage: schoolClass.stage,
    };
    this.notify();
    return { success: true };
  }

  public canDeleteClass(classId: string): {
    canDelete: boolean;
    reason?: string;
    counts: { sections: number; students: number; subjects: number; grades: number };
  } {
    const sectionsCount = this.state.sections.filter((s) => s.classId === classId).length;
    const studentsCount = this.state.students.filter((s) => s.classId === classId).length;
    const subjectsCount = this.state.subjects.filter((s) => s.classId === classId).length;
    const gradesCount = Object.values(this.state.grades).filter((g) => g.classId === classId).length;

    const counts = { sections: sectionsCount, students: studentsCount, subjects: subjectsCount, grades: gradesCount };

    if (sectionsCount > 0 || studentsCount > 0 || subjectsCount > 0 || gradesCount > 0) {
      const reasons: string[] = [];
      if (sectionsCount > 0) reasons.push(`${sectionsCount} شعبة`);
      if (studentsCount > 0) reasons.push(`${studentsCount} طالب`);
      if (subjectsCount > 0) reasons.push(`${subjectsCount} مادة دراسية`);
      if (gradesCount > 0) reasons.push(`${gradesCount} سجل درجات`);

      return {
        canDelete: false,
        reason: `لا يمكن حذف هذا الصف لأنه مرتبط ببيانات فعلية (${reasons.join('، ')}). لحماية السجلات، لا يُسمح بالحذف المباشر للصفوف التي تحتوي على شعب أو طلاب أو درجات.`,
        counts,
      };
    }

    return { canDelete: true, counts };
  }

  public deleteClass(classId: string): { success: boolean; message?: string } {
    const check = this.canDeleteClass(classId);
    if (!check.canDelete) {
      return { success: false, message: check.reason };
    }

    this.state.classes = this.state.classes.filter((c) => c.id !== classId);
    this.notify();
    return { success: true };
  }

  public addSection(section: Omit<Section, 'id'>): Section {
    const id = `sec-${Date.now()}`;
    const newSection: Section = { ...section, id };
    this.state.sections.push(newSection);
    this.notify();
    return newSection;
  }

  public updateSection(section: Section): { success: boolean; message?: string } {
    if (!section.name || !section.name.trim()) {
      return { success: false, message: 'اسم أو رمز الشعبة مطلوب.' };
    }
    if (this.isSectionNameTaken(section.classId, section.name, section.id)) {
      return { success: false, message: `الشعبة «${section.name.trim()}» مسجلة بالفعل لهذا الصف.` };
    }

    const idx = this.state.sections.findIndex((s) => s.id === section.id);
    if (idx === -1) {
      return { success: false, message: 'لم يتم العثور على الشعبة المطلوبة.' };
    }

    this.state.sections[idx] = {
      ...this.state.sections[idx],
      name: section.name.trim(),
    };
    this.notify();
    return { success: true };
  }

  public canDeleteSection(sectionId: string): {
    canDelete: boolean;
    reason?: string;
    counts: { students: number; grades: number };
  } {
    const studentsCount = this.state.students.filter((s) => s.sectionId === sectionId).length;
    const gradesCount = Object.values(this.state.grades).filter((g) => g.sectionId === sectionId).length;
    const counts = { students: studentsCount, grades: gradesCount };

    if (studentsCount > 0 || gradesCount > 0) {
      const reasons: string[] = [];
      if (studentsCount > 0) reasons.push(`${studentsCount} طالب`);
      if (gradesCount > 0) reasons.push(`${gradesCount} سجل درجات`);

      return {
        canDelete: false,
        reason: `لا يمكن حذف هذه الشعبة لاحتوائها على (${reasons.join('، ')}). يرجى نقل الطلاب إلى شعبة أخرى عبر «إدارة الطلاب» أولاً قبل حذف الشعبة.`,
        counts,
      };
    }

    return { canDelete: true, counts };
  }

  public deleteSection(sectionId: string): { success: boolean; message?: string } {
    const check = this.canDeleteSection(sectionId);
    if (!check.canDelete) {
      return { success: false, message: check.reason };
    }

    this.state.sections = this.state.sections.filter((s) => s.id !== sectionId);
    this.notify();
    return { success: true };
  }

  public addSubject(subject: Omit<Subject, 'id'>): Subject {
    const id = `sub-${Date.now()}`;
    const existingInClass = this.state.subjects.filter((s) => s.classId === subject.classId);
    const maxOrder = existingInClass.reduce((max, s) => Math.max(max, s.order ?? 0), 0);
    const order = typeof subject.order === 'number' && subject.order > 0 ? subject.order : maxOrder + 1;
    const newSubject: Subject = { ...subject, id, order };
    this.state.subjects.push(newSubject);
    this.sortSubjectsInternal();
    this.notify();
    return newSubject;
  }

  public updateSubject(subject: Subject): void {
    this.state.subjects = this.state.subjects.map((s) => (s.id === subject.id ? subject : s));
    this.sortSubjectsInternal();
    this.notify();
  }

  public deleteSubject(subjectId: string): void {
    const target = this.state.subjects.find((s) => s.id === subjectId);
    const classId = target?.classId;
    this.state.subjects = this.state.subjects.filter((s) => s.id !== subjectId);

    // Re-normalize consecutive order for remaining subjects in this class
    if (classId) {
      const remaining = this.state.subjects.filter((s) => s.classId === classId);
      remaining.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      remaining.forEach((s, idx) => {
        s.order = idx + 1;
      });
    }

    // Clean up associated grade records for this subject without disturbing other subjects
    const remainingGrades: Record<string, GradeRecord> = {};
    Object.entries(this.state.grades).forEach(([k, g]) => {
      if (g.subjectId !== subjectId) {
        remainingGrades[k] = g;
      }
    });
    this.state.grades = remainingGrades;

    this.sortSubjectsInternal();
    this.notify();
  }

  /**
   * Reorder subjects for a given class based on the ordered list of subject IDs.
   * Immediately saves new order to localStorage and notifies all subscribers.
   */
  public reorderSubjects(classId: string, orderedSubjectIds: string[]): void {
    const idToOrder = new Map<string, number>();
    orderedSubjectIds.forEach((id, index) => {
      idToOrder.set(id, index + 1);
    });

    this.state.subjects = this.state.subjects.map((sub) => {
      if (sub.classId === classId && idToOrder.has(sub.id)) {
        return {
          ...sub,
          order: idToOrder.get(sub.id)!,
        };
      }
      return sub;
    });

    this.sortSubjectsInternal();
    this.notify();
  }

  public getSubjectsByClass(classId: string): Subject[] {
    return this.state.subjects
      .filter((s) => s.classId === classId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  private sortSubjectsInternal(): void {
    this.state.subjects.sort((a, b) => {
      if (a.classId !== b.classId) {
        return a.classId.localeCompare(b.classId);
      }
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }

  public isAcademicYearNameTaken(name: string, excludeId?: string): boolean {
    const clean = name.trim().toLowerCase();
    return this.state.academicYears.some(
      (y) => y.name.trim().toLowerCase() === clean && y.id !== excludeId
    );
  }

  public addAcademicYear(year: Omit<AcademicYear, 'id'>): { success: boolean; year?: AcademicYear; message?: string } {
    if (!year.name || !year.name.trim()) {
      return { success: false, message: 'اسم العام الدراسي مطلوب.' };
    }
    if (this.isAcademicYearNameTaken(year.name)) {
      return { success: false, message: `العام الدراسي «${year.name.trim()}» مسجل بالفعل مسبقاً.` };
    }

    const id = `ay-${Date.now()}`;
    const newYear: AcademicYear = { ...year, name: year.name.trim(), id };
    if (newYear.isCurrent) {
      this.state.academicYears.forEach((y) => (y.isCurrent = false));
    }
    this.state.academicYears.push(newYear);
    this.notify();
    return { success: true, year: newYear };
  }

  public updateAcademicYear(id: string, name: string): { success: boolean; message?: string } {
    if (!name || !name.trim()) {
      return { success: false, message: 'اسم العام الدراسي مطلوب.' };
    }
    if (this.isAcademicYearNameTaken(name, id)) {
      return { success: false, message: `العام الدراسي «${name.trim()}» مسجل بالفعل.` };
    }

    const idx = this.state.academicYears.findIndex((y) => y.id === id);
    if (idx === -1) {
      return { success: false, message: 'لم يتم العثور على العام الدراسي المطلوب.' };
    }

    this.state.academicYears[idx] = {
      ...this.state.academicYears[idx],
      name: name.trim(),
    };
    this.notify();
    return { success: true };
  }

  public canDeleteAcademicYear(yearId: string): {
    canDelete: boolean;
    reason?: string;
    counts: { students: number; grades: number; isCurrent: boolean; totalYears: number };
  } {
    const target = this.state.academicYears.find((y) => y.id === yearId);
    const totalYears = this.state.academicYears.length;
    const isCurrent = !!target?.isCurrent;
    const studentsCount = this.state.students.filter((s) => s.academicYearId === yearId).length;
    const gradesCount = Object.values(this.state.grades).filter(
      (g) => g.academicYearId === yearId
    ).length;

    const counts = {
      students: studentsCount,
      grades: gradesCount,
      isCurrent,
      totalYears,
    };

    if (totalYears <= 1) {
      return {
        canDelete: false,
        reason: 'لا يمكن حذف العام الدراسي لأنه العام الوحيد المسجل في النظام. يجب أن يحتوي النظام على عام دراسي واحد على الأقل.',
        counts,
      };
    }

    if (isCurrent) {
      return {
        canDelete: false,
        reason: 'لا يمكن حذف العام الدراسي لأنه العام النشط والمعتمد حالياً في النظام. يرجى تعيين عام دراسي آخر كعام نشط أولاً قبل الحذف.',
        counts,
      };
    }

    if (studentsCount > 0 || gradesCount > 0) {
      const reasons: string[] = [];
      if (studentsCount > 0) reasons.push(`${studentsCount} طالب`);
      if (gradesCount > 0) reasons.push(`${gradesCount} سجل درجات`);

      return {
        canDelete: false,
        reason: `لا يمكن حذف هذا العام الدراسي لاحتوائه على بيانات وسجلات فعلية (${reasons.join('، ')}). لحماية سجلات ودرجات الطلاب التاريخية، لا يُسمح بالحذف المباشر للأعوام المرتبطة ببيانات.`,
        counts,
      };
    }

    return { canDelete: true, counts };
  }

  public deleteAcademicYear(yearId: string): { success: boolean; message?: string } {
    const check = this.canDeleteAcademicYear(yearId);
    if (!check.canDelete) {
      return { success: false, message: check.reason };
    }

    this.state.academicYears = this.state.academicYears.filter((y) => y.id !== yearId);

    // Clean up empty exemption settings for this year if any
    if (this.state.exemptionSettings && this.state.exemptionSettings[yearId]) {
      delete this.state.exemptionSettings[yearId];
    }

    this.notify();
    return { success: true };
  }

  public setCurrentYear(id: string): void {
    this.state.academicYears.forEach((y) => {
      y.isCurrent = y.id === id;
    });
    this.notify();
  }

  // --- Student Promotion Operations ---
  public getPromotionLogs(): StudentPromotionBatchLog[] {
    return this.state.promotionLogs || [];
  }

  public executeStudentPromotion(params: {
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
      targetSectionId: string | null;
      action: 'promote' | 'repeat' | 'graduate' | 'exclude';
      reason?: string;
    }>;
    executedBy?: string;
  }): {
    success: boolean;
    promotedCount: number;
    repeatingCount: number;
    graduatedCount: number;
    excludedCount: number;
    skippedDuplicatesCount: number;
    message: string;
  } {
    const { sourceYearId, targetYearId, promotions, executedBy } = params;

    if (sourceYearId === targetYearId) {
      return {
        success: false,
        promotedCount: 0,
        repeatingCount: 0,
        graduatedCount: 0,
        excludedCount: 0,
        skippedDuplicatesCount: 0,
        message: 'لا يمكن ترحيل الطلاب إلى نفس العام الدراسي المصدر.',
      };
    }

    const sourceYear = this.state.academicYears.find((y) => y.id === sourceYearId);
    const targetYear = this.state.academicYears.find((y) => y.id === targetYearId);

    if (!sourceYear || !targetYear) {
      return {
        success: false,
        promotedCount: 0,
        repeatingCount: 0,
        graduatedCount: 0,
        excludedCount: 0,
        skippedDuplicatesCount: 0,
        message: 'العام الدراسي المصدر أو الوجهة غير موجود.',
      };
    }

    // Auto-backup current state before executing migration
    try {
      localStorage.setItem(`school_grades_backup_before_promotion_${Date.now()}`, this.exportJSON());
    } catch (e) {
      console.warn('Auto-backup before promotion warning:', e);
    }

    let promotedCount = 0;
    let repeatingCount = 0;
    let graduatedCount = 0;
    let excludedCount = 0;
    let skippedDuplicatesCount = 0;

    // Existing students in target academic year
    const targetYearStudents = this.state.students.filter((s) => s.academicYearId === targetYearId);

    promotions.forEach((item) => {
      if (item.action === 'graduate') {
        graduatedCount++;
        return;
      }
      if (item.action === 'exclude') {
        excludedCount++;
        return;
      }

      if ((item.action === 'promote' || item.action === 'repeat') && item.targetClassId && item.targetSectionId) {
        // Check if student is already enrolled in target year
        const cleanReg = item.registrationNumber?.trim();
        const cleanName = item.studentName.trim().toLowerCase();
        const cleanPhone = item.fatherPhone?.trim();

        const alreadyExists = targetYearStudents.some((s) => {
          if (cleanReg && s.registrationNumber && s.registrationNumber.trim() === cleanReg) {
            return true;
          }
          if (s.name.trim().toLowerCase() === cleanName) {
            if (cleanPhone && s.fatherPhone && s.fatherPhone.trim() === cleanPhone) {
              return true;
            }
            if (s.classId === item.targetClassId) {
              return true;
            }
          }
          return false;
        });

        if (alreadyExists) {
          skippedDuplicatesCount++;
          return;
        }

        // Calculate seat number for target section in target year
        const sectionStudentsInTargetYear = this.state.students.filter(
          (s) => s.academicYearId === targetYearId && s.classId === item.targetClassId && s.sectionId === item.targetSectionId
        );

        const nextSeat = sectionStudentsInTargetYear.length > 0
          ? Math.max(...sectionStudentsInTargetYear.map((s) => s.seatNumber || 0)) + 1
          : 1;

        const newStudentId = `stu-prom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        const newStudent: Student = {
          id: newStudentId,
          name: item.studentName.trim(),
          registrationNumber: item.registrationNumber?.trim() || `${1000 + this.state.students.length + 1}`,
          fatherPhone: item.fatherPhone?.trim() || '',
          nationalId: item.nationalId || '',
          seatNumber: nextSeat,
          academicYearId: targetYearId,
          classId: item.targetClassId,
          sectionId: item.targetSectionId,
          gender: item.gender || 'male',
          notes: item.notes || (item.action === 'repeat' ? 'طالب معيد في الصف نفسه' : undefined),
        };

        this.state.students.push(newStudent);
        targetYearStudents.push(newStudent);

        if (item.action === 'promote') {
          promotedCount++;
        } else {
          repeatingCount++;
        }
      }
    });

    // Create batch log record
    const batchLog: StudentPromotionBatchLog = {
      id: `log-prom-${Date.now()}`,
      date: new Date().toISOString(),
      sourceYearId,
      sourceYearName: sourceYear.name,
      targetYearId,
      targetYearName: targetYear.name,
      promotedCount,
      repeatingCount,
      graduatedCount,
      excludedCount,
      totalProcessedCount: promotedCount + repeatingCount + graduatedCount + excludedCount,
      executedBy: executedBy || 'مدير المدرسة',
    };

    if (!this.state.promotionLogs) {
      this.state.promotionLogs = [];
    }
    this.state.promotionLogs.unshift(batchLog);

    this.notify();

    return {
      success: true,
      promotedCount,
      repeatingCount,
      graduatedCount,
      excludedCount,
      skippedDuplicatesCount,
      message: `تم تنفيذ عملية الترحيل بنجاح! تم ترقية ${promotedCount} طالباً، وتسجيل ${repeatingCount} طالباً معيداً، ومعالجة ${graduatedCount} طالباً خريجاً.${
        skippedDuplicatesCount > 0 ? ` (تم تجاوز ${skippedDuplicatesCount} طالباً سبق ترحيلهم مسبقاً لمنع التكرار).` : ''
      }`,
    };
  }

  // --- Backup & Restore ---
  public exportJSON(): string {
    const backup: DatabaseState = {
      ...this.state,
      lastBackupDate: new Date().toISOString(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public importJSON(jsonStr: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonStr) as DatabaseState;
      if (!parsed.academicYears || !parsed.classes || !parsed.grades) {
        return { success: false, message: 'ملف النسخة الاحتياطية غير صالح أو تالف.' };
      }
      this.state = parsed;
      this.notify();
      return { success: true, message: 'تم استعادة البيانات بنجاح تام.' };
    } catch (e) {
      return { success: false, message: `خطأ في قراءة ملف JSON: ${e instanceof Error ? e.message : 'تنسيق غير صحيح'}` };
    }
  }

  public resetToDefault(): void {
    const defaultState: DatabaseState = {
      academicYears: INITIAL_YEARS,
      classes: INITIAL_CLASSES,
      sections: INITIAL_SECTIONS,
      subjects: INITIAL_SUBJECTS,
      students: INITIAL_STUDENTS_5SCI_A,
      grades: generateInitialGrades(INITIAL_STUDENTS_5SCI_A, INITIAL_SUBJECTS, INITIAL_SETTINGS),
      settings: INITIAL_SETTINGS,
      exemptionSettings: {},
      decisionSettings: {},
      decisionGrants: {},
      version: '1.0.0',
      lastBackupDate: new Date().toISOString(),
    };
    this.state = defaultState;
    this.notify();
  }

  /**
   * Generates a 100% compliant SQLite SQL script (DDL + DML)
   * ready to be executed in sqlite3 or within an Electron desktop backend.
   */
  public exportSQLiteScript(): string {
    const lines: string[] = [
      '--',
      '-- نظام إدارة الدرجات المدرسية - سكربت قاعدة بيانات SQLite',
      `-- تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`,
      '--',
      'PRAGMA foreign_keys = ON;',
      'BEGIN TRANSACTION;',
      '',
      '-- جدول الأعوام الدراسية',
      'CREATE TABLE IF NOT EXISTS academic_years (',
      '    id TEXT PRIMARY KEY,',
      '    name TEXT NOT NULL,',
      '    is_current INTEGER DEFAULT 0',
      ');',
      '',
      '-- جدول الصفوف الدراسية',
      'CREATE TABLE IF NOT EXISTS classes (',
      '    id TEXT PRIMARY KEY,',
      '    name TEXT NOT NULL,',
      '    stage TEXT NOT NULL,',
      '    sort_order INTEGER DEFAULT 1',
      ');',
      '',
      '-- جدول الشعب',
      'CREATE TABLE IF NOT EXISTS sections (',
      '    id TEXT PRIMARY KEY,',
      '    class_id TEXT NOT NULL,',
      '    name TEXT NOT NULL,',
      '    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE',
      ');',
      '',
      '-- جدول المواد الدراسية',
      'CREATE TABLE IF NOT EXISTS subjects (',
      '    id TEXT PRIMARY KEY,',
      '    class_id TEXT NOT NULL,',
      '    name TEXT NOT NULL,',
      '    max_score REAL DEFAULT 100,',
      '    pass_score REAL DEFAULT 50,',
      '    sort_order INTEGER DEFAULT 1,',
      '    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE',
      ');',
      '',
      '-- جدول الطلاب',
      'CREATE TABLE IF NOT EXISTS students (',
      '    id TEXT PRIMARY KEY,',
      '    seat_number INTEGER NOT NULL,',
      '    national_id TEXT,',
      '    name TEXT NOT NULL,',
      '    academic_year_id TEXT NOT NULL,',
      '    class_id TEXT NOT NULL,',
      '    section_id TEXT NOT NULL,',
      '    gender TEXT DEFAULT "male",',
      '    notes TEXT,',
      '    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),',
      '    FOREIGN KEY (class_id) REFERENCES classes(id),',
      '    FOREIGN KEY (section_id) REFERENCES sections(id)',
      ');',
      '',
      '-- جدول الدرجات المحفوظة',
      'CREATE TABLE IF NOT EXISTS grades (',
      '    id TEXT PRIMARY KEY,',
      '    academic_year_id TEXT NOT NULL,',
      '    class_id TEXT NOT NULL,',
      '    section_id TEXT NOT NULL,',
      '    subject_id TEXT NOT NULL,',
      '    student_id TEXT NOT NULL,',
      '    term1_score REAL,',
      '    midterm_score REAL,',
      '    term2_score REAL,',
      '    term_yearly_score REAL,',
      '    final_exam_score REAL,',
      '    final_score REAL,',
      '    last_updated TEXT NOT NULL,',
      '    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,',
      '    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE',
      ');',
      '',
    ];

    // Inserts for Academic Years
    this.state.academicYears.forEach((y) => {
      lines.push(`INSERT OR REPLACE INTO academic_years (id, name, is_current) VALUES ('${y.id}', '${y.name}', ${y.isCurrent ? 1 : 0});`);
    });

    // Inserts for Classes
    this.state.classes.forEach((c) => {
      lines.push(`INSERT OR REPLACE INTO classes (id, name, stage, sort_order) VALUES ('${c.id}', '${c.name}', '${c.stage}', ${c.order});`);
    });

    // Inserts for Sections
    this.state.sections.forEach((s) => {
      lines.push(`INSERT OR REPLACE INTO sections (id, class_id, name) VALUES ('${s.id}', '${s.classId}', '${s.name}');`);
    });

    // Inserts for Subjects
    this.state.subjects.forEach((sub) => {
      lines.push(`INSERT OR REPLACE INTO subjects (id, class_id, name, max_score, pass_score, sort_order) VALUES ('${sub.id}', '${sub.classId}', '${sub.name}', ${sub.maxScore}, ${sub.passScore}, ${sub.order});`);
    });

    // Inserts for Students
    this.state.students.forEach((stu) => {
      lines.push(`INSERT OR REPLACE INTO students (id, seat_number, national_id, name, academic_year_id, class_id, section_id, gender) VALUES ('${stu.id}', ${stu.seatNumber}, '${stu.nationalId || ''}', '${stu.name.replace(/'/g, "''")}', '${stu.academicYearId}', '${stu.classId}', '${stu.sectionId}', '${stu.gender}');`);
    });

    // Inserts for Grades
    Object.values(this.state.grades).forEach((g) => {
      const t1 = g.term1Score !== null ? g.term1Score : 'NULL';
      const mid = g.midtermScore !== null ? g.midtermScore : 'NULL';
      const t2 = g.term2Score !== null ? g.term2Score : 'NULL';
      const yr = g.termYearlyScore !== null ? g.termYearlyScore : 'NULL';
      const fe = g.finalExamScore !== null ? g.finalExamScore : 'NULL';
      const fs = g.finalScore !== null ? g.finalScore : 'NULL';
      lines.push(`INSERT OR REPLACE INTO grades (id, academic_year_id, class_id, section_id, subject_id, student_id, term1_score, midterm_score, term2_score, term_yearly_score, final_exam_score, final_score, last_updated) VALUES ('${g.id}', '${g.academicYearId}', '${g.classId}', '${g.sectionId}', '${g.subjectId}', '${g.studentId}', ${t1}, ${mid}, ${t2}, ${yr}, ${fe}, ${fs}, '${g.lastUpdated}');`);
    });

    // Users table creation and inserts for SQLite compatibility
    lines.push('');
    lines.push('-- جدول المستخدمين وإدارة الصلاحيات');
    lines.push('CREATE TABLE IF NOT EXISTS users (');
    lines.push('    id TEXT PRIMARY KEY,');
    lines.push('    username TEXT UNIQUE NOT NULL,');
    lines.push('    password_hash TEXT NOT NULL,');
    lines.push('    salt TEXT NOT NULL,');
    lines.push('    role TEXT NOT NULL,');
    lines.push('    is_active INTEGER NOT NULL DEFAULT 1,');
    lines.push('    must_change_password INTEGER NOT NULL DEFAULT 0,');
    lines.push('    created_at TEXT NOT NULL,');
    lines.push('    last_login TEXT');
    lines.push(');');
    lines.push('');

    (this.state.users || []).forEach((u) => {
      const ll = u.lastLogin ? `'${u.lastLogin}'` : 'NULL';
      lines.push(`INSERT OR REPLACE INTO users (id, username, password_hash, salt, role, is_active, must_change_password, created_at, last_login) VALUES ('${u.id}', '${u.username.replace(/'/g, "''")}', '${u.passwordHash}', '${u.salt}', '${u.role}', ${u.isActive ? 1 : 0}, ${u.mustChangePassword ? 1 : 0}, '${u.createdAt}', ${ll});`);
    });

    // App Settings table creation and insert
    lines.push('');
    lines.push('-- جدول إعدادات النظام وشعار المدرسة');
    lines.push('CREATE TABLE IF NOT EXISTS app_settings (');
    lines.push('    id TEXT PRIMARY KEY,');
    lines.push('    school_name TEXT,');
    lines.push('    director_name TEXT,');
    lines.push('    exam_committee_head TEXT,');
    lines.push('    city TEXT,');
    lines.push('    rounding_rule TEXT,');
    lines.push('    school_logo TEXT,');
    lines.push('    kufic_logo TEXT');
    lines.push(');');
    const s = this.state.settings;
    const sLogo = s.schoolLogo ? `'${s.schoolLogo.replace(/'/g, "''")}'` : 'NULL';
    const sKufic = s.kuficLogo ? `'${s.kuficLogo.replace(/'/g, "''")}'` : 'NULL';
    lines.push(`INSERT OR REPLACE INTO app_settings (id, school_name, director_name, exam_committee_head, city, rounding_rule, school_logo, kufic_logo) VALUES ('default_settings', '${s.schoolName?.replace(/'/g, "''") || ''}', '${s.directorName?.replace(/'/g, "''") || ''}', '${s.examCommitteeHead?.replace(/'/g, "''") || ''}', '${s.city?.replace(/'/g, "''") || ''}', '${s.roundingRule}', ${sLogo}, ${sKufic});`);

    lines.push('');
    lines.push('COMMIT;');
    return lines.join('\n');
  }

  // ==========================================
  // User Management & Security Operations
  // ==========================================
  public getUsers(): UserAccount[] {
    return this.state.users || [];
  }

  public getUserById(id: string): UserAccount | undefined {
    return (this.state.users || []).find((u) => u.id === id);
  }

  public getActiveAdminsCount(): number {
    return (this.state.users || []).filter((u) => u.role === 'admin' && u.isActive).length;
  }

  public canDeleteUser(id: string): { allowed: boolean; reason?: string } {
    const user = this.getUserById(id);
    if (!user) {
      return { allowed: false, reason: 'المستخدم غير موجود' };
    }
    if (user.role === 'admin' && user.isActive && this.getActiveAdminsCount() <= 1) {
      return {
        allowed: false,
        reason: 'لا يمكن حذف آخر مدير نشط في النظام! يجب الإبقاء على مدير واحد نشط على الأقل.',
      };
    }
    return { allowed: true };
  }

  public canToggleUserStatus(id: string): { allowed: boolean; reason?: string } {
    const user = this.getUserById(id);
    if (!user) {
      return { allowed: false, reason: 'المستخدم غير موجود' };
    }
    // If currently active and is admin, check if it's the last active admin
    if (user.isActive && user.role === 'admin' && this.getActiveAdminsCount() <= 1) {
      return {
        allowed: false,
        reason: 'لا يمكن تعطيل آخر مدير نشط في النظام! يجب الإبقاء على مدير واحد نشط على الأقل.',
      };
    }
    return { allowed: true };
  }

  public addUser(userData: {
    username: string;
    passwordHash: string;
    salt: string;
    role: 'admin' | 'user';
    isActive?: boolean;
    mustChangePassword?: boolean;
  }): { success: boolean; user?: UserAccount; error?: string } {
    const trimmed = userData.username.trim();
    if (!trimmed) {
      return { success: false, error: 'اسم المستخدم مطلوب ولا يمكن أن يكون فارغاً' };
    }
    const duplicate = (this.state.users || []).find(
      (u) => u.username.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      return { success: false, error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر' };
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      username: trimmed,
      passwordHash: userData.passwordHash,
      salt: userData.salt,
      role: userData.role,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      mustChangePassword: userData.mustChangePassword ?? false,
      createdAt: new Date().toISOString(),
    };

    if (!this.state.users) {
      this.state.users = [];
    }
    this.state.users.push(newUser);
    this.notify();
    return { success: true, user: newUser };
  }

  public updateUser(
    id: string,
    updates: Partial<UserAccount>
  ): { success: boolean; error?: string } {
    const user = this.getUserById(id);
    if (!user) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    if (updates.username && updates.username.trim()) {
      const trimmed = updates.username.trim();
      const duplicate = (this.state.users || []).find(
        (u) => u.id !== id && u.username.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: 'اسم المستخدم هذا مستخدم بالفعل' };
      }
      user.username = trimmed;
    }

    if (updates.passwordHash && updates.salt) {
      user.passwordHash = updates.passwordHash;
      user.salt = updates.salt;
    }

    if (updates.role && updates.role !== user.role) {
      // If demoting an admin to regular user, check last active admin
      if (user.role === 'admin' && updates.role === 'user' && user.isActive && this.getActiveAdminsCount() <= 1) {
        return {
          success: false,
          error: 'لا يمكن تحويل آخر مدير نشط إلى مستخدم عادي، يجب أن يبقى مدير نشط واحد على الأقل',
        };
      }
      user.role = updates.role;
    }

    if (typeof updates.isActive === 'boolean') {
      if (!updates.isActive) {
        const check = this.canToggleUserStatus(id);
        if (!check.allowed) {
          return { success: false, error: check.reason };
        }
      }
      user.isActive = updates.isActive;
    }

    if (typeof updates.mustChangePassword === 'boolean') {
      user.mustChangePassword = updates.mustChangePassword;
    }

    this.notify();
    return { success: true };
  }

  public toggleUserStatus(id: string): { success: boolean; error?: string; newStatus?: boolean } {
    const user = this.getUserById(id);
    if (!user) {
      return { success: false, error: 'المستخدم غير موجود' };
    }
    if (user.isActive) {
      const check = this.canToggleUserStatus(id);
      if (!check.allowed) {
        return { success: false, error: check.reason };
      }
    }
    user.isActive = !user.isActive;
    this.notify();
    return { success: true, newStatus: user.isActive };
  }

  public deleteUser(id: string): { success: boolean; error?: string } {
    const check = this.canDeleteUser(id);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }
    this.state.users = (this.state.users || []).filter((u) => u.id !== id);
    this.notify();
    return { success: true };
  }

  public updateUserLastLogin(id: string): void {
    const user = this.getUserById(id);
    if (user) {
      user.lastLogin = new Date().toISOString();
      this.notify();
    }
  }
}

// Global Singleton Instance for easy offline persistence
export const db = new LocalStorageEngine();

