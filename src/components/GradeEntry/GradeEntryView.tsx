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
  ArrowRight,
  Sparkles,
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
    <div className="flex flex-col gap-5 pb-12">
      {isReadOnly && (
        <div className="p-3.5 rounded-2xl bg-[#D69B42]/10 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] text-xs sm:text-sm font-bold flex items-center gap-2.5 no-print shadow-sm">
          <Info className="w-5 h-5 text-[#B45309] dark:text-[#D69B42] shrink-0" />
          <span>وضع المعاينة للقراءة فقط (Read-Only) — يمكنك تصفح الدرجات والإحصائيات وتصدير التقارير بدون إمكانية إدخال أو تعديل الدرجات.</span>
        </div>
      )}

      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1C2939] p-5 rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3156C9] dark:text-[#60A5FA]">
              <Sparkles className="w-3.5 h-3.5" />
              الواجهة الرئيسية للرصد السريع
            </span>
            <span className="text-[#64748B] dark:text-[#8493A8] text-xs" aria-hidden="true">·</span>
            <span className="text-[#64748B] dark:text-[#8493A8] text-xs">
              حفظ لحظي مباشر في قاعدة البيانات
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] tracking-tight">
            إدخال وتدقيق درجات الطلاب
          </h1>
          <p className="text-sm text-[#64748B] dark:text-[#8493A8] mt-1">
            نظام رصد تفاعلي يشبه Excel مع دعم الانتقال بـ Enter والأسهم، وحساب السعي والدرجة النهائية آلياً.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center gap-2 cursor-pointer transition-colors"
            title="تصدير جدول الدرجات الحالي إلى ملف CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />
            <span>تصدير Excel/CSV</span>
          </button>
          {onNavigateToReports && (
            <button
              type="button"
              onClick={onNavigateToReports}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الشيت الرسمي</span>
            </button>
          )}
        </div>
      </div>

      {/* Sequential Filter Selectors */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-3 flex items-center gap-2">
          <span>التسلسل المنطقي لتحديد سجل الدرجات المطلوب</span>
          <span className="text-[#64748B] dark:text-[#8493A8] font-normal">(1. العام ← 2. الصف ← 3. الشعبة ← 4. المرحلة ← 5. المادة)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Academic Year */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>1. العام الدراسي</span>
            </label>
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
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

          {/* 2. School Class */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>2. الصف الدراسي</span>
            </label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
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

          {/* 3. Section */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>3. الشعبة</span>
            </label>
            <div className="relative">
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
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
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 5. Subject */}
          <div>
            <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>5. المادة الدراسية</span>
            </label>
            <div className="relative">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full h-10 px-3 pr-3 pl-8 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
              >
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} (النهاية العظمى: {sub.maxScore})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Stage Selector (المرحلة الدراسية المطلوبة لإدخال الدرجات) */}
      <StageSelector
        currentStage={selectedStage}
        onChangeStage={(stage) => setSelectedStage(stage)}
      />

      {/* Status & Completeness Indicator Bar */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Indicator */}
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3 w-full md:w-auto">
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

      {/* Red Cell Clarification & Keyboard Shortcuts Tip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#E35D6A]/10 border border-[#E35D6A]/25 rounded-xl p-3 flex items-center gap-3 text-xs text-[#C83D4B] dark:text-[#E35D6A]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong>تنبيه الخانات الحمراء:</strong> الخانة الحمراء تعني أن الدرجة لم تُدخل بعد، ولا تُعتبر صفراً ولا تدخل في حساب السعي أو النهائي حتى يتم رصدها.
          </span>
        </div>

        <div className="bg-white dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-3 flex items-center gap-3 text-xs text-[#475569] dark:text-[#A8B5C7]">
          <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA] shrink-0" />
          <span>
            <strong>طريقة الإدخال السريع:</strong> اضغط <kbd className="px-1.5 py-0.5 bg-[#EDF1F7] dark:bg-[#26364B] rounded text-[#3156C9] dark:text-[#60A5FA] font-mono border border-[#DCE3ED] dark:border-[#2D3B4D]">Enter</kbd> للحفظ والانتقال إلى الطالب التالي، أو <kbd className="px-1.5 py-0.5 bg-[#EDF1F7] dark:bg-[#26364B] rounded text-[#3156C9] dark:text-[#60A5FA] font-mono border border-[#DCE3ED] dark:border-[#2D3B4D]">Tab</kbd> للانتقال أفقياً إلى حقل الدرجة التالي؛ و<kbd className="px-1.5 py-0.5 bg-[#EDF1F7] dark:bg-[#26364B] rounded text-[#3156C9] dark:text-[#60A5FA] font-mono border border-[#DCE3ED] dark:border-[#2D3B4D]">Shift + Tab</kbd> للرجوع للحقل السابق.
          </span>
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
