import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  ExemptionSettings,
} from '../types';
import { recalculateGradeRecord } from './calculations';
import { buildGradeKey, DatabaseState } from './storage';

// Canonical list of all subjects across all classes
export const CANONICAL_SUBJECTS: Subject[] = [
  // 5th Science (الخامس العلمي) - 7 Subjects
  { id: 'sub-math', classId: 'cls-5-sci', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 1 },
  { id: 'sub-arabic', classId: 'cls-5-sci', name: 'اللغة العربية', maxScore: 100, passScore: 50, order: 2 },
  { id: 'sub-english', classId: 'cls-5-sci', name: 'اللغة الإنكليزية', maxScore: 100, passScore: 50, order: 3 },
  { id: 'sub-physics', classId: 'cls-5-sci', name: 'الفيزياء', maxScore: 100, passScore: 50, order: 4 },
  { id: 'sub-chemistry', classId: 'cls-5-sci', name: 'الكيمياء', maxScore: 100, passScore: 50, order: 5 },
  { id: 'sub-biology', classId: 'cls-5-sci', name: 'الأحياء', maxScore: 100, passScore: 50, order: 6 },
  { id: 'sub-islamic', classId: 'cls-5-sci', name: 'التربية الإسلامية', maxScore: 100, passScore: 50, order: 7 },

  // 6th Science (السادس العلمي) - 7 Subjects
  { id: 'sub-6-math', classId: 'cls-6-sci', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 1 },
  { id: 'sub-6-arabic', classId: 'cls-6-sci', name: 'اللغة العربية', maxScore: 100, passScore: 50, order: 2 },
  { id: 'sub-6-english', classId: 'cls-6-sci', name: 'اللغة الإنكليزية', maxScore: 100, passScore: 50, order: 3 },
  { id: 'sub-6-physics', classId: 'cls-6-sci', name: 'الفيزياء', maxScore: 100, passScore: 50, order: 4 },
  { id: 'sub-6-chem', classId: 'cls-6-sci', name: 'الكيمياء', maxScore: 100, passScore: 50, order: 5 },
  { id: 'sub-6-bio', classId: 'cls-6-sci', name: 'الأحياء', maxScore: 100, passScore: 50, order: 6 },
  { id: 'sub-6-islamic', classId: 'cls-6-sci', name: 'التربية الإسلامية', maxScore: 100, passScore: 50, order: 7 },

  // 4th Science (الرابع العلمي) - 7 Subjects
  { id: 'sub-4-islamic', classId: 'cls-4-sci', name: 'التربية الإسلامية', maxScore: 100, passScore: 50, order: 1 },
  { id: 'sub-4-arabic', classId: 'cls-4-sci', name: 'اللغة العربية', maxScore: 100, passScore: 50, order: 2 },
  { id: 'sub-4-english', classId: 'cls-4-sci', name: 'اللغة الإنكليزية', maxScore: 100, passScore: 50, order: 3 },
  { id: 'sub-4-math', classId: 'cls-4-sci', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 4 },
  { id: 'sub-4-chem', classId: 'cls-4-sci', name: 'الكيمياء', maxScore: 100, passScore: 50, order: 5 },
  { id: 'sub-4-physics', classId: 'cls-4-sci', name: 'الفيزياء', maxScore: 100, passScore: 50, order: 6 },
  { id: 'sub-4-bio', classId: 'cls-4-sci', name: 'الأحياء', maxScore: 100, passScore: 50, order: 7 },

  // 3rd Intermediate (الثالث المتوسط) - 7 Subjects
  { id: 'sub-3-islamic', classId: 'cls-3-mid', name: 'التربية الإسلامية', maxScore: 100, passScore: 50, order: 1 },
  { id: 'sub-3-arabic', classId: 'cls-3-mid', name: 'اللغة العربية', maxScore: 100, passScore: 50, order: 2 },
  { id: 'sub-3-english', classId: 'cls-3-mid', name: 'اللغة الإنكليزية', maxScore: 100, passScore: 50, order: 3 },
  { id: 'sub-3-math', classId: 'cls-3-mid', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 4 },
  { id: 'sub-3-chem', classId: 'cls-3-mid', name: 'الكيمياء', maxScore: 100, passScore: 50, order: 5 },
  { id: 'sub-3-physics', classId: 'cls-3-mid', name: 'الفيزياء', maxScore: 100, passScore: 50, order: 6 },
  { id: 'sub-3-bio', classId: 'cls-3-mid', name: 'الأحياء', maxScore: 100, passScore: 50, order: 7 },
];

// Additional demo students for other sections to provide complete test coverage
export const ADDITIONAL_DEMO_STUDENTS: Student[] = [
  // 5th Science - Section B
  { id: 'stu-5b-201', registrationNumber: '2001', fatherPhone: '0770234501', seatNumber: 1, name: 'أوس فراس محمود العبيدي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-b', gender: 'male' },
  { id: 'stu-5b-202', registrationNumber: '2002', fatherPhone: '0770234502', seatNumber: 2, name: 'بلال حسن طه المشهداني', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-b', gender: 'male' },
  { id: 'stu-5b-203', registrationNumber: '2003', fatherPhone: '0770234503', seatNumber: 3, name: 'تميم ضياء إسماعيل الحيالي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-b', gender: 'male' },
  { id: 'stu-5b-204', registrationNumber: '2004', fatherPhone: '0770234504', seatNumber: 4, name: 'حارث مؤيد سليم الطائي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-b', gender: 'male' },
  { id: 'stu-5b-205', registrationNumber: '2005', fatherPhone: '0770234505', seatNumber: 5, name: 'دانيال نزار رفيق الشمري', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-b', gender: 'male' },

  // 5th Science - Section C (الشعبة ج)
  { id: 'stu-5c-251', registrationNumber: '2501', fatherPhone: '0770254501', seatNumber: 1, name: 'فاروق عمر عبد القادر الحديثي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-c', gender: 'male' },
  { id: 'stu-5c-252', registrationNumber: '2502', fatherPhone: '0770254502', seatNumber: 2, name: 'أحمد طارق خليل الراوي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-c', gender: 'male' },
  { id: 'stu-5c-253', registrationNumber: '2503', fatherPhone: '0770254503', seatNumber: 3, name: 'ليث عماد صائب الجبوري', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-c', gender: 'male' },
  { id: 'stu-5c-254', registrationNumber: '2504', fatherPhone: '0770254504', seatNumber: 4, name: 'حيدر عدي فاضل الكلابي', academicYearId: 'ay-2026-2027', classId: 'cls-5-sci', sectionId: 'sec-5sci-c', gender: 'male' },

  // 6th Science - Section A
  { id: 'stu-6a-301', registrationNumber: '3001', fatherPhone: '0770334501', seatNumber: 1, name: 'مصطفى كمال الدين الجبوري', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-a', gender: 'male' },
  { id: 'stu-6a-302', registrationNumber: '3002', fatherPhone: '0770334502', seatNumber: 2, name: 'همام عبد الرحمن الزهيري', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-a', gender: 'male' },
  { id: 'stu-6a-303', registrationNumber: '3003', fatherPhone: '0770334503', seatNumber: 3, name: 'أيمن عاصم حميد الخالدي', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-a', gender: 'male' },
  { id: 'stu-6a-304', registrationNumber: '3004', fatherPhone: '0770334504', seatNumber: 4, name: 'برهان صبحي جليل العاني', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-a', gender: 'male' },
  { id: 'stu-6a-305', registrationNumber: '3005', fatherPhone: '0770334505', seatNumber: 5, name: 'تيسير غسان كامل الفهداوي', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-a', gender: 'male' },

  // 6th Science - Section B
  { id: 'stu-6b-351', registrationNumber: '3501', fatherPhone: '0770384501', seatNumber: 1, name: 'أمجد صباح شريف الدليمي', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-b', gender: 'male' },
  { id: 'stu-6b-352', registrationNumber: '3502', fatherPhone: '0770384502', seatNumber: 2, name: 'جهاد حازم وفيق السعدون', academicYearId: 'ay-2026-2027', classId: 'cls-6-sci', sectionId: 'sec-6sci-b', gender: 'male' },

  // 4th Science - Section A
  { id: 'stu-4a-401', registrationNumber: '4001', fatherPhone: '0770434501', seatNumber: 1, name: 'مروان نبهان عاصم الشمري', academicYearId: 'ay-2026-2027', classId: 'cls-4-sci', sectionId: 'sec-4sci-a', gender: 'male' },
  { id: 'stu-4a-402', registrationNumber: '4002', fatherPhone: '0770434502', seatNumber: 2, name: 'سامر قتيبة غانم الكرخي', academicYearId: 'ay-2026-2027', classId: 'cls-4-sci', sectionId: 'sec-4sci-a', gender: 'male' },
  { id: 'stu-4a-403', registrationNumber: '4003', fatherPhone: '0770434503', seatNumber: 3, name: 'عدنان فوزي نافع البغدادي', academicYearId: 'ay-2026-2027', classId: 'cls-4-sci', sectionId: 'sec-4sci-a', gender: 'male' },

  // 3rd Intermediate - Section A
  { id: 'stu-3m-501', registrationNumber: '5001', fatherPhone: '0770534501', seatNumber: 1, name: 'إبراهيم غيث عواد الخزرجي', academicYearId: 'ay-2026-2027', classId: 'cls-3-mid', sectionId: 'sec-3mid-a', gender: 'male' },
  { id: 'stu-3m-502', registrationNumber: '5002', fatherPhone: '0770534502', seatNumber: 2, name: 'سنان ماجد صبحي الراوي', academicYearId: 'ay-2026-2027', classId: 'cls-3-mid', sectionId: 'sec-3mid-a', gender: 'male' },
  { id: 'stu-3m-503', registrationNumber: '5003', fatherPhone: '0770534503', seatNumber: 3, name: 'باسم وسام فخري النقيب', academicYearId: 'ay-2026-2027', classId: 'cls-3-mid', sectionId: 'sec-3mid-a', gender: 'male' },
];

/**
 * Pre-defined test matrices for 5th Science A students to precisely test all 7 cases
 * Map from studentId to subjectId -> { term1, midterm, term2, finalExam }
 */
interface SubjectScorePlan {
  t1: number | null;
  mid: number | null;
  t2: number | null;
  finalExam?: number | null;
}

export const TEST_PLANS_5SCI_A: Record<string, Record<string, SubjectScorePlan>> = {
  // Case 7 General + Case 1 Individual: High Achiever (مستحق للإعفاء العام بجدارة 97.71% وكل مادة 90+)
  'stu-101': {
    'sub-math': { t1: 98, mid: 98, t2: 98, finalExam: 99 },      // yearly = 98 (مستحق فردي)
    'sub-arabic': { t1: 96, mid: 96, t2: 96, finalExam: 95 },    // yearly = 96 (مستحق فردي)
    'sub-english': { t1: 97, mid: 97, t2: 97, finalExam: 98 },   // yearly = 97 (مستحق فردي)
    'sub-physics': { t1: 98, mid: 98, t2: 98, finalExam: 99 },   // yearly = 98 (مستحق فردي)
    'sub-chemistry': { t1: 96, mid: 96, t2: 96, finalExam: 97 }, // yearly = 96 (مستحق فردي)
    'sub-biology': { t1: 99, mid: 99, t2: 99, finalExam: 100 },  // yearly = 99 (مستحق فردي)
    'sub-islamic': { t1: 100, mid: 100, t2: 100, finalExam: 100 },// yearly = 100 (مستحق فردي)
  },

  // Case 1 General: Eligible for General Exemption (88.14% avg, all >= 75)
  // Individual: Eligible in English (90) and Islamic (92)
  'stu-102': {
    'sub-math': { t1: 88, mid: 88, t2: 88, finalExam: 90 },      // yearly = 88
    'sub-arabic': { t1: 86, mid: 86, t2: 86, finalExam: 88 },    // yearly = 86
    'sub-english': { t1: 90, mid: 90, t2: 90, finalExam: 92 },   // yearly = 90 (مستحق فردي)
    'sub-physics': { t1: 87, mid: 87, t2: 87, finalExam: 89 },   // yearly = 87
    'sub-chemistry': { t1: 85, mid: 85, t2: 85, finalExam: 86 }, // yearly = 85
    'sub-biology': { t1: 89, mid: 89, t2: 89, finalExam: 91 },   // yearly = 89
    'sub-islamic': { t1: 92, mid: 92, t2: 92, finalExam: 94 },   // yearly = 92 (مستحق فردي)
  },

  // Case 2 General: Average > 85 (89.29%), BUT Chemistry has 72 (< 75)!
  // Reason: أقل درجة سعي (الكيمياء: 72) أقل من الحد المسموح (75)
  // Individual: Eligible in 5 subjects (Math 94, Arabic 92, English 95, Physics 90, Islamic 94)
  'stu-103': {
    'sub-math': { t1: 94, mid: 94, t2: 94, finalExam: 95 },      // yearly = 94 (مستحق فردي)
    'sub-arabic': { t1: 92, mid: 92, t2: 92, finalExam: 93 },    // yearly = 92 (مستحق فردي)
    'sub-english': { t1: 95, mid: 95, t2: 95, finalExam: 96 },   // yearly = 95 (مستحق فردي)
    'sub-physics': { t1: 90, mid: 90, t2: 90, finalExam: 91 },   // yearly = 90 (مستحق فردي)
    'sub-chemistry': { t1: 70, mid: 74, t2: 72, finalExam: 75 }, // yearly = 72 (< 75 blocker!)
    'sub-biology': { t1: 88, mid: 88, t2: 88, finalExam: 90 },   // yearly = 88
    'sub-islamic': { t1: 94, mid: 94, t2: 94, finalExam: 96 },   // yearly = 94 (مستحق فردي)
  },

  // Case 4 General: Borderline Average = 84.57% to test Jabr toggle (84.57 without jabr vs 85 with jabr)
  // All subjects >= 75
  'stu-104': {
    'sub-math': { t1: 85, mid: 85, t2: 85, finalExam: 86 },      // yearly = 85
    'sub-arabic': { t1: 85, mid: 85, t2: 85, finalExam: 86 },    // yearly = 85
    'sub-english': { t1: 85, mid: 85, t2: 85, finalExam: 86 },   // yearly = 85
    'sub-physics': { t1: 84, mid: 84, t2: 84, finalExam: 85 },   // yearly = 84
    'sub-chemistry': { t1: 85, mid: 85, t2: 85, finalExam: 86 }, // yearly = 85
    'sub-biology': { t1: 84, mid: 84, t2: 84, finalExam: 85 },   // yearly = 84
    'sub-islamic': { t1: 84, mid: 84, t2: 84, finalExam: 85 },   // yearly = 84
    // sum = 592 / 7 = 84.571%
  },

  // Case 3 General: Average below 85 slightly (81.71%) with all subjects >= 75
  'stu-105': {
    'sub-math': { t1: 82, mid: 82, t2: 82, finalExam: 84 },      // yearly = 82
    'sub-arabic': { t1: 80, mid: 80, t2: 80, finalExam: 82 },    // yearly = 80
    'sub-english': { t1: 83, mid: 83, t2: 83, finalExam: 85 },   // yearly = 83
    'sub-physics': { t1: 81, mid: 81, t2: 81, finalExam: 83 },   // yearly = 81
    'sub-chemistry': { t1: 82, mid: 82, t2: 82, finalExam: 83 }, // yearly = 82
    'sub-biology': { t1: 80, mid: 80, t2: 80, finalExam: 82 },   // yearly = 80
    'sub-islamic': { t1: 84, mid: 84, t2: 84, finalExam: 86 },   // yearly = 84
    // sum = 572 / 7 = 81.71%
  },

  // Case 5 General & Case 5 Individual: Incomplete Yearly Score in Biology (term 2 missing)
  'stu-106': {
    'sub-math': { t1: 95, mid: 95, t2: 95, finalExam: null },     // yearly = 95 (مستحق فردي)
    'sub-arabic': { t1: 94, mid: 94, t2: 94, finalExam: null },   // yearly = 94 (مستحق فردي)
    'sub-english': { t1: 92, mid: 92, t2: 92, finalExam: null },  // yearly = 92 (مستحق فردي)
    'sub-physics': { t1: 96, mid: 96, t2: 96, finalExam: null },  // yearly = 96 (مستحق فردي)
    'sub-chemistry': { t1: 93, mid: 93, t2: 93, finalExam: null },// yearly = 93 (مستحق فردي)
    'sub-biology': { t1: 92, mid: 90, t2: null, finalExam: null },// yearly = null! (غير مكتمل)
    'sub-islamic': { t1: 95, mid: 95, t2: 95, finalExam: null },  // yearly = 95 (مستحق فردي)
  },

  // Case 2 Individual: Score equals threshold exactly (90 = 90) + Case 3 Individual (89 < 90)
  'stu-107': {
    'sub-math': { t1: 90, mid: 90, t2: 90, finalExam: 92 },      // yearly = 90 (تساوي الحد تماماً!)
    'sub-arabic': { t1: 90, mid: 88, t2: 89, finalExam: 90 },    // yearly = 89 (أقل بنقطة واحدة!)
    'sub-english': { t1: 88, mid: 88, t2: 88, finalExam: 90 },   // yearly = 88
    'sub-physics': { t1: 90, mid: 90, t2: 90, finalExam: 92 },   // yearly = 90 (تساوي الحد تماماً!)
    'sub-chemistry': { t1: 86, mid: 86, t2: 86, finalExam: 88 }, // yearly = 86
    'sub-biology': { t1: 85, mid: 85, t2: 85, finalExam: 87 },   // yearly = 85
    'sub-islamic': { t1: 90, mid: 90, t2: 90, finalExam: 92 },   // yearly = 90 (تساوي الحد تماماً!)
    // General: 88.29% (معفى عام)
  },

  // General Exempt (88.71%), but NO individual exemption because all subjects are 88-89
  'stu-108': {
    'sub-math': { t1: 89, mid: 89, t2: 89, finalExam: 90 },      // yearly = 89 (< 90)
    'sub-arabic': { t1: 89, mid: 89, t2: 89, finalExam: 90 },    // yearly = 89 (< 90)
    'sub-english': { t1: 88, mid: 88, t2: 88, finalExam: 90 },   // yearly = 88 (< 90)
    'sub-physics': { t1: 89, mid: 89, t2: 89, finalExam: 90 },   // yearly = 89 (< 90)
    'sub-chemistry': { t1: 88, mid: 88, t2: 88, finalExam: 90 }, // yearly = 88 (< 90)
    'sub-biology': { t1: 89, mid: 89, t2: 89, finalExam: 90 },   // yearly = 89 (< 90)
    'sub-islamic': { t1: 89, mid: 89, t2: 89, finalExam: 90 },   // yearly = 89 (< 90)
  },

  // Case 4 Individual: Eligible for Individual in Math (93) and Physics (91),
  // but NOT eligible for General (avg = 78.29% and 4 subjects < 75)
  'stu-109': {
    'sub-math': { t1: 93, mid: 93, t2: 93, finalExam: 95 },      // yearly = 93 (مستحق فردي)
    'sub-arabic': { t1: 68, mid: 68, t2: 68, finalExam: 70 },    // yearly = 68 (< 75 blocker)
    'sub-english': { t1: 70, mid: 70, t2: 70, finalExam: 72 },   // yearly = 70 (< 75 blocker)
    'sub-physics': { t1: 91, mid: 91, t2: 91, finalExam: 92 },   // yearly = 91 (مستحق فردي)
    'sub-chemistry': { t1: 72, mid: 72, t2: 72, finalExam: 75 }, // yearly = 72 (< 75 blocker)
    'sub-biology': { t1: 74, mid: 74, t2: 74, finalExam: 76 },   // yearly = 74 (< 75 blocker)
    'sub-islamic': { t1: 80, mid: 80, t2: 80, finalExam: 82 },   // yearly = 80
  },

  // Case 6 General: Average student (avg = 62.57%, no exemption)
  'stu-110': {
    'sub-math': { t1: 62, mid: 62, t2: 62, finalExam: 65 },      // yearly = 62
    'sub-arabic': { t1: 58, mid: 58, t2: 58, finalExam: 60 },    // yearly = 58
    'sub-english': { t1: 65, mid: 65, t2: 65, finalExam: 68 },   // yearly = 65
    'sub-physics': { t1: 60, mid: 60, t2: 60, finalExam: 62 },   // yearly = 60
    'sub-chemistry': { t1: 55, mid: 55, t2: 55, finalExam: 58 }, // yearly = 55
    'sub-biology': { t1: 68, mid: 68, t2: 68, finalExam: 70 },   // yearly = 68
    'sub-islamic': { t1: 70, mid: 70, t2: 70, finalExam: 72 },   // yearly = 70
  },
};

/**
 * Generates an automatic balanced score plan for students not explicitly in the test matrix
 */
export function generateBalancedScorePlan(studentIndex: number, subjectIndex: number): SubjectScorePlan {
  // Deterministic realistic spread between 65 and 96
  const base = 65 + ((studentIndex * 5 + subjectIndex * 7) % 30);
  const t1 = Math.min(100, Math.max(50, base + ((studentIndex + subjectIndex) % 5) - 2));
  const mid = Math.min(100, Math.max(50, base + ((studentIndex * 2 + subjectIndex) % 7) - 3));
  const t2 = Math.min(100, Math.max(50, base + ((subjectIndex * 3) % 5) - 2));
  const finalExam = Math.min(100, Math.max(50, base + 2));

  return { t1, mid, t2, finalExam };
}

/**
 * Idempotently completes the database with all missing subjects, students, and grade records.
 * Protects existing user data completely.
 */
export function completeDemoSeedData(state: DatabaseState): {
  state: DatabaseState;
  newSubjectsCount: number;
  newStudentsCount: number;
  newGradesCount: number;
} {
  let newSubjectsCount = 0;
  let newStudentsCount = 0;
  let newGradesCount = 0;

  // 1. Ensure all Canonical Subjects exist
  const existingSubjectIds = new Set(state.subjects.map((s) => s.id));
  CANONICAL_SUBJECTS.forEach((sub) => {
    if (!existingSubjectIds.has(sub.id)) {
      state.subjects.push({ ...sub });
      existingSubjectIds.add(sub.id);
      newSubjectsCount++;
    }
  });

  // 2. Ensure all Demo Students exist
  const existingStudentIds = new Set(state.students.map((s) => s.id));
  ADDITIONAL_DEMO_STUDENTS.forEach((stu) => {
    if (!existingStudentIds.has(stu.id)) {
      state.students.push({ ...stu });
      existingStudentIds.add(stu.id);
      newStudentsCount++;
    }
  });

  // Ensure 5th Science has section C (الشعبة ج) for 3-section demonstration
  if (!state.sections.some((s) => s.id === 'sec-5sci-c')) {
    state.sections.push({ id: 'sec-5sci-c', classId: 'cls-5-sci', name: 'ج' });
  }

  // Ensure default Exemption Settings exist for all academic years
  if (!state.exemptionSettings) {
    state.exemptionSettings = {};
  }

  state.academicYears.forEach((year) => {
    if (!state.exemptionSettings![year.id]) {
      state.exemptionSettings![year.id] = {
        academicYearId: year.id,
        generalMinAverage: 85,
        generalMinSubjectScore: 75,
        enableGeneralJabr: false,
        individualMinScore: 90,
        isConfigured: true,
        updatedAt: new Date().toISOString(),
      };
    }
  });

  // 3. For EVERY student, ensure EVERY approved subject for their class has a grade record
  state.students.forEach((student, stuIdx) => {
    const classApprovedSubjects = state.subjects.filter((s) => s.classId === student.classId);

    classApprovedSubjects.forEach((subject, subIdx) => {
      const key = buildGradeKey(
        student.academicYearId,
        student.classId,
        student.sectionId,
        subject.id,
        student.id
      );

      // If record already exists, NEVER overwrite it!
      if (state.grades[key]) {
        return;
      }

      // Record is missing -> create it using either explicit test plan or balanced generation
      let plan: SubjectScorePlan;

      // Special 6th science borderline student for exact 84.50 average across 6-7 subjects
      if (student.id === 'stu-6a-301') {
        // Mustafa Kamal: scores: 85, 85, 85, 84, 84, 84, 85
        // 507 / 6 = 84.50 (if 6 subjects) or 592 / 7 = 84.57 (if 7 subjects)
        const val = subIdx % 2 === 0 ? 85 : 84;
        plan = { t1: val, mid: val, t2: val, finalExam: val + 1 };
      } else if (TEST_PLANS_5SCI_A[student.id]?.[subject.id]) {
        plan = TEST_PLANS_5SCI_A[student.id][subject.id];
      } else {
        plan = generateBalancedScorePlan(stuIdx, subIdx);
      }

      const { termYearlyScore, finalScore } = recalculateGradeRecord(
        {
          term1Score: plan.t1,
          midtermScore: plan.mid,
          term2Score: plan.t2,
          finalExamScore: plan.finalExam ?? null,
        },
        state.settings.roundingRule
      );

      state.grades[key] = {
        id: key,
        academicYearId: student.academicYearId,
        classId: student.classId,
        sectionId: student.sectionId,
        subjectId: subject.id,
        studentId: student.id,
        term1Score: plan.t1,
        midtermScore: plan.mid,
        term2Score: plan.t2,
        termYearlyScore,
        finalExamScore: plan.finalExam ?? null,
        finalScore,
        secondRoundScore: null,
        secondRoundFinalScore: null,
        lastUpdated: new Date().toISOString(),
      };

      newGradesCount++;
    });
  });

  return {
    state,
    newSubjectsCount,
    newStudentsCount,
    newGradesCount,
  };
}
