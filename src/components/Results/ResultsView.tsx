import React, { useState, useMemo } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  ResultGradeType,
  StudentComprehensiveEvaluation,
} from '../../types';
import { buildGradeKey, db } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import { evaluateStudentAcademicYearDecisions } from '../../services/calculations';
import * as XLSX from 'xlsx';
import {
  Trophy,
  Award,
  ChevronDown,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  BarChart3,
  Layers,
  Sparkles,
  Info,
  Eye,
  X,
  School,
  HelpCircle,
} from 'lucide-react';
import { SchoolLogo } from '../Common/SchoolLogo';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { StudentStatusBadge } from '../Common/StudentStatusBadge';

interface ResultsViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
}

export const GRADE_TYPE_CONFIG: Record<
  ResultGradeType,
  { label: string; shortLabel: string; description: string; badgeColor: string }
> = {
  term1Score: {
    label: 'درجة الفصل الأول',
    shortLabel: 'الفصل الأول',
    description: 'درجات تقييم الفصل الدراسي الأول',
    badgeColor: 'text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border-[#3156C9]/25 dark:border-[#2785F5]/30',
  },
  midtermScore: {
    label: 'درجة نصف السنة',
    shortLabel: 'نصف السنة',
    description: 'درجات امتحانات نصف السنة الدراسية',
    badgeColor: 'text-[#B45309] dark:text-[#D69B42] bg-[#D69B42]/10 border-[#D69B42]/30',
  },
  term2Score: {
    label: 'درجة الفصل الثاني',
    shortLabel: 'الفصل الثاني',
    description: 'درجات تقييم الفصل الدراسي الثاني',
    badgeColor: 'text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border-[#3156C9]/25 dark:border-[#2785F5]/30',
  },
  termYearlyScore: {
    label: 'درجة السعي السنوي',
    shortLabel: 'السعي السنوي',
    description: 'معدل درجات السعي السنوي المحسوبة وفق القواعد المعتمدة',
    badgeColor: 'text-[#7C3AED] dark:text-[#A78BFA] bg-[#A78BFA]/12 border-[#A78BFA]/30',
  },
  finalExamScore: {
    label: 'درجة الامتحان النهائي',
    shortLabel: 'الامتحان النهائي',
    description: 'درجات الدور الأول للامتحان النهائي',
    badgeColor: 'text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border-[#3156C9]/25 dark:border-[#2785F5]/30',
  },
  finalScore: {
    label: 'الدرجة النهائية',
    shortLabel: 'الدرجة النهائية',
    description: 'النتيجة العامة والدرجة النهائية المحسوبة آلياً',
    badgeColor: 'text-[#059669] dark:text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30',
  },
  secondRoundFinalScore: {
    label: 'الدرجة النهائية بعد الإكمال',
    shortLabel: 'بعد الإكمال',
    description: 'الدرجة النهائية بعد احتساب امتحان الدور الثاني للمكمّلين',
    badgeColor: 'text-[#7C3AED] dark:text-[#A78BFA] bg-[#A78BFA]/12 border-[#A78BFA]/30',
  },
};

export const ResultsView: React.FC<ResultsViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
}) => {
  // 1. Academic Year Filter
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  // 2. Class Filter (Filtered strictly by selected academic year)
  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  React.useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  // 3. Section Filter
  const availableSections = useMemo(
    () => sections.filter((s) => s.classId === selectedClassId),
    [sections, selectedClassId]
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    availableSections[0]?.id || ''
  );

  React.useEffect(() => {
    if (availableSections.length === 0) {
      if (selectedSectionId !== '') setSelectedSectionId('');
    } else if (availableSections.length === 1) {
      setSelectedSectionId(availableSections[0].id);
    } else {
      if (!availableSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(availableSections[0].id);
      }
    }
  }, [availableSections, selectedSectionId]);

  // 4. Grade Type Filter (The new 4th filter requested)
  const [selectedGradeType, setSelectedGradeType] = useState<ResultGradeType>('finalScore');

  // Search Query Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Print execution & preview states
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Subjects sorted strictly by order
  const classSubjects = useMemo(
    () =>
      subjects
        .filter((sub) => sub.classId === selectedClassId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [subjects, selectedClassId]
  );

  // Section Students
  const sectionStudents = useMemo(() => {
    return students
      .filter(
        (s) =>
          s.classId === selectedClassId &&
          s.sectionId === selectedSectionId &&
          s.academicYearId === selectedYearId
      )
      .sort((a, b) => a.seatNumber - b.seatNumber);
  }, [students, selectedClassId, selectedSectionId, selectedYearId]);

  // Active records helpers
  const activeYear = academicYears.find((y) => y.id === selectedYearId);
  const activeClass = classes.find((c) => c.id === selectedClassId);
  const activeSection = sections.find((s) => s.id === selectedSectionId);
  const activeGradeConfig = GRADE_TYPE_CONFIG[selectedGradeType];

  // Active administrative decision settings for this academic year
  const decisionSettings = useMemo(() => {
    return db.getDecisionSettings(selectedYearId);
  }, [selectedYearId]);

  // Active exemption settings for this academic year
  const exemptionSettings = useMemo(() => {
    return db.getExemptionSettings(selectedYearId);
  }, [selectedYearId]);

  // Aggregate results per student across subjects according to selectedGradeType & official regulations
  const studentResults = useMemo(() => {
    return sectionStudents.map((student) => {
      let totalScore = 0;
      let countedSubjects = 0;
      let failedSubjectsCount = 0;
      let hasIncomplete = false;

      const subjectScores: Record<string, number | null> = {};
      const subjectRawScores: Record<string, number | null> = {};
      const subjectAssistance: Record<string, number> = {};

      const studentGradesBySubject: Record<string, GradeRecord | undefined> = {};
      classSubjects.forEach((sub) => {
        const key = buildGradeKey(
          selectedYearId,
          selectedClassId,
          selectedSectionId,
          sub.id,
          student.id
        );
        studentGradesBySubject[sub.id] = grades[key];
      });

      const evaluation = evaluateStudentAcademicYearDecisions(
        student,
        classSubjects,
        studentGradesBySubject,
        decisionSettings,
        settings.roundingRule,
        db.getDecisionGrants(),
        exemptionSettings
      );

      const isGeneralExempt = evaluation.isGeneralExempt;

      classSubjects.forEach((sub) => {
        const record = studentGradesBySubject[sub.id];
        const subEval = evaluation.subjects[sub.id];
        const isSubjectExempt = isGeneralExempt || !!subEval?.isIndividualExempt;

        // Read specific score field requested
        let score: number | null = null;
        let rawScore: number | null = null;
        let assistanceApplied: number = 0;

        if (selectedGradeType === 'finalScore') {
          if (isSubjectExempt) {
            // المادة معفاة: لا تسجل درجة نهائية وهمية، بل تترك فارغة مع اعتبارها ناجحة بحكم الإعفاء
            score = null;
            rawScore = null;
            assistanceApplied = 0;
          } else {
            score = subEval ? subEval.effectiveFinalScore : (record?.finalScore ?? null);
            rawScore = subEval ? subEval.rawFinalScore : (record?.finalScore ?? null);
            assistanceApplied = subEval ? subEval.primaryAssistanceApplied : 0;
          }
        } else if (selectedGradeType === 'secondRoundFinalScore') {
          if (subEval?.isMakeUpEligible && subEval.secondRoundScore !== null && subEval.secondRoundScore !== undefined) {
            score = subEval.finalScoreAfterSecondRoundAssistance ?? subEval.effectiveFinalScore ?? subEval.secondRoundFinalScore ?? record?.secondRoundFinalScore ?? null;
            rawScore = subEval.secondRoundFinalScore ?? record?.secondRoundFinalScore ?? null;
            assistanceApplied = subEval.secondRoundAssistanceApplied || 0;
          } else if (subEval) {
            score = subEval.effectiveFinalScore;
            rawScore = subEval.rawFinalScore;
            assistanceApplied = subEval.primaryAssistanceApplied || 0;
          } else {
            score = record?.secondRoundFinalScore ?? record?.finalScore ?? null;
            rawScore = record?.secondRoundFinalScore ?? record?.finalScore ?? null;
            assistanceApplied = 0;
          }
        } else {
          score = record ? record[selectedGradeType] : null;
          rawScore = score;
          assistanceApplied = 0;
        }

        subjectScores[sub.id] = score;
        subjectRawScores[sub.id] = rawScore;
        subjectAssistance[sub.id] = assistanceApplied;

        if (score !== null && score !== undefined && !isNaN(score)) {
          totalScore += score;
          countedSubjects++;
          if (score < sub.passScore) {
            failedSubjectsCount++;
          }
        } else {
          // إذا كانت المادة معفاة في احتساب الدرجات النهائية، فإن عدم وجود امتحان نهائي لا يجعلها غير مكتملة
          if (!(selectedGradeType === 'finalScore' && isSubjectExempt)) {
            hasIncomplete = true;
          }
        }
      });

      // Strict completeness check: all subjects must have recorded scores, or student is general exempt
      const isComplete = isGeneralExempt && selectedGradeType === 'finalScore'
        ? true
        : (!hasIncomplete && countedSubjects === classSubjects.length && classSubjects.length > 0);

      // Average: computed only when complete and not general exempt in finalScore mode
      const average = (isGeneralExempt && selectedGradeType === 'finalScore')
        ? null
        : (isComplete && countedSubjects > 0
          ? Math.round((totalScore / countedSubjects) * 10) / 10
          : null);

      // Result Status and Notes directly from Ministerial Decisions Engine
      const status = evaluation.statusFinal;
      const notes = evaluation.notes;

      return {
        student,
        evaluation,
        totalScore,
        countedSubjects,
        failedSubjectsCount,
        hasIncomplete,
        isComplete,
        average,
        status,
        notes,
        subjectScores,
        subjectRawScores,
        subjectAssistance,
      };
    });
  }, [
    sectionStudents,
    classSubjects,
    selectedYearId,
    selectedClassId,
    selectedSectionId,
    selectedGradeType,
    grades,
    decisionSettings,
    exemptionSettings,
    settings.roundingRule,
  ]);

  // Filter students based on search query
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return studentResults;
    const q = searchQuery.trim().toLowerCase();
    return studentResults.filter(
      (r) =>
        r.student.name.toLowerCase().includes(q) ||
        (r.student.registrationNumber && r.student.registrationNumber.includes(q)) ||
        (r.student.seatNumber && String(r.student.seatNumber).includes(q))
    );
  }, [studentResults, searchQuery]);

  // Overall Statistics for this selected grade type
  const classStats = useMemo(() => {
    const total = studentResults.length;
    if (total === 0) {
      return { total: 0, completed: 0, passed: 0, generalExemptCount: 0, supplementary: 0, failed: 0, incomplete: 0, passRate: 0, highestAvg: null };
    }

    const generalExemptCount = studentResults.filter((r) => r.evaluation.isGeneralExempt).length;
    const completed = studentResults.filter((r) => r.isComplete).length;
    const passed = studentResults.filter((r) => r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام' || r.status === 'معفى عام').length;
    const supplementary = studentResults.filter((r) => r.status === 'مكمّل' || (r.status as string) === 'مكمل').length;
    const failed = studentResults.filter((r) => r.status === 'راسب').length;
    const incomplete = studentResults.filter((r) => r.status === 'غير مكتمل').length;

    const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;

    const averages = studentResults
      .filter((r) => !r.evaluation.isGeneralExempt || selectedGradeType !== 'finalScore')
      .map((r) => r.average)
      .filter((avg): avg is number => avg !== null);
    const highestAvg = averages.length > 0 ? Math.max(...averages) : null;

    return {
      total,
      completed,
      passed,
      generalExemptCount,
      supplementary,
      failed,
      incomplete,
      passRate,
      highestAvg,
    };
  }, [studentResults, selectedGradeType]);

  // Top 10 Students ranking based on completed average in this selected grade type
  // (In finalScore mode, general exempt students did not sit for the exam, so they are not ranked against exam averages)
  const topStudents = useMemo(() => {
    return [...studentResults]
      .filter((r) => r.average !== null && r.isComplete && (!r.evaluation.isGeneralExempt || selectedGradeType !== 'finalScore') && (r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام' || r.status === 'معفى عام'))
      .sort((a, b) => (b.average || 0) - (a.average || 0))
      .slice(0, 10);
  }, [studentResults, selectedGradeType]);

  // Export to Excel file with UTF-8 support and Right-to-Left sheet formatting
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const headers = [
      'ت',
      'رقم القيد',
      'اسم الطالب',
      ...classSubjects.map((s) => `${s.name} (${s.maxScore})`),
      'المجموع',
      'المعدل',
      'النتيجة',
      'الملاحظات',
    ];

    const rows = studentResults.map((r, idx) => {
      const isGeneral = r.evaluation.isGeneralExempt;
      const row: (string | number)[] = [
        idx + 1,
        r.student.registrationNumber || '—',
        r.student.name,
        ...classSubjects.map((s) => {
          const subEval = r.evaluation.subjects[s.id];
          if (selectedGradeType === 'finalScore') {
            if (isGeneral || subEval?.isGeneralExempt) return 'إعفاء عام';
            if (subEval?.isIndividualExempt) return 'معفى';
          }
          const score = r.subjectScores[s.id];
          return score !== null && score !== undefined && !isNaN(score) ? score : '—';
        }),
        isGeneral && selectedGradeType === 'finalScore'
          ? 'إعفاء عام'
          : r.isComplete
          ? r.totalScore
          : (r.countedSubjects > 0 ? `${r.totalScore} (جزئي)` : '—'),
        isGeneral && selectedGradeType === 'finalScore'
          ? 'إعفاء عام'
          : r.average !== null ? `${r.average}%` : '—',
        r.status,
        r.notes,
      ];
      return row;
    });

    const titleRows = [
      [`نتائج الطلاب — ${activeGradeConfig.label}`],
      [`المدرسة: ${settings.schoolName || 'الإدارة المدرسية'} | العام الدراسي: ${activeYear?.name || ''} | الصف: ${activeClass?.name || ''} | الشعبة: ${activeSection?.name || ''}`],
      [`تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);
    ws['!views'] = [{ rightToLeft: true }];
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 32 },
      ...classSubjects.map(() => ({ wch: 16 })),
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, activeGradeConfig.shortLabel);
    XLSX.writeFile(
      wb,
      `نتائج_${activeClass?.name || 'الصف'}_شعبة_${activeSection?.name || 'شعبة'}_${activeGradeConfig.shortLabel}.xlsx`
    );
  };

  // Robust print execution with DOM stabilization and focus
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error('Print dialog failed to open:', err);
      } finally {
        setIsPrinting(false);
      }
    }, 180);
  };

  // Shared Printable Content Component (used for print media & print preview modal)
  const renderPrintableContent = () => (
    <div className="printable-results-document w-full text-black bg-white select-text" dir="rtl">
      {/* Official Header */}
      <div className="border-b-2 border-black pb-3 mb-3">
        <div className="flex items-start justify-between">
          {/* Right: Management & School Name (Exact 2 lines) */}
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900 text-sm">إدارة</p>
            <p className="font-bold text-slate-900 text-sm">{settings.schoolName}</p>
          </div>

          {/* Center: School Name, Logo & Report Title */}
          <div className="flex flex-col items-center text-center">
            {settings.schoolLogo ? (
              <div className="mb-1 flex items-center justify-center">
                <SchoolLogo
                  logoUrl={settings.schoolLogo}
                  schoolName={settings.schoolName}
                  size="md"
                  className="max-h-14 max-w-[120px]"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {!settings.schoolLogo && <School className="w-5 h-5 text-black" />}
              <h2 className="text-lg font-black tracking-tight text-black">
                {settings.schoolName || 'مدرسة المتفوقين للبنين'}
              </h2>
            </div>
            <h1 className="text-base font-black text-slate-900 px-4 py-1 border border-black/40 rounded-lg bg-slate-100/90 shadow-2xs">
              كشف نتائج وتدقيق درجات الطلاب — {activeGradeConfig.label}
            </h1>
          </div>

          {/* Left: Meta details */}
          <div className="text-left text-xs leading-relaxed font-mono">
            <div><strong className="font-sans">العام: </strong>{activeYear?.name || '—'}</div>
            <div><strong className="font-sans">الصف: </strong>{activeClass?.name || '—'}</div>
            <div><strong className="font-sans">الشعبة: </strong>{activeSection?.name ? `شعبة ${activeSection.name}` : '—'}</div>
            <div><strong className="font-sans">تاريخ الطباعة: </strong>{new Date().toLocaleDateString('ar-EG')}</div>
          </div>
        </div>

        {/* Statistical Summary Bar */}
        <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[11px] font-bold px-3 py-1.5 bg-slate-50 border border-slate-300 rounded">
          <span>عدد طلاب القائمة: <strong className="font-mono text-black">{filteredResults.length}</strong></span>
          <span>الناجحون: <strong className="font-mono text-emerald-700">{classStats.passed}</strong></span>
          <span>المكملون: <strong className="font-mono text-amber-700">{classStats.supplementary}</strong></span>
          <span>الراسبون: <strong className="font-mono text-rose-700">{classStats.failed}</strong></span>
          <span>غير مكتمل: <strong className="font-mono text-slate-700">{classStats.incomplete}</strong></span>
          <span>نسبة النجاح: <strong className="font-mono text-emerald-800">{classStats.passRate}%</strong></span>
          <span>أعلى معدل: <strong className="font-mono text-black">{classStats.highestAvg !== null ? `${classStats.highestAvg}%` : '—'}</strong></span>
        </div>
      </div>

      {/* Official Table */}
      <table className="results-print-table w-full border-collapse border border-black text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-black p-1.5 text-center font-bold text-black" style={{ width: '34px' }}>ت</th>
            <th className="border border-black p-1.5 text-center font-bold text-black font-mono" style={{ width: '70px' }}>رقم القيد</th>
            <th className="border border-black p-1.5 text-right font-bold text-black pr-2" style={{ minWidth: '170px' }}>اسم الطالب الثلاثي / الرباعي</th>
            {classSubjects.map((sub) => (
              <th key={sub.id} className="border border-black p-1 text-center font-bold text-black" style={{ minWidth: '55px' }}>
                <div className="font-bold text-[10.5px] leading-tight">{sub.name}</div>
                <div className="text-[9px] font-normal text-slate-600 font-mono mt-0.5">
                  ({sub.maxScore}/{sub.passScore})
                </div>
              </th>
            ))}
            <th className="border border-black p-1.5 text-center font-bold text-black font-mono" style={{ width: '55px' }}>المجموع</th>
            <th className="border border-black p-1.5 text-center font-bold text-black font-mono" style={{ width: '55px' }}>المعدل</th>
            <th className="border border-black p-1.5 text-center font-bold text-black" style={{ width: '65px' }}>النتيجة</th>
            <th className="border border-black p-1.5 text-center font-bold text-black" style={{ width: '80px' }}>الملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {filteredResults.length === 0 ? (
            <tr>
              <td colSpan={classSubjects.length + 6} className="py-8 text-center text-slate-500 font-bold">
                لا توجد نتائج مسجلة مطابقة للاختيارات الحالية.
              </td>
            </tr>
          ) : (
            filteredResults.map((r, idx) => {
              const isGeneralExempt = r.evaluation.isGeneralExempt;
              return (
                <tr
                  key={r.student.id}
                  className={isGeneralExempt ? 'bg-emerald-50' : (idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white')}
                  style={isGeneralExempt ? { backgroundColor: '#ecfdf5' } : undefined}
                >
                  <td className="border border-black p-1 text-center font-mono font-bold text-xs">{idx + 1}</td>
                  <td className="border border-black p-1 text-center font-mono text-xs text-slate-800">
                    {r.student.registrationNumber || r.student.seatNumber || '—'}
                  </td>
                  <td className="border border-black p-1 pr-2 text-right font-bold text-xs text-black">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>{r.student.name}</span>
                        <StudentStatusBadge status={r.student.status} />
                      </div>
                      {isGeneralExempt && (
                        <span className="text-[9px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          إعفاء عام
                        </span>
                      )}
                    </div>
                  </td>
                  {classSubjects.map((sub) => {
                    const score = r.subjectScores[sub.id];
                    const rawScore = r.subjectRawScores?.[sub.id];
                    const assistance = r.subjectAssistance?.[sub.id] || 0;
                    const isNull = score === null || score === undefined || isNaN(score);
                    const isPass = !isNull && score >= sub.passScore;
                    const subEval = r.evaluation.subjects[sub.id];
                    const isIndivExempt = !!subEval?.isIndividualExempt;
                    const isGenExempt = isGeneralExempt || !!subEval?.isGeneralExempt;
                    const isExemptInFinal = selectedGradeType === 'finalScore' && (isGenExempt || isIndivExempt);
                    const exemptLabel = isGenExempt ? 'إعفاء عام' : 'معفى';

                    const title = isExemptInFinal
                      ? exemptLabel
                      : isNull
                      ? '—'
                      : assistance > 0
                      ? `الدرجة بعد المساعدة: ${score} (الدرجة قبل المساعدة: ${rawScore} | مساعدة: +${assistance})`
                      : rawScore !== null && rawScore !== score
                      ? `الدرجة: ${score} (الخام: ${rawScore})`
                      : `الدرجة: ${score}`;

                    return (
                      <td
                        key={sub.id}
                        title={title}
                        style={{
                          position: 'relative',
                          ...(isExemptInFinal ? { backgroundColor: '#ecfdf5' } : isIndivExempt ? { backgroundColor: '#eff6ff' } : {}),
                        }}
                        className={`relative border border-black p-1 text-center font-mono text-xs ${
                          isExemptInFinal
                            ? 'font-bold text-emerald-900 bg-emerald-50'
                            : isIndivExempt
                            ? 'font-bold text-blue-900 bg-blue-50'
                            : isNull
                            ? 'text-slate-400'
                            : isPass
                            ? 'font-medium text-black'
                            : 'font-black text-rose-700 bg-rose-50/90'
                        }`}
                      >
                        <div
                          className="relative w-full h-full flex items-center justify-center min-h-[26px]"
                          style={{ position: 'relative' }}
                        >
                          {isExemptInFinal ? (
                            <span className="font-bold text-[10px] text-emerald-800">{exemptLabel}</span>
                          ) : assistance > 0 && rawScore !== null && rawScore !== score ? (
                            <>
                              <span className="font-extrabold text-black">{score}</span>
                              <span
                                className="absolute text-[8px] text-red-600 font-mono font-bold leading-none select-none bg-white px-0.5 rounded"
                                style={{ position: 'absolute', right: '5px', bottom: '3px' }}
                                title={`الدرجة الأصلية قبل القرار: ${rawScore}`}
                              >
                                {rawScore}
                              </span>
                            </>
                          ) : (
                            <span>{isNull ? '—' : score}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border border-black p-1 text-center font-mono font-bold text-xs bg-slate-50">
                    {isGeneralExempt && selectedGradeType === 'finalScore'
                      ? 'إعفاء عام'
                      : r.isComplete
                      ? r.totalScore
                      : r.countedSubjects > 0
                      ? `${r.totalScore}*`
                      : '—'}
                  </td>
                  <td className="border border-black p-1 text-center font-mono font-bold text-xs bg-slate-50">
                    {isGeneralExempt && selectedGradeType === 'finalScore'
                      ? 'إعفاء عام'
                      : r.average !== null
                      ? `${r.average}%`
                      : '—'}
                  </td>
                  <td className="border border-black p-1 text-center font-bold text-xs">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                        r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام' || r.status === 'معفى عام'
                          ? 'text-emerald-800 bg-emerald-50 border border-emerald-300'
                          : r.status === 'مكمّل' || (r.status as string) === 'مكمل'
                          ? 'text-amber-800 bg-amber-50 border border-amber-300'
                          : r.status === 'راسب'
                          ? 'text-rose-800 bg-rose-50 border border-rose-300'
                          : 'text-slate-600 bg-slate-100'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="border border-black p-1 text-center text-[10px] font-bold text-slate-800">
                    {r.notes}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Official Signatures Block */}
      <div className="print-signatures-block mt-6 pt-4 border-t-2 border-black">
        <div className="grid grid-cols-4 gap-4 text-center text-xs">
          <div className="flex flex-col items-center">
            <span className="font-bold text-slate-800">منظم القوائم</span>
            <span className="text-[11px] text-slate-600 mt-0.5">عضو اللجنة الامتحانية</span>
            <div className="mt-8 border-b border-dotted border-black w-32" />
            <span className="text-[10px] text-slate-500 mt-1">التوقيع والتاريخ</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="font-bold text-slate-800">مدقق الدرجات</span>
            <span className="text-[11px] text-slate-600 mt-0.5">لجنة التدقيق المركزية</span>
            <div className="mt-8 border-b border-dotted border-black w-32" />
            <span className="text-[10px] text-slate-500 mt-1">التوقيع والتاريخ</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="font-bold text-slate-800">رئيس اللجنة الامتحانية</span>
            <span className="text-[11px] text-slate-900 font-bold mt-0.5">{settings.examCommitteeHead || '........................'}</span>
            <div className="mt-8 border-b border-dotted border-black w-32" />
            <span className="text-[10px] text-slate-500 mt-1">التوقيع</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="font-bold text-slate-800">مدير المدرسة</span>
            <span className="text-[11px] text-slate-900 font-bold mt-0.5">{settings.directorName || '........................'}</span>
            <div className="mt-8 border-b border-dotted border-black w-32" />
            <span className="text-[10px] text-slate-500 mt-1">التوقيع والختم الرسمي</span>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-500 mt-4 pt-2 border-t border-slate-200 flex justify-between">
          <span>نظام إدارة الدرجات المدرسية — كشف درجات رسمي معتمد</span>
          <span>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-16" dir="rtl">
      {/* Main Header & Filter Control Bar */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs flex flex-col gap-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 ${activeGradeConfig.badgeColor}`}>
                <Sparkles className="w-3 h-3" />
                <span>النوع المعروض: {activeGradeConfig.label}</span>
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>عرض وتدقيق نتائج وتقييم الطلاب</span>
            </h1>
          </div>

          {/* Action Buttons: Export Excel, Print Preview & Print */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-10 px-3.5 text-xs font-bold rounded-[10px] bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5]/60 flex items-center gap-2 cursor-pointer transition-colors"
              title={`تصدير كشف ${activeGradeConfig.label} إلى ملف Excel`}
            >
              <FileSpreadsheet className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="h-10 px-3.5 text-xs font-bold rounded-[10px] bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5]/60 flex items-center gap-2 cursor-pointer transition-colors"
              title="معاينة شكل ورقة الطباعة A4 على الشاشة قبل الطباعة"
            >
              <Eye className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>معاينة الطباعة</span>
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="h-10 px-4 text-xs font-bold rounded-[10px] bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              title="طباعة النتائج المعروضة حالياً على ورق A4"
            >
              {isPrinting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isPrinting ? 'جاري التجهيز...' : 'طباعة النتائج'}</span>
            </button>
          </div>
        </div>

        {/* 4 Filters Sequential Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Filter 1: Academic Year */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">1. العام الدراسي</label>
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '(الحالي)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: School Class */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">2. الصف الدراسي</label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
              >
                {availableClasses.length === 0 ? (
                  <option value="">(لا توجد صفوف مسجلة لهذا العام)</option>
                ) : (
                  availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.stage})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 3: Section */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">3. الشعبة</label>
            <div className="relative">
              <select
                value={selectedSectionId}
                disabled={availableSections.length === 0}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={`w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer ${
                  availableSections.length === 0 ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {availableSections.length === 0 ? (
                  <option value="">(الصف لا يحتوي على شُعب)</option>
                ) : (
                  availableSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      شعبة {s.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 4: Grade Type */}
          <div>
            <label className="block text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>4. نوع الدرجة المعروضة</span>
            </label>
            <div className="relative">
              <select
                value={selectedGradeType}
                onChange={(e) => setSelectedGradeType(e.target.value as ResultGradeType)}
                className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#3156C9]/8 dark:bg-[#2785F5]/15 border border-[#3156C9]/35 dark:border-[#2785F5]/40 rounded-[10px] text-[#3156C9] dark:text-[#60A5FA] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer shadow-xs"
              >
                <option value="term1Score">درجة الفصل الأول</option>
                <option value="midtermScore">درجة نصف السنة</option>
                <option value="term2Score">درجة الفصل الثاني</option>
                <option value="termYearlyScore">درجة السعي السنوي</option>
                <option value="finalExamScore">درجة الامتحان النهائي</option>
                <option value="finalScore">الدرجة النهائية</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA] absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for the chosen Grade Type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col shadow-xs">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A8B5C7]">إجمالي طلاب الشعبة</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#1E293B] dark:text-[#E2E8F0] mt-1">{classStats.total}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col shadow-xs">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A8B5C7]">الدرجات المكتملة</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] mt-1">
            {classStats.completed} <span className="text-xs text-[#64748B] dark:text-[#8493A8]">من {classStats.total}</span>
          </span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col shadow-xs">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A8B5C7]">عدد الناجحين</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#059669] dark:text-[#10B981] mt-1">{classStats.passed}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col shadow-xs">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A8B5C7]">المكملون (1-2 مادة)</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#B45309] dark:text-[#D69B42] mt-1">{classStats.supplementary}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col shadow-xs">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A8B5C7]">الراسبون (3 فأكثر)</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#C83D4B] dark:text-[#E35D6A] mt-1">{classStats.failed}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col shadow-xs">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A8B5C7]">نسبة النجاح للمكتملين</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] mt-1">
            {classStats.completed > 0 ? `${classStats.passRate}%` : '—'}
          </span>
        </div>
      </div>

      {/* Top 5 Honors Cards for this Selected Grade Type */}
      {topStudents.length > 0 && (
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-5 shadow-xs no-print">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
              <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0]">
                لوحة الشرف — المتفوقون في {activeGradeConfig.label} ({activeClass?.name} - شعبة {activeSection?.name})
              </h3>
            </div>
            <span className="text-xs text-[#3156C9] dark:text-[#60A5FA] font-bold font-mono tabular-nums bg-[#3156C9]/10 dark:bg-[#2785F5]/15 px-2.5 py-1 rounded-lg border border-[#3156C9]/25 dark:border-[#2785F5]/30">
              أعلى معدل: {classStats.highestAvg !== null ? `${classStats.highestAvg}%` : '—'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {topStudents.slice(0, 5).map((rankItem, idx) => (
              <div
                key={rankItem.student.id}
                className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-[12px] flex flex-col justify-between hover:border-[#2785F5] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-[#3156C9] dark:bg-[#2785F5] text-white font-black text-xs flex items-center justify-center font-mono tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-mono tabular-nums font-bold text-[#3156C9] dark:text-[#60A5FA]">
                    معدل: {rankItem.average}%
                  </span>
                </div>
                <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0] mt-2 line-clamp-1">
                  {rankItem.student.name}
                </h4>
                <span className="text-[11px] text-[#64748B] dark:text-[#A8B5C7] font-mono tabular-nums mt-1">
                  المجموع: {rankItem.totalScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Toolbar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="relative max-w-sm w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الطالب أو رقم القيد..."
            className="w-full h-10 pr-9 pl-3 text-xs bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] text-[#1E293B] dark:text-[#E2E8F0] placeholder-[#64748B] dark:placeholder-[#8493A8] focus:border-[#2785F5] focus:outline-hidden shadow-2xs"
          />
          <Search className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute right-3 top-3 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#A8B5C7]">
          <span>عرض</span>
          <strong className="text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums">{filteredResults.length}</strong>
          <span>من إجمالي</span>
          <strong className="text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums">{studentResults.length}</strong>
          <span>طالباً في الشعبة</span>
        </div>
      </div>

      {/* Complete Student Ledger Table */}
      <div className="no-print overflow-x-auto rounded-[14px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] shadow-xs">
        <table className="w-full border-collapse text-right select-none">
          <thead>
            <tr className="bg-[#EDF1F7] dark:bg-[#26364B] border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">
              <th className="p-3 text-center w-12 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">ت</th>
              <th className="p-3 min-w-[220px] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">اسم الطالب</th>
              {classSubjects.map((sub) => (
                <th key={sub.id} className="p-2.5 text-center min-w-[95px] border-l border-[#DCE3ED] dark:border-[#2D3B4D] text-[11px]">
                  <div>{sub.name}</div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums font-normal">
                    (ع: {sub.maxScore} | ن: {sub.passScore})
                  </div>
                </th>
              ))}
              <th className="p-3 text-center min-w-[90px] border-l border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-mono">
                المجموع
              </th>
              <th className="p-3 text-center min-w-[90px] border-l border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#3156C9] dark:text-[#60A5FA] font-mono">
                المعدل
              </th>
              <th className="p-3 text-center min-w-[100px] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                النتيجة
              </th>
              <th className="p-3 text-center min-w-[140px] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0]">
                الملاحظات
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={classSubjects.length + 6} className="py-12 text-center text-[#64748B] dark:text-[#A8B5C7]">
                  <p className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">لا توجد نتائج مطابقة للشروط أو البحث الحالي</p>
                  <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] mt-1">
                    تأكد من اختيار العام الدراسي والصف والشعبة الصحيحة، أو تحقق من عبارة البحث.
                  </p>
                </td>
              </tr>
            ) : (
              filteredResults.map((r, idx) => {
                const isGeneralExempt = r.evaluation.isGeneralExempt;

                return (
                  <tr
                    key={r.student.id}
                    className={`hover:bg-[#F8FAFC] dark:hover:bg-[#202E40] transition-colors ${
                      isGeneralExempt ? 'bg-[#10B981]/8 dark:bg-[#10B981]/10 hover:bg-[#10B981]/12' : ''
                    }`}
                  >
                    <td className="p-2.5 text-center text-xs text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0]">{r.student.name}</span>
                        {isGeneralExempt && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/12 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                            إعفاء عام
                          </span>
                        )}
                      </div>
                      {r.student.registrationNumber && (
                        <div className="text-[11px] text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums">
                          قيد: {r.student.registrationNumber}
                        </div>
                      )}
                    </td>

                    {/* Subject Scores for selected grade type */}
                    {classSubjects.map((sub) => {
                      const score = r.subjectScores[sub.id];
                      const rawScore = r.subjectRawScores?.[sub.id];
                      const assistance = r.subjectAssistance?.[sub.id] || 0;
                      const isNull = score === null || score === undefined || isNaN(score);
                      const isPass = !isNull && score >= sub.passScore;
                      const subEval = r.evaluation.subjects[sub.id];
                      const isIndivExempt = !!subEval?.isIndividualExempt;
                      const isGenExempt = isGeneralExempt || !!subEval?.isGeneralExempt;
                      const isExemptInFinal = selectedGradeType === 'finalScore' && (isGenExempt || isIndivExempt);
                      const exemptLabel = isGenExempt ? 'إعفاء عام' : 'معفى';

                      const tooltip = isExemptInFinal
                        ? exemptLabel
                        : isNull
                        ? 'درجة غير مسجلة'
                        : assistance > 0
                        ? `الدرجة بعد المساعدة الوزارية: ${score} (الدرجة الخام قبل المساعدة: ${rawScore} | مقدار المساعدة: +${assistance})`
                        : rawScore !== null && rawScore !== score
                        ? `الدرجة: ${score} (الخام: ${rawScore})`
                        : `الدرجة: ${score}`;

                      return (
                        <td
                          key={sub.id}
                          title={tooltip}
                          style={{ position: 'relative' }}
                          className={`relative p-2.5 text-center font-mono tabular-nums text-sm border-l border-[#DCE3ED] dark:border-[#2D3B4D] ${
                            isExemptInFinal
                              ? 'bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] font-bold'
                              : isIndivExempt
                              ? 'bg-[#2785F5]/10 text-[#3156C9] dark:text-[#60A5FA] font-bold'
                              : isNull
                              ? 'text-[#64748B] dark:text-[#8493A8] bg-[#F8FAFC] dark:bg-[#202E40]/60'
                              : isPass
                              ? 'text-[#1E293B] dark:text-[#E2E8F0] font-medium'
                              : 'text-[#C83D4B] dark:text-[#E35D6A] font-bold bg-[#E35D6A]/10'
                          }`}
                        >
                          <div
                            className="relative w-full h-full flex items-center justify-center min-h-[28px]"
                            style={{ position: 'relative' }}
                          >
                            {isExemptInFinal ? (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                                {exemptLabel}
                              </span>
                            ) : assistance > 0 && rawScore !== null && rawScore !== score ? (
                              <>
                                <span className="font-extrabold text-[#059669] dark:text-[#10B981]">{score}</span>
                                <span
                                  className="absolute text-[9px] text-[#C83D4B] dark:text-[#E35D6A] font-mono font-bold leading-none select-none bg-white dark:bg-[#1C2939] border border-[#E35D6A]/35 px-0.5 rounded"
                                  style={{ position: 'absolute', right: '5px', bottom: '3px' }}
                                  title={`الدرجة الأصلية قبل القرار: ${rawScore}`}
                                >
                                  {rawScore}
                                </span>
                              </>
                            ) : (
                              <span>{isNull ? '—' : score}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Score */}
                    <td className="p-2.5 text-center font-mono tabular-nums font-bold text-[#1E293B] dark:text-[#E2E8F0] border-l border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#202E40]">
                      {isGeneralExempt && selectedGradeType === 'finalScore' ? (
                        <span className="text-[#059669] dark:text-[#10B981] font-bold text-xs">إعفاء عام</span>
                      ) : r.isComplete ? (
                        r.totalScore
                      ) : r.countedSubjects > 0 ? (
                        <span className="text-[#64748B] dark:text-[#A8B5C7] text-xs" title="مجموع جزئي - توجد درجات غير مكتملة">
                          {r.totalScore}*
                        </span>
                      ) : (
                        <span className="text-[#64748B] dark:text-[#8493A8]">—</span>
                      )}
                    </td>

                    {/* Average */}
                    <td className="p-2.5 text-center font-mono tabular-nums font-bold text-[#3156C9] dark:text-[#60A5FA] border-l border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#202E40]">
                      {isGeneralExempt && selectedGradeType === 'finalScore' ? (
                        <span className="text-[#059669] dark:text-[#10B981] font-bold text-xs">إعفاء عام</span>
                      ) : r.average !== null ? (
                        `${r.average}%`
                      ) : (
                        <span className="text-[#64748B] dark:text-[#8493A8] font-normal">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="p-2.5 text-center border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                          r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام' || r.status === 'معفى عام'
                            ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#10B981] border-[#10B981]/30'
                            : r.status === 'مكمّل' || (r.status as string) === 'مكمل'
                            ? 'bg-[#D69B42]/12 text-[#B45309] dark:text-[#D69B42] border-[#D69B42]/30'
                            : r.status === 'راسب'
                            ? 'bg-[#E35D6A]/12 text-[#C83D4B] dark:text-[#E35D6A] border-[#E35D6A]/30'
                            : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] border-[#DCE3ED] dark:border-[#2D3B4D]'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    {/* Notes Badge */}
                    <td className="p-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                            r.notes === 'ناجح — إعفاء عام'
                              ? 'bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border-[#10B981]/30 shadow-2xs'
                              : r.notes === 'ناجح'
                              ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#10B981] border-[#10B981]/30'
                              : r.notes === 'مكمّل'
                              ? 'bg-[#D69B42]/12 text-[#B45309] dark:text-[#D69B42] border-[#D69B42]/30'
                              : r.notes === 'راسب'
                              ? 'bg-[#E35D6A]/12 text-[#C83D4B] dark:text-[#E35D6A] border-[#E35D6A]/30'
                              : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] border-[#DCE3ED] dark:border-[#2D3B4D]'
                          }`}
                        >
                          {r.notes}
                        </span>

                        {(r.evaluation.primaryAssistanceUsed > 0 || r.evaluation.secondRoundAssistanceUsed > 0) && (
                          <span className="text-[10px] text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">
                            (+{r.evaluation.primaryAssistanceUsed + r.evaluation.secondRoundAssistanceUsed} درجات مساعدة)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Unified Interactive Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title={`كشف النتائج الرسمية — ${activeClass?.name || 'الصف'} (شعبة ${activeSection?.name || 'الشعبة'})`}
        subtitle={`نوع الدرجة: ${activeGradeConfig.label} • العام الدراسي: ${activeYear?.name || '—'}`}
        defaultOrientation="landscape"
        suggestedFileName={`نتائج_${activeClass?.name || 'الصف'}_شعبة_${activeSection?.name || 'الشعبة'}`}
      >
        <div className="bg-white text-slate-950 font-sans" dir="rtl">
          {renderPrintableContent()}
        </div>
      </PrintPreviewModal>
    </div>
  );
};
