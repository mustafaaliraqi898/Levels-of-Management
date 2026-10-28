import {
  GradeRecord,
  RoundingRule,
  GradeStage,
  Subject,
  Student,
  ExemptionSettings,
  GeneralExemptionResult,
  IndividualExemptionSubjectResult,
  AcademicYearDecisionSettings,
  SubjectEvaluation,
  StudentComprehensiveEvaluation,
  DecisionGrantRecord,
} from '../types';

/**
 * Rounds a number according to the school's configured rounding rule
 */
export function applyRounding(value: number, rule: RoundingRule): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }

  switch (rule) {
    case 'standard':
      // التقريب الرياضي المعتاد: >= 0.5 للأعلى
      return Math.round(value);
    case 'ceil':
      // جبر الكسر لصالح الطالب: أي كسر يُجبر للأعلى (مثال 49.1 -> 50)
      return Math.ceil(value);
    case 'floor':
      // حذف الكسور تماماً بدون تقريب
      return Math.floor(value);
    case 'one_decimal':
      // خانة عشرية واحدة
      return Math.round(value * 10) / 10;
    case 'two_decimals':
      // خانتان عشريتان
      return Math.round(value * 100) / 100;
    default:
      return Math.round(value);
  }
}

/**
 * حساب درجة السعي السنوي:
 * درجة السعي السنوي = (درجة الفصل الأول + درجة نصف السنة + درجة الفصل الثاني) ÷ 3
 * 
 * قاعدة أساسية: إذا كانت إحدى الدرجات فارغة، لا تعتبرها صفراً، ولا تحسب النتيجة.
 */
export function calculateTermYearlyScore(
  term1: number | null,
  midterm: number | null,
  term2: number | null,
  roundingRule: RoundingRule = 'standard'
): number | null {
  if (term1 === null || midterm === null || term2 === null) {
    return null;
  }
  if (isNaN(term1) || isNaN(midterm) || isNaN(term2)) {
    return null;
  }

  const rawAverage = (term1 + midterm + term2) / 3;
  return applyRounding(rawAverage, roundingRule);
}

/**
 * حساب الدرجة النهائية:
 * الدرجة النهائية = (درجة السعي السنوي + درجة الامتحان النهائي) ÷ 2
 * 
 * قاعدة أساسية: إذا كان السعي أو الامتحان النهائي فارغاً، لا تحسب الدرجة النهائية.
 */
export function calculateFinalScore(
  yearlyScore: number | null,
  finalExam: number | null,
  roundingRule: RoundingRule = 'standard'
): number | null {
  if (yearlyScore === null || finalExam === null) {
    return null;
  }
  if (isNaN(yearlyScore) || isNaN(finalExam)) {
    return null;
  }

  const rawAverage = (yearlyScore + finalExam) / 2;
  return applyRounding(rawAverage, roundingRule);
}

/**
 * حساب الدرجة النهائية بعد الإكمال:
 * الدرجة النهائية بعد الإكمال = (السعي السنوي + درجة الإكمال) ÷ 2
 * 
 * قاعدة أساسية: إذا كان السعي أو درجة الإكمال فارغاً، لا تحسب النتيجة.
 */
export function calculateSecondRoundFinalScore(
  yearlyScore: number | null,
  secondRoundScore: number | null,
  roundingRule: RoundingRule = 'standard'
): number | null {
  if (yearlyScore === null || secondRoundScore === null) {
    return null;
  }
  if (isNaN(yearlyScore) || isNaN(secondRoundScore)) {
    return null;
  }

  const rawAverage = (yearlyScore + secondRoundScore) / 2;
  return applyRounding(rawAverage, roundingRule);
}

/**
 * إعادة حساب وتحديث سجل الدرجات بالكامل
 */
export function recalculateGradeRecord(
  record: Partial<GradeRecord>,
  roundingRule: RoundingRule = 'standard'
): {
  termYearlyScore: number | null;
  finalScore: number | null;
  secondRoundFinalScore: number | null;
} {
  const term1 = record.term1Score !== undefined ? record.term1Score : null;
  const midterm = record.midtermScore !== undefined ? record.midtermScore : null;
  const term2 = record.term2Score !== undefined ? record.term2Score : null;
  const finalExam = record.finalExamScore !== undefined ? record.finalExamScore : null;
  const secondRound = record.secondRoundScore !== undefined ? record.secondRoundScore : null;

  const termYearlyScore = calculateTermYearlyScore(term1, midterm, term2, roundingRule);
  const finalScore = calculateFinalScore(termYearlyScore, finalExam, roundingRule);
  const secondRoundFinalScore = calculateSecondRoundFinalScore(termYearlyScore, secondRound, roundingRule);

  return {
    termYearlyScore,
    finalScore,
    secondRoundFinalScore,
  };
}

/**
 * فحص هل الدرجة المطلوبة في مرحلة معينة مدخلة
 */
export function isGradeEnteredForStage(
  record: GradeRecord | undefined,
  stage: GradeStage
): boolean {
  if (!record) return false;

  switch (stage) {
    case 'term1':
      return record.term1Score !== null && !isNaN(record.term1Score);
    case 'midterm':
      return record.midtermScore !== null && !isNaN(record.midtermScore);
    case 'term2':
      return record.term2Score !== null && !isNaN(record.term2Score);
    case 'final':
      return record.finalExamScore !== null && !isNaN(record.finalExamScore);
    case 'second_round':
      return record.secondRoundScore !== null && !isNaN(record.secondRoundScore);
    default:
      return false;
  }
}

/**
 * فحص اكتمال جميع الدرجات المتطلبة حتى هذه المرحلة
 */
export function isCompleteUpToStage(
  record: GradeRecord | undefined,
  stage: GradeStage
): boolean {
  if (!record) return false;

  switch (stage) {
    case 'term1':
      return record.term1Score !== null;
    case 'midterm':
      return record.term1Score !== null && record.midtermScore !== null;
    case 'term2':
      return record.term1Score !== null && record.midtermScore !== null && record.term2Score !== null;
    case 'final':
      return (
        record.term1Score !== null &&
        record.midtermScore !== null &&
        record.term2Score !== null &&
        record.finalExamScore !== null
      );
    default:
      return false;
  }
}

/**
 * التحقق من صحة الرقم المدخل
 */
export function validateScoreInput(
  rawInput: string,
  maxScore: number = 100
): { isValid: boolean; value: number | null; error?: string } {
  const trimmed = rawInput.trim();
  if (trimmed === '') {
    return { isValid: true, value: null };
  }

  // دعم الأرقام العربية المشرقية والإنجليزية
  const normalized = trimmed.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  const num = Number(normalized);
  if (isNaN(num)) {
    return { isValid: false, value: null, error: 'الرجاء إدخال رقم صحيح أو كسر صالح' };
  }

  if (num < 0) {
    return { isValid: false, value: null, error: 'لا يمكن أن تكون الدرجة سالبة (أقل من 0)' };
  }

  if (num > maxScore) {
    return { isValid: false, value: null, error: `الدرجة لا يمكن أن تتجاوز الحد الأعلى (${maxScore})` };
  }

  return { isValid: true, value: num };
}

/**
 * تنسيق عرض الدرجة
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(score)) {
    return '—';
  }
  return score.toString();
}

/**
 * وصف خيارات التقريب باللغة العربية
 */
export const ROUNDING_RULE_LABELS: Record<RoundingRule, { title: string; desc: string }> = {
  standard: {
    title: 'تقريب رياضي لأقرب عدد صحيح (0.5 للأعلى)',
    desc: 'الكسر من 0.5 وما فوق يُقرب إلى الرقم التالي، وأقل من 0.5 يُحذف (مثال: 74.5 -> 75، 74.4 -> 74)',
  },
  ceil: {
    title: 'جبر الكسر لصالح الطالب (Ceil)',
    desc: 'أي كسر يُجبر إلى الدرجة الأعلى تلقائياً لمصلحة الطالب (مثال: 49.1 -> 50، 72.05 -> 73)',
  },
  floor: {
    title: 'حذف الكسور بدون تقريب (Floor)',
    desc: 'إلغاء أي جزء عشري تماماً (مثال: 74.9 -> 74)',
  },
  one_decimal: {
    title: 'إبقاء كسر عشري واحد (0.1)',
    desc: 'عرض الدرجة مع مرتبة عشرية واحدة (مثال: 78.3)',
  },
  two_decimals: {
    title: 'إبقاء كسرين عشريين (0.01)',
    desc: 'عرض الدرجة مع مرتبتين عشريتين لأعلى دقة (مثال: 78.33)',
  },
};

/**
 * تقييم استحقاق الطالب للإعفاء العام والإعفاء الفردي بصورة مركزية وموحدة
 */
export function evaluateStudentExemption(
  student: Student,
  classSubjects: Subject[],
  studentGrades: Record<string, GradeRecord | undefined>,
  exemptionSettings: ExemptionSettings,
  schoolRoundingRule: RoundingRule
): GeneralExemptionResult {
  let totalYearlyScore = 0;
  let completedSubjectsCount = 0;
  let hasIncomplete = false;
  let minSubjectScore: number | null = null;
  let lowestSubjectName: string | undefined = undefined;

  const individualResults: IndividualExemptionSubjectResult[] = [];
  const subjectsBelowMin: { subjectId: string; subjectName: string; score: number }[] = [];

  const isIndividualEnabled = exemptionSettings.isIndividualExemptionEnabled !== false && (exemptionSettings.isIndividualExemptionEnabled as any) !== 0;
  const isGeneralEnabled = exemptionSettings.isGeneralExemptionEnabled !== false && (exemptionSettings.isGeneralExemptionEnabled as any) !== 0;

  classSubjects.forEach((sub) => {
    const record = studentGrades[sub.id];
    let score = record ? record.termYearlyScore : null;
    if (score === null && record && record.term1Score !== null && record.midtermScore !== null && record.term2Score !== null) {
      score = calculateTermYearlyScore(record.term1Score, record.midtermScore, record.term2Score, schoolRoundingRule);
    }

    let individualStatus: 'مستحق للإعفاء الفردي' | 'غير مستحق' | 'غير مكتمل' = 'غير مكتمل';
    let meetsScore = false;
    let diagnostic = '';

    if (score !== null && score !== undefined && !isNaN(score)) {
      totalYearlyScore += score;
      completedSubjectsCount++;
      if (minSubjectScore === null || score < minSubjectScore) {
        minSubjectScore = score;
        lowestSubjectName = sub.name;
      }
      if (score < exemptionSettings.generalMinSubjectScore) {
        subjectsBelowMin.push({ subjectId: sub.id, subjectName: sub.name, score });
      }
      meetsScore = score >= exemptionSettings.individualMinScore;
      if (meetsScore) {
        if (isIndividualEnabled) {
          individualStatus = 'مستحق للإعفاء الفردي';
          diagnostic = `مستحق للإعفاء الفردي (درجة السعي ${score} >= ${exemptionSettings.individualMinScore})`;
        } else {
          individualStatus = 'غير مستحق';
          diagnostic = `مستوفٍ لدرجة الإعفاء (${score} >= ${exemptionSettings.individualMinScore}) ولكن نظام الإعفاء الفردي معطّل لهذا العام الدراسي`;
        }
      } else {
        individualStatus = 'غير مستحق';
        diagnostic = `درجة السعي السنوي (${score}) أقل من درجة الإعفاء المطلوبة (${exemptionSettings.individualMinScore})`;
      }
    } else {
      hasIncomplete = true;
      diagnostic = 'درجة السعي السنوي غير مكتملة (نقص في رصد الفصول أو نصف السنة)';
    }

    individualResults.push({
      subjectId: sub.id,
      subjectName: sub.name,
      yearlyScore: score,
      requiredScore: exemptionSettings.individualMinScore,
      status: individualStatus,
      meetsScoreCondition: meetsScore,
      isExemptionEnabled: isIndividualEnabled,
      diagnosticReason: diagnostic,
    });
  });

  const totalApprovedSubjects = classSubjects.length;
  const isComplete = !hasIncomplete && completedSubjectsCount === totalApprovedSubjects && totalApprovedSubjects > 0;

  if (!isComplete) {
    return {
      student,
      rawAverage: null,
      evaluatedAverage: null,
      appliedJabr: exemptionSettings.enableGeneralJabr,
      minSubjectScore,
      lowestSubjectName,
      isComplete: false,
      status: 'غير مكتمل',
      reason: totalApprovedSubjects === 0 
        ? 'لا توجد مواد مسجلة لهذا الصف' 
        : `لم تكتمل درجات السعي السنوي (${completedSubjectsCount} من ${totalApprovedSubjects} مواد مسجلة)`,
      individualResults,
      subjectsBelowMin,
      isNearEligible: false,
    };
  }

  // حساب المعدل بدقة وقسمته حصراً على عدد المواد المعتمدة للصف
  const rawAverage = totalYearlyScore / totalApprovedSubjects;

  // تقييم الجبر: عند التفعيل يُطبّق نظام التقريب المعتمد للمدرسة، وعند الإلغاء يُعتمد المعدل الدقيق
  let evaluatedAverage = rawAverage;
  if (exemptionSettings.enableGeneralJabr) {
    evaluatedAverage = applyRounding(rawAverage, schoolRoundingRule);
  }

  const meetsAverage = evaluatedAverage >= exemptionSettings.generalMinAverage;
  const meetsMinSubject = minSubjectScore !== null && minSubjectScore >= exemptionSettings.generalMinSubjectScore;

  // فحص حالة "قريب من الاستحقاق": يحقق شرط المعدل لكن لديه مادة أو مادتان فقط دون الحد الأدنى
  const isNearEligible = !meetsMinSubject && meetsAverage && (subjectsBelowMin.length === 1 || subjectsBelowMin.length === 2);

  let status: 'معفى عام' | 'غير مشمول' = 'غير مشمول';
  let reason = '';

  if (!isGeneralEnabled) {
    status = 'غير مشمول';
    reason = 'نظام الإعفاء العام معطّل لهذا العام الدراسي بقرار الإدارة';
  } else if (meetsAverage && meetsMinSubject) {
    status = 'معفى عام';
    reason = 'مستوفٍ لكافة الشروط المقررة';
  } else {
    status = 'غير مشمول';
    const reasons: string[] = [];
    if (!meetsAverage) {
      if (exemptionSettings.enableGeneralJabr) {
        reasons.push(`المعدل المعتمد بعد الجبر (${evaluatedAverage}) أقل من المطلوب (${exemptionSettings.generalMinAverage})`);
      } else {
        reasons.push(`المعدل العام الأصلي (${(Math.round(rawAverage * 100) / 100).toFixed(2)}) أقل من المطلوب (${exemptionSettings.generalMinAverage}) دون جبر`);
      }
    }
    if (!meetsMinSubject && minSubjectScore !== null) {
      if (subjectsBelowMin.length === 1) {
        reasons.push(`مادة واحدة دون الحد الأدنى (${subjectsBelowMin[0].subjectName}: ${subjectsBelowMin[0].score} < ${exemptionSettings.generalMinSubjectScore})`);
      } else if (subjectsBelowMin.length === 2) {
        reasons.push(`مادتان دون الحد الأدنى (${subjectsBelowMin.map(s => `${s.subjectName}: ${s.score}`).join('، ')} < ${exemptionSettings.generalMinSubjectScore})`);
      } else {
        reasons.push(`توجد ${subjectsBelowMin.length} مواد دون الحد الأدنى (${exemptionSettings.generalMinSubjectScore})`);
      }
    }
    reason = reasons.join('، و');
  }

  return {
    student,
    rawAverage: Math.round(rawAverage * 100) / 100,
    evaluatedAverage: exemptionSettings.enableGeneralJabr ? evaluatedAverage : Math.round(rawAverage * 100) / 100,
    appliedJabr: exemptionSettings.enableGeneralJabr,
    minSubjectScore,
    lowestSubjectName,
    isComplete: true,
    status,
    reason,
    individualResults,
    subjectsBelowMin,
    isNearEligible,
  };
}

/**
 * التقييم الشامل لنتائج الطالب في الدور الأول والدور الثاني
 * وإدارة المساعدة الوزارية والإعفاءات وتحديد حالة الطالب في عمود الملاحظات
 */
export function evaluateStudentAcademicYearDecisions(
  student: Student,
  classSubjects: Subject[],
  studentGrades: Record<string, GradeRecord | undefined>,
  decisionSettings: AcademicYearDecisionSettings,
  roundingRule: RoundingRule = 'standard',
  persistedGrants?: Record<string, DecisionGrantRecord>,
  exemptionSettings?: ExemptionSettings
): StudentComprehensiveEvaluation {
  // تقييم الإعفاء المركزي استناداً إلى إعدادات العام الدراسي المعتمدة
  let isGeneralExempt = student.isGeneralExempt === true;
  let individualExemptSubjectIds: string[] = student.individualExemptions || [];

  if (exemptionSettings) {
    const exResult = evaluateStudentExemption(
      student,
      classSubjects,
      studentGrades,
      exemptionSettings,
      roundingRule
    );
    isGeneralExempt = exResult.status === 'معفى عام';
    individualExemptSubjectIds = exResult.individualResults
      .filter((r) => r.status === 'مستحق للإعفاء الفردي')
      .map((r) => r.subjectId);
  }

  // Initialize subject evaluation structures
  const subjectsMap: Record<string, SubjectEvaluation> = {};
  const subjectsList: SubjectEvaluation[] = [];

  let hasIncomplete1stRound = false;

  classSubjects.forEach((sub) => {
    const rec = studentGrades[sub.id];
    const isSubjectIndivExempt = !isGeneralExempt && individualExemptSubjectIds.includes(sub.id);
    const isSubjectGenExempt = isGeneralExempt;
    const isExempt = isSubjectGenExempt || isSubjectIndivExempt;

    const term1 = rec?.term1Score ?? null;
    const midterm = rec?.midtermScore ?? null;
    const term2 = rec?.term2Score ?? null;
    const termYearlyScore = rec?.termYearlyScore ?? null;
    const finalExamScore = rec?.finalExamScore ?? null;
    const secondRoundScore = rec?.secondRoundScore ?? null;
    const secondRoundDate = rec?.secondRoundDate;

    let rawFinalScore: number | null = null;
    let passed1stRound = false;

    if (isExempt) {
      // الطالب المعفى (عاماً أو فردياً): لا يتم تزييف درجة الامتحان أو الدرجة النهائية بوضع السعي
      // بل تترك الدرجة النهائية الرسمية null ويُعتبر الطالب ناجحاً ومستوفياً بحكم الإعفاء
      rawFinalScore = null;
      passed1stRound = true;
    } else {
      rawFinalScore = calculateFinalScore(termYearlyScore, finalExamScore, roundingRule);
      if (rawFinalScore !== null && rawFinalScore >= sub.passScore) {
        passed1stRound = true;
      }
      if (termYearlyScore === null || finalExamScore === null) {
        hasIncomplete1stRound = true;
      }
    }

    const subEval: SubjectEvaluation = {
      subject: sub,
      term1Score: term1,
      midtermScore: midterm,
      term2Score: term2,
      termYearlyScore,
      finalExamScore,
      rawFinalScore,
      isGeneralExempt: isSubjectGenExempt,
      isIndividualExempt: isSubjectIndivExempt,
      isExempt,
      primaryAssistanceApplied: 0,
      finalScoreAfterPrimaryAssistance: rawFinalScore,
      passed1stRound,
      isMakeUpEligible: false,
      secondRoundScore,
      secondRoundFinalScore: null,
      secondRoundDate,
      secondRoundAssistanceApplied: 0,
      finalScoreAfterSecondRoundAssistance: rawFinalScore,
      passedFinal: passed1stRound,
      effectiveFinalScore: rawFinalScore,
    };

    subjectsMap[sub.id] = subEval;
    subjectsList.push(subEval);
  });

  // 1. حساب المساعدة الوزارية في الدور الأول (Primary Ministerial Assistance)
  let primaryAssistanceUsed = 0;
  let remainingPrimary = Math.max(0, decisionSettings.primaryAssistanceMarks);

  // حصر المواد الراسبة في الدور الأول (التي لم تعفَ ودرجتها النهائية < 50)
  const failed1stRoundSubs = subjectsList.filter(
    (s) => !s.isExempt && s.rawFinalScore !== null && s.rawFinalScore < s.subject.passScore
  );

  const failedCountBeforeAssistance = failed1stRoundSubs.length;

  if (persistedGrants !== undefined) {
    // الاعتماد الصارم على القرارات الممنوحة فعلياً بقرار المدير المحفوظ
    subjectsList.forEach((subEval) => {
      const grantKey = `${decisionSettings.academicYearId}_${student.classId}_${student.sectionId}_${student.id}_${subEval.subject.id}_round1`;
      const grant = persistedGrants[grantKey];
      if (grant && !subEval.isExempt) {
        subEval.primaryAssistanceApplied = grant.appliedMarks;
        subEval.finalScoreAfterPrimaryAssistance = grant.finalScoreAfterDecision;
        subEval.passed1stRound = true;
        subEval.passedFinal = true;
        subEval.effectiveFinalScore = grant.finalScoreAfterDecision;
        primaryAssistanceUsed += grant.appliedMarks;
        remainingPrimary = Math.max(0, remainingPrimary - grant.appliedMarks);
      } else {
        subEval.primaryAssistanceApplied = 0;
        subEval.finalScoreAfterPrimaryAssistance = subEval.rawFinalScore;
        subEval.passed1stRound = subEval.isExempt || (subEval.rawFinalScore !== null && subEval.rawFinalScore >= subEval.subject.passScore);
        subEval.passedFinal = subEval.passed1stRound;
        subEval.effectiveFinalScore = subEval.rawFinalScore;
      }
    });
  } else if (!isGeneralExempt) {
    // المحاكاة التلقائية الافتراضية في حال عدم توفير القرارات المحفوظة
    const sortedFailing = [...failed1stRoundSubs].sort((a, b) => {
      const deficitA = a.subject.passScore - (a.rawFinalScore ?? 0);
      const deficitB = b.subject.passScore - (b.rawFinalScore ?? 0);
      return deficitA - deficitB;
    });

    sortedFailing.forEach((subEval) => {
      const needed = subEval.subject.passScore - (subEval.rawFinalScore ?? 0);
      if (needed > 0 && remainingPrimary >= needed) {
        subEval.primaryAssistanceApplied = needed;
        subEval.finalScoreAfterPrimaryAssistance = subEval.subject.passScore;
        subEval.passed1stRound = true;
        subEval.passedFinal = true;
        subEval.effectiveFinalScore = subEval.subject.passScore;
        primaryAssistanceUsed += needed;
        remainingPrimary -= needed;
      } else {
        subEval.primaryAssistanceApplied = 0;
        subEval.finalScoreAfterPrimaryAssistance = subEval.rawFinalScore;
        subEval.passed1stRound = false;
        subEval.passedFinal = false;
        subEval.effectiveFinalScore = subEval.rawFinalScore;
      }
    });
  }

  const primaryAssistanceRemaining = remainingPrimary;

  // احتساب عدد المواد الراسبة بعد المساعدة الرئيسية
  const failedCountAfterPrimaryAssistance = subjectsList.filter((s) => !s.passed1stRound).length;

  // تحديد حالة الطالب في الدور الأول
  let status1stRound: 'ناجح' | 'مكمّل' | 'راسب' | 'غير مكتمل' | 'ناجح — إعفاء عام' | 'معفى عام' = 'غير مكتمل';
  if (isGeneralExempt) {
    status1stRound = 'معفى عام';
  } else if (hasIncomplete1stRound) {
    status1stRound = 'غير مكتمل';
  } else if (failedCountAfterPrimaryAssistance === 0) {
    status1stRound = 'ناجح';
  } else if (failedCountAfterPrimaryAssistance < decisionSettings.maxFailedSubjectsAllowed) {
    status1stRound = 'مكمّل';
  } else {
    status1stRound = 'راسب';
  }

  // 2. معالجة الدور الثاني والإكمال (Second Round / Make-up Exam)
  const isStudentMokammal = status1stRound === 'مكمّل';
  let hasSecondRoundScores = false;

  subjectsList.forEach((subEval) => {
    if (isStudentMokammal && !subEval.passed1stRound) {
      subEval.isMakeUpEligible = true;

      if (subEval.secondRoundScore !== null && subEval.secondRoundScore !== undefined) {
        hasSecondRoundScores = true;
        const mkFinal = calculateSecondRoundFinalScore(
          subEval.termYearlyScore,
          subEval.secondRoundScore,
          roundingRule
        );
        subEval.secondRoundFinalScore = mkFinal;

        if (mkFinal !== null && mkFinal >= subEval.subject.passScore) {
          subEval.passedFinal = true;
          subEval.finalScoreAfterSecondRoundAssistance = mkFinal;
          subEval.effectiveFinalScore = mkFinal;
        } else {
          subEval.passedFinal = false;
          subEval.finalScoreAfterSecondRoundAssistance = mkFinal;
          subEval.effectiveFinalScore = mkFinal;
        }
      }
    } else {
      subEval.isMakeUpEligible = false;
    }
  });

  // 3. المساعدة المتبقية والإضافية بعد الدور الثاني
  const totalAssistancePoolSecondRound =
    primaryAssistanceRemaining + Math.max(0, decisionSettings.secondRoundAdditionalAssistanceMarks || 0);

  let available2ndPool = totalAssistancePoolSecondRound;
  let secondRoundAssistanceUsed = 0;

  if (isStudentMokammal && hasSecondRoundScores) {
    if (persistedGrants !== undefined) {
      // الاعتماد الصارم على القرارات الممنوحة فعلياً في الدور الثاني
      subjectsList.forEach((subEval) => {
        if (!subEval.isMakeUpEligible || subEval.secondRoundFinalScore === null) return;
        const grant2Key = `${decisionSettings.academicYearId}_${student.classId}_${student.sectionId}_${student.id}_${subEval.subject.id}_round2`;
        const grant2 = persistedGrants[grant2Key];
        if (grant2) {
          subEval.secondRoundAssistanceApplied = grant2.appliedMarks;
          subEval.finalScoreAfterSecondRoundAssistance = grant2.finalScoreAfterDecision;
          subEval.passedFinal = true;
          subEval.effectiveFinalScore = grant2.finalScoreAfterDecision;
          secondRoundAssistanceUsed += grant2.appliedMarks;
          available2ndPool = Math.max(0, available2ndPool - grant2.appliedMarks);
        } else {
          subEval.secondRoundAssistanceApplied = 0;
          subEval.finalScoreAfterSecondRoundAssistance = subEval.secondRoundFinalScore;
          subEval.passedFinal = subEval.secondRoundFinalScore >= subEval.subject.passScore;
          subEval.effectiveFinalScore = subEval.secondRoundFinalScore;
        }
      });
    } else {
      // المحاكاة التلقائية في حال عدم توفير القرارات المحفوظة
      const failingAfter2ndRound = subjectsList.filter(
        (s) =>
          s.isMakeUpEligible &&
          s.secondRoundFinalScore !== null &&
          s.secondRoundFinalScore < s.subject.passScore
      );

      const sortedFailing2nd = [...failingAfter2ndRound].sort((a, b) => {
        const defA = a.subject.passScore - (a.secondRoundFinalScore ?? 0);
        const defB = b.subject.passScore - (b.secondRoundFinalScore ?? 0);
        return defA - defB;
      });

      sortedFailing2nd.forEach((subEval) => {
        const needed = subEval.subject.passScore - (subEval.secondRoundFinalScore ?? 0);
        if (needed > 0 && available2ndPool >= needed) {
          subEval.secondRoundAssistanceApplied = needed;
          subEval.finalScoreAfterSecondRoundAssistance = subEval.subject.passScore;
          subEval.passedFinal = true;
          subEval.effectiveFinalScore = subEval.subject.passScore;
          secondRoundAssistanceUsed += needed;
          available2ndPool -= needed;
        } else {
          subEval.secondRoundAssistanceApplied = 0;
          subEval.finalScoreAfterSecondRoundAssistance = subEval.secondRoundFinalScore;
          subEval.passedFinal = false;
          subEval.effectiveFinalScore = subEval.secondRoundFinalScore;
        }
      });
    }
  }

  const secondRoundAssistanceRemaining = available2ndPool;

  // احتساب عدد المواد الراسبة النهائية
  const failedCountFinal = subjectsList.filter((s) => !s.passedFinal).length;

  // تحديد الحالة النهائية وعمود الملاحظات
  let statusFinal: 'ناجح' | 'مكمّل' | 'راسب' | 'غير مكتمل' | 'ناجح — إعفاء عام' | 'معفى عام' = status1stRound;
  let notes: 'ناجح' | 'مكمّل' | 'راسب' | 'ناجح — إعفاء عام' | 'غير مكتمل' | 'معفى عام' = status1stRound;

  if (isGeneralExempt) {
    statusFinal = 'معفى عام';
    notes = 'معفى عام';
  } else if (hasIncomplete1stRound) {
    statusFinal = 'غير مكتمل';
    notes = 'غير مكتمل';
  } else if (status1stRound === 'راسب') {
    statusFinal = 'راسب';
    notes = 'راسب';
  } else if (status1stRound === 'ناجح') {
    statusFinal = 'ناجح';
    notes = 'ناجح';
  } else if (isStudentMokammal) {
    if (hasSecondRoundScores) {
      if (failedCountFinal === 0) {
        statusFinal = 'ناجح';
        notes = 'ناجح';
      } else {
        // بعد الدور الثاني، وجود أي مادة رسوب متبقية يعني الرسوب في السنة
        statusFinal = 'راسب';
        notes = 'راسب';
      }
    } else {
      // لم يؤدِّ الدور الثاني بعد أو لم تُدخل درجاته
      statusFinal = 'مكمّل';
      notes = 'مكمّل';
    }
  }

  return {
    student,
    academicYearId: decisionSettings.academicYearId,
    isComplete1stRound: !hasIncomplete1stRound,
    isGeneralExempt,
    failedCountBeforeAssistance,
    primaryAssistanceUsed,
    primaryAssistanceRemaining,
    failedCountAfterPrimaryAssistance,
    status1stRound,
    statusBeforeSecondRound: status1stRound,
    totalAssistancePoolSecondRound,
    secondRoundAssistanceUsed,
    secondRoundAssistanceRemaining,
    hasSecondRoundScores,
    failedCountFinal,
    statusFinal,
    notes,
    subjects: subjectsMap,
    subjectsList,
  };
}

