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
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 dark:border-[#2d3b4d] dark:bg-[#1c2939] dark:shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#a8b5c7]">{subtitle}</p>
        </div>
        <span className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-[#26364b] dark:text-[#60a5fa]">
          {icon}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`نسبة ${title}: ${percentage}%`}>
            <circle cx="60" cy="60" r="47" fill="none" stroke={safeTotal > 0 ? secondaryColor : "currentColor"} className={safeTotal > 0 ? "" : "text-slate-200 dark:text-slate-700"} strokeWidth="12" />
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
            <strong className="font-mono text-2xl font-black text-slate-900 dark:text-slate-100">{valueLabel ?? `${percentage}%`}</strong>
            <span className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-[#a8b5c7]">{primaryLabel}</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-[#2d3b4d] dark:bg-[#202e40]">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#a8b5c7]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
              <span>{primaryLabel}</span>
            </div>
            <div className="text-base font-black text-slate-900 dark:text-slate-100" dir="ltr">
              {safeValue.toLocaleString('en-US')}
              <span className="mr-1 text-[10px] font-medium text-slate-400">({percentage}%)</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-[#2d3b4d] dark:bg-[#202e40]">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#a8b5c7]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
            <div className="text-base font-black text-slate-900 dark:text-slate-100" dir="ltr">
              {remainder.toLocaleString('en-US')}
              <span className="mr-1 text-[10px] font-medium text-slate-400">({100 - percentage}%)</span>
            </div>
          </div>
        </div>
        {safeTotal === 0 && (
          <p className="text-center text-[11px] text-slate-500 dark:text-[#a8b5c7]">لا توجد بيانات كافية لعرض المخطط حالياً.</p>
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
      color: 'from-[#5146b8] to-[#38318f]',
      action: 'classes' as ActiveTab,
    },
    {
      label: 'الشعب الدراسية',
      value: activeSections.length,
      detail: 'شعب مسجلة',
      icon: <GraduationCap className="h-5 w-5" />,
      color: 'from-[#b7791f] to-[#925b17]',
      action: 'classes' as ActiveTab,
    },
    {
      label: 'إجمالي الطلاب',
      value: activeStudents.length,
      detail: 'طالب مسجل',
      icon: <Users className="h-5 w-5" />,
      color: 'from-[#2878c7] to-[#2453a6]',
      action: 'students' as ActiveTab,
    },
    {
      label: 'المواد المكتملة',
      value: hierarchyStats.completedCount,
      detail: 'مواد مكتملة حسب الشعب',
      icon: <BookOpen className="h-5 w-5" />,
      color: 'from-[#138b83] to-[#12645f]',
      action: 'grade_entry' as ActiveTab,
    },
    {
      label: 'درجات ناقصة',
      value: totalGradeSlotsMissing,
      detail: 'خانات تحتاج استكمال',
      icon: <AlertCircle className="h-5 w-5" />,
      color: 'from-[#bd4262] to-[#87344f]',
      action: 'grade_entry' as ActiveTab,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-10">
      {/* Dashboard heading and filters */}
      <div className="flex flex-col gap-4 relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#31506f] dark:bg-[radial-gradient(ellipse_at_12%_120%,rgba(39,133,245,0.24),transparent_42%),linear-gradient(115deg,#14243a_0%,#1c2939_54%,#10233c_100%)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.2)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-[#173c68] dark:text-[#60a5fa]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 sm:text-2xl">لوحة التحكم والإحصائيات العامة</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-[#a8b5c7]">
            {settings.directorName && <span>مدير المدرسة: {settings.directorName}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-[#34465d] dark:bg-[#26364b] dark:text-slate-200">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-[#60a5fa]" />
            <span>العام الدراسي</span>
            <span className="font-mono">{currentYear?.name || 'غير محدد'}</span>
          </label>
          <button
            type="button"
            onClick={() => onNavigate('grade_entry')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3156c9] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-[#2749b0] hover:shadow-md dark:bg-[#3156c9] dark:hover:bg-[#3979e6]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            بدء رصد الدرجات
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Six colorful KPI cards inspired by the Absence dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.action)}
            className={`group relative flex min-h-[116px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} p-3.5 text-right text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-[#111c2a]`}
          >
            <span className="absolute -bottom-7 -left-5 h-20 w-20 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-125" />
            <div className="relative flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/90">{card.label}</span>
              <span className="rounded-lg bg-white/15 p-1.5 text-white">{card.icon}</span>
            </div>
            <div className="relative text-2xl font-black tracking-tight sm:text-3xl" dir="auto">
              {typeof card.value === 'number' ? card.value.toLocaleString('en-US') : card.value}
            </div>
            <span className="relative text-[10px] font-semibold text-white/85">{card.detail}</span>
          </button>
        ))}
      </div>

      {/* Main analytics area: class completion and two donut charts */}
      <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-12">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d3b4d] dark:bg-[#1c2939] dark:shadow-[0_8px_24px_rgba(0,0,0,0.16)] 2xl:col-span-8">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-[#2d3b4d] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-[#173c68] dark:text-[#60a5fa]"><Layers className="h-5 w-5" /></span>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">متابعة اكتمال رصد الدرجات حسب الصفوف</h2>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-[#a8b5c7]">اختر الفصل الدراسي لمتابعة الإنجاز</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={expandAll} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-[#34465d] dark:bg-[#26364b] dark:text-slate-300 dark:hover:bg-[#31445d]">توسيع الكل</button>
              <button type="button" onClick={collapseAll} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-[#34465d] dark:bg-[#26364b] dark:text-slate-300 dark:hover:bg-[#31445d]">طي الكل</button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {(Object.keys(STAGE_LABELS) as GradeStage[]).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedStage(stage)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors ${selectedStage === stage ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-400 dark:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#26364b] dark:text-slate-300 dark:hover:bg-[#31445d]'}`}
              >
                {STAGE_LABELS[stage]}
              </button>
            ))}
          </div>

          {hierarchyStats.classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-xs text-slate-500 dark:border-[#34465d] dark:text-slate-400">
              لا توجد صفوف دراسية مسجلة في العام الدراسي الحالي.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {hierarchyStats.classes.map((classItem, index) => {
                const isExpanded = expandedClassIds.has(classItem.schoolClass.id);
                const accent = ['bg-emerald-600 dark:bg-emerald-400', 'bg-blue-600 dark:bg-[#2785f5]', 'bg-violet-600 dark:bg-violet-400', 'bg-teal-600 dark:bg-teal-400'][index % 4];
                const statusTone = classItem.status === 'مكتمل'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-[#10b981]/12 dark:text-[#34d399]'
                  : classItem.status === 'قيد الإنجاز'
                    ? 'bg-amber-50 text-amber-700 dark:bg-[#d69b42]/15 dark:text-[#fbbf24]'
                    : classItem.status === 'غير مكتمل'
                      ? 'bg-rose-50 text-rose-700 dark:bg-[#e35d6a]/15 dark:text-[#fb7185]'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#26364b] dark:text-slate-400';

                return (
                  <div key={classItem.schoolClass.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-[#34465d] dark:bg-[#111c2a]">
                    <button
                      type="button"
                      onClick={() => toggleClass(classItem.schoolClass.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full flex-col gap-3 p-3 text-right transition-colors hover:bg-slate-100 dark:hover:bg-[#26364b] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${accent}`}><GraduationCap className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100">{classItem.schoolClass.name}</span>
                            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 dark:bg-teal-500/15 dark:text-[#60a5fa]">{classItem.schoolClass.stage}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-[#a8b5c7]">
                            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3 text-amber-500" />{classItem.totalSections} شعبة</span>
                            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-sky-500" />{classItem.totalStudents} طالب</span>
                            <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3 text-violet-500" />{classItem.totalSubjects} مادة</span>
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 sm:min-w-[190px]">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between text-[10px]">
                            <span className={`font-black ${classItem.percent === 100 ? 'text-emerald-600 dark:text-[#34d399]' : classItem.percent > 0 ? 'text-amber-600 dark:text-[#fbbf24]' : 'text-slate-500'}`}>{classItem.percent}%</span>
                            <span className="text-slate-500 dark:text-[#a8b5c7]">اكتمال الرصد</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#35465c]">
                            <div className={`h-full rounded-full transition-all ${classItem.percent === 100 ? 'bg-[#10b981]' : classItem.percent > 0 ? 'bg-[#d69b42]' : 'bg-slate-400'}`} style={{ width: `${classItem.percent}%` }} />
                          </div>
                        </div>
                        <span className={`hidden rounded-full px-2.5 py-1 text-[9px] font-bold sm:inline-flex ${statusTone}`}>{classItem.status}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-[#34d399]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 p-3 dark:border-[#34465d]">
                        {classItem.sections.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-500 dark:text-[#a8b5c7]">لا توجد شعب مسجلة لهذا الصف.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                            {classItem.sections.map((sectionItem) => {
                              const sectionKey = `${classItem.schoolClass.id}_${sectionItem.section.id}`;
                              const sectionExpanded = expandedSectionKeys.has(sectionKey);
                              const sectionTone = sectionItem.status === 'مكتمل'
                                ? 'text-emerald-700 dark:text-[#34d399]'
                                : sectionItem.status === 'قيد الإنجاز'
                                  ? 'text-amber-700 dark:text-[#fbbf24]'
                                  : sectionItem.status === 'غير مكتمل'
                                    ? 'text-rose-700 dark:text-[#fb7185]'
                                    : 'text-slate-500 dark:text-[#a8b5c7]';

                              return (
                                <div key={sectionItem.section.id || 'no-section'} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#34465d] dark:bg-[#1c2939]">
                                  <button
                                    type="button"
                                    onClick={() => toggleSection(classItem.schoolClass.id, sectionItem.section.id)}
                                    aria-expanded={sectionExpanded}
                                    className="flex w-full items-center gap-2.5 p-3 text-right transition-colors hover:bg-slate-50 dark:hover:bg-[#26364b]"
                                  >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${sectionExpanded ? 'bg-[#3156c9] text-white dark:bg-[#3156c9] dark:text-white' : 'bg-slate-100 text-slate-700 dark:bg-[#26364b] dark:text-slate-200'}`}>{sectionItem.section.name}</span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-xs font-black text-slate-900 dark:text-slate-100">الشعبة {sectionItem.section.name}</span>
                                      <span className="mt-1 block text-[10px] text-slate-500 dark:text-[#a8b5c7]">{sectionItem.studentsCount} طالب · {sectionItem.completedSubjectsCount} من {sectionItem.totalSubjects} مواد مكتملة</span>
                                    </span>
                                    <span className={`text-xs font-black ${sectionTone}`}>{sectionItem.percent}%</span>
                                    {sectionExpanded ? <ChevronUp className="h-4 w-4 text-emerald-600" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                  </button>

                                  {sectionExpanded && (
                                    <div className="border-t border-slate-200 dark:border-[#34465d]">
                                      {sectionItem.subjects.length === 0 ? (
                                        <p className="p-4 text-center text-[10px] text-slate-500 dark:text-[#a8b5c7]">لا توجد مواد مضافة لهذا الصف.</p>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full min-w-[330px] text-right text-[10px]">
                                            <thead className="bg-slate-50 text-slate-500 dark:bg-[#26364b] dark:text-slate-400">
                                              <tr>
                                                <th className="px-3 py-2 font-bold">المادة</th>
                                                <th className="px-2 py-2 text-center font-bold">الرصد</th>
                                                <th className="px-3 py-2 text-left font-bold">الإنجاز</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                              {sectionItem.subjects.map((subjectItem) => (
                                                <tr
                                                  key={subjectItem.subject.id}
                                                  onClick={() => onNavigate('grade_entry')}
                                                  className="cursor-pointer transition-colors hover:bg-emerald-50/70 dark:hover:bg-blue-500/10"
                                                  title="الانتقال إلى شاشة رصد الدرجات"
                                                >
                                                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{subjectItem.subject.name}</td>
                                                  <td className="px-2 py-2 text-center">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 font-bold ${subjectItem.isComplete ? 'bg-emerald-50 text-emerald-700 dark:bg-[#10b981]/12 dark:text-[#34d399]' : subjectItem.enteredCount > 0 ? 'bg-amber-50 text-amber-700 dark:bg-[#d69b42]/15 dark:text-[#fbbf24]' : 'bg-rose-50 text-rose-700 dark:bg-[#e35d6a]/15 dark:text-[#fb7185]'}`}>
                                                      {subjectItem.isComplete ? 'مكتمل' : subjectItem.enteredCount > 0 ? 'قيد الرصد' : 'غير مكتمل'}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <div className="flex items-center justify-end gap-2">
                                                      <span className="font-mono font-bold text-slate-600 dark:text-slate-300" dir="ltr">{subjectItem.percent}%</span>
                                                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-[#35465c]">
                                                        <span className={`block h-full rounded-full ${subjectItem.isComplete ? 'bg-[#10b981]' : subjectItem.enteredCount > 0 ? 'bg-[#d69b42]' : 'bg-[#e35d6a]'}`} style={{ width: `${subjectItem.percent}%` }} />
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
                                        className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-3 py-2 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-[#2d3b4d] dark:text-[#34d399] dark:hover:bg-blue-500/10"
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
            primaryColor="#0DCA9A"
            secondaryColor="#E91E63"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <DonutChart
            title="حالة المواد الدراسية"
            subtitle="على مستوى الصفوف والشعب"
            value={hierarchyStats.completedCount}
            total={hierarchyStats.totalSectionSubjectPairs}
            primaryLabel="مواد مكتملة"
            secondaryLabel="مواد غير مكتملة"
            primaryColor="#2387F5"
            secondaryColor="#F59E0B"
            icon={<PieChart className="h-5 w-5" />}
            valueLabel={`${hierarchyStats.completedCount}/${hierarchyStats.totalSectionSubjectPairs}`}
          />
        </div>
      </div>
    </div>
  );
};
