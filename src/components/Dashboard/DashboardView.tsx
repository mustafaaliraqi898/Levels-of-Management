import React, { useMemo, useState } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Student,
  GradeRecord,
  AppSettings,
  ActiveTab,
  GradeStage,
} from '../../types';
import { buildGradeKey } from '../../services/storage';
import {
  filterClassesByAcademicYear,
  filterSectionsByClassIds,
  filterStudentsByAcademicYear,
} from '../../utils/academicYearUtils';
import {
  Calendar,
  Layers,
  Users,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  PieChart,
  BarChart3,
} from 'lucide-react';

interface DashboardViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: import('../../types').Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
  onNavigate: (tab: ActiveTab) => void;
}

const STAGE_LABELS: Record<GradeStage, string> = {
  term1: 'الفصل الأول',
  midterm: 'نصف السنة',
  term2: 'الفصل الثاني',
  final: 'الامتحان النهائي',
  second_round: 'الدور الثاني (الإكمال)',
};

type DonutChartProps = {
  title: string;
  subtitle: string;
  value: number;
  total: number;
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor: string;
  secondaryColor: string;
  icon: React.ReactNode;
  valueLabel?: string;
};

const DonutChart: React.FC<DonutChartProps> = ({
  title,
  subtitle,
  value,
  total,
  primaryLabel,
  secondaryLabel,
  primaryColor,
  secondaryColor,
  icon,
  valueLabel,
}) => {
  const safeTotal = Math.max(0, total);
  const safeValue = Math.min(Math.max(0, value), safeTotal);
  const percentage = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;
  const remainder = Math.max(0, safeTotal - safeValue);
  const circumference = 2 * Math.PI * 47;
  const dashLength = circumference * (percentage / 100);

  return (
    <section className="min-w-0 rounded-2xl border border-[#DCE3ED] bg-white p-4 shadow-sm transition-all duration-200 dark:border-[#2D3B4D] dark:bg-[#1C2939] dark:shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-[#1E293B] dark:text-[#E2E8F0]">{title}</h3>
          <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#A8B5C7]">{subtitle}</p>
        </div>
        <span className="rounded-xl bg-[#EDF1F7] p-2 text-[#3156C9] dark:bg-[#26364B] dark:text-[#60A5FA]">
          {icon}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`نسبة ${title}: ${percentage}%`}>
            <circle cx="60" cy="60" r="47" fill="none" stroke={safeTotal > 0 ? secondaryColor : "currentColor"} className={safeTotal > 0 ? "opacity-85" : "text-[#DCE3ED] dark:text-[#2D3B4D]"} strokeWidth="12" />
            {safeTotal > 0 && (
              <circle
                cx="60"
                cy="60"
                r="47"
                fill="none"
                stroke={primaryColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dashLength} ${circumference}`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="font-mono tabular-nums text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0]">{valueLabel ?? `${percentage}%`}</strong>
            <span className="mt-0.5 text-[10px] font-semibold text-[#64748B] dark:text-[#A8B5C7]">{primaryLabel}</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#DCE3ED] bg-[#F4F6FA] px-2.5 py-2 dark:border-[#2D3B4D] dark:bg-[#202E40]">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#A8B5C7]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
              <span>{primaryLabel}</span>
            </div>
            <div className="text-base font-black font-mono tabular-nums text-[#1E293B] dark:text-[#E2E8F0]" dir="ltr">
              {safeValue.toLocaleString('en-US')}
              <span className="mr-1 text-[10px] font-medium text-[#64748B] dark:text-[#8493A8]">({percentage}%)</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#DCE3ED] bg-[#F4F6FA] px-2.5 py-2 dark:border-[#2D3B4D] dark:bg-[#202E40]">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#A8B5C7]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
            <div className="text-base font-black font-mono tabular-nums text-[#1E293B] dark:text-[#E2E8F0]" dir="ltr">
              {remainder.toLocaleString('en-US')}
              <span className="mr-1 text-[10px] font-medium text-[#64748B] dark:text-[#8493A8]">({100 - percentage}%)</span>
            </div>
          </div>
        </div>
        {safeTotal === 0 && (
          <p className="text-center text-[11px] text-[#64748B] dark:text-[#A8B5C7]">لا توجد بيانات كافية لعرض المخطط حالياً.</p>
        )}
      </div>
    </section>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
  onNavigate,
}) => {
  const currentYear = academicYears.find((year) => year.isCurrent) || academicYears[0];
  const defaultYearId = currentYear?.id || '';

  const activeClasses = useMemo(
    () => filterClassesByAcademicYear(classes, currentYear?.id, defaultYearId),
    [classes, currentYear?.id, defaultYearId]
  );
  const activeClassIdSet = useMemo(() => new Set(activeClasses.map((item) => item.id)), [activeClasses]);
  const activeSections = useMemo(
    () => filterSectionsByClassIds(sections, activeClassIdSet),
    [sections, activeClassIdSet]
  );
  const activeStudents = useMemo(
    () => filterStudentsByAcademicYear(students, currentYear?.id),
    [students, currentYear?.id]
  );

  const [selectedStage, setSelectedStage] = useState<GradeStage>('term1');
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(() => {
    const firstClass = [...activeClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    return new Set(firstClass ? [firstClass.id] : []);
  });
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<Set<string>>(new Set());

  const toggleClass = (classId: string) => {
    setExpandedClassIds((previous) => {
      const next = new Set(previous);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const toggleSection = (classId: string, sectionId: string) => {
    const key = `${classId}_${sectionId}`;
    setExpandedSectionKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClassIds(new Set(activeClasses.map((item) => item.id)));
    const keys = new Set<string>();
    activeClasses.forEach((item) => {
      activeSections.filter((section) => section.classId === item.id)
        .forEach((section) => keys.add(`${item.id}_${section.id}`));
    });
    setExpandedSectionKeys(keys);
  };

  const collapseAll = () => {
    setExpandedClassIds(new Set());
    setExpandedSectionKeys(new Set());
  };

  // Keep the existing grade-completion rules: a subject is complete only when
  // every student in its section has a grade entered for the selected stage.
  const hierarchyStats = useMemo(() => {
    const sortedClasses = [...activeClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let totalSectionSubjectPairs = 0;
    let completedSectionSubjectPairs = 0;
    let totalGradeSlotsExpected = 0;
    let totalGradeSlotsEntered = 0;

    const classStats = sortedClasses.map((schoolClass) => {
      const realSections = activeSections.filter((section) => section.classId === schoolClass.id);
      const classSections = realSections.length > 0
        ? realSections
        : [{ id: '', name: 'بدون شعبة', classId: schoolClass.id } as Section];
      const classSubjects = subjects
        .filter((subject) => subject.classId === schoolClass.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const classStudents = activeStudents.filter((student) => student.classId === schoolClass.id);

      let classExpectedSlots = 0;
      let classEnteredSlots = 0;
      let classCompletedSubjectsCount = 0;

      const sectionDetails = classSections.map((section) => {
        const sectionStudents = classStudents.filter((student) => student.sectionId === section.id);
        const studentsCount = sectionStudents.length;
        let sectionCompletedSubjects = 0;
        let sectionEnteredSlots = 0;
        const sectionExpectedSlots = studentsCount * classSubjects.length;

        const subjectDetails = classSubjects.map((subject) => {
          totalSectionSubjectPairs++;
          let enteredCount = 0;

          sectionStudents.forEach((student) => {
            const key = buildGradeKey(currentYear?.id || '', schoolClass.id, section.id, subject.id, student.id);
            const record = grades[key];
            if (record) {
              if (selectedStage === 'term1' && record.term1Score !== null) enteredCount++;
              else if (selectedStage === 'midterm' && record.midtermScore !== null) enteredCount++;
              else if (selectedStage === 'term2' && record.term2Score !== null) enteredCount++;
              else if (selectedStage === 'final' && record.finalExamScore !== null) enteredCount++;
            }
          });

          const isComplete = studentsCount > 0 && enteredCount === studentsCount;
          if (isComplete) {
            sectionCompletedSubjects++;
            completedSectionSubjectPairs++;
            classCompletedSubjectsCount++;
          }
          sectionEnteredSlots += enteredCount;
          const percent = studentsCount > 0 ? Math.round((enteredCount / studentsCount) * 100) : 0;
          const status = studentsCount === 0
            ? 'لا يوجد طلاب'
            : isComplete
              ? 'مكتمل'
              : enteredCount > 0
                ? 'قيد الإنجاز'
                : 'غير مكتمل';

          return { subject, studentsCount, enteredCount, isComplete, percent, status };
        });

        classExpectedSlots += sectionExpectedSlots;
        classEnteredSlots += sectionEnteredSlots;
        const sectionPercent = sectionExpectedSlots > 0
          ? Math.round((sectionEnteredSlots / sectionExpectedSlots) * 100)
          : 0;
        const sectionStatus = studentsCount === 0 || classSubjects.length === 0
          ? 'لا توجد بيانات'
          : sectionEnteredSlots === sectionExpectedSlots
            ? 'مكتمل'
            : sectionEnteredSlots > 0
              ? 'قيد الإنجاز'
              : 'غير مكتمل';

        return {
          section,
          studentsCount,
          totalSubjects: classSubjects.length,
          completedSubjectsCount: sectionCompletedSubjects,
          sectionExpectedSlots,
          sectionEnteredSlots,
          percent: sectionPercent,
          status: sectionStatus,
          subjects: subjectDetails,
        };
      });

      totalGradeSlotsExpected += classExpectedSlots;
      totalGradeSlotsEntered += classEnteredSlots;
      const classPercent = classExpectedSlots > 0
        ? Math.round((classEnteredSlots / classExpectedSlots) * 100)
        : 0;
      const classStatus = classExpectedSlots === 0
        ? 'لا توجد بيانات'
        : classEnteredSlots === classExpectedSlots
          ? 'مكتمل'
          : classEnteredSlots > 0
            ? 'قيد الإنجاز'
            : 'غير مكتمل';

      return {
        schoolClass,
        totalStudents: classStudents.length,
        totalSections: classSections.length,
        totalSubjects: classSubjects.length,
        completedSubjectsCount: classCompletedSubjectsCount,
        totalExpectedSlots: classExpectedSlots,
        enteredSlotsCount: classEnteredSlots,
        percent: classPercent,
        status: classStatus,
        sections: sectionDetails,
      };
    });

    return {
      classes: classStats,
      totalSectionSubjectPairs,
      completedCount: completedSectionSubjectPairs,
      pendingCount: Math.max(0, totalSectionSubjectPairs - completedSectionSubjectPairs),
      totalGradeSlotsExpected,
      totalGradeSlotsEntered,
      overallPercent: totalGradeSlotsExpected > 0
        ? Math.round((totalGradeSlotsEntered / totalGradeSlotsExpected) * 100)
        : 0,
    };
  }, [activeClasses, activeSections, subjects, activeStudents, grades, currentYear, selectedStage]);

  const totalGradeSlotsMissing = Math.max(
    0,
    hierarchyStats.totalGradeSlotsExpected - hierarchyStats.totalGradeSlotsEntered
  );

  const statCards = [
    {
      label: 'الصفوف الدراسية',
      value: activeClasses.length,
      detail: 'صفوف مسجلة',
      icon: <Layers className="h-5 w-5" />,
      surfaceTone: 'border-[#CFE0FA] bg-gradient-to-br from-white via-[#F5F8FF] to-[#EAF1FF] dark:border-[#29496B] dark:from-[#17263A] dark:via-[#192B42] dark:to-[#142238]',
      iconTone: 'bg-[#E3EDFF] text-[#2563EB] dark:bg-[#1D416D] dark:text-[#8ABEFF]',
      valueTone: 'text-[#173B78] dark:text-[#E6F1FF]',
      accentTone: 'bg-[#3B82F6]',
      glowTone: 'bg-[#60A5FA]/20 dark:bg-[#3B82F6]/15',
      action: 'classes' as ActiveTab,
    },
    {
      label: 'الشعب الدراسية',
      value: activeSections.length,
      detail: 'شعب مسجلة',
      icon: <GraduationCap className="h-5 w-5" />,
      surfaceTone: 'border-[#E3D8FA] bg-gradient-to-br from-white via-[#FAF7FF] to-[#F1EAFE] dark:border-[#51406F] dark:from-[#251F36] dark:via-[#29213D] dark:to-[#211B32]',
      iconTone: 'bg-[#F0E8FF] text-[#7C3AED] dark:bg-[#49346D] dark:text-[#C4A5FF]',
      valueTone: 'text-[#51258E] dark:text-[#F0E7FF]',
      accentTone: 'bg-[#8B5CF6]',
      glowTone: 'bg-[#A78BFA]/20 dark:bg-[#8B5CF6]/15',
      action: 'classes' as ActiveTab,
    },
    {
      label: 'إجمالي الطلاب',
      value: activeStudents.length,
      detail: 'طالب مسجل',
      icon: <Users className="h-5 w-5" />,
      surfaceTone: 'border-[#CDEFE3] bg-gradient-to-br from-white via-[#F2FCF8] to-[#E4F7EF] dark:border-[#285B4D] dark:from-[#152C2B] dark:via-[#17332F] dark:to-[#142A28]',
      iconTone: 'bg-[#DDF8EC] text-[#059669] dark:bg-[#1D5145] dark:text-[#6EE7B7]',
      valueTone: 'text-[#086B50] dark:text-[#D9FFF0]',
      accentTone: 'bg-[#10B981]',
      glowTone: 'bg-[#34D399]/20 dark:bg-[#10B981]/15',
      action: 'students' as ActiveTab,
    },
    {
      label: 'المواد المكتملة',
      value: hierarchyStats.completedCount,
      detail: 'مواد مكتملة حسب الشعب',
      icon: <BookOpen className="h-5 w-5" />,
      surfaceTone: 'border-[#D2EEE4] bg-gradient-to-br from-white via-[#F3FBF7] to-[#E8F7EF] dark:border-[#285B4D] dark:from-[#152C29] dark:via-[#18342F] dark:to-[#142A26]',
      iconTone: 'bg-[#DDF8EC] text-[#059669] dark:bg-[#1D5145] dark:text-[#6EE7B7]',
      valueTone: 'text-[#087A59] dark:text-[#6EE7B7]',
      accentTone: 'bg-[#10B981]',
      glowTone: 'bg-[#34D399]/20 dark:bg-[#10B981]/15',
      action: 'grade_entry' as ActiveTab,
    },
    {
      label: 'درجات ناقصة',
      value: totalGradeSlotsMissing,
      detail: 'خانات تحتاج استكمال',
      icon: <AlertCircle className="h-5 w-5" />,
      surfaceTone: totalGradeSlotsMissing > 0
        ? 'border-[#F4D6D9] bg-gradient-to-br from-white via-[#FFF8F8] to-[#FCEAEC] dark:border-[#69404A] dark:from-[#302127] dark:via-[#35232B] dark:to-[#2B1D25]'
        : 'border-[#CDEFE3] bg-gradient-to-br from-white via-[#F2FCF8] to-[#E4F7EF] dark:border-[#285B4D] dark:from-[#152C2B] dark:via-[#17332F] dark:to-[#142A28]',
      iconTone: totalGradeSlotsMissing > 0
        ? 'bg-[#FCE7E9] text-[#D14352] dark:bg-[#65313D] dark:text-[#FDA4AF]'
        : 'bg-[#DDF8EC] text-[#059669] dark:bg-[#1D5145] dark:text-[#6EE7B7]',
      valueTone: totalGradeSlotsMissing > 0
        ? 'text-[#B42332] dark:text-[#FDA4AF]'
        : 'text-[#087A59] dark:text-[#6EE7B7]',
      accentTone: totalGradeSlotsMissing > 0 ? 'bg-[#E35D6A]' : 'bg-[#10B981]',
      glowTone: totalGradeSlotsMissing > 0 ? 'bg-[#FB7185]/20 dark:bg-[#E35D6A]/15' : 'bg-[#34D399]/20 dark:bg-[#10B981]/15',
      action: 'grade_entry' as ActiveTab,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-10">
      {/* Dashboard heading and filters */}
      <div className="flex flex-col gap-4 relative overflow-hidden rounded-2xl border border-[#DCE3ED] bg-white p-5 shadow-sm dark:border-[#2D3B4D] dark:bg-[#1C2939] dark:shadow-[0_8px_24px_rgba(0,0,0,0.2)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="rounded-xl bg-[#3156C9]/10 p-2 text-[#3156C9] dark:bg-[#26364B] dark:text-[#60A5FA]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-black text-[#1E293B] dark:text-[#E2E8F0] sm:text-2xl">لوحة التحكم والإحصائيات العامة</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] dark:text-[#A8B5C7]">
            {settings.directorName && <span>مدير المدرسة: {settings.directorName}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-[10px] border border-[#DCE3ED] bg-[#F4F6FA] px-3 py-2 text-xs font-bold text-[#1E293B] dark:border-[#2D3B4D] dark:bg-[#26364B] dark:text-[#E2E8F0]">
            <Calendar className="h-4 w-4 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>العام الدراسي</span>
            <span className="font-mono tabular-nums">{currentYear?.name || 'غير محدد'}</span>
          </label>
          <button
            type="button"
            onClick={() => onNavigate('grade_entry')}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#3156C9] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-[#2749B0] dark:hover:bg-[#3979E6] cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            بدء رصد الدرجات
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Unified Fluent KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.action)}
            className={`group relative flex min-h-[126px] min-w-0 flex-col justify-between overflow-hidden rounded-[18px] border p-4 text-right shadow-[0_5px_18px_rgba(30,55,90,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_26px_rgba(30,55,90,0.12)] focus:outline-none focus:ring-2 focus:ring-[#2785F5]/40 dark:shadow-[0_8px_22px_rgba(0,0,0,0.20)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.30)] cursor-pointer ${card.surfaceTone}`}
          >
            <span aria-hidden="true" className={`pointer-events-none absolute -bottom-10 left-[-18px] h-28 w-28 rounded-full blur-2xl ${card.glowTone}`} />
            <span aria-hidden="true" className={`absolute right-0 top-4 bottom-4 w-1 rounded-l-full ${card.accentTone}`} />
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#526174] dark:text-[#B6C4D6]">{card.label}</span>
              <span className={`rounded-2xl p-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06] ${card.iconTone}`}>{card.icon}</span>
            </div>
            <div className={`relative z-10 text-2xl font-black font-mono tabular-nums tracking-tight sm:text-3xl ${card.valueTone}`} dir="auto">
              {typeof card.value === 'number' ? card.value.toLocaleString('en-US') : card.value}
            </div>
            <span className="relative z-10 text-[10px] font-semibold text-[#64748B] dark:text-[#9EADC0]">{card.detail}</span>
          </button>
        ))}
      </div>

      {/* Main analytics area: class completion and two donut charts */}
      <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-12">
        <section className="min-w-0 rounded-2xl border border-[#DCE3ED] bg-white p-4 shadow-sm dark:border-[#2D3B4D] dark:bg-[#1C2939] dark:shadow-[0_8px_24px_rgba(0,0,0,0.16)] 2xl:col-span-8">
          <div className="mb-4 flex flex-col gap-3 border-b border-[#DCE3ED] pb-3 dark:border-[#2D3B4D] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[#3156C9]/10 p-2 text-[#3156C9] dark:bg-[#26364B] dark:text-[#60A5FA]"><Layers className="h-5 w-5" /></span>
              <div>
                <h2 className="text-sm font-black text-[#1E293B] dark:text-[#E2E8F0]">متابعة اكتمال رصد الدرجات حسب الصفوف</h2>
                <p className="mt-0.5 text-[10px] text-[#64748B] dark:text-[#A8B5C7]">اختر الفصل الدراسي لمتابعة الإنجاز</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={expandAll} className="rounded-lg border border-[#DCE3ED] bg-[#EDF1F7] px-2.5 py-1.5 text-[10px] font-bold text-[#1E293B] hover:border-[#2785F5] dark:border-[#2D3B4D] dark:bg-[#26364B] dark:text-[#E2E8F0] cursor-pointer">توسيع الكل</button>
              <button type="button" onClick={collapseAll} className="rounded-lg border border-[#DCE3ED] bg-[#EDF1F7] px-2.5 py-1.5 text-[10px] font-bold text-[#1E293B] hover:border-[#2785F5] dark:border-[#2D3B4D] dark:bg-[#26364B] dark:text-[#E2E8F0] cursor-pointer">طي الكل</button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {(Object.keys(STAGE_LABELS) as GradeStage[]).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedStage(stage)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
                  selectedStage === stage
                    ? 'bg-[#3156C9] text-white shadow-sm'
                    : 'bg-[#EDF1F7] text-[#64748B] hover:text-[#1E293B] border border-[#DCE3ED] dark:bg-[#26364B] dark:text-[#A8B5C7] dark:hover:text-[#E2E8F0] dark:border-[#2D3B4D]'
                }`}
              >
                {STAGE_LABELS[stage]}
              </button>
            ))}
          </div>

          {hierarchyStats.classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DCE3ED] py-12 text-center text-xs text-[#64748B] dark:border-[#2D3B4D] dark:text-[#A8B5C7]">
              لا توجد صفوف دراسية مسجلة في العام الدراسي الحالي.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {hierarchyStats.classes.map((classItem) => {
                const isExpanded = expandedClassIds.has(classItem.schoolClass.id);
                const statusTone = classItem.status === 'مكتمل'
                  ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#10B981]'
                  : classItem.status === 'قيد الإنجاز'
                    ? 'bg-[#D69B42]/12 text-[#B47A20] dark:text-[#D69B42]'
                    : classItem.status === 'غير مكتمل'
                      ? 'bg-[#E35D6A]/12 text-[#C83D4B] dark:text-[#E35D6A]'
                      : 'bg-[#EDF1F7] text-[#64748B] dark:bg-[#26364B] dark:text-[#A8B5C7]';

                return (
                  <div key={classItem.schoolClass.id} className="overflow-hidden rounded-xl border border-[#DCE3ED] bg-[#F4F6FA] dark:border-[#2D3B4D] dark:bg-[#202E40]">
                    <button
                      type="button"
                      onClick={() => toggleClass(classItem.schoolClass.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full flex-col gap-3 p-3 text-right transition-colors hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3156C9] text-white shadow-xs"><GraduationCap className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-[#1E293B] dark:text-[#E2E8F0]">{classItem.schoolClass.name}</span>
                            <span className="rounded-md bg-[#3156C9]/10 px-2 py-0.5 text-[9px] font-bold text-[#3156C9] dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]">{classItem.schoolClass.stage}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#64748B] dark:text-[#A8B5C7]">
                            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3 text-[#3156C9] dark:text-[#60A5FA]" />{classItem.totalSections} شعبة</span>
                            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-[#3156C9] dark:text-[#60A5FA]" />{classItem.totalStudents} طالب</span>
                            <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3 text-[#3156C9] dark:text-[#60A5FA]" />{classItem.totalSubjects} مادة</span>
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 sm:min-w-[190px]">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between text-[10px]">
                            <span className={`font-black font-mono tabular-nums ${classItem.percent === 100 ? 'text-[#059669] dark:text-[#10B981]' : classItem.percent > 0 ? 'text-[#B47A20] dark:text-[#D69B42]' : 'text-[#64748B] dark:text-[#8493A8]'}`}>{classItem.percent}%</span>
                            <span className="text-[#64748B] dark:text-[#A8B5C7]">اكتمال الرصد</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#DCE3ED] dark:bg-[#111C2A]">
                            <div className={`h-full rounded-full transition-all ${classItem.percent === 100 ? 'bg-[#10B981]' : classItem.percent > 0 ? 'bg-[#D69B42]' : 'bg-[#8493A8]'}`} style={{ width: `${classItem.percent}%` }} />
                          </div>
                        </div>
                        <span className={`hidden rounded-lg px-2.5 py-1 text-[9px] font-bold sm:inline-flex ${statusTone}`}>{classItem.status}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-[#3156C9] dark:text-[#60A5FA]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] dark:text-[#8493A8]" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#DCE3ED] p-3 dark:border-[#2D3B4D]">
                        {classItem.sections.length === 0 ? (
                          <p className="py-4 text-center text-xs text-[#64748B] dark:text-[#A8B5C7]">لا توجد شعب مسجلة لهذا الصف.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                            {classItem.sections.map((sectionItem) => {
                              const sectionKey = `${classItem.schoolClass.id}_${sectionItem.section.id}`;
                              const sectionExpanded = expandedSectionKeys.has(sectionKey);
                              const sectionTone = sectionItem.status === 'مكتمل'
                                ? 'text-[#059669] dark:text-[#10B981]'
                                : sectionItem.status === 'قيد الإنجاز'
                                  ? 'text-[#B47A20] dark:text-[#D69B42]'
                                  : sectionItem.status === 'غير مكتمل'
                                    ? 'text-[#C83D4B] dark:text-[#E35D6A]'
                                    : 'text-[#64748B] dark:text-[#A8B5C7]';

                              return (
                                <div key={sectionItem.section.id || 'no-section'} className="min-w-0 overflow-hidden rounded-xl border border-[#DCE3ED] bg-white dark:border-[#2D3B4D] dark:bg-[#1C2939]">
                                  <button
                                    type="button"
                                    onClick={() => toggleSection(classItem.schoolClass.id, sectionItem.section.id)}
                                    aria-expanded={sectionExpanded}
                                    className="flex w-full items-center gap-2.5 p-3 text-right transition-colors hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] cursor-pointer"
                                  >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${sectionExpanded ? 'bg-[#3156C9] text-white' : 'bg-[#EDF1F7] text-[#1E293B] dark:bg-[#26364B] dark:text-[#E2E8F0]'}`}>{sectionItem.section.name}</span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-xs font-black text-[#1E293B] dark:text-[#E2E8F0]">الشعبة {sectionItem.section.name}</span>
                                      <span className="mt-1 block text-[10px] text-[#64748B] dark:text-[#A8B5C7]">{sectionItem.studentsCount} طالب · {sectionItem.completedSubjectsCount} من {sectionItem.totalSubjects} مواد مكتملة</span>
                                    </span>
                                    <span className={`text-xs font-black font-mono tabular-nums ${sectionTone}`}>{sectionItem.percent}%</span>
                                    {sectionExpanded ? <ChevronUp className="h-4 w-4 text-[#3156C9] dark:text-[#60A5FA]" /> : <ChevronDown className="h-4 w-4 text-[#64748B] dark:text-[#8493A8]" />}
                                  </button>

                                  {sectionExpanded && (
                                    <div className="border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                                      {sectionItem.subjects.length === 0 ? (
                                        <p className="p-4 text-center text-[10px] text-[#64748B] dark:text-[#A8B5C7]">لا توجد مواد مضافة لهذا الصف.</p>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full min-w-[330px] text-right text-[10px]">
                                            <thead className="bg-[#F4F6FA] text-[#64748B] dark:bg-[#26364B] dark:text-[#A8B5C7]">
                                              <tr>
                                                <th className="px-3 py-2 font-bold">المادة</th>
                                                <th className="px-2 py-2 text-center font-bold">الرصد</th>
                                                <th className="px-3 py-2 text-left font-bold">الإنجاز</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                                              {sectionItem.subjects.map((subjectItem) => (
                                                <tr
                                                  key={subjectItem.subject.id}
                                                  onClick={() => onNavigate('grade_entry')}
                                                  className="cursor-pointer transition-colors hover:bg-[#3156C9]/6 dark:hover:bg-[#2785F5]/12"
                                                  title="الانتقال إلى شاشة رصد الدرجات"
                                                >
                                                  <td className="px-3 py-2 font-bold text-[#1E293B] dark:text-[#E2E8F0]">{subjectItem.subject.name}</td>
                                                  <td className="px-2 py-2 text-center">
                                                    <span className={`inline-flex rounded-md px-2 py-0.5 font-bold ${subjectItem.isComplete ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#10B981]' : subjectItem.enteredCount > 0 ? 'bg-[#D69B42]/12 text-[#B47A20] dark:text-[#D69B42]' : 'bg-[#E35D6A]/12 text-[#C83D4B] dark:text-[#E35D6A]'}`}>
                                                      {subjectItem.isComplete ? 'مكتمل' : subjectItem.enteredCount > 0 ? 'قيد الرصد' : 'غير مكتمل'}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <div className="flex items-center justify-end gap-2">
                                                      <span className="font-mono tabular-nums font-bold text-[#1E293B] dark:text-[#E2E8F0]" dir="ltr">{subjectItem.percent}%</span>
                                                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#DCE3ED] dark:bg-[#111C2A]">
                                                        <span className={`block h-full rounded-full ${subjectItem.isComplete ? 'bg-[#10B981]' : subjectItem.enteredCount > 0 ? 'bg-[#D69B42]' : 'bg-[#E35D6A]'}`} style={{ width: `${subjectItem.percent}%` }} />
                                                      </span>
                                                    </div>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => onNavigate('grade_entry')}
                                        className="flex w-full items-center justify-center gap-1.5 border-t border-[#DCE3ED] px-3 py-2 text-[10px] font-bold text-[#3156C9] transition-colors hover:bg-[#3156C9]/8 dark:border-[#2D3B4D] dark:text-[#60A5FA] dark:hover:bg-[#2785F5]/12 cursor-pointer"
                                      >
                                        رصد درجات الشعبة <ArrowLeft className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-3 2xl:col-span-4 2xl:grid-cols-1">
          <DonutChart
            title="حالة رصد الدرجات"
            subtitle={`حسب ${STAGE_LABELS[selectedStage]}`}
            value={hierarchyStats.totalGradeSlotsEntered}
            total={hierarchyStats.totalGradeSlotsExpected}
            primaryLabel="درجات مرصودة"
            secondaryLabel="درجات ناقصة"
            primaryColor="#10B981"
            secondaryColor="#E35D6A"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <DonutChart
            title="حالة المواد الدراسية"
            subtitle="على مستوى الصفوف والشعب"
            value={hierarchyStats.completedCount}
            total={hierarchyStats.totalSectionSubjectPairs}
            primaryLabel="مواد مكتملة"
            secondaryLabel="مواد غير مكتملة"
            primaryColor="#2785F5"
            secondaryColor="#D69B42"
            icon={<PieChart className="h-5 w-5" />}
            valueLabel={`${hierarchyStats.completedCount}/${hierarchyStats.totalSectionSubjectPairs}`}
          />
        </div>
      </div>
    </div>
  );
};
