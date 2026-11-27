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
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
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
import { StudentStatusBadge } from '../Common/StudentStatusBadge';

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
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
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

  const eligibleSubjectCount = eligibleStudentsList.reduce((total, item) => total + item.eligibleSubjects.length, 0);
  const grantedDecisionCount = eligibleStudentsList.reduce(
    (total, item) => total + item.eligibleSubjects.filter((subject) => subject.isGranted).length,
    0
  );
  const totalRemainingMarks = eligibleStudentsList.reduce((total, item) => total + item.balance.remainingMarks, 0);

  return (
    <div className="w-full flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 flex items-center justify-center text-[#3156C9] dark:text-[#60A5FA] shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <h1 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-[#E2E8F0]">إضافة درجات القرار ومساعدة المدير</h1>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'الطلاب المستحقون', value: eligibleStudentsList.length, icon: Users, tone: 'blue' },
          { label: 'المواد المستحقة', value: eligibleSubjectCount, icon: BookOpen, tone: 'violet' },
          { label: 'القرارات الممنوحة', value: grantedDecisionCount, icon: CheckCircle2, tone: 'green' },
          { label: 'الرصيد المتبقي', value: totalRemainingMarks, suffix: 'درجة', icon: Sparkles, tone: 'amber' },
        ].map((item) => {
          const tones: Record<string, string> = {
            blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900',
            violet: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900',
            green: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900',
            amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900',
          };
          const Icon = item.icon;
          return (
            <div key={item.label} className={`rounded-2xl border p-4 ${tones[item.tone]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{item.label}</span>
                <Icon className="w-5 h-5 opacity-80" />
              </div>
              <div className="mt-2 text-2xl font-black font-mono tabular-nums">
                {item.value}{item.suffix ? <span className="mr-1 text-xs font-bold">{item.suffix}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#059669] dark:text-[#10B981]'
              : 'bg-[#E35D6A]/10 border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-4 shadow-sm">
        {/* 1. Academic Year */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>العام الدراسي</span>
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2785F5] font-bold cursor-pointer"
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
          <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>الصف الدراسي</span>
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2785F5] font-bold"
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
          <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>الشعبة</span>
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2785F5] font-bold"
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
          <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>الدور</span>
          </label>
          <select
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value as 'round1' | 'round2')}
            className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2785F5] font-bold"
          >
            <option value="round1">الدور الأول</option>
            <option value="round2">الدور الثاني (الإكمال)</option>
          </select>
        </div>

        {/* 5. Search Student */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>بحث باسم الطالب</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب للبحث..."
              className="w-full h-10 px-3 pl-9 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] text-sm focus:outline-none focus:border-[#2785F5]"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-[#64748B] dark:text-[#8493A8]" />
          </div>
        </div>
      </div>

      {/* Main Students List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
            <span>الطلبة المستحقون والمشمولون بالقرار</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30 font-mono tabular-nums text-xs">
              {eligibleStudentsList.length} طالب
            </span>
          </h2>
        </div>

        {eligibleStudentsList.length === 0 ? (
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-center text-[#64748B] dark:text-[#8493A8]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <p className="text-[#1E293B] dark:text-[#E2E8F0] font-bold text-base">لا يوجد طلبة مستحقون للقرار وفق الفلاتر المحددة.</p>
            <p className="text-xs text-[#64748B] dark:text-[#8493A8] max-w-md">لا توجد حالات مستحقة وفق خيارات التصفية الحالية.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {eligibleStudentsList.map(({ student, evaluation, eligibleSubjects, balance }) => {
              const sectionObj = sections.find((s) => s.id === student.sectionId);
              const classObj = classes.find((c) => c.id === student.classId);

              return (
                <div
                  key={student.id}
                  className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-5 shadow-sm flex flex-col gap-4 transition-all hover:border-[#2785F5]/40"
                >
                  {/* Student Top Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-center font-mono tabular-nums font-bold text-[#3156C9] dark:text-[#60A5FA] text-sm">
                        #{student.seatNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">{student.name}</h3>
                          <StudentStatusBadge status={student.status} />
                        </div>
                        <p className="text-xs text-[#64748B] dark:text-[#8493A8] font-mono">
                          الصف: {classObj?.name} | الشعبة: ({sectionObj?.name || '—'}) | رقم القيد: {student.registrationNumber || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-mono tabular-nums text-[#475569] dark:text-[#A8B5C7] flex items-center gap-2">
                        <span className="text-[#64748B] dark:text-[#8493A8]">رصيد المساعدة المستهلك:</span>
                        <span className="font-bold text-[#B45309] dark:text-[#D69B42]">{balance.usedMarks} / {balance.totalPool}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs font-mono tabular-nums text-[#059669] dark:text-[#10B981] flex items-center gap-2">
                        <span className="opacity-85">المتبقي:</span>
                        <span className="font-bold">{balance.remainingMarks} درجات</span>
                      </div>
                    </div>
                  </div>

                  {/* Eligible Subjects Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-xs text-[#475569] dark:text-[#A8B5C7] bg-[#EDF1F7] dark:bg-[#26364B]">
                          <th className="p-3 font-bold">المادة الدراسية</th>
                          <th className="p-3 font-bold text-center">درجة السعي السنوي</th>
                          <th className="p-3 font-bold text-center">
                            {selectedRound === 'round1' ? 'درجة الامتحان النهائي' : 'درجة الإكمال (الدور الثاني)'}
                          </th>
                          <th className="p-3 font-bold text-center">الدرجة النهائية الحالية</th>
                          <th className="p-3 font-bold text-center">العجز المطلوب للنجاح</th>
                          <th className="p-3 font-bold text-center">حالة القرار</th>
                          <th className="p-3 font-bold text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D] font-mono tabular-nums text-sm">
                        {eligibleSubjects.map((item) => {
                          const subEval = evaluation.subjects[item.subject.id];
                          const yearlyScore = subEval?.termYearlyScore ?? '—';
                          const examScore = selectedRound === 'round1' ? subEval?.finalExamScore ?? '—' : subEval?.secondRoundScore ?? '—';

                          return (
                            <tr key={item.subject.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#26364B]/60 transition-colors">
                              <td className="p-3 font-sans font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                                {item.subject.name}
                              </td>
                              <td className="p-3 text-center text-[#475569] dark:text-[#A8B5C7]">{yearlyScore}</td>
                              <td className="p-3 text-center text-[#475569] dark:text-[#A8B5C7]">{examScore}</td>
                              <td className="p-3 text-center">
                                {item.isGranted && item.grantRecord && item.originalScore !== item.grantRecord.finalScoreAfterDecision ? (
                                  <div className="relative w-full h-full flex items-center justify-center min-h-[32px]">
                                    <span className="text-base font-black text-[#059669] dark:text-[#10B981]">
                                      {item.grantRecord.finalScoreAfterDecision}
                                    </span>
                                    <span
                                      className="absolute text-[9px] text-[#C83D4B] dark:text-[#E35D6A] font-mono font-bold leading-none select-none bg-white dark:bg-[#1C2939] border border-[#E35D6A]/35 px-0.5 rounded"
                                      style={{ right: '5px', bottom: '3px' }}
                                      title={`الدرجة الأصلية قبل القرار: ${item.originalScore}`}
                                    >
                                      {item.originalScore}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-base font-bold text-[#B45309] dark:text-[#D69B42]">
                                    {item.originalScore}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center text-[#C83D4B] dark:text-[#E35D6A] font-bold">
                                {item.neededMarks} درجات
                              </td>
                              <td className="p-3 text-center">
                                {item.isGranted ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-sans font-bold bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                                    ممنوح ({item.grantRecord?.appliedMarks} درجات)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-sans text-[#64748B] dark:text-[#8493A8] bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D]">
                                    غير ممنوح
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {item.isGranted ? (
                                  <button
                                    onClick={() => handleRevokeDecision(student, item.subject)}
                                    className="px-3 py-1.5 rounded-xl bg-[#E35D6A]/10 hover:bg-[#E35D6A]/20 text-[#C83D4B] dark:text-[#E35D6A] border border-[#E35D6A]/30 text-xs font-sans font-bold transition-colors cursor-pointer"
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
                                        ? 'bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white shadow-sm'
                                        : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] cursor-not-allowed border border-[#DCE3ED] dark:border-[#2D3B4D]'
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
        <div className="no-print fixed inset-0 z-50 bg-[#111C2A]/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 flex items-center justify-center text-[#3156C9] dark:text-[#60A5FA]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">تأكيد منح قرار المساعدة الوزارية</h3>
                    </div>
              </div>
              <button
                onClick={() => setGrantModalData(null)}
                className="text-[#64748B] hover:text-[#1E293B] dark:text-[#8493A8] dark:hover:text-[#E2E8F0] cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-sm bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] font-mono tabular-nums">
              <div className="flex justify-between items-center pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">اسم الطالب:</span>
                <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0] font-sans">{grantModalData.student.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">المادة الدراسية:</span>
                <span className="font-bold text-[#3156C9] dark:text-[#60A5FA] font-sans">{grantModalData.subject.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">الدرجة النهائية الأصلية قبل القرار:</span>
                <span className="text-[#C83D4B] dark:text-[#E35D6A] font-bold">{grantModalData.originalScore} من {grantModalData.passScore}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">مقدار المساعدة اللازم للوصول إلى النجاح:</span>
                <span className="text-[#B45309] dark:text-[#D69B42] font-bold">+{grantModalData.neededMarks} درجات</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">رصيد المساعدة المتاح قبل المنح:</span>
                <span className="text-[#1E293B] dark:text-[#E2E8F0] font-bold">{grantModalData.balanceRemaining} درجات</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">الدرجة التي ستظهر بعد القرار:</span>
                <span className="text-[#059669] dark:text-[#10B981] font-black text-base">{grantModalData.passScore} (ناجح)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#8493A8] font-sans">الرصيد المتبقي بعد المنح:</span>
                <span className="text-[#3156C9] dark:text-[#60A5FA] font-bold">{grantModalData.balanceRemaining - grantModalData.neededMarks} درجات</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#D69B42]/10 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                سيتم تطبيق القرار على هذه المادة مع الاحتفاظ بالدرجة الأصلية.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGrantModalData(null)}
                className="px-4 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmGrant}
                className="px-5 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
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
