import React, { useState, useMemo, useEffect } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  DecisionGrantRecord,
  StudentComprehensiveEvaluation,
} from '../../types';
import { db, buildGradeKey } from '../../services/storage';
import {
  evaluateStudentAcademicYearDecisions,
  formatScore,
} from '../../services/calculations';
import {
  ShieldCheck,
  Award,
  Search,
  Check,
  AlertCircle,
  Lock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Users,
  Printer,
  X,
  FileCheck,
} from 'lucide-react';

interface DecisionMarksViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
}

export const DecisionMarksView: React.FC<DecisionMarksViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
}) => {
  // 1. Filters
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  const availableClasses = useMemo(() => {
    return [...classes].sort((a, b) => a.order - b.order);
  }, [classes]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  useEffect(() => {
    if (!availableClasses.some((c) => c.id === selectedClassId) && availableClasses.length > 0) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  // Sections: "all" or specific section ID
  const classSections = useMemo(() => {
    return sections.filter((s) => s.classId === selectedClassId);
  }, [sections, selectedClassId]);

  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');

  useEffect(() => {
    setSelectedSectionId('all');
  }, [selectedClassId]);

  // Round filter: 'round1' or 'round2'
  const [selectedRound, setSelectedRound] = useState<'round1' | 'round2'>('round1');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Active modal for granting decision
  const [grantModalData, setGrantModalData] = useState<{
    student: Student;
    subject: Subject;
    originalScore: number;
    neededMarks: number;
    passScore: number;
    balanceRemaining: number;
  } | null>(null);

  // Action feedback message
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Decision settings for this academic year
  const decisionSettings = useMemo(() => {
    return db.getDecisionSettings(selectedYearId);
  }, [selectedYearId]);

  // Class subjects sorted by order
  const classSubjects = useMemo(() => {
    return subjects
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [subjects, selectedClassId]);

  // Filter students for selected year, class, and section
  const targetStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (s.academicYearId !== selectedYearId || s.classId !== selectedClassId) return false;
        if (selectedSectionId !== 'all' && s.sectionId !== selectedSectionId) return false;
        return true;
      })
      .sort((a, b) => a.seatNumber - b.seatNumber);
  }, [students, selectedYearId, selectedClassId, selectedSectionId]);

  // Get persisted decision grants
  const decisionGrants = db.getDecisionGrants();

  // Evaluate students and filter those eligible for decision in selected round
  const eligibleStudentsList = useMemo(() => {
    if (!decisionSettings || classSubjects.length === 0) return [];

    const resultList: Array<{
      student: Student;
      evaluation: StudentComprehensiveEvaluation;
      eligibleSubjects: Array<{
        subject: Subject;
        originalScore: number;
        neededMarks: number;
        passScore: number;
        isGranted: boolean;
        grantRecord?: DecisionGrantRecord;
      }>;
      balance: ReturnType<typeof db.getStudentDecisionBalance>;
    }> = [];

    targetStudents.forEach((student) => {
      // Map student grades by subject
      const studentGradesBySubject: Record<string, GradeRecord | undefined> = {};
      classSubjects.forEach((sub) => {
        const k = buildGradeKey(selectedYearId, selectedClassId, student.sectionId, sub.id, student.id);
        studentGradesBySubject[sub.id] = grades[k];
      });

      const evaluation = evaluateStudentAcademicYearDecisions(
        student,
        classSubjects,
        studentGradesBySubject,
        decisionSettings,
        settings.roundingRule,
        decisionGrants,
        db.getExemptionSettings(selectedYearId)
      );

      const balance = db.getStudentDecisionBalance(student.id, selectedYearId, selectedRound);
      const eligibleSubjects: Array<{
        subject: Subject;
        originalScore: number;
        neededMarks: number;
        passScore: number;
        isGranted: boolean;
        grantRecord?: DecisionGrantRecord;
      }> = [];

      classSubjects.forEach((sub) => {
        const subEval = evaluation.subjects[sub.id];
        if (!subEval || subEval.isExempt) return;

        const passScore = sub.passScore || 50;

        if (selectedRound === 'round1') {
          // Round 1 eligibility: raw final score < 50 and failing
          const rawFinal = subEval.rawFinalScore;
          if (rawFinal !== null && rawFinal < passScore) {
            const grantKey = `${selectedYearId}_${selectedClassId}_${student.sectionId}_${student.id}_${sub.id}_round1`;
            const grant = decisionGrants[grantKey];
            const needed = passScore - rawFinal;
            
            eligibleSubjects.push({
              subject: sub,
              originalScore: rawFinal,
              neededMarks: needed,
              passScore,
              isGranted: !!grant,
              grantRecord: grant,
            });
          }
        } else {
          // Round 2 eligibility: Student must be mokammal, subject is make up eligible and 2nd round final < 50
          if (subEval.isMakeUpEligible) {
            const r2Final = subEval.secondRoundFinalScore;
            if (r2Final !== null && r2Final < passScore) {
              const grantKey = `${selectedYearId}_${selectedClassId}_${student.sectionId}_${student.id}_${sub.id}_round2`;
              const grant = decisionGrants[grantKey];
              const needed = passScore - r2Final;

              eligibleSubjects.push({
                subject: sub,
                originalScore: r2Final,
                neededMarks: needed,
                passScore,
                isGranted: !!grant,
                grantRecord: grant,
              });
            }
          }
        }
      });

      // Include student if they have at least one eligible failing subject OR already have granted decisions in this round
      const existingGrantsForRound = db.getStudentDecisionGrants(student.id, selectedYearId, selectedRound);
      if (eligibleSubjects.length > 0 || existingGrantsForRound.length > 0) {
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          if (!student.name.toLowerCase().includes(q)) {
            return;
          }
        }

        resultList.push({
          student,
          evaluation,
          eligibleSubjects,
          balance,
        });
      }
    });

    return resultList;
  }, [targetStudents, classSubjects, selectedYearId, selectedClassId, selectedRound, decisionSettings, settings.roundingRule, decisionGrants, searchQuery]);

  // Handle opening grant confirmation modal
  const handleOpenGrantModal = (
    student: Student,
    subject: Subject,
    originalScore: number,
    neededMarks: number,
    passScore: number,
    balanceRemaining: number
  ) => {
    if (balanceRemaining < neededMarks) {
      setFeedbackMessage({
        type: 'error',
        text: `رصيد المساعدة المتاح (${balanceRemaining} درجات) غير كافٍ لمنح القرار لهذه المادة (تحتاج ${neededMarks} درجات). لا يُسمح بمنح مساعدة جزئية.`,
      });
      return;
    }

    setGrantModalData({
      student,
      subject,
      originalScore,
      neededMarks,
      passScore,
      balanceRemaining,
    });
  };

  // Confirm and execute grant decision
  const handleConfirmGrant = () => {
    if (!grantModalData) return;
    const { student, subject, neededMarks, balanceRemaining } = grantModalData;

    if (balanceRemaining < neededMarks) {
      setFeedbackMessage({
        type: 'error',
        text: 'رصيد المساعدة غير كافٍ.',
      });
      setGrantModalData(null);
      return;
    }

    const res = db.grantDecision({
      academicYearId: selectedYearId,
      classId: selectedClassId,
      sectionId: student.sectionId,
      studentId: student.id,
      subjectId: subject.id,
      round: selectedRound,
      grantedBy: 'مدير المدرسة',
    });

    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: `تم منح القرار بنجاح للطالب «${student.name}» في مادة «${subject.name}» وتحديث الدرجة والرصيد.`,
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.error || 'حدث خطأ أثناء منح القرار.',
      });
    }

    setGrantModalData(null);
  };

  // Revoke decision
  const handleRevokeDecision = (student: Student, subject: Subject) => {
    const res = db.revokeDecision(
      selectedYearId,
      selectedClassId,
      student.sectionId,
      student.id,
      subject.id,
      selectedRound
    );

    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: `تم إلغاء القرار واستعادة الرصيد للطالب «${student.name}» في مادة «${subject.name}».`,
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.message || 'تعذر إلغاء القرار.',
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100">إضافة درجات القرار ومساعدة المدير</h1>
            <p className="text-sm text-slate-400">
              منح درجات المساعدة الوزارية يدوياً للطلبة المستحقين وفق الضوابط، مع مزامنة فورية في قسم إدخال الدرجات والنتائج.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>رصيد الدور الأول الأساسي: {decisionSettings?.primaryAssistanceMarks || 10} درجات</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              : 'bg-red-950/30 border-red-800/50 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        {/* 1. Academic Year */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>العام الدراسي</span>
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-bold"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isCurrent ? '(الحالي)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Class */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>الصف الدراسي</span>
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-bold"
          >
            {availableClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Section */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>الشعبة</span>
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-bold"
          >
            <option value="all">جميع الشعب</option>
            {classSections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                الشعبة ({sec.name})
              </option>
            ))}
          </select>
        </div>

        {/* 4. Round */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>الدور</span>
          </label>
          <select
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value as 'round1' | 'round2')}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-bold"
          >
            <option value="round1">الدور الأول</option>
            <option value="round2">الدور الثاني (الإكمال)</option>
          </select>
        </div>

        {/* 5. Search Student */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>بحث باسم الطالب</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب للبحث..."
              className="w-full h-10 px-3 pl-9 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Main Students List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <span>الطلبة المستحقون والمشمولون بالقرار</span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono text-xs">
              {eligibleStudentsList.length} طالب
            </span>
          </h2>
          <span className="text-xs text-slate-400">
            يظهر كل طالب مرة واحدة مع كافة مواده المستحقة في {selectedRound === 'round1' ? 'الدور الأول' : 'الدور الثاني'}
          </span>
        </div>

        {eligibleStudentsList.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <p className="text-slate-300 font-bold text-base">لا يوجد طلبة مستحقون للقرار وفق الفلاتر المحددة.</p>
            <p className="text-xs text-slate-500 max-w-md">
              تأكد من إدخال درجات السعي والامتحان النهائي للطلبة وأن لديهم عجزاً ضمن رصيد المساعدة المتاحة.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {eligibleStudentsList.map(({ student, evaluation, eligibleSubjects, balance }) => {
              const sectionObj = sections.find((s) => s.id === student.sectionId);
              const classObj = classes.find((c) => c.id === student.classId);

              return (
                <div
                  key={student.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4 transition-all hover:border-slate-700"
                >
                  {/* Student Top Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm">
                        #{student.seatNumber}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-100">{student.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">
                          الصف: {classObj?.name} | الشعبة: ({sectionObj?.name || '—'}) | رقم القيد: {student.registrationNumber || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
                        <span className="text-slate-500">رصيد المساعدة المستهلك:</span>
                        <span className="font-bold text-amber-400">{balance.usedMarks} / {balance.totalPool}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-xs font-mono text-emerald-300 flex items-center gap-2">
                        <span className="text-emerald-500/80">المتبقي:</span>
                        <span className="font-bold text-emerald-400">{balance.remainingMarks} درجات</span>
                      </div>
                    </div>
                  </div>

                  {/* Eligible Subjects Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/50">
                          <th className="p-3 font-medium">المادة الدراسية</th>
                          <th className="p-3 font-medium text-center">درجة السعي السنوي</th>
                          <th className="p-3 font-medium text-center">
                            {selectedRound === 'round1' ? 'درجة الامتحان النهائي' : 'درجة الإكمال (الدور الثاني)'}
                          </th>
                          <th className="p-3 font-medium text-center">الدرجة النهائية الحالية</th>
                          <th className="p-3 font-medium text-center">العجز المطلوب للنجاح</th>
                          <th className="p-3 font-medium text-center">حالة القرار</th>
                          <th className="p-3 font-medium text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-sm">
                        {eligibleSubjects.map((item) => {
                          const subEval = evaluation.subjects[item.subject.id];
                          const yearlyScore = subEval?.termYearlyScore ?? '—';
                          const examScore = selectedRound === 'round1' ? subEval?.finalExamScore ?? '—' : subEval?.secondRoundScore ?? '—';

                          return (
                            <tr key={item.subject.id} className="hover:bg-slate-850/40 transition-colors">
                              <td className="p-3 font-sans font-bold text-slate-200">
                                {item.subject.name}
                              </td>
                              <td className="p-3 text-center text-slate-300">{yearlyScore}</td>
                              <td className="p-3 text-center text-slate-300">{examScore}</td>
                              <td className="p-3 text-center">
                                {item.isGranted && item.grantRecord && item.originalScore !== item.grantRecord.finalScoreAfterDecision ? (
                                  <div className="relative w-full h-full flex items-center justify-center min-h-[32px]">
                                    <span className="text-base font-black text-emerald-400">
                                      {item.grantRecord.finalScoreAfterDecision}
                                    </span>
                                    <span
                                      className="absolute text-[9px] text-red-400 font-mono font-bold leading-none select-none bg-slate-950/90 px-0.5 rounded"
                                      style={{ right: '5px', bottom: '3px' }}
                                      title={`الدرجة الأصلية قبل القرار: ${item.originalScore}`}
                                    >
                                      {item.originalScore}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-base font-bold text-amber-400">
                                    {item.originalScore}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center text-red-400 font-bold">
                                {item.neededMarks} درجات
                              </td>
                              <td className="p-3 text-center">
                                {item.isGranted ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-sans font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    ممنوح ({item.grantRecord?.appliedMarks} درجات)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-sans text-slate-400 bg-slate-800 border border-slate-700">
                                    غير ممنوح
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {item.isGranted ? (
                                  <button
                                    onClick={() => handleRevokeDecision(student, item.subject)}
                                    className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800 text-xs font-sans font-bold transition-colors cursor-pointer"
                                  >
                                    إلغاء القرار
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleOpenGrantModal(
                                        student,
                                        item.subject,
                                        item.originalScore,
                                        item.neededMarks,
                                        item.passScore,
                                        balance.remainingMarks
                                      )
                                    }
                                    disabled={balance.remainingMarks < item.neededMarks}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-colors cursor-pointer ${
                                      balance.remainingMarks >= item.neededMarks
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-600/20'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                    }`}
                                  >
                                    {balance.remainingMarks >= item.neededMarks ? 'منح القرار (موافق)' : 'الرصيد غير كافٍ'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {grantModalData && (
        <div className="no-print fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">تأكيد منح قرار المساعدة الوزارية</h3>
                  <p className="text-xs text-slate-400">يرجى مراجعة تفاصيل القرار قبل الحفظ</p>
                </div>
              </div>
              <button
                onClick={() => setGrantModalData(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-sm bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">اسم الطالب:</span>
                <span className="font-bold text-slate-100 font-sans">{grantModalData.student.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">المادة الدراسية:</span>
                <span className="font-bold text-emerald-400 font-sans">{grantModalData.subject.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">الدرجة النهائية الأصلية قبل القرار:</span>
                <span className="text-red-400 font-bold">{grantModalData.originalScore} من {grantModalData.passScore}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">مقدار المساعدة اللازم للوصول إلى النجاح:</span>
                <span className="text-amber-400 font-bold">+{grantModalData.neededMarks} درجات</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">رصيد المساعدة المتاح قبل المنح:</span>
                <span className="text-slate-200 font-bold">{grantModalData.balanceRemaining} درجات</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">الدرجة التي ستظهر بعد القرار:</span>
                <span className="text-emerald-400 font-black text-base">{grantModalData.passScore} (ناجح)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">الرصيد المتبقي بعد المنح:</span>
                <span className="text-cyan-400 font-bold">{grantModalData.balanceRemaining - grantModalData.neededMarks} درجات</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                هل تريد منح القرار لهذا الطالب في هذه المادة؟ سيتم تطبيق الدرجة مباشرة في قسم إدخال الدرجات والنتائج دون تغيير الدرجة الأصلية.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGrantModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmGrant}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                موافق (منح القرار)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
