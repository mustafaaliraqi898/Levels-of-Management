export type GradeStage = 'term1' | 'midterm' | 'term2' | 'final' | 'second_round';

export type ResultGradeType =
  | 'term1Score'              // درجة الفصل الأول
  | 'midtermScore'            // درجة نصف السنة
  | 'term2Score'              // درجة الفصل الثاني
  | 'termYearlyScore'         // درجة السعي السنوي
  | 'finalExamScore'          // درجة الامتحان النهائي
  | 'finalScore'              // الدرجة النهائية (الدور الأول)
  | 'secondRoundFinalScore';  // الدرجة النهائية بعد الإكمال

export type RoundingRule = 
  | 'standard'     // تقريب رياضي لأقرب عدد صحيح (>= 0.5 للأعلى)
  | 'ceil'         // جبر الكسر لصالح الطالب (أي كسر يرفع للأعلى)
  | 'floor'        // حذف الكسور بدون تقريب
  | 'one_decimal'  // إبقاء كسر عشري واحد
  | 'two_decimals'; // إبقاء كسرين عشريين

export interface AcademicYear {
  id: string;
  name: string; // e.g., "2026–2027"
  isCurrent: boolean;
}

export interface SchoolClass {
  id: string;
  name: string; // e.g., "الخامس العلمي"
  stage: string; // "إعدادي", "متوسط", "ابتدائي"
  order: number;
  academicYearId?: string; // العام الدراسي التابع له الصف
  isArchived?: boolean; // هل الصف مؤرشف/مغلق للمحافظة على سجلاته التاريخية
}

export interface Section {
  id: string;
  classId: string;
  name: string; // e.g., "أ", "ب", "ج"
}

export interface Subject {
  id: string;
  classId: string;
  name: string; // e.g., "الرياضيات", "اللغة العربية"
  maxScore: number; // default: 100
  passScore: number; // default: 50
  order: number;
}

export interface Student {
  id: string;
  name: string; // اسم الطالب
  registrationNumber?: string; // رقم القيد
  fatherPhone?: string; // رقم هاتف الأب
  seatNumber: number; // الرقم التسلسلي / الامتحاني
  nationalId?: string; // الرقم الوطني (للتوافق القديم)
  academicYearId: string;
  classId: string;
  sectionId: string;
  gender?: 'male' | 'female';
  notes?: string;
  isGeneralExempt?: boolean; // مشمول بالإعفاء العام
  individualExemptions?: string[]; // مصفوفة بالمواد المعفى منها فردياً (subjectId)
}

export interface GradeAuditEntry {
  field: 'term1Score' | 'midtermScore' | 'term2Score' | 'finalExamScore' | 'secondRoundScore';
  fieldArabic: string;
  oldValue: number | null;
  newValue: number | null;
  timestamp: string;
  reason?: string;
}

export interface GradeRecord {
  id: string; // `${academicYearId}_${classId}_${sectionId}_${subjectId}_${studentId}`
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  studentId: string;
  
  // Official Arabic columns
  term1Score: number | null;              // درجة الفصل الأول
  midtermScore: number | null;            // درجة نصف السنة
  term2Score: number | null;              // درجة الفصل الثاني
  termYearlyScore: number | null;         // درجة السعي السنوي (محسوبة تلقائياً)
  finalExamScore: number | null;          // درجة الامتحان النهائي (الدور الأول)
  finalScore: number | null;              // الدرجة النهائية (الدور الأول، محسوبة تلقائياً)

  // الدور الثاني والإكمال
  secondRoundScore: number | null;        // درجة الإكمال (امتحان الدور الثاني)
  secondRoundFinalScore: number | null;   // الدرجة النهائية بعد الإكمال (السعي + الإكمال ÷ 2)
  secondRoundDate?: string;               // تاريخ ووقت رصد درجة الإكمال

  // الإعفاء الفردي
  isIndividualExempt?: boolean;           // مشمول بالإعفاء الفردي في هذه المادة

  lastUpdated: string;
  auditHistory?: GradeAuditEntry[];
}

export interface AcademicYearDecisionSettings {
  academicYearId: string;
  maxFailedSubjectsAllowed: number;              // عدد دروس الرسوب المسموح بها (الافتراضي: 4 مواد)
  primaryAssistanceMarks: number;                // درجات المساعدة الوزارية الرئيسية (الافتراضي: 10 درجات)
  secondRoundAdditionalAssistanceMarks: number;  // درجات المساعدة الوزارية الإضافية بعد الدور الثاني (الافتراضي: 0 درجات)
  notes?: string;                                // ملاحظات الإعدادات
  updatedAt?: string;
}

export interface SubjectEvaluation {
  subject: Subject;
  term1Score: number | null;
  midtermScore: number | null;
  term2Score: number | null;
  termYearlyScore: number | null;
  finalExamScore: number | null;
  
  // الدور الأول
  rawFinalScore: number | null;
  isGeneralExempt: boolean;
  isIndividualExempt: boolean;
  isExempt: boolean;
  
  // المساعدة الرئيسية (الدور الأول)
  primaryAssistanceApplied: number;
  finalScoreAfterPrimaryAssistance: number | null;
  passed1stRound: boolean;
  
  // الدور الثاني والإكمال
  isMakeUpEligible: boolean;
  secondRoundScore: number | null;
  secondRoundFinalScore: number | null;
  secondRoundDate?: string;
  
  // المساعدة الإضافية والمتبقية بعد الدور الثاني
  secondRoundAssistanceApplied: number;
  finalScoreAfterSecondRoundAssistance: number | null;
  passedFinal: boolean;
  
  // الدرجة المعروضة النهائية
  effectiveFinalScore: number | null;
}

export interface StudentComprehensiveEvaluation {
  student: Student;
  academicYearId: string;
  isComplete1stRound: boolean;
  
  isGeneralExempt: boolean;
  
  // نتائج الدور الأول
  failedCountBeforeAssistance: number;
  primaryAssistanceUsed: number;
  primaryAssistanceRemaining: number;
  failedCountAfterPrimaryAssistance: number;
  status1stRound: 'ناجح' | 'مكمّل' | 'راسب' | 'غير مكتمل' | 'ناجح — إعفاء عام' | 'معفى عام';
  /** حقل إضافي بديل للتوافق البرمجي */
  statusBeforeSecondRound?: 'ناجح' | 'مكمّل' | 'راسب' | 'غير مكتمل' | 'ناجح — إعفاء عام' | 'معفى عام';
  
  // نتائج الدور الثاني والمساعدة الإضافية
  totalAssistancePoolSecondRound: number;
  secondRoundAssistanceUsed: number;
  secondRoundAssistanceRemaining: number;
  hasSecondRoundScores: boolean;
  failedCountFinal: number;
  statusFinal: 'ناجح' | 'مكمّل' | 'راسب' | 'غير مكتمل' | 'ناجح — إعفاء عام' | 'معفى عام';
  
  // عمود الملاحظات
  notes: 'ناجح' | 'مكمّل' | 'راسب' | 'ناجح — إعفاء عام' | 'غير مكتمل' | 'معفى عام';
  
  subjects: Record<string, SubjectEvaluation>;
  subjectsList: SubjectEvaluation[];
}

export interface AppSettings {
  schoolName: string;
  directorName: string;
  examCommitteeHead: string;
  city: string;
  roundingRule: RoundingRule;
  maxScoreDefault: number;
  passScoreDefault: number;
  confirmPreviousTermEdits: boolean;
  theme: 'dark' | 'light';
  schoolLogo?: string; // Base64 data URL for school logo
  kuficLogo?: string; // Base64 data URL for school Kufic geometric logo
  backupPath?: string; // Custom path for automated and manual backups
  isAccessCodeConfigured?: boolean; // هل تم إنشاء رمز الدخول مسبقاً
  accessCodeHash?: string; // هاش رمز الدخول المشفر
  accessCodeSalt?: string; // الملح المستخدم في تشفير الرمز
  accessCodeCreatedAt?: string; // تاريخ إنشاء رمز الدخول
}

export interface ExemptionSettings {
  academicYearId: string;
  generalMinAverage: number;      // Default: 85
  generalMinSubjectScore: number; // Default: 75
  enableGeneralJabr: boolean;     // Enable applying school rounding rule to evaluation average
  isGeneralExemptionEnabled: boolean;
  individualMinScore: number;     // Default: 90
  isIndividualExemptionEnabled: boolean;
  isConfigured: boolean;          // Whether settings were explicitly reviewed and saved
  updatedAt?: string;
}

export interface IndividualExemptionSubjectResult {
  subjectId: string;
  subjectName: string;
  yearlyScore: number | null;
  requiredScore: number;
  status: 'مستحق للإعفاء الفردي' | 'غير مستحق' | 'غير مكتمل';
  meetsScoreCondition?: boolean;
  isExemptionEnabled?: boolean;
  diagnosticReason?: string;
}

export interface GeneralExemptionResult {
  student: Student;
  rawAverage: number | null;        // Exact raw average
  evaluatedAverage: number | null;  // Average after applying Jabr if enabled
  appliedJabr: boolean;             // True if jabr was enabled and affected or evaluated
  minSubjectScore: number | null;   // Lowest yearly term score across subjects
  lowestSubjectName?: string;       // Name of subject with lowest score
  isComplete: boolean;              // True if all subjects have yearly scores
  status: 'معفى عام' | 'غير مشمول' | 'غير مكتمل';
  reason: string;                   // Explanation of status
  individualResults: IndividualExemptionSubjectResult[];
  subjectsBelowMin?: { subjectId: string; subjectName: string; score: number }[];
  isNearEligible?: boolean;         // True if meets average condition with strictly 1 or 2 subjects < minScore
}

export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  isActive: boolean;
  email?: string; // بريد إلكتروني خاص بحسابات الأدمن لاستعادة كلمة المرور
  mustChangePassword?: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  user: {
    id: string;
    username: string;
    role: UserRole;
    email?: string;
    mustChangePassword?: boolean;
  };
  token: string;
  loginTime: string;
}

export type CertificateElementKey =
  | 'officialLogo'
  | 'kuficLogo'
  | 'studentName'
  | 'academicYear'
  | 'directorName';

export interface CertificateElementConfig {
  x: number; // percentage from left (0 to 100)
  y: number; // percentage from top (0 to 100)
  width?: number; // percentage width of certificate canvas (e.g. 10%)
  height?: number; // percentage height or auto
  fontSize?: number; // font size in px at design base 1123px width
  fontWeight?: 'normal' | 'bold' | 'black';
  fontColor?: string; // hex color e.g. '#0f172a'
  fontFamily?: string; // 'Cairo' | 'Tajawal' | 'Amiri'
  textAlign?: 'center' | 'right' | 'left';
  visible: boolean;
}

export interface CertificateTemplateConfig {
  templateImage?: string; // Base64 data URL of uploaded background template
  elements: {
    officialLogo: CertificateElementConfig;
    kuficLogo: CertificateElementConfig;
    studentName: CertificateElementConfig;
    academicYear: CertificateElementConfig;
    directorName: CertificateElementConfig;
  };
  lastUpdated?: string;
}

export interface DecisionGrantRecord {
  id: string; // `${academicYearId}_${classId}_${sectionId}_${studentId}_${subjectId}_${round}`
  academicYearId: string;
  classId: string;
  sectionId: string;
  studentId: string;
  subjectId: string;
  round: 'round1' | 'round2';
  originalScore: number;           // الدرجة النهائية الأصلية قبل القرار
  appliedMarks: number;            // مقدار المساعدة الممنوحة (تصل إلى 50)
  finalScoreAfterDecision: number; // الدرجة بعد القرار (درجة النجاح 50)
  requiredPassScore: number;       // درجة النجاح المطلوبة (50)
  grantedAt: string;               // تاريخ ووقت المنح
  grantedBy?: string;              // اسم المدير المانح
  notes?: string;
}

export interface StudentPromotionBatchLog {
  id: string;
  date: string;
  sourceYearId: string;
  sourceYearName: string;
  targetYearId: string;
  targetYearName: string;
  promotedCount: number;
  repeatingCount: number;
  graduatedCount: number;
  excludedCount: number;
  totalProcessedCount: number;
  executedBy?: string;
}

export type ActiveTab = 
  | 'dashboard'
  | 'years'
  | 'classes'
  | 'students'
  | 'subjects'
  | 'grade_entry'
  | 'decision_marks'
  | 'results'
  | 'exemption'
  | 'reports'
  | 'certificate_template'
  | 'student_promotion'
  | 'backup'
  | 'settings';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      version: string;
      auth: {
        setSession: (session: AuthSession) => Promise<{ success: boolean }>;
        clearSession: () => Promise<{ success: boolean }>;
        requestPasswordResetCode: (username: string) => Promise<{
          success: boolean;
          maskedEmail?: string;
          message?: string;
          error?: string;
        }>;
        verifyResetCodeAndChangePassword: (
          username: string,
          code: string,
          newPassword: string
        ) => Promise<{ success: boolean; message?: string; error?: string }>;
      };
      smtp: {
        getSmtpStatus: () => Promise<{
          isConfigured: boolean;
          host: string;
          port: number;
          userEmail: string;
          rawEmail: string;
        }>;
        saveConfig: (config: {
          host?: string;
          port?: number | string;
          secure?: boolean;
          user?: string;
          pass?: string;
        }) => Promise<{ success: boolean; error?: string }>;
        testConnection: (config?: {
          host?: string;
          port?: number | string;
          secure?: boolean;
          user?: string;
          pass?: string;
        }) => Promise<{ success: boolean; message?: string; error?: string }>;
      };
      db: {
        init: () => Promise<{ success: boolean; error?: string }>;
        loadAll: () => Promise<any>;
        saveSettings: (key: string, value: any) => Promise<any>;
        upsertUser: (user: UserAccount) => Promise<any>;
        upsertYear: (year: AcademicYear) => Promise<any>;
        upsertClass: (cls: SchoolClass) => Promise<any>;
        upsertSection: (sec: Section) => Promise<any>;
        upsertSubject: (sub: Subject) => Promise<any>;
        upsertStudent: (stu: Student) => Promise<any>;
        upsertGrade: (grade: GradeRecord) => Promise<any>;
        saveExemptionSettings: (settings: ExemptionSettings) => Promise<any>;
        saveDecisionSettings: (settings: AcademicYearDecisionSettings) => Promise<any>;
        upsertDecisionGrant: (grant: DecisionGrantRecord) => Promise<any>;
        saveCertificateTemplate: (config: CertificateTemplateConfig, imageData?: string) => Promise<any>;
        upsertPromotionLog: (log: StudentPromotionBatchLog) => Promise<any>;
        executeStudentPromotionBatch: (students: Student[], promotionLog?: StudentPromotionBatchLog) => Promise<any>;
        deleteEntity: (table: string, id: string) => Promise<any>;
        deleteStudentCascade: (studentId: string) => Promise<any>;
        deleteClassCascade: (classId: string) => Promise<any>;
        createBackup: () => Promise<any>;
        getBackupsInfo: () => Promise<any>;
        exportSql: () => Promise<string>;
        restoreDb: (filePath: string) => Promise<{ success: boolean; message: string }>;
      };
      dialog: {
        openDirectory: () => Promise<string | null>;
        openFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
      };
    };
  }
}



