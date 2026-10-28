import { Student, Subject, GradeRecord, SubjectEvaluation, StudentComprehensiveEvaluation } from '../types';

export interface SubjectExemptionDisplay {
  isExempt: boolean;
  isGeneralExempt: boolean;
  isIndividualExempt: boolean;
  /**
   * القيمة النصية أو الرقمية المعروضة داخل خلية الدرجة للمادة
   */
  gradeDisplayText: string;
  /**
   * الملاحظة الخاصة بمادة واحدة في جدول المواد (مثل: معفى، ناجح، راسب)
   */
  subjectNotesText: string;
  /**
   * هل يعتبر الطالب ناجحاً/معفياً في هذه المادة تحديداً
   */
  isPassedOrExempt: boolean;
  /**
   * وسام التمييز إن وجد (مثل: معفى)
   */
  badgeText?: string;
}

export interface StudentExemptionReportSummary {
  isGeneralExempt: boolean;
  /**
   * الحالة العامة للطالب في التقارير (مثل: معفى عام، ناجح، مكمّل، راسب، غير مكتمل)
   */
  finalStatusText: string;
  /**
   * صنف كلاس CSS للشارة
   */
  finalStatusBadgeClass: string;
}

/**
 * فحص هل الطالب مشمول بالإعفاء العام صراحة
 */
export function isStudentGeneralExempt(
  student: Student,
  evaluation?: StudentComprehensiveEvaluation
): boolean {
  if (student.isGeneralExempt === true) {
    return true;
  }
  if (evaluation?.isGeneralExempt === true) {
    return true;
  }
  if (evaluation?.statusFinal === 'معفى عام' || evaluation?.statusFinal === 'ناجح — إعفاء عام') {
    return true;
  }
  return false;
}

/**
 * فحص هل الطالب مشمول بالإعفاء الفردي في مادة معينة
 */
export function isStudentSubjectExempt(
  student: Student,
  subjectId: string,
  gradeRecord?: GradeRecord,
  subEval?: SubjectEvaluation
): boolean {
  if (student.individualExemptions?.includes(subjectId)) {
    return true;
  }
  if (gradeRecord?.isIndividualExempt === true) {
    return true;
  }
  if (subEval?.isIndividualExempt === true) {
    return true;
  }
  return false;
}

/**
 * إرجاع المسمى الموحد للحالة النهائية للطالب في التقارير الرسمية
 */
export function getStudentReportFinalStatus(
  student: Student,
  evaluation?: StudentComprehensiveEvaluation
): StudentExemptionReportSummary {
  const isGenExempt = isStudentGeneralExempt(student, evaluation);

  if (isGenExempt) {
    return {
      isGeneralExempt: true,
      finalStatusText: 'معفى عام',
      finalStatusBadgeClass: 'text-emerald-800 bg-emerald-50 border border-emerald-300',
    };
  }

  const rawStatus = evaluation?.statusFinal || 'غير مكتمل';
  let formattedStatus = rawStatus;

  if (rawStatus === 'ناجح — إعفاء عام') {
    formattedStatus = 'معفى عام';
  }

  let badgeClass = 'text-slate-600 bg-slate-100';
  if (formattedStatus === 'معفى عام' || formattedStatus === 'ناجح') {
    badgeClass = 'text-emerald-800 bg-emerald-50 border border-emerald-300';
  } else if (formattedStatus === 'مكمّل') {
    badgeClass = 'text-amber-800 bg-amber-50 border border-amber-300';
  } else if (formattedStatus === 'راسب') {
    badgeClass = 'text-rose-800 bg-rose-50 border border-rose-300';
  }

  return {
    isGeneralExempt: false,
    finalStatusText: formattedStatus,
    finalStatusBadgeClass: badgeClass,
  };
}

/**
 * دالة موحدة لحساب وتنسيق عرض درجة وملاحظات مادة دراسية للطالب في التقارير الرسمية
 */
export function getSubjectReportDisplay(
  student: Student,
  subject: Subject,
  gradeRecord?: GradeRecord,
  subEval?: SubjectEvaluation
): SubjectExemptionDisplay {
  const isGenExempt = isStudentGeneralExempt(student);
  const isIndivExempt = isStudentSubjectExempt(student, subject.id, gradeRecord, subEval);
  const isExempt = isGenExempt || isIndivExempt;

  const yearlyScore = gradeRecord?.termYearlyScore ?? subEval?.termYearlyScore ?? null;
  const effectiveFinalScore = subEval?.effectiveFinalScore ?? gradeRecord?.finalScore ?? null;

  // 1. إذا كان الطالب معفى عاماً
  if (isGenExempt) {
    return {
      isExempt: true,
      isGeneralExempt: true,
      isIndividualExempt: false,
      gradeDisplayText: yearlyScore !== null && yearlyScore !== undefined ? String(yearlyScore) : 'معفى',
      subjectNotesText: 'معفى',
      isPassedOrExempt: true,
      badgeText: 'معفى',
    };
  }

  // 2. إذا كان الطالب معفى فردياً من هذه المادة
  if (isIndivExempt) {
    return {
      isExempt: true,
      isGeneralExempt: false,
      isIndividualExempt: true,
      gradeDisplayText: yearlyScore !== null && yearlyScore !== undefined ? String(yearlyScore) : 'معفى',
      subjectNotesText: 'معفى',
      isPassedOrExempt: true,
      badgeText: 'معفى',
    };
  }

  // 3. الطالب غير معفى في هذه المادة (حساب طبيعي)
  const scoreNum = effectiveFinalScore !== null && effectiveFinalScore !== undefined ? Number(effectiveFinalScore) : null;
  const isPass = scoreNum !== null && !isNaN(scoreNum) && scoreNum >= (subject.passScore || 50);

  let notesText = 'غير مكتمل';
  if (scoreNum !== null && !isNaN(scoreNum)) {
    notesText = isPass ? 'ناجح' : 'راسب';
  }

  return {
    isExempt: false,
    isGeneralExempt: false,
    isIndividualExempt: false,
    gradeDisplayText: scoreNum !== null && !isNaN(scoreNum) ? String(scoreNum) : '—',
    subjectNotesText: notesText,
    isPassedOrExempt: isPass,
    badgeText: undefined,
  };
}
