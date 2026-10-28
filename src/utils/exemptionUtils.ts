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
  if (evaluation) {
    return evaluation.isGeneralExempt === true;
  }
  return student.isGeneralExempt === true;
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
  subEval?: SubjectEvaluation,
  reportGradeType: 'finalScore' | 'termYearlyScore' = 'finalScore'
): SubjectExemptionDisplay {
  const isGenExempt = subEval ? subEval.isGeneralExempt : isStudentGeneralExempt(student);
  const isIndivExempt = subEval ? subEval.isIndividualExempt : isStudentSubjectExempt(student, subject.id, gradeRecord);
  const isExempt = isGenExempt || isIndivExempt;

  const yearlyScore = gradeRecord?.termYearlyScore ?? subEval?.termYearlyScore ?? null;
  const effectiveFinalScore = subEval?.effectiveFinalScore ?? gradeRecord?.finalScore ?? null;

  // أ) في حال عرض تقرير السعي السنوي فقط:
  // تظهر درجات السعي السنوي الرقمية الأصلية كأرقام طبيعية لجميع الطلبة بمن فيهم المعفون عاماً وفردياً
  if (reportGradeType === 'termYearlyScore') {
    const hasYearly = yearlyScore !== null && yearlyScore !== undefined && !isNaN(yearlyScore);
    const pass = hasYearly && Number(yearlyScore) >= (subject.passScore || 50);
    return {
      isExempt,
      isGeneralExempt: isGenExempt,
      isIndividualExempt: isIndivExempt,
      gradeDisplayText: hasYearly ? String(yearlyScore) : '—',
      subjectNotesText: isGenExempt ? 'معفى عام' : isIndivExempt ? 'معفى' : hasYearly ? (pass ? 'ناجح' : 'راسب') : 'غير مكتمل',
      isPassedOrExempt: isExempt || pass,
      badgeText: isGenExempt ? 'إعفاء عام' : isIndivExempt ? 'معفى' : undefined,
    };
  }

  // ب) في حال عرض تقرير الدرجات النهائية الرسمية (finalScore):
  // 1. إذا كان الطالب معفى عاماً: يظهر «إعفاء عام» بوضوح في الدرجة والامتحان النهائي
  if (isGenExempt) {
    return {
      isExempt: true,
      isGeneralExempt: true,
      isIndividualExempt: false,
      gradeDisplayText: 'إعفاء عام',
      subjectNotesText: 'إعفاء عام',
      isPassedOrExempt: true,
      badgeText: 'إعفاء عام',
    };
  }

  // 2. إذا كان الطالب معفى فردياً من هذه المادة: يظهر «معفى»
  if (isIndivExempt) {
    return {
      isExempt: true,
      isGeneralExempt: false,
      isIndividualExempt: true,
      gradeDisplayText: 'معفى',
      subjectNotesText: 'معفى',
      isPassedOrExempt: true,
      badgeText: 'معفى',
    };
  }

  // 3. الطالب غير معفى في هذه المادة (حساب طبيعي رسمي)
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
