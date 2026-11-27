import React, { useState, useMemo } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  GradeStage,
  AppSettings,
} from '../../types';
import { db, buildGradeKey } from '../../services/storage';
import { authService } from '../../services/auth';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import { StageSelector } from './StageSelector';
import { GradeTable } from './GradeTable';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Info,
  Layers,
  Calendar,
  BookOpen,
  Users,
} from 'lucide-react';

interface GradeEntryViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
  onNavigateToReports?: () => void;
}

export const GradeEntryView: React.FC<GradeEntryViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
  onNavigateToReports,
}) => {
  // 1. Sequential selection states
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  // Synchronize selectedClassId when availableClasses changes
  React.useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  const availableSections = useMemo(
    () => sections.filter((s) => s.classId === selectedClassId),
    [sections, selectedClassId]
  );

  const displayedSections = useMemo(() => {
    if (availableSections.length > 0) return availableSections;
    // If class has no sections, return a "No Section" entry with ID ''
    return [{ id: '', name: 'بدون شعبة', classId: selectedClassId }];
  }, [availableSections, selectedClassId]);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    displayedSections[0]?.id ?? ''
  );

  // Sync selection when class/displayedSections change
  React.useEffect(() => {
    if (displayedSections.length > 0) {
      if (!displayedSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(displayedSections[0].id);
      }
    } else if (selectedSectionId !== '') {
      setSelectedSectionId('');
    }
  }, [displayedSections, selectedSectionId]);

  const [selectedStage, setSelectedStage] = useState<GradeStage>('term1');

  const availableSubjects = useMemo(
    () =>
      subjects
        .filter((sub) => sub.classId === selectedClassId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [subjects, selectedClassId]
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    availableSubjects[0]?.id || ''
  );

  // Sync subject if class changes
  React.useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.some((sub) => sub.id === selectedSubjectId)) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Current active subject & section details
  const activeClass = classes.find((c) => c.id === selectedClassId);
  const activeSection = sections.find((s) => s.id === selectedSectionId);
  const activeSubject = subjects.find((sub) => sub.id === selectedSubjectId);

  // Students in this section
  const sectionStudents = useMemo(() => {
    return students
      .filter(
        (s) =>
          s.classId === selectedClassId &&
          (s.sectionId || '') === selectedSectionId &&
          s.academicYearId === selectedYearId
      )
      .sort((a, b) => a.seatNumber - b.seatNumber);
  }, [students, selectedClassId, selectedSectionId, selectedYearId]);

  // Grade records for this specific combination
  const currentGradesMap = useMemo(() => {
    const map: Record<string, GradeRecord> = {};
    sectionStudents.forEach((student) => {
      const key = buildGradeKey(
        selectedYearId,
        selectedClassId,
        selectedSectionId,
        selectedSubjectId,
        student.id
      );
      if (grades[key]) {
        map[key] = grades[key];
      }
    });
    return map;
  }, [grades, selectedYearId, selectedClassId, selectedSectionId, selectedSubjectId, sectionStudents]);

  // Calculate completeness for current stage
  const completionStats = useMemo(() => {
    const total = sectionStudents.length;
    if (total === 0) return { entered: 0, missing: 0, total: 0, percentage: 0, isComplete: false };

    let entered = 0;
    sectionStudents.forEach((student) => {
      const key = buildGradeKey(
        selectedYearId,
        selectedClassId,
        selectedSectionId,
        selectedSubjectId,
        student.id
      );
      const rec = grades[key];
      if (rec) {
        if (selectedStage === 'term1' && rec.term1Score !== null) entered++;
        else if (selectedStage === 'midterm' && rec.midtermScore !== null) entered++;
        else if (selectedStage === 'term2' && rec.term2Score !== null) entered++;
        else if (selectedStage === 'final' && rec.finalExamScore !== null) entered++;
        else if (selectedStage === 'second_round' && rec.secondRoundScore !== null) entered++;
      }
    });

    const missing = total - entered;
    const percentage = Math.round((entered / total) * 100);
    return {
      entered,
      missing,
      total,
      percentage,
      isComplete: missing === 0,
    };
  }, [sectionStudents, grades, selectedStage, selectedYearId, selectedClassId, selectedSectionId, selectedSubjectId]);

  // Handle grade saving
  const handleSaveGrade = async (
    studentId: string,
    field: 'term1Score' | 'midtermScore' | 'term2Score' | 'finalExamScore' | 'secondRoundScore',
    fieldArabic: string,
    value: number | null
  ) => {
    return await db.saveGradeField(
      selectedYearId,
      selectedClassId,
      selectedSectionId,
      selectedSubjectId,
      studentId,
      field,
      fieldArabic,
      value
    );
  };

  // Export current table view to CSV
  const handleExportCSV = () => {
    if (sectionStudents.length === 0) return;

    let headers = ['الرقم', 'اسم الطالب', 'درجة الفصل الأول'];
    if (selectedStage === 'midterm' || selectedStage === 'term2' || selectedStage === 'final' || selectedStage === 'second_round') {
      headers.push('درجة نصف السنة');
    }
    if (selectedStage === 'term2' || selectedStage === 'final' || selectedStage === 'second_round') {
      headers.push('درجة الفصل الثاني', 'درجة السعي السنوي');
    }
    if (selectedStage === 'final' || selectedStage === 'second_round') {
      headers.push('درجة الامتحان النهائي', 'الدرجة النهائية');
    }
    if (selectedStage === 'second_round') {
      headers.push('درجة الإكمال (الدور الثاني)', 'الدرجة النهائية بعد الإكمال');
    }

    const rows = sectionStudents.map((s, idx) => {
      const key = buildGradeKey(
        selectedYearId,
        selectedClassId,
        selectedSectionId,
        selectedSubjectId,
        s.id
      );
      const rec = grades[key];
      const row = [
        (idx + 1).toString(),
        `"${s.name}"`,
        rec?.term1Score !== null && rec?.term1Score !== undefined ? rec.term1Score.toString() : '',
      ];

      if (selectedStage === 'midterm' || selectedStage === 'term2' || selectedStage === 'final' || selectedStage === 'second_round') {
        row.push(rec?.midtermScore !== null && rec?.midtermScore !== undefined ? rec.midtermScore.toString() : '');
      }
      if (selectedStage === 'term2' || selectedStage === 'final' || selectedStage === 'second_round') {
        row.push(
          rec?.term2Score !== null && rec?.term2Score !== undefined ? rec.term2Score.toString() : '',
          rec?.termYearlyScore !== null && rec?.termYearlyScore !== undefined ? rec.termYearlyScore.toString() : ''
        );
      }
      if (selectedStage === 'final' || selectedStage === 'second_round') {
        row.push(
          rec?.finalExamScore !== null && rec?.finalExamScore !== undefined ? rec.finalExamScore.toString() : '',
          rec?.finalScore !== null && rec?.finalScore !== undefined ? rec.finalScore.toString() : ''
        );
      }
      if (selectedStage === 'second_round') {
        row.push(
          rec?.secondRoundScore !== null && rec?.secondRoundScore !== undefined ? rec.secondRoundScore.toString() : '',
          rec?.secondRoundFinalScore !== null && rec?.secondRoundFinalScore !== undefined ? rec.secondRoundFinalScore.toString() : ''
        );
      }
      return row.join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `درجات_${activeClass?.name}_شعبة_${activeSection?.name}_مادة_${activeSubject?.name}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentRole = authService.getCurrentSession()?.user.role || 'user';
  const isReadOnly = currentRole === 'user';

  return (
    <div className="flex flex-col gap-3.5 pb-8">
      {isReadOnly && (
        <div className="p-3.5 rounded-2xl bg-[#D69B42]/10 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] text-xs sm:text-sm font-bold flex items-center gap-2.5 no-print shadow-sm">
          <Info className="w-5 h-5 text-[#B45309] dark:text-[#D69B42] shrink-0" />
          <span>وضع المعاينة للقراءة فقط (Read-Only) — يمكنك تصفح الدرجات والإحصائيات وتصدير التقارير بدون إمكانية إدخال أو تعديل الدرجات.</span>
        </div>
      )}

      {/* Compact title bar */}
      <div className="relative isolate overflow-hidden flex flex-col gap-3 rounded-[22px] border border-[#B9D1E8] bg-gradient-to-br from-[#FFFFFF] via-[#F1F7FF] to-[#E5F0FF] px-4 py-4 shadow-sm dark:border-[#344B64] dark:bg-gradient-to-br dark:from-[#1C2939] dark:via-[#1D3048] dark:to-[#14283D] dark:shadow-[0_12px_32px_rgba(0,0,0,0.24)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full border border-[#2785F5]/15 dark:border-[#60A5FA]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-5 -top-12 h-44 w-44 rounded-full border border-[#2785F5]/15 dark:border-[#60A5FA]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 h-56 w-56 rounded-full bg-[#2785F5]/10 dark:bg-[#60A5FA]/[0.08] blur-3xl" />
        <h1 className="relative z-10 text-xl font-black tracking-tight text-[#172B4D] dark:text-[#F1F5FC] sm:text-2xl">
          إدخال وتدقيق درجات الطلاب
        </h1>
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7E6CF] bg-[#E9F8F1] px-3 py-2 text-[11px] font-bold text-[#087A59] dark:border-[#246B58] dark:bg-[#123A34] dark:text-[#54D6A6]">
            <CheckCircle2 className="h-4 w-4" />
            حفظ لحظي مباشر
          </span>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D8E2F0] bg-[#F1F5FB] px-3 py-2 text-xs font-bold text-[#29466F] transition-colors hover:border-[#3156C9] hover:bg-[#E8EFFB] dark:border-[#34465F] dark:bg-[#202F45] dark:text-[#D9E6FA] dark:hover:border-[#6F94FF] dark:hover:bg-[#293B56] cursor-pointer"
            title="تصدير جدول الدرجات الحالي إلى ملف CSV / Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#0D9B75] dark:text-[#42C99A]" />
            <span>تصدير Excel/CSV</span>
          </button>
          {onNavigateToReports && (
            <button
              type="button"
              onClick={onNavigateToReports}
              className="inline-flex items-center gap-2 rounded-lg bg-[#315BD2] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#274DBB] dark:bg-[#386CE8] dark:hover:bg-[#4A7CF0] cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة الشيت الرسمي</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary selection panel: class, section and subject are the main focus */}
      <section className="relative isolate overflow-hidden rounded-[24px] border border-[#72B9D2] bg-gradient-to-br from-[#F1FBFF] via-[#EAF6FC] to-[#E2F0FA] p-4 shadow-[0_10px_30px_rgba(20,110,150,0.10)] ring-1 ring-[#2785F5]/10 dark:border-[#326B83] dark:from-[#142B3D] dark:via-[#153247] dark:to-[#14283D] dark:shadow-[0_12px_34px_rgba(0,0,0,0.24)] dark:ring-[#39A9D1]/15 sm:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-28 h-80 w-80 rounded-full border border-[#2785F5]/15 dark:border-[#60A5FA]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-4 -top-10 h-56 w-56 rounded-full border border-[#2785F5]/15 dark:border-[#60A5FA]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-6 h-64 w-64 rounded-full bg-[#2785F5]/10 dark:bg-[#60A5FA]/[0.08] blur-3xl" />
        <div className="relative z-10 mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#315BD2] text-white shadow-sm dark:bg-[#3975F2]">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-black text-[#19345F] dark:text-[#E7F0FF]">تحديد بيانات الرصد</h2>
              <p className="mt-0.5 text-[10px] font-medium text-[#647A9A] dark:text-[#9EB2D0]">اختر الصف والشعبة والمادة قبل إدخال الدرجات</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#C9D8F5] bg-white/80 px-3 py-1 text-[10px] font-bold text-[#3156C9] dark:border-[#36547E] dark:bg-[#1D304B] dark:text-[#9AB8FF] sm:inline-flex">
            بيانات الرصد الحالية
          </span>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
          {/* Academic Year - secondary emphasis */}
          <div className="rounded-xl border border-[#B7D2ED] bg-gradient-to-br from-[#EAF3FF] to-[#F7FAFF] p-3 shadow-sm dark:border-[#385B7C] dark:bg-gradient-to-br dark:from-[#1B3550] dark:to-[#1A2B40]">
            <label className="mb-2 flex items-center gap-2 text-xs font-bold text-[#64748B] dark:text-[#A8B8CE]">
              <Calendar className="h-4 w-4" />
              العام الدراسي
            </label>
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-[#E0E6EF] bg-white px-3 pl-9 text-sm font-bold text-[#334155] outline-none transition-colors focus:border-[#8AA5D8] dark:border-[#3A4A61] dark:bg-[#172235] dark:text-[#DCE6F5] dark:focus:border-[#7893C7] cursor-pointer"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '(الحالي)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#7B8DA8] dark:text-[#9AAAC2]" />
            </div>
          </div>
          {/* School Class */}
          <div className="rounded-xl border border-[#AFC5F5] bg-white/90 p-3 shadow-sm transition-all focus-within:border-[#315BD2] focus-within:ring-2 focus-within:ring-[#315BD2]/15 dark:border-[#3C5C89] dark:bg-[#1D304B] dark:focus-within:border-[#79A0FF] dark:focus-within:ring-[#79A0FF]/15">
            <label className="mb-2 flex items-center gap-2 text-xs font-black text-[#3156A6] dark:text-[#A9C3FF]">
              <Layers className="h-4 w-4" />
              الصف الدراسي
            </label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-[#D6E1F3] bg-[#F5F8FE] px-3 pl-9 text-sm font-black text-[#172B4D] outline-none transition-colors focus:border-[#315BD2] dark:border-[#3B5274] dark:bg-[#17263D] dark:text-[#F0F5FF] dark:focus:border-[#79A0FF] cursor-pointer"
              >
                {availableClasses.length === 0 ? (
                  <option value="">لا توجد صفوف مسجلة لهذا العام</option>
                ) : (
                  availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.stage})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#5272A8] dark:text-[#A9C3FF]" />
            </div>
          </div>

          {/* Section */}
          <div className="rounded-xl border border-[#B8DAD7] bg-white/90 p-3 shadow-sm transition-all focus-within:border-[#0D9488] focus-within:ring-2 focus-within:ring-[#0D9488]/15 dark:border-[#326C69] dark:bg-[#1B343D] dark:focus-within:border-[#4BC5B7] dark:focus-within:ring-[#4BC5B7]/15">
            <label className="mb-2 flex items-center gap-2 text-xs font-black text-[#087E78] dark:text-[#78DED3]">
              <Users className="h-4 w-4" />
              الشعبة
            </label>
            <div className="relative">
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-[#D3E8E5] bg-[#F2FAF9] px-3 pl-9 text-sm font-black text-[#164B4A] outline-none transition-colors focus:border-[#0D9488] dark:border-[#3A6968] dark:bg-[#172E36] dark:text-[#E4FFFC] dark:focus:border-[#4BC5B7] cursor-pointer"
              >
                {displayedSections.length === 0 ? (
                  <option value="">لا توجد شعب لهذا الصف</option>
                ) : (
                  displayedSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id === '' ? s.name : `الشعبة ${s.name}`}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#278E87] dark:text-[#78DED3]" />
            </div>
          </div>

          {/* Subject */}
          <div className="rounded-xl border border-[#8B5CF6] bg-gradient-to-br from-[#7C3AED] via-[#8B35D9] to-[#6D28D9] p-3 shadow-[0_8px_20px_rgba(124,58,237,0.24)] ring-1 ring-[#A78BFA]/35 transition-all focus-within:ring-2 focus-within:ring-[#C4B5FD]/60 dark:border-[#A78BFA] dark:from-[#6D28D9] dark:via-[#5B21B6] dark:to-[#4C1D95] dark:shadow-[0_8px_22px_rgba(0,0,0,0.3)]">
            <label className="mb-2 flex items-center gap-2 text-xs font-black text-white dark:text-white">
              <BookOpen className="h-4 w-4" />
              المادة الدراسية
            </label>
            <div className="relative">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-white/70 bg-white px-3 pl-9 text-sm font-black text-[#5521A8] outline-none transition-colors focus:border-white focus:ring-2 focus:ring-white/40 dark:border-[#C4B5FD] dark:bg-[#F5F0FF] dark:text-[#4C1D95] dark:focus:border-white cursor-pointer"
              >
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} (النهاية العظمى: {sub.maxScore})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#7C3AED] dark:text-[#6D28D9]" />
            </div>
          </div>

        </div>
      </section>

      {/* 4. Stage Selector (المرحلة الدراسية المطلوبة لإدخال الدرجات) */}
      <StageSelector
        currentStage={selectedStage}
        onChangeStage={(stage) => setSelectedStage(stage)}
      />

      {/* Status & Completeness Indicator Bar */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-[#F0FBF8] via-white to-[#E7F6F2] dark:from-[#15332F] dark:via-[#1C2939] dark:to-[#172F35] border border-[#B8DDD4] dark:border-[#326B65] rounded-[22px] p-4 shadow-sm dark:shadow-[0_10px_28px_rgba(0,0,0,0.20)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 h-52 w-52 rounded-full border border-[#0D9488]/15 dark:border-[#4BC5B7]/15" />
        {/* Status Indicator */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              completionStats.isComplete
                ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#059669] dark:text-[#10B981]'
                : 'bg-[#E35D6A]/10 border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]'
            }`}
          >
            {completionStats.isComplete ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                حالة الرصد: {completionStats.isComplete ? 'مكتمل بالكامل' : 'توجد درجات ناقصة'}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md font-bold font-mono tabular-nums border ${
                  completionStats.isComplete
                    ? 'bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] border-[#10B981]/30'
                    : 'bg-[#E35D6A]/10 text-[#C83D4B] dark:text-[#E35D6A] border-[#E35D6A]/30'
                }`}
              >
                {completionStats.percentage}%
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-0.5 font-medium">
              الدرجات المدخلة: <span className="text-[#059669] dark:text-[#10B981] font-bold font-mono tabular-nums">{completionStats.entered}</span> من أصل <span className="text-[#1E293B] dark:text-[#E2E8F0] font-bold font-mono tabular-nums">{completionStats.total}</span> طالباً ({completionStats.missing} غير مدخلة).
            </p>
          </div>
        </div>

        {/* Student Search Box */}
        <div className="relative z-10 flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع عن طالب بالاسم..."
              className="w-full h-10 pr-9 pl-4 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:border-[#2785F5] focus:outline-hidden"
            />
            <Search className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute right-3 top-3 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#64748B] hover:text-[#1E293B] dark:text-[#8493A8] dark:hover:text-white absolute left-3 top-3 cursor-pointer"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grade Table */}
      <GradeTable
        students={sectionStudents}
        grades={grades}
        currentStage={selectedStage}
        maxScore={activeSubject?.maxScore || 100}
        settings={settings}
        searchQuery={searchQuery}
        academicYearId={selectedYearId}
        classId={selectedClassId}
        sectionId={selectedSectionId}
        subjectId={selectedSubjectId}
        classSubjects={availableSubjects}
        onSaveGrade={handleSaveGrade}
      />
    </div>
  );
};
