import React, { useState, useMemo } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  StudentComprehensiveEvaluation,
} from '../../types';
import { db, buildGradeKey } from '../../services/storage';
import { evaluateStudentAcademicYearDecisions } from '../../services/calculations';
import * as XLSX from 'xlsx';
import {
  ArrowRightLeft,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

interface StudentPromotionViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
  onNavigateToStudents?: () => void;
}

export const StudentPromotionView: React.FC<StudentPromotionViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
  onNavigateToStudents,
}) => {
  // 1. Select Source Academic Year (Default to current or first year)
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [sourceYearId, setSourceYearId] = useState<string>(currentYear?.id || '');

  // Select Target Academic Year (Default to another year if available or blank)
  const otherYears = academicYears.filter((y) => y.id !== sourceYearId);
  const [targetYearId, setTargetYearId] = useState<string>(otherYears[0]?.id || '');

  // Modal to add a new academic year inline if needed
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [addYearError, setAddYearError] = useState<string | null>(null);

  // Class Mapping State: key: sourceClassId -> targetClassId ('graduated' or classId)
  const [classMappings, setClassMappings] = useState<Record<string, string>>({});

  // Section Mapping State: key: `${sourceClassId}_${sourceSectionId}` -> targetSectionId
  const [sectionMappings, setSectionMappings] = useState<Record<string, string>>({});

  // Search and Filter query in Preview Table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'promote' | 'repeat' | 'graduate' | 'exclude' | 'migrated'>('all');

  // Confirmation Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-initialize default class mappings based on class order/sequence
  React.useEffect(() => {
    const sortedClasses = [...classes].sort((a, b) => a.order - b.order);
    const initialClassMap: Record<string, string> = {};

    sortedClasses.forEach((cls, idx) => {
      // Default higher class is the next class in sequence if available, otherwise 'graduated'
      if (idx < sortedClasses.length - 1) {
        initialClassMap[cls.id] = sortedClasses[idx + 1].id;
      } else {
        initialClassMap[cls.id] = 'graduated';
      }
    });

    setClassMappings(initialClassMap);
  }, [classes]);

  // Handle adding new academic year inline
  const handleCreateAcademicYear = () => {
    if (!newYearName.trim()) {
      setAddYearError('اسم العام الدراسي مطلوب.');
      return;
    }

    const res = db.addAcademicYear({
      name: newYearName.trim(),
      isCurrent: false,
    });

    if (res.success && res.year) {
      setTargetYearId(res.year.id);
      setIsAddYearModalOpen(false);
      setNewYearName('');
      setAddYearError(null);
      setFeedbackMessage({
        type: 'success',
        text: `تم إنشاء العام الدراسي الجديد «${res.year.name}» بنجاح وتعيينه كجهة للترحيل.`,
      });
    } else {
      setAddYearError(res.message || 'حدث خطأ أثناء إضافة العام الدراسي.');
    }
  };

  // Get decision settings for source year
  const decisionSettings = useMemo(() => {
    return db.getDecisionSettings(sourceYearId);
  }, [sourceYearId]);

  // Source Year Students
  const sourceYearStudents = useMemo(() => {
    return students.filter((s) => s.academicYearId === sourceYearId);
  }, [students, sourceYearId]);

  // Target Year Students (to detect duplicates)
  const targetYearStudents = useMemo(() => {
    return students.filter((s) => s.academicYearId === targetYearId);
  }, [students, targetYearId]);

  // Compute student evaluation & promotion preview item
  const promotionCandidates = useMemo(() => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      return [];
    }

    const decisionGrants = db.getDecisionGrants();

    return sourceYearStudents.map((student) => {
      const sourceClass = classes.find((c) => c.id === student.classId);
      const sourceSection = sections.find((s) => s.id === student.sectionId);

      // Get subjects for student's class
      const classSubjects = subjects
        .filter((s) => s.classId === student.classId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Get student grades by subject
      const studentGradesBySubject: Record<string, GradeRecord | undefined> = {};
      classSubjects.forEach((sub) => {
        const k = buildGradeKey(sourceYearId, student.classId, student.sectionId, sub.id, student.id);
        studentGradesBySubject[sub.id] = grades[k];
      });

      // Comprehensive evaluation using official engine & saved decisions
      const evaluation: StudentComprehensiveEvaluation = evaluateStudentAcademicYearDecisions(
        student,
        classSubjects,
        studentGradesBySubject,
        decisionSettings,
        settings.roundingRule,
        decisionGrants
      );

      const statusFinal = evaluation.statusFinal;

      // Determine Target Class & Section
      let action: 'promote' | 'repeat' | 'graduate' | 'exclude' = 'exclude';
      let targetClassId: string | null = null;
      let targetSectionId: string = '';
      let reason: string = '';

      if (statusFinal === 'ناجح' || statusFinal === 'ناجح — إعفاء عام') {
        const mappedTargetClass = classMappings[student.classId];
        if (mappedTargetClass && mappedTargetClass !== 'graduated') {
          action = 'promote';
          targetClassId = mappedTargetClass;
          reason = 'ناجح في التقييم النهائي مستحق للترقية إلى الصف الأعلى';
        } else {
          action = 'graduate';
          targetClassId = null;
          reason = 'طالب خريج في الصف النهائي (لا يوجد صف أعلى)';
        }
      } else if (statusFinal === 'راسب') {
        action = 'repeat';
        targetClassId = student.classId; // Repeats same class in target year
        reason = 'راسب في التقييم النهائي (يُسجّل معيداً في الصف نفسه)';
      } else {
        action = 'exclude';
        targetClassId = null;
        reason = statusFinal === 'مكمّل'
          ? 'طالب مكمّل في امتحانات الدور الثاني ولم تُحسم نتيجته بعد'
          : 'نتائج الطالب غير مكتملة ولم يتوفر تقييم نهائي حاسم';
      }

      // Determine Target Section
      if (targetClassId) {
        const secMappingKey = `${student.classId}_${student.sectionId}`;
        const userMappedSection = sectionMappings[secMappingKey];

        if (userMappedSection) {
          targetSectionId = userMappedSection;
        } else {
          // Auto suggest matching section name in target class
          const targetClassSections = sections.filter((s) => s.classId === targetClassId);
          const matchingNameSec = targetClassSections.find(
            (s) => s.name.trim().toLowerCase() === sourceSection?.name.trim().toLowerCase()
          );
          targetSectionId = matchingNameSec ? matchingNameSec.id : (targetClassSections[0]?.id || '');
        }
      }

      // Check if student is ALREADY migrated to target year
      const cleanReg = student.registrationNumber?.trim();
      const cleanName = student.name.trim().toLowerCase();
      const cleanPhone = student.fatherPhone?.trim();

      const isAlreadyMigrated = targetYearStudents.some((s) => {
        if (cleanReg && s.registrationNumber && s.registrationNumber.trim() === cleanReg) {
          return true;
        }
        if (s.name.trim().toLowerCase() === cleanName) {
          if (cleanPhone && s.fatherPhone && s.fatherPhone.trim() === cleanPhone) {
            return true;
          }
          if (s.classId === targetClassId) {
            return true;
          }
        }
        return false;
      });

      return {
        student,
        evaluation,
        statusFinal,
        sourceClass,
        sourceSection,
        action,
        targetClassId,
        targetSectionId,
        reason,
        isAlreadyMigrated,
      };
    });
  }, [
    sourceYearStudents,
    targetYearStudents,
    sourceYearId,
    targetYearId,
    classes,
    sections,
    subjects,
    grades,
    decisionSettings,
    settings.roundingRule,
    classMappings,
    sectionMappings,
  ]);

  // Filter preview list
  const filteredCandidates = useMemo(() => {
    return promotionCandidates.filter((item) => {
      if (statusFilter === 'promote' && item.action !== 'promote') return false;
      if (statusFilter === 'repeat' && item.action !== 'repeat') return false;
      if (statusFilter === 'graduate' && item.action !== 'graduate') return false;
      if (statusFilter === 'exclude' && item.action !== 'exclude') return false;
      if (statusFilter === 'migrated' && !item.isAlreadyMigrated) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.student.name.toLowerCase().includes(q) ||
          (item.student.registrationNumber && item.student.registrationNumber.includes(q))
        );
      }
      return true;
    });
  }, [promotionCandidates, statusFilter, searchQuery]);

  // KPI Summary Statistics
  const stats = useMemo(() => {
    const total = promotionCandidates.length;
    const promoted = promotionCandidates.filter((c) => c.action === 'promote').length;
    const repeating = promotionCandidates.filter((c) => c.action === 'repeat').length;
    const graduated = promotionCandidates.filter((c) => c.action === 'graduate').length;
    const excluded = promotionCandidates.filter((c) => c.action === 'exclude').length;
    const alreadyMigrated = promotionCandidates.filter((c) => c.isAlreadyMigrated).length;
    const pendingToMigrate = promotionCandidates.filter(
      (c) => (c.action === 'promote' || c.action === 'repeat') && !c.isAlreadyMigrated
    ).length;

    return {
      total,
      promoted,
      repeating,
      graduated,
      excluded,
      alreadyMigrated,
      pendingToMigrate,
    };
  }, [promotionCandidates]);

  // Execute promotion
  const handleExecutePromotion = () => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى اختيار عامين دراسيين مختلفين للترحيل.',
      });
      return;
    }

    const payload = promotionCandidates.map((item) => ({
      sourceStudentId: item.student.id,
      studentName: item.student.name,
      registrationNumber: item.student.registrationNumber,
      fatherPhone: item.student.fatherPhone,
      nationalId: item.student.nationalId,
      gender: item.student.gender,
      notes: item.student.notes,
      targetClassId: item.targetClassId,
      targetSectionId: item.targetSectionId,
      action: item.action,
      reason: item.reason,
    }));

    const res = db.executeStudentPromotion({
      sourceYearId,
      targetYearId,
      promotions: payload,
      executedBy: 'مدير المدرسة',
    });

    setIsConfirmModalOpen(false);

    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: res.message,
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.message,
      });
    }
  };

  // Export promotion preview report to Excel
  const handleExportExcel = () => {
    const sourceYearObj = academicYears.find((y) => y.id === sourceYearId);
    const targetYearObj = academicYears.find((y) => y.id === targetYearId);

    const rows = promotionCandidates.map((item, idx) => {
      const targetClassObj = classes.find((c) => c.id === item.targetClassId);
      const targetSecObj = sections.find((s) => s.id === item.targetSectionId);

      let actionText = '';
      if (item.action === 'promote') actionText = 'ترقية إلى الصف الأعلى';
      else if (item.action === 'repeat') actionText = 'إعادة في الصف نفسه';
      else if (item.action === 'graduate') actionText = 'خريج (تخرج)';
      else actionText = 'مستبعد (نتيجة غير مكتملة)';

      return {
        'ت': idx + 1,
        'رقم القيد': item.student.registrationNumber || '—',
        'اسم الطالب': item.student.name,
        'الصف الحالي': item.sourceClass?.name || '—',
        'الشعبة الحالية': item.sourceSection?.name || '—',
        'النتيجة النهائية': item.statusFinal,
        'الإجراء المستحق': actionText,
        'الصف الجديد': targetClassObj?.name || (item.action === 'graduate' ? 'خريج' : '—'),
        'الشعبة الجديدة': targetSecObj?.name || '—',
        'سبب المسار': item.reason,
        'حالة الترحيل': item.isAlreadyMigrated ? 'مُرحّل مسبقاً' : 'جاهز للترحيل',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير ترحيل الطلبة');
    XLSX.writeFile(
      wb,
      `تقرير_ترحيل_الطلبة_${sourceYearObj?.name || ''}_إلى_${targetYearObj?.name || ''}.xlsx`
    );
  };

  const sourceYearObj = academicYears.find((y) => y.id === sourceYearId);
  const targetYearObj = academicYears.find((y) => y.id === targetYearId);

  // Distinct classes in source year that have students
  const sourceClasses = useMemo(() => {
    const classIdsWithStudents = new Set(sourceYearStudents.map((s) => s.classId));
    return classes
      .filter((c) => classIdsWithStudents.has(c.id))
      .sort((a, b) => a.order - b.order);
  }, [classes, sourceYearStudents]);

  return (
    <div className="w-full flex flex-col gap-6 pb-16" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <span>ترحيل الطلبة وترقيتهم للأعوام الدراسية</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                نظام حماية السجلات التاريخية
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              نقل الطلبة الناجحين والراسبين والخريجين إلى العام الدراسي الجديد بناءً على تقييم النتائج والقرارات الوزارية المعتمدة، مع الاحتفاظ ببيانات السجلات القديمة بالكامل دون تعديلها.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير معاينة Excel</span>
          </button>
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
          <div className="flex items-center gap-2.5 text-sm font-bold">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 1: Academic Years Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
            ١
          </div>
          <h2 className="text-base font-bold text-slate-100">تحديد الأعوام الدراسية (المصدر والوجهة)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Source Academic Year */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>1. العام الدراسي المنصرم (المصدر)</span>
            </label>
            <select
              value={sourceYearId}
              onChange={(e) => setSourceYearId(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-emerald-500 focus:outline-none"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? '(العام الحالي)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Direction Arrow */}
          <div className="hidden lg:flex items-center justify-center pb-2 text-emerald-400">
            <ArrowRightLeft className="w-6 h-6" />
          </div>

          {/* Target Academic Year */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>2. العام الدراسي الجديد (الوجهة)</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(true)}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إنشاء عام جديد</span>
              </button>
            </div>

            <select
              value={targetYearId}
              onChange={(e) => setTargetYearId(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-emerald-500 focus:outline-none"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id} disabled={y.id === sourceYearId}>
                  {y.name} {y.id === sourceYearId ? '(غير مسموح - نفس العام)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {sourceYearId === targetYearId && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              تنبيه: لا يمكن اختيار نفس العام الدراسي كعام مصدر وعام وجهة للترحيل. يرجى اختيار عام دراسي جديد للترحيل إليه أو إنشاء عام جديد.
            </span>
          </div>
        )}
      </div>

      {/* STEP 2: Class & Section Transition Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
              ٢
            </div>
            <h2 className="text-base font-bold text-slate-100">تحديد انتقالات الصفوف والشعب للعام الجديد</h2>
          </div>
          <span className="text-xs text-slate-400">
            حدد الصف الوجهة للناجحين في كل مرحلة (أما الراسبون فيُسجلون كـ معيدين في الصف نفسه آلياً)
          </span>
        </div>

        {sourceClasses.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            لا يوجد طلاب مسجلون في العام الدراسي المصدر المختار.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sourceClasses.map((cls) => {
              const currentMappedTarget = classMappings[cls.id] || 'graduated';
              const classSections = sections.filter((s) => s.classId === cls.id);

              return (
                <div
                  key={cls.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>{cls.name} ({cls.stage})</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      عدد الطلاب: {sourceYearStudents.filter((s) => s.classId === cls.id).length}
                    </span>
                  </div>

                  {/* Target Class Selector for Passed Students */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>الناجحون: ينقلون إلى الصف الوجهة التالي:</span>
                    </label>
                    <select
                      value={currentMappedTarget}
                      onChange={(e) => {
                        const val = e.target.value;
                        setClassMappings((prev) => ({ ...prev, [cls.id]: val }));
                      }}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-none"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.stage})
                        </option>
                      ))}
                      <option value="graduated">🎓 خريجون / لا يوجد صف أعلى (تخرج المرحلة)</option>
                    </select>
                  </div>

                  {/* Failed Students Rule Notice */}
                  <div className="text-[11px] text-amber-400/90 font-mono bg-amber-950/20 p-2 rounded-lg border border-amber-900/30">
                    الراسبون: يُسجلون تلقائياً كـ (معيدين) في الصف نفسه ({cls.name}) للعام الجديد.
                  </div>

                  {/* Section Mappings */}
                  {currentMappedTarget !== 'graduated' && classSections.length > 0 && (
                    <div className="pt-2 border-t border-slate-850 flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-slate-400">توزيع الشعب في الصف الوجهة:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {classSections.map((sec) => {
                          const secKey = `${cls.id}_${sec.id}`;
                          const targetClassSections = sections.filter((s) => s.classId === currentMappedTarget);
                          const matchingSec = targetClassSections.find(
                            (s) => s.name.trim().toLowerCase() === sec.name.trim().toLowerCase()
                          );
                          const currentMappedSec = sectionMappings[secKey] || (matchingSec ? matchingSec.id : targetClassSections[0]?.id || '');

                          return (
                            <div key={sec.id} className="flex items-center justify-between text-xs bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <span className="font-bold text-slate-300">شعبة ({sec.name}) ←</span>
                              <select
                                value={currentMappedSec}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSectionMappings((prev) => ({ ...prev, [secKey]: v }));
                                }}
                                className="h-7 px-2 bg-slate-950 border border-slate-700 rounded text-[11px] font-bold text-slate-200"
                              >
                                {targetClassSections.map((ts) => (
                                  <option key={ts.id} value={ts.id}>
                                    شعبة {ts.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">إجمالي طلاب العام</span>
          <span className="text-xl font-bold font-mono text-white mt-1">{stats.total}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">المترقون (ناجحون)</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.promoted}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">المعيدون (راسبون)</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.repeating}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">الخريجون</span>
          <span className="text-xl font-bold font-mono text-cyan-400 mt-1">{stats.graduated}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">المستبعدون (غير مكتمل)</span>
          <span className="text-xl font-bold font-mono text-rose-400 mt-1">{stats.excluded}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">مُرحّلون مسبقاً</span>
          <span className="text-xl font-bold font-mono text-purple-400 mt-1">{stats.alreadyMigrated}</span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/40 p-3 rounded-xl flex flex-col bg-emerald-950/20">
          <span className="text-[11px] text-emerald-300 font-bold">المتوقع ترحيلهم الآن</span>
          <span className="text-xl font-black font-mono text-emerald-400 mt-1">{stats.pendingToMigrate}</span>
        </div>
      </div>

      {/* STEP 3: Preview Table Toolbar & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
              ٣
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">معاينة قائمة الترحيل الشاملة قبل التنفيذ</h2>
              <p className="text-xs text-slate-400">
                يمكنك مراجعة كافة الانتقالات والقرارات للطلاب قبل الضغط على زر التأكيد
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={stats.pendingToMigrate === 0 || sourceYearId === targetYearId}
            onClick={() => setIsConfirmModalOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GraduationCap className="w-4 h-4" />
            <span>تأكيد وتنفيذ عملية الترحيل ({stats.pendingToMigrate} طالب)</span>
          </button>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'all' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              الكل ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('promote')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'promote' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-emerald-400 hover:bg-slate-800'
              }`}
            >
              الترقية ({stats.promoted})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('repeat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'repeat' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-amber-400 hover:bg-slate-800'
              }`}
            >
              المعيدون ({stats.repeating})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('graduate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'graduate' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-cyan-400 hover:bg-slate-800'
              }`}
            >
              الخريجون ({stats.graduated})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('exclude')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'exclude' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-rose-400 hover:bg-slate-800'
              }`}
            >
              المستبعدون ({stats.excluded})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('migrated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'migrated' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-purple-400 hover:bg-slate-800'
              }`}
            >
              مُرحّلون مسبقاً ({stats.alreadyMigrated})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم الطالب أو رقم القيد..."
              className="w-full h-9 pr-8 pl-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-right border-collapse text-xs select-none">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 font-bold">
                <th className="p-3 text-center w-12 border-l border-slate-800">ت</th>
                <th className="p-3 border-l border-slate-800 min-w-[200px]">اسم الطالب ورقم القيد</th>
                <th className="p-3 border-l border-slate-800 text-center">النتيجة الرسمية</th>
                <th className="p-3 border-l border-slate-800 text-center min-w-[140px]">الصف والشعبة الحالية</th>
                <th className="p-3 border-l border-slate-800 text-center">الإجراء المستحق</th>
                <th className="p-3 border-l border-slate-800 text-center min-w-[160px]">الصف والشعبة الجديدة</th>
                <th className="p-3 text-center min-w-[120px]">حالة الترحيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    لا توجد سجلات مطابقة للفلتر أو البحث المحدد.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((item, idx) => {
                  const targetClassObj = classes.find((c) => c.id === item.targetClassId);
                  const targetSecObj = sections.find((s) => s.id === item.targetSectionId);

                  return (
                    <tr key={item.student.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-2.5 text-center font-mono text-slate-400 border-l border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 border-l border-slate-800">
                        <div className="font-bold text-slate-200">{item.student.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          قيد: {item.student.registrationNumber || `#${item.student.seatNumber}`}
                        </div>
                      </td>
                      <td className="p-2.5 text-center border-l border-slate-800">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.statusFinal === 'ناجح' || item.statusFinal === 'ناجح — إعفاء عام'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : item.statusFinal === 'راسب'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {item.statusFinal}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-300 border-l border-slate-800">
                        {item.sourceClass?.name} ({item.sourceSection?.name})
                      </td>
                      <td className="p-2.5 text-center border-l border-slate-800">
                        {item.action === 'promote' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ترقية إلى الصف الأعلى</span>
                          </span>
                        )}
                        {item.action === 'repeat' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>إعادة في الصف نفسه</span>
                          </span>
                        )}
                        {item.action === 'graduate' && (
                          <span className="inline-flex items-center gap-1 text-cyan-400 font-bold">
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>خريج (تخرج)</span>
                          </span>
                        )}
                        {item.action === 'exclude' && (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold" title={item.reason}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>مستبعد (نتيجة غير مكتملة)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono border-l border-slate-800">
                        {item.targetClassId ? (
                          <span className="text-slate-200 font-bold">
                            {targetClassObj?.name} {targetSecObj ? `(${targetSecObj.name})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-sans">
                            {item.action === 'graduate' ? 'خريج' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.isAlreadyMigrated ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            مُرحّل مسبقاً
                          </span>
                        ) : item.action === 'promote' || item.action === 'repeat' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            جاهز للترحيل
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                            مستبعد
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">تأكيد عملية ترحيل الطلبة</h3>
                  <p className="text-xs text-slate-400">الرجاء المراجعة النهائية قبل الحفظ التلقائي</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
              <div className="flex justify-between pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">العام الدراسي المصدر:</span>
                <span className="font-bold text-slate-100 font-sans">{sourceYearObj?.name}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">العام الدراسي الجديد الوجهة:</span>
                <span className="font-bold text-emerald-400 font-sans">{targetYearObj?.name}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">الطلاب المستحقون للترقية:</span>
                <span className="font-bold text-emerald-400">{stats.promoted} طالب</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">الطلاب المعيدون (الراسبون):</span>
                <span className="font-bold text-amber-400">{stats.repeating} طالب</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-sans">الطلاب الخريجون:</span>
                <span className="font-bold text-cyan-400">{stats.graduated} طالب</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">إجمالي الانتسابات الجديدة التي ستُنشأ:</span>
                <span className="font-black text-emerald-300 text-sm">{stats.pendingToMigrate} طالب</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                سيتم إنشاء انتسابات جديدة تماماً للطلاب في العام الجديد مع الاحتفاظ التام بكافة السجلات والدرجات والتقارير التاريخية للعام الماضي دون أي تغيير.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecutePromotion}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                تأكيد وتنفيذ الترحيل الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inline Add Academic Year */}
      {isAddYearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>إنشاء عام دراسي جديد للترحيل</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddYearModalOpen(false);
                  setAddYearError(null);
                }}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">اسم العام الدراسي الجديد (مثال: 2027–2028)</label>
              <input
                type="text"
                value={newYearName}
                onChange={(e) => {
                  setNewYearName(e.target.value);
                  if (addYearError) setAddYearError(null);
                }}
                placeholder="2027–2028"
                className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              {addYearError && <span className="text-xs text-rose-400 font-bold">{addYearError}</span>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateAcademicYear}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                إنشاء العام الدراسي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
