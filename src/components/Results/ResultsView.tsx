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
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  midtermScore: {
    label: 'درجة نصف السنة',
    shortLabel: 'نصف السنة',
    description: 'درجات امتحانات نصف السنة الدراسية',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  term2Score: {
    label: 'درجة الفصل الثاني',
    shortLabel: 'الفصل الثاني',
    description: 'درجات تقييم الفصل الدراسي الثاني',
    badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  termYearlyScore: {
    label: 'درجة السعي السنوي',
    shortLabel: 'السعي السنوي',
    description: 'معدل درجات السعي السنوي المحسوبة وفق القواعد المعتمدة',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  finalExamScore: {
    label: 'درجة الامتحان النهائي',
    shortLabel: 'الامتحان النهائي',
    description: 'درجات الدور الأول للامتحان النهائي',
    badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  finalScore: {
    label: 'الدرجة النهائية',
    shortLabel: 'الدرجة النهائية',
    description: 'النتيجة العامة والدرجة النهائية المحسوبة آلياً',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  secondRoundFinalScore: {
    label: 'الدرجة النهائية بعد الإكمال',
    shortLabel: 'بعد الإكمال',
    description: 'الدرجة النهائية بعد احتساب امتحان الدور الثاني للمكمّلين',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
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

  // 2. Class Filter
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');

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
        db.getDecisionGrants()
      );

      classSubjects.forEach((sub) => {
        const record = studentGradesBySubject[sub.id];
        const subEval = evaluation.subjects[sub.id];

        // Read specific score field requested
        let score: number | null = null;
        let rawScore: number | null = null;
        let assistanceApplied: number = 0;

        if (selectedGradeType === 'finalScore') {
          score = subEval ? subEval.effectiveFinalScore : (record?.finalScore ?? null);
          rawScore = subEval ? subEval.rawFinalScore : (record?.finalScore ?? null);
          assistanceApplied = subEval ? subEval.primaryAssistanceApplied : 0;
        } else if (selectedGradeType === 'secondRoundFinalScore') {
          if (subEval?.isMakeUpEligible && subEval.secondRoundScore !== null && subEval.secondRoundScore !== undefined) {
            // الطالب أدى الدور الثاني في هذه المادة:
            // الدرجة بعد احتساب المساعدة الإضافية (إن وجدت)
            score = subEval.finalScoreAfterSecondRoundAssistance ?? subEval.effectiveFinalScore ?? subEval.secondRoundFinalScore ?? record?.secondRoundFinalScore ?? null;
            // الدرجة الخام المحسوبة من (السعي + الإكمال) ÷ 2 قبل المساعدة الإضافية
            rawScore = subEval.secondRoundFinalScore ?? record?.secondRoundFinalScore ?? null;
            assistanceApplied = subEval.secondRoundAssistanceApplied || 0;
          } else if (subEval) {
            // المادة لم يشملها الدور الثاني (ناجح فيها من الدور الأول أو معفى)
            // الدرجة المعتمدة النهائية بعد انتهاء الدورين
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
          hasIncomplete = true;
        }
      });

      // Strict completeness check: all subjects must have recorded scores
      const isComplete =
        !hasIncomplete && countedSubjects === classSubjects.length && classSubjects.length > 0;

      // Average: only computed when all subjects are complete, avoiding false provisional averages
      const average = isComplete
        ? Math.round((totalScore / classSubjects.length) * 10) / 10
        : null;

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
      return { total: 0, completed: 0, passed: 0, supplementary: 0, failed: 0, incomplete: 0, passRate: 0, highestAvg: null };
    }

    const completed = studentResults.filter((r) => r.isComplete).length;
    const passed = studentResults.filter((r) => r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام' || r.status === 'معفى عام').length;
    const supplementary = studentResults.filter((r) => r.status === 'مكمّل' || (r.status as string) === 'مكمل').length;
    const failed = studentResults.filter((r) => r.status === 'راسب').length;
    const incomplete = studentResults.filter((r) => r.status === 'غير مكتمل').length;

    const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;

    const averages = studentResults
      .map((r) => r.average)
      .filter((avg): avg is number => avg !== null);
    const highestAvg = averages.length > 0 ? Math.max(...averages) : null;

    return {
      total,
      completed,
      passed,
      supplementary,
      failed,
      incomplete,
      passRate,
      highestAvg,
    };
  }, [studentResults]);

  // Top 10 Students ranking based on completed average in this selected grade type
  const topStudents = useMemo(() => {
    return [...studentResults]
      .filter((r) => r.average !== null && r.isComplete && (r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام' || r.status === 'معفى عام'))
      .sort((a, b) => (b.average || 0) - (a.average || 0))
      .slice(0, 10);
  }, [studentResults]);

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
      const row: (string | number)[] = [
        idx + 1,
        r.student.registrationNumber || '—',
        r.student.name,
        ...classSubjects.map((s) => {
          const score = r.subjectScores[s.id];
          return score !== null && score !== undefined && !isNaN(score) ? score : '—';
        }),
        r.isComplete ? r.totalScore : (r.countedSubjects > 0 ? `${r.totalScore} (جزئي)` : '—'),
        r.average !== null ? `${r.average}%` : '—',
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
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              {activeGradeConfig.description}
            </div>
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
                      <span>{r.student.name}</span>
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

                    const title = isNull
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
                          ...(isIndivExempt ? { backgroundColor: '#eff6ff' } : {}),
                        }}
                        className={`relative border border-black p-1 text-center font-mono text-xs ${
                          isIndivExempt
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
                          {assistance > 0 && rawScore !== null && rawScore !== score ? (
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
                    {r.isComplete ? r.totalScore : r.countedSubjects > 0 ? `${r.totalScore}*` : '—'}
                  </td>
                  <td className="border border-black p-1 text-center font-mono font-bold text-xs bg-slate-50">
                    {r.average !== null ? `${r.average}%` : '—'}
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
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col gap-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${activeGradeConfig.badgeColor}`}>
                <Sparkles className="w-3 h-3" />
                <span>النوع المعروض: {activeGradeConfig.label}</span>
              </span>
              <span className="text-slate-400 text-xs hidden sm:inline">
                {activeGradeConfig.description}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-amber-400" />
              <span>عرض وتدقيق نتائج وتقييم الطلاب</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              اختر نوع الدرجة المطلوب لعرض كشف الدرجات الشامل، مع حساب المجموع والمعدل والترتيب آلياً.
            </p>
          </div>

          {/* Action Buttons: Export Excel, Print Preview & Print */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-10 px-3.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
              title={`تصدير كشف ${activeGradeConfig.label} إلى ملف Excel`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="h-10 px-3.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
              title="معاينة شكل ورقة الطباعة A4 على الشاشة قبل الطباعة"
            >
              <Eye className="w-4 h-4 text-blue-400" />
              <span>معاينة الطباعة</span>
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="h-10 px-4 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50"
              title="طباعة النتائج المعروضة حالياً على ورق A4"
            >
              {isPrinting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            <label className="block text-xs font-bold text-slate-300 mb-1.5">1. العام الدراسي</label>
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:border-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '(الحالي)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: School Class */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">2. الصف الدراسي</label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:border-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.stage})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 3: Section */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">3. الشعبة</label>
            <div className="relative">
              <select
                value={selectedSectionId}
                disabled={availableSections.length === 0}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={`w-full h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:border-emerald-500 focus:outline-hidden appearance-none cursor-pointer ${
                  availableSections.length === 0 ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
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
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 4: Grade Type (The newly added 4th filter) */}
          <div>
            <label className="block text-xs font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>4. نوع الدرجة المعروضة</span>
            </label>
            <div className="relative">
              <select
                value={selectedGradeType}
                onChange={(e) => setSelectedGradeType(e.target.value as ResultGradeType)}
                className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-emerald-950/40 border border-emerald-500/50 rounded-lg text-emerald-300 font-bold focus:border-emerald-400 focus:outline-hidden appearance-none cursor-pointer shadow-sm"
              >
                <option value="term1Score">درجة الفصل الأول</option>
                <option value="midtermScore">درجة نصف السنة</option>
                <option value="term2Score">درجة الفصل الثاني</option>
                <option value="termYearlyScore">درجة السعي السنوي</option>
                <option value="finalExamScore">درجة الامتحان النهائي</option>
                <option value="finalScore">الدرجة النهائية</option>
              </select>
              <ChevronDown className="w-4 h-4 text-emerald-400 absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for the chosen Grade Type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">إجمالي طلاب الشعبة</span>
          <span className="text-xl font-bold font-mono text-white mt-1">{classStats.total}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">الدرجات المكتملة</span>
          <span className="text-xl font-bold font-mono text-blue-400 mt-1">
            {classStats.completed} <span className="text-xs text-slate-500">من {classStats.total}</span>
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">عدد الناجحين</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1">{classStats.passed}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">المكملون (1-2 مادة)</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1">{classStats.supplementary}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">الراسبون (3 فأكثر)</span>
          <span className="text-xl font-bold font-mono text-red-400 mt-1">{classStats.failed}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">نسبة النجاح للمكتملين</span>
          <span className="text-xl font-bold font-mono text-emerald-300 mt-1">
            {classStats.completed > 0 ? `${classStats.passRate}%` : '—'}
          </span>
        </div>
      </div>

      {/* Top 5 Honors Cards for this Selected Grade Type */}
      {topStudents.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl no-print">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-base text-amber-300">
                لوحة الشرف — المتفوقون في {activeGradeConfig.label} ({activeClass?.name} - شعبة {activeSection?.name})
              </h3>
            </div>
            <span className="text-xs text-amber-400/80 font-mono">
              أعلى معدل: {classStats.highestAvg !== null ? `${classStats.highestAvg}%` : '—'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {topStudents.slice(0, 5).map((rankItem, idx) => (
              <div
                key={rankItem.student.id}
                className="bg-slate-950/80 border border-amber-500/30 p-3.5 rounded-xl flex flex-col justify-between hover:border-amber-400/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    معدل: {rankItem.average}%
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white mt-2 line-clamp-1">
                  {rankItem.student.name}
                </h4>
                <span className="text-[11px] text-slate-400 font-mono mt-1">
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
            className="w-full h-10 pr-9 pl-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>عرض</span>
          <strong className="text-white font-mono">{filteredResults.length}</strong>
          <span>من إجمالي</span>
          <strong className="text-white font-mono">{studentResults.length}</strong>
          <span>طالباً في الشعبة</span>
        </div>
      </div>

      {/* Complete Student Ledger Table */}
      <div className="no-print overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <table className="w-full border-collapse text-right select-none">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700 text-xs font-bold text-slate-300">
              <th className="p-3 text-center w-12 border-l border-slate-800">ت</th>
              <th className="p-3 min-w-[220px] border-l border-slate-800">اسم الطالب</th>
              {classSubjects.map((sub) => (
                <th key={sub.id} className="p-2.5 text-center min-w-[95px] border-l border-slate-800 text-[11px]">
                  <div>{sub.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono font-normal">
                    (ع: {sub.maxScore} | ن: {sub.passScore})
                  </div>
                </th>
              ))}
              <th className="p-3 text-center min-w-[90px] border-l border-slate-800 bg-slate-850 text-white font-mono">
                المجموع
              </th>
              <th className="p-3 text-center min-w-[90px] border-l border-slate-800 bg-slate-850 text-emerald-400 font-mono">
                المعدل
              </th>
              <th className="p-3 text-center min-w-[100px] bg-slate-850 text-white border-l border-slate-800">
                النتيجة
              </th>
              <th className="p-3 text-center min-w-[140px] bg-slate-850 text-white">
                الملاحظات
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={classSubjects.length + 6} className="py-12 text-center text-slate-400">
                  <p className="text-sm font-bold">لا توجد نتائج مطابقة للشروط أو البحث الحالي</p>
                  <p className="text-xs text-slate-500 mt-1">
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
                    className={`hover:bg-slate-900/40 transition-colors ${
                      isGeneralExempt ? 'bg-emerald-950/25 hover:bg-emerald-950/35' : ''
                    }`}
                  >
                    <td className="p-2.5 text-center text-xs text-slate-400 font-mono border-l border-slate-800">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border-l border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-200">{r.student.name}</span>
                        {isGeneralExempt && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            إعفاء عام
                          </span>
                        )}
                      </div>
                      {r.student.registrationNumber && (
                        <div className="text-[11px] text-slate-500 font-mono">
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

                      const tooltip = isNull
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
                          className={`relative p-2.5 text-center font-mono text-sm border-l border-slate-800 ${
                            isIndivExempt
                              ? 'bg-blue-950/30 text-blue-300 font-bold border-blue-900/40'
                              : isNull
                              ? 'text-slate-500 bg-slate-900/20'
                              : isPass
                              ? 'text-slate-200 font-medium'
                              : 'text-red-400 font-bold bg-red-950/30'
                          }`}
                        >
                          <div
                            className="relative w-full h-full flex items-center justify-center min-h-[28px]"
                            style={{ position: 'relative' }}
                          >
                            {assistance > 0 && rawScore !== null && rawScore !== score ? (
                              <>
                                <span className="font-extrabold text-emerald-400">{score}</span>
                                <span
                                  className="absolute text-[9px] text-red-400 font-mono font-bold leading-none select-none bg-slate-950/90 px-0.5 rounded"
                                  style={{ position: 'absolute', right: '5px', bottom: '3px' }}
                                  title={`الدرجة الأصلية قبل القرار: ${rawScore}`}
                                >
                                  {rawScore}
                                </span>
                              </>
                            ) : (
                              <span>{isNull ? '—' : score}</span>
                            )}
                            {isIndivExempt && (
                              <span
                                className="absolute text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-sans border border-blue-500/30"
                                style={{ position: 'absolute', left: '4px', top: '2px' }}
                              >
                                معفى
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Score */}
                    <td className="p-2.5 text-center font-mono font-bold text-white border-l border-slate-800 bg-slate-950/40">
                      {r.isComplete ? (
                        r.totalScore
                      ) : r.countedSubjects > 0 ? (
                        <span className="text-slate-400 text-xs" title="مجموع جزئي - توجد درجات غير مكتملة">
                          {r.totalScore}*
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Average */}
                    <td className="p-2.5 text-center font-mono font-bold text-emerald-400 border-l border-slate-800 bg-slate-950/40">
                      {r.average !== null ? `${r.average}%` : <span className="text-slate-500 font-normal">—</span>}
                    </td>

                    {/* Status Badge */}
                    <td className="p-2.5 text-center border-l border-slate-800">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          r.status === 'ناجح' || r.status === 'ناجح — إعفاء عام'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : r.status === 'مكمّل' || (r.status as string) === 'مكمل'
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : r.status === 'راسب'
                            ? 'bg-red-950 text-red-400 border-red-800'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    {/* Notes Badge */}
                    <td className="p-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            r.notes === 'ناجح — إعفاء عام'
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700 shadow-xs'
                              : r.notes === 'ناجح'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : r.notes === 'مكمّل'
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : r.notes === 'راسب'
                              ? 'bg-rose-950 text-rose-300 border-rose-700'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {r.notes}
                        </span>

                        {(r.evaluation.primaryAssistanceUsed > 0 || r.evaluation.secondRoundAssistanceUsed > 0) && (
                          <span className="text-[10px] text-amber-400/90 font-mono">
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

      {/* Informative Guidance Footer Note */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-400 no-print">
        <Info className="w-4 h-4 text-purple-400 shrink-0" />
        <div>
          <span>ملاحظة: علامة الشرطة (—) تعني أن الدرجة غير مدخلة بعد ولم تُحتسب صفراً. </span>
          <span>المجموع والمعدل يُحسبان بصورة نهائية فور اكتمال رصد جميع المواد لهذا النوع من الدرجات.</span>
        </div>
      </div>

      {/* Dedicated Printable Document Container (Visible ONLY during print) */}
      <div className="hidden print:block">
        {renderPrintableContent()}
      </div>

      {/* Interactive Print Preview Modal */}
      {showPrintPreview && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">معاينة كشف النتائج للطباعة (ورق A4 أفقي)</h3>
                  <p className="text-[11px] text-slate-400">
                    هكذا ستظهر صفحة الطباعة على ورق A4 مع كامل الترويسة والدرجات والتواقيع
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isPrinting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>طباعة الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950/60 flex justify-center">
              <div className="bg-white text-slate-950 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-5xl border border-slate-300 font-sans">
                {renderPrintableContent()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
