import React, { useState, useMemo } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
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
  TrendingUp,
  FileSpreadsheet,
  ArrowLeft,
  ShieldCheck,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  FolderOpen,
  Sparkles,
} from 'lucide-react';

interface DashboardViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
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
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const defaultYearId = currentYear?.id || '';

  // Filter classes, sections, and students strictly for active academic year
  const activeClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, currentYear?.id, defaultYearId);
  }, [classes, currentYear?.id, defaultYearId]);

  const activeClassIdSet = useMemo(() => new Set(activeClasses.map((c) => c.id)), [activeClasses]);

  const activeSections = useMemo(() => {
    return filterSectionsByClassIds(sections, activeClassIdSet);
  }, [sections, activeClassIdSet]);

  const activeStudents = useMemo(() => {
    return filterStudentsByAcademicYear(students, currentYear?.id);
  }, [students, currentYear?.id]);

  // Selected stage for completion monitoring (default: term1)
  const [selectedStage, setSelectedStage] = useState<GradeStage>('term1');

  // Track expanded classes (Set of classId)
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(() => {
    // Expand the first class by default for immediate visual feedback
    const firstClass = [...activeClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    return new Set(firstClass ? [firstClass.id] : []);
  });

  // Track expanded sections (Set of `${classId}_${sectionId}`)
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<Set<string>>(() => {
    // Expand the first section of the first class by default
    const sortedCls = [...activeClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (sortedCls.length > 0) {
      const firstSec = activeSections.filter((s) => s.classId === sortedCls[0].id)[0];
      if (firstSec) {
        return new Set([`${sortedCls[0].id}_${firstSec.id}`]);
      }
    }
    return new Set();
  });

  const toggleClass = (classId: string) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const toggleSection = (classId: string, sectionId: string) => {
    const key = `${classId}_${sectionId}`;
    setExpandedSectionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClassIds(new Set(activeClasses.map((c) => c.id)));
    const allSecKeys = new Set<string>();
    activeClasses.forEach((c) => {
      activeSections
        .filter((s) => s.classId === c.id)
        .forEach((s) => allSecKeys.add(`${c.id}_${s.id}`));
    });
    setExpandedSectionKeys(allSecKeys);
  };

  const collapseAll = () => {
    setExpandedClassIds(new Set());
    setExpandedSectionKeys(new Set());
  };

  // Comprehensive Hierarchical Completion Stats: Classes -> Sections -> Subjects
  const hierarchyStats = useMemo(() => {
    // 1. Sort active classes strictly according to the approved academic order
    const sortedClasses = [...activeClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let totalSectionSubjectPairs = 0;
    let completedSectionSubjectPairs = 0;
    let totalGradeSlotsExpected = 0;
    let totalGradeSlotsEntered = 0;

    const classStats = sortedClasses.map((schoolClass) => {
      // 2. Sections in this class (preserving registered order)
      const realSections = activeSections.filter((s) => s.classId === schoolClass.id);
      const classSections = realSections.length > 0 
        ? realSections 
        : [{ id: '', name: 'بدون شعبة', classId: schoolClass.id } as Section];

      // 3. Subjects in this class strictly ordered by order field
      const classSubjects = subjects
        .filter((sub) => sub.classId === schoolClass.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Students in this class for the active academic year
      const classStudents = activeStudents.filter(
        (s) => s.classId === schoolClass.id
      );

      let classExpectedSlots = 0;
      let classEnteredSlots = 0;
      let classCompletedSubjectsCount = 0;
      let classTotalSubjectsCount = 0;

      const sectionDetails = classSections.map((section) => {
        // Students strictly belonging to this section
        const sectionStudents = classStudents.filter((s) => s.sectionId === section.id);
        const studentsCount = sectionStudents.length;

        let sectionCompletedSubjects = 0;
        let sectionEnteredSlots = 0;
        const sectionExpectedSlots = studentsCount * classSubjects.length;

        const subjectDetails = classSubjects.map((sub) => {
          totalSectionSubjectPairs++;
          classTotalSubjectsCount++;

          let enteredCount = 0;
          sectionStudents.forEach((stu) => {
            const key = buildGradeKey(
              currentYear?.id || '',
              schoolClass.id,
              section.id,
              sub.id,
              stu.id
            );
            const rec = grades[key];
            if (rec) {
              if (selectedStage === 'term1' && rec.term1Score !== null) enteredCount++;
              else if (selectedStage === 'midterm' && rec.midtermScore !== null) enteredCount++;
              else if (selectedStage === 'term2' && rec.term2Score !== null) enteredCount++;
              else if (selectedStage === 'final' && rec.finalExamScore !== null) enteredCount++;
            }
          });

          // A subject is complete ONLY if there are students and ALL students have their grades entered
          const isComplete = studentsCount > 0 && enteredCount === studentsCount;
          if (isComplete) {
            sectionCompletedSubjects++;
            completedSectionSubjectPairs++;
            classCompletedSubjectsCount++;
          }
          sectionEnteredSlots += enteredCount;

          const percent = studentsCount > 0 ? Math.round((enteredCount / studentsCount) * 100) : 0;

          let status: 'مكتمل' | 'قيد الإنجاز' | 'غير مكتمل' | 'لا يوجد طلاب';
          if (studentsCount === 0) {
            status = 'لا يوجد طلاب';
          } else if (isComplete) {
            status = 'مكتمل';
          } else if (enteredCount > 0) {
            status = 'قيد الإنجاز';
          } else {
            status = 'غير مكتمل';
          }

          return {
            subject: sub,
            studentsCount,
            enteredCount,
            isComplete,
            percent,
            status,
          };
        });

        classExpectedSlots += sectionExpectedSlots;
        classEnteredSlots += sectionEnteredSlots;

        const sectionPercent =
          sectionExpectedSlots > 0
            ? Math.round((sectionEnteredSlots / sectionExpectedSlots) * 100)
            : 0;

        let sectionStatus: 'مكتمل' | 'قيد الإنجاز' | 'غير مكتمل' | 'لا توجد بيانات';
        if (studentsCount === 0 || classSubjects.length === 0) {
          sectionStatus = 'لا توجد بيانات';
        } else if (sectionEnteredSlots === sectionExpectedSlots) {
          sectionStatus = 'مكتمل';
        } else if (sectionEnteredSlots > 0) {
          sectionStatus = 'قيد الإنجاز';
        } else {
          sectionStatus = 'غير مكتمل';
        }

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

      const classPercent =
        classExpectedSlots > 0
          ? Math.round((classEnteredSlots / classExpectedSlots) * 100)
          : 0;

      let classStatus: 'مكتمل' | 'قيد الإنجاز' | 'غير مكتمل' | 'لا توجد بيانات';
      if (classExpectedSlots === 0) {
        classStatus = 'لا توجد بيانات';
      } else if (classEnteredSlots === classExpectedSlots) {
        classStatus = 'مكتمل';
      } else if (classEnteredSlots > 0) {
        classStatus = 'قيد الإنجاز';
      } else {
        classStatus = 'غير مكتمل';
      }

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

    const pendingSectionSubjectPairs = Math.max(
      0,
      totalSectionSubjectPairs - completedSectionSubjectPairs
    );
    const overallPercent =
      totalGradeSlotsExpected > 0
        ? Math.round((totalGradeSlotsEntered / totalGradeSlotsExpected) * 100)
        : 0;

    return {
      classes: classStats,
      totalSectionSubjectPairs,
      completedCount: completedSectionSubjectPairs,
      pendingCount: pendingSectionSubjectPairs,
      overallPercent,
    };
  }, [activeClasses, activeSections, subjects, activeStudents, grades, currentYear, selectedStage]);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              نظام إدارة الدرجات المدرسية الداخلي
            </span>
            <span className="text-slate-400 text-xs flex items-center gap-1 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              يعمل 100% بدون اتصال بالإنترنت
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">
            {settings.schoolName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            العام الدراسي النشط: <span className="text-white font-bold">{currentYear?.name || 'غير محدد'}</span> — مدير المدرسة: <span className="text-slate-200">{settings.directorName}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('grade_entry')}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>بدء رصد الدرجات الآن</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Main KPI Stat Cards (Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Academic Years */}
        <div
          onClick={() => onNavigate('years')}
          className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-slate-850 group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">العام الحالي</span>
            <Calendar className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black text-white font-mono">
            {currentYear?.name || '2026–2027'}
          </div>
          <span className="text-[11px] text-blue-400 mt-1 flex items-center gap-1">
            إدارة الأعوام ←
          </span>
        </div>

        {/* Classes */}
        <div
          onClick={() => onNavigate('classes')}
          className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-slate-850 group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">عدد الصفوف</span>
            <Layers className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {activeClasses.length}
          </div>
          <span className="text-[11px] text-teal-400 mt-1 flex items-center gap-1">
            إدارة الصفوف ←
          </span>
        </div>

        {/* Sections */}
        <div
          onClick={() => onNavigate('classes')}
          className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-slate-850 group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">عدد الشعب</span>
            <Layers className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {activeSections.length}
          </div>
          <span className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
            عرض الشعب ←
          </span>
        </div>

        {/* Students */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-slate-850 group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">عدد الطلاب</span>
            <Users className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {activeStudents.length}
          </div>
          <span className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1">
            سجل الطلاب ←
          </span>
        </div>

        {/* Completed Subjects */}
        <div
          onClick={() => onNavigate('grade_entry')}
          className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-slate-850 group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400">مواد مكتملة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {hierarchyStats.completedCount}
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            مكتملة الرصد
          </span>
        </div>

        {/* Pending Subjects */}
        <div
          onClick={() => onNavigate('grade_entry')}
          className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-slate-850 group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-400">درجات ناقصة</span>
            <AlertCircle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            {hierarchyStats.pendingCount}
          </div>
          <span className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
            تحتاج استكمال ←
          </span>
        </div>
      </div>

      {/* Organized Section: Grade Entry Completion Status (Hierarchical: Classes -> Sections -> Subjects) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
        {/* Section Header with Stage Tabs & Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>حالة اكتمال رصد المواد الدراسية</span>
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {STAGE_LABELS[selectedStage]}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تسلسل هرمي منظم: انقر على بطاقة الصف لعرض شعبه، وانقر على الشعبة لعرض موادها بدقة
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stage Selector Pills */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(Object.keys(STAGE_LABELS) as GradeStage[]).map((stageKey) => (
                <button
                  key={stageKey}
                  type="button"
                  onClick={() => setSelectedStage(stageKey)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedStage === stageKey
                      ? 'bg-emerald-600 text-slate-950 shadow-sm font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {STAGE_LABELS[stageKey]}
                </button>
              ))}
            </div>

            {/* Expand / Collapse All Helpers */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                title="توسيع كافة الصفوف والشعب"
              >
                توسيع الكل
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                title="طي كافة الصفوف والشعب"
              >
                طي الكل
              </button>
            </div>

            {/* Quick Link to Grade Entry */}
            <button
              type="button"
              onClick={() => onNavigate('grade_entry')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer mr-auto lg:mr-0"
            >
              <span>فتح شاشة الرصد</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Classes List (Strict sequence according to official curriculum order) */}
        {hierarchyStats.classes.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            لا توجد صفوف دراسية مسجلة حالياً في النظام.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {hierarchyStats.classes.map((clsItem) => {
              const isClassExpanded = expandedClassIds.has(clsItem.schoolClass.id);

              return (
                <div
                  key={clsItem.schoolClass.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all"
                >
                  {/* 1. Class Header Card (Clickable to Expand / Collapse) */}
                  <div
                    onClick={() => toggleClass(clsItem.schoolClass.id)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/60 transition-colors select-none"
                  >
                    {/* Class Info */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
                        aria-label={isClassExpanded ? 'طي الصف' : 'توسيع الصف'}
                      >
                        {isClassExpanded ? (
                          <ChevronUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base sm:text-lg font-black text-white">
                            {clsItem.schoolClass.name}
                          </h4>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-teal-300 border border-teal-500/20">
                            {clsItem.schoolClass.stage}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            <span>{clsItem.totalSections} شعب</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{clsItem.totalStudents} طالباً</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                            <span>{clsItem.totalSubjects} مواد</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress & Status Pill */}
                    <div className="flex items-center gap-4 self-end md:self-center">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">نسبة اكتمال الصف:</span>
                          <span
                            className={`font-mono font-black text-sm ${
                              clsItem.percent === 100
                                ? 'text-emerald-400'
                                : clsItem.percent > 0
                                ? 'text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {clsItem.percent}%
                          </span>
                        </div>
                        {/* Mini visual progress bar for class */}
                        <div className="w-28 sm:w-36 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              clsItem.percent === 100
                                ? 'bg-emerald-500'
                                : clsItem.percent > 0
                                ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                                : 'bg-slate-700'
                            }`}
                            style={{ width: `${clsItem.percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Class Status Badge */}
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${
                          clsItem.status === 'مكتمل'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : clsItem.status === 'قيد الإنجاز'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : clsItem.status === 'غير مكتمل'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {clsItem.status === 'مكتمل' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {clsItem.status === 'قيد الإنجاز' && (
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        {clsItem.status === 'غير مكتمل' && (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{clsItem.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* 2. Sections Container inside Opened Class */}
                  {isClassExpanded && (
                    <div className="border-t border-slate-800/80 p-4 sm:p-5 bg-slate-900/30 flex flex-col gap-4">
                      {clsItem.sections.length === 0 ? (
                        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                          لا توجد شعب مسجلة لهذا الصف حالياً.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3.5">
                          {clsItem.sections.map((secItem) => {
                            const sectionKey = `${clsItem.schoolClass.id}_${secItem.section.id}`;
                            const isSectionExpanded = expandedSectionKeys.has(sectionKey);

                            return (
                              <div
                                key={secItem.section.id}
                                className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xs hover:border-slate-700 transition-all"
                              >
                                {/* Section Card Header (Clickable to toggle its subjects) */}
                                <div
                                  onClick={() =>
                                    toggleSection(clsItem.schoolClass.id, secItem.section.id)
                                  }
                                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
                                >
                                  {/* Section Identity & Count */}
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs font-bold transition-colors shrink-0 ${
                                        isSectionExpanded
                                          ? 'bg-[#60CDFF]/15 text-[#60CDFF] border-[#60CDFF]/30'
                                          : 'bg-slate-800 text-slate-400 border-slate-700'
                                      }`}
                                    >
                                      {secItem.section.name}
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h5 className="font-bold text-sm text-slate-100">
                                          الشعبة {secItem.section.name}
                                        </h5>
                                        <span className="text-xs text-slate-400 font-mono">
                                          ({secItem.studentsCount} طالباً)
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        المواد المكتملة:{' '}
                                        <strong className="text-slate-200 font-mono">
                                          {secItem.completedSubjectsCount}
                                        </strong>{' '}
                                        من{' '}
                                        <span className="font-mono">{secItem.totalSubjects}</span> مواد
                                      </p>
                                    </div>
                                  </div>

                                  {/* Progress bar & Percent & Status */}
                                  <div className="flex items-center gap-3 self-end lg:self-center">
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-400">اكتمال الشعبة:</span>
                                        <span
                                          className={`font-mono font-bold ${
                                            secItem.percent === 100
                                              ? 'text-emerald-400'
                                              : secItem.percent > 0
                                              ? 'text-amber-300'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          {secItem.percent}%
                                        </span>
                                      </div>

                                      {/* Visual progress bar */}
                                      <div className="w-24 sm:w-32 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                        <div
                                          className={`h-full transition-all duration-300 rounded-full ${
                                            secItem.percent === 100
                                              ? 'bg-emerald-500'
                                              : secItem.percent > 0
                                              ? 'bg-amber-500'
                                              : 'bg-slate-700'
                                          }`}
                                          style={{ width: `${secItem.percent}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Section Status Badge */}
                                    <span
                                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                                        secItem.status === 'مكتمل'
                                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                          : secItem.status === 'قيد الإنجاز'
                                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                          : secItem.status === 'غير مكتمل'
                                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                          : 'bg-slate-800 text-slate-400 border-slate-700'
                                      }`}
                                    >
                                      {secItem.status === 'مكتمل' && (
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      )}
                                      {secItem.status === 'قيد الإنجاز' && (
                                        <Clock className="w-3 h-3" />
                                      )}
                                      {secItem.status === 'غير مكتمل' && (
                                        <AlertCircle className="w-3 h-3" />
                                      )}
                                      <span>{secItem.status}</span>
                                    </span>

                                    {/* Toggle Chevron */}
                                    <button
                                      type="button"
                                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 p-1"
                                      aria-label={isSectionExpanded ? 'إخفاء المواد' : 'عرض المواد'}
                                    >
                                      {isSectionExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-[#60CDFF]" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* 3. Subjects Grid inside Opened Section */}
                                {isSectionExpanded && (
                                  <div className="bg-slate-950/80 border-t border-slate-800/80 p-4">
                                    <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
                                      <span className="flex items-center gap-1.5 font-medium">
                                        <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                                        <span>مواد الشعبة ({secItem.subjects.length} مادة مرتبة بالتسلسل المعتمد)</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onNavigate('grade_entry');
                                        }}
                                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                                      >
                                        <span>رصد درجات الشعبة</span>
                                        <ArrowLeft className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {secItem.subjects.length === 0 ? (
                                      <div className="py-6 text-center text-slate-500 text-xs">
                                        لا توجد مواد دراسية مضافة لهذا الصف.
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {secItem.subjects.map((subItem) => {
                                          return (
                                            <div
                                              key={subItem.subject.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onNavigate('grade_entry');
                                              }}
                                              className="bg-slate-900 border border-slate-800/90 hover:border-slate-700 p-3 rounded-xl flex flex-col justify-between gap-2.5 transition-all hover:bg-slate-850/80 cursor-pointer group"
                                              title="انقر للانتقال المباشر لرصد هذه المادة"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div>
                                                  <h6 className="font-bold text-xs sm:text-sm text-slate-200 group-hover:text-white transition-colors">
                                                    {subItem.subject.name}
                                                  </h6>
                                                  <span className="text-[10px] text-slate-500 font-mono">
                                                    تسلسل المادة: #{subItem.subject.order}
                                                  </span>
                                                </div>

                                                <span
                                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                                                    subItem.isComplete
                                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                      : subItem.enteredCount > 0
                                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                                  }`}
                                                >
                                                  {subItem.isComplete ? 'مكتمل' : 'غير مكتمل'}
                                                </span>
                                              </div>

                                              <div>
                                                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                                                  <span>
                                                    {subItem.enteredCount} من {subItem.studentsCount} طالباً
                                                  </span>
                                                  <span
                                                    className={`font-bold ${
                                                      subItem.isComplete
                                                        ? 'text-emerald-400'
                                                        : subItem.enteredCount > 0
                                                        ? 'text-amber-300'
                                                        : 'text-slate-400'
                                                    }`}
                                                  >
                                                    {subItem.percent}%
                                                  </span>
                                                </div>

                                                {/* Micro Progress Bar */}
                                                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                                  <div
                                                    className={`h-full transition-all duration-300 rounded-full ${
                                                      subItem.isComplete
                                                        ? 'bg-emerald-500'
                                                        : subItem.enteredCount > 0
                                                        ? 'bg-amber-500'
                                                        : 'bg-rose-500/60'
                                                    }`}
                                                    style={{ width: `${subItem.percent}%` }}
                                                  />
                                                </div>
                                              </div>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
