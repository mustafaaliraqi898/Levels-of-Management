import React, { useState, useMemo, useEffect } from 'react';
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
  FileSpreadsheet,
  GraduationCap,
  RotateCcw,
  Check,
  X,
  Shuffle,
  Sliders,
  CheckSquare,
  Square,
  ArrowRight,
  ShieldCheck,
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

export type DistributionMethod = 'manual' | 'auto_balanced';

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
  // 1. Source Academic Year Selection
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [sourceYearId, setSourceYearId] = useState<string>(currentYear?.id || '');

  // 2. Target Academic Year Selection
  const otherYears = academicYears.filter((y) => y.id !== sourceYearId);
  const [targetYearId, setTargetYearId] = useState<string>(otherYears[0]?.id || '');

  // Modal to add a new academic year inline
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [addYearError, setAddYearError] = useState<string | null>(null);

  // 3. Source Class Selection (الصف الحالي)
  const availableSourceClasses = useMemo(() => {
    return [...classes].sort((a, b) => a.order - b.order);
  }, [classes]);

  const [sourceClassId, setSourceClassId] = useState<string>(availableSourceClasses[0]?.id || '');

  // Available sections for the source class
  const availableSourceSections = useMemo(() => {
    return sections.filter((s) => s.classId === sourceClassId);
  }, [sections, sourceClassId]);

  // Selected source sections (الشعب الحالية التي ستُرحّل منها قوائم الطلاب)
  const [selectedSourceSectionIds, setSelectedSourceSectionIds] = useState<string[]>([]);

  // Auto-select all sections of the source class whenever source class changes
  useEffect(() => {
    if (availableSourceSections.length > 0) {
      setSelectedSourceSectionIds(availableSourceSections.map((s) => s.id));
    } else {
      setSelectedSourceSectionIds([]);
    }
  }, [availableSourceSections, sourceClassId]);

  // 4. Target Class Selection (الصف الذي سينتقل إليه الطلاب)
  // Default to the next class in sequence or 'graduated'
  const [targetClassId, setTargetClassId] = useState<string>('');

  useEffect(() => {
    if (!sourceClassId) return;
    const sorted = [...classes].sort((a, b) => a.order - b.order);
    const currIdx = sorted.findIndex((c) => c.id === sourceClassId);
    if (currIdx >= 0 && currIdx < sorted.length - 1) {
      setTargetClassId(sorted[currIdx + 1].id);
    } else {
      setTargetClassId('graduated');
    }
  }, [sourceClassId, classes]);

  // Available sections for the target class (الشعب المتاحة في الصف الجديد)
  const availableTargetSections = useMemo(() => {
    if (!targetClassId || targetClassId === 'graduated') return [];
    return sections.filter((s) => s.classId === targetClassId);
  }, [sections, targetClassId]);

  // Selected target sections that will receive students
  const [selectedTargetSectionIds, setSelectedTargetSectionIds] = useState<string[]>([]);

  // Auto-select all available target sections whenever target class changes
  useEffect(() => {
    if (availableTargetSections.length > 0) {
      setSelectedTargetSectionIds(availableTargetSections.map((s) => s.id));
    } else {
      setSelectedTargetSectionIds([]);
    }
  }, [availableTargetSections, targetClassId]);

  // Modal to add a new section to the target class inline
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addSectionError, setAddSectionError] = useState<string | null>(null);

  // 5. Distribution Method: 'manual' (توزيع يدوي) or 'auto_balanced' (توزيع تلقائي متوازن)
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('auto_balanced');

  // Student Section Assignments map: studentId -> targetSectionId
  const [studentTargetSections, setStudentTargetSections] = useState<Record<string, string>>({});

  // Option: Include failing students as repeaters in the current class in target year
  const [includeFailingAsRepeaters, setIncludeFailingAsRepeaters] = useState<boolean>(false);

  // Search & Filter in list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'promote' | 'repeat' | 'exclude' | 'migrated'>('all');

  // Review & Confirmation Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get decision settings & exemption settings for source year
  const decisionSettings = useMemo(() => {
    return db.getDecisionSettings(sourceYearId);
  }, [sourceYearId]);

  const exemptionSettings = useMemo(() => {
    return db.getExemptionSettings(sourceYearId);
  }, [sourceYearId]);

  // All students of source year
  const sourceYearStudents = useMemo(() => {
    return students.filter((s) => s.academicYearId === sourceYearId);
  }, [students, sourceYearId]);

  // Target Year Students (to detect duplicates)
  const targetYearStudents = useMemo(() => {
    return students.filter((s) => s.academicYearId === targetYearId);
  }, [students, targetYearId]);

  // Filter students belonging to selected source class and selected source sections
  const selectedScopeStudents = useMemo(() => {
    if (!sourceClassId) return [];
    return sourceYearStudents.filter((s) => {
      if (s.classId !== sourceClassId) return false;
      if (selectedSourceSectionIds.length > 0) {
        return selectedSourceSectionIds.includes(s.sectionId);
      }
      return true;
    });
  }, [sourceYearStudents, sourceClassId, selectedSourceSectionIds]);

  // Subjects of the source class
  const sourceClassSubjects = useMemo(() => {
    return subjects
      .filter((s) => s.classId === sourceClassId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [subjects, sourceClassId]);

  // Evaluate each candidate student in the selected scope
  const candidates = useMemo(() => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      return [];
    }

    const decisionGrants = db.getDecisionGrants();

    return selectedScopeStudents.map((student) => {
      const sourceClass = classes.find((c) => c.id === student.classId);
      const sourceSection = sections.find((s) => s.id === student.sectionId);

      // Student grades map for evaluation
      const studentGradesBySubject: Record<string, GradeRecord | undefined> = {};
      sourceClassSubjects.forEach((sub) => {
        const k = buildGradeKey(sourceYearId, student.classId, student.sectionId, sub.id, student.id);
        studentGradesBySubject[sub.id] = grades[k];
      });

      // Comprehensive evaluation using official engine
      const evaluation: StudentComprehensiveEvaluation = evaluateStudentAcademicYearDecisions(
        student,
        sourceClassSubjects,
        studentGradesBySubject,
        decisionSettings,
        settings.roundingRule,
        decisionGrants,
        exemptionSettings
      );

      const statusFinal = evaluation.statusFinal;

      // Determine Eligibility & Action
      let action: 'promote' | 'repeat' | 'graduate' | 'exclude' = 'exclude';
      let reason: string = '';
      let assignedTargetClassId: string | null = null;

      const isPassingOrExempt =
        statusFinal === 'ناجح' ||
        statusFinal === 'ناجح — إعفاء عام' ||
        statusFinal === 'معفى عام';

      if (isPassingOrExempt) {
        if (targetClassId && targetClassId !== 'graduated') {
          action = 'promote';
          assignedTargetClassId = targetClassId;
          reason =
            statusFinal === 'معفى عام'
              ? 'مستحق للترقية إلى الصف الأعلى (معفى عام)'
              : 'مستحق للترقية إلى الصف الأعلى (ناجح بالتقييم النهائي)';
        } else {
          action = 'graduate';
          assignedTargetClassId = null;
          reason = 'خريج (الصف النهائي للمرحلة / لا يوجد صف أعلى)';
        }
      } else if (statusFinal === 'راسب') {
        if (includeFailingAsRepeaters) {
          action = 'repeat';
          assignedTargetClassId = student.classId; // Repeats same class in the new year
          reason = 'راسب في التقييم النهائي (يُسجّل كمعيد في الصف نفسه)';
        } else {
          action = 'exclude';
          assignedTargetClassId = null;
          reason = 'راسب (غير مستحق للترقية إلى الصف الأعلى)';
        }
      } else if (statusFinal === 'مكمّل') {
        action = 'exclude';
        assignedTargetClassId = null;
        reason = 'مكمّل (بانتظار حسم امتحانات الدور الثاني ولا يُرحل الآن)';
      } else {
        action = 'exclude';
        assignedTargetClassId = null;
        reason = 'غير مكتمل (درجات الطالب ناقصة ولم تُحسم نتيجته)';
      }

      // Check for already migrated
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
          if (assignedTargetClassId && s.classId === assignedTargetClassId) {
            return true;
          }
        }
        return false;
      });

      return {
        student,
        evaluation,
        statusFinal,
        isPassingOrExempt,
        sourceClass,
        sourceSection,
        action,
        reason,
        assignedTargetClassId,
        isAlreadyMigrated,
      };
    });
  }, [
    selectedScopeStudents,
    sourceYearId,
    targetYearId,
    targetClassId,
    classes,
    sections,
    sourceClassSubjects,
    grades,
    decisionSettings,
    settings.roundingRule,
    exemptionSettings,
    targetYearStudents,
    includeFailingAsRepeaters,
  ]);

  // Candidates who are eligible for promotion (action === 'promote' and not already migrated)
  const eligiblePromoteCandidates = useMemo(() => {
    return candidates.filter((c) => c.action === 'promote' && !c.isAlreadyMigrated);
  }, [candidates]);

  // Active target sections available for distribution
  const activeTargetSections = useMemo(() => {
    if (selectedTargetSectionIds.length === 0) return availableTargetSections;
    return availableTargetSections.filter((s) => selectedTargetSectionIds.includes(s.id));
  }, [availableTargetSections, selectedTargetSectionIds]);

  // Balanced Automatic Distribution Algorithm
  const executeBalancedDistribution = React.useCallback(() => {
    if (activeTargetSections.length === 0 || eligiblePromoteCandidates.length === 0) {
      return;
    }

    const assignments: Record<string, string> = {};
    const numSections = activeTargetSections.length;

    // Distribute students evenly in a round-robin balanced fashion
    eligiblePromoteCandidates.forEach((item, index) => {
      const sectionIndex = index % numSections;
      const targetSec = activeTargetSections[sectionIndex];
      assignments[item.student.id] = targetSec.id;
    });

    setStudentTargetSections((prev) => ({
      ...prev,
      ...assignments,
    }));

    setFeedbackMessage({
      type: 'success',
      text: `تم تنفيذ التوزيع التلقائي المتوازن بنجاح لعدد ${eligiblePromoteCandidates.length} طالب على ${numSections} شُعب جديدة بأعداد متقاربة. يمكنك مراجعة وتعديل أي شعبة يدوياً قبل الاعتماد.`,
    });
  }, [activeTargetSections, eligiblePromoteCandidates]);

  // Auto-run balanced distribution when target sections or eligible candidates change if currently in auto_balanced mode
  useEffect(() => {
    if (distributionMethod === 'auto_balanced' && activeTargetSections.length > 0 && eligiblePromoteCandidates.length > 0) {
      // Check if assignments already exist for all eligible students
      const hasMissing = eligiblePromoteCandidates.some((c) => !studentTargetSections[c.student.id]);
      if (hasMissing) {
        const assignments: Record<string, string> = { ...studentTargetSections };
        const numSections = activeTargetSections.length;

        eligiblePromoteCandidates.forEach((item, index) => {
          if (!assignments[item.student.id]) {
            const sectionIndex = index % numSections;
            const targetSec = activeTargetSections[sectionIndex];
            assignments[item.student.id] = targetSec.id;
          }
        });
        setStudentTargetSections(assignments);
      }
    }
  }, [distributionMethod, activeTargetSections, eligiblePromoteCandidates, studentTargetSections]);

  // Handle single student section change
  const handleStudentSectionChange = (studentId: string, sectionId: string) => {
    setStudentTargetSections((prev) => ({
      ...prev,
      [studentId]: sectionId,
    }));
  };

  // Section distribution counts (Live Counters)
  const targetSectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeTargetSections.forEach((s) => {
      counts[s.id] = 0;
    });

    let unassignedCount = 0;

    eligiblePromoteCandidates.forEach((c) => {
      const assignedSecId = studentTargetSections[c.student.id];
      if (assignedSecId && counts[assignedSecId] !== undefined) {
        counts[assignedSecId]++;
      } else {
        unassignedCount++;
      }
    });

    return { counts, unassignedCount };
  }, [activeTargetSections, eligiblePromoteCandidates, studentTargetSections]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = candidates.length;
    const eligiblePromote = candidates.filter((c) => c.action === 'promote').length;
    const repeating = candidates.filter((c) => c.action === 'repeat').length;
    const graduated = candidates.filter((c) => c.action === 'graduate').length;
    const excluded = candidates.filter((c) => c.action === 'exclude').length;
    const alreadyMigrated = candidates.filter((c) => c.isAlreadyMigrated).length;
    const pendingEligible = eligiblePromoteCandidates.length;

    const failingTotal = candidates.filter((c) => c.statusFinal === 'راسب').length;
    const incompleteTotal = candidates.filter(
      (c) => c.statusFinal === 'مكمّل' || c.statusFinal === 'غير مكتمل'
    ).length;

    return {
      total,
      eligiblePromote,
      repeating,
      graduated,
      excluded,
      alreadyMigrated,
      pendingEligible,
      failingTotal,
      incompleteTotal,
    };
  }, [candidates, eligiblePromoteCandidates]);

  // Filtered list for display in table
  const filteredCandidates = useMemo(() => {
    return candidates.filter((item) => {
      if (statusFilter === 'promote' && item.action !== 'promote') return false;
      if (statusFilter === 'repeat' && item.action !== 'repeat') return false;
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
  }, [candidates, statusFilter, searchQuery]);

  // Validate before opening review modal
  const handleProceedToReview = () => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى اختيار عامين دراسيين مختلفين للترحيل.',
      });
      return;
    }

    if (!sourceClassId) {
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى اختيار الصف الحالي المراد ترحيل طلابه.',
      });
      return;
    }

    if (!targetClassId) {
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى اختيار الصف الوجهة للترحيل.',
      });
      return;
    }

    if (targetClassId !== 'graduated') {
      if (activeTargetSections.length === 0) {
        setFeedbackMessage({
          type: 'error',
          text: 'الصف الجديد المختار لا يحتوي على أي شُعب دراسية متاحة. يرجى إضافة شعبة على الأقل للصف الجديد أولاً.',
        });
        return;
      }

      if (targetSectionCounts.unassignedCount > 0) {
        setFeedbackMessage({
          type: 'error',
          text: `يوجد ${targetSectionCounts.unassignedCount} طالب مستحق للترحيل لم تُحدد لهم شعبة جديدة بعد. يرجى تعيين شُعب لجميع الطلاب أو النقر على "التوزيع التلقائي المتوازن".`,
        });
        return;
      }
    }

    if (eligiblePromoteCandidates.length === 0 && (!includeFailingAsRepeaters || stats.repeating === 0)) {
      setFeedbackMessage({
        type: 'error',
        text: 'لا يوجد أي طلاب مستحقين للترحيل أو الترقية في الصف والشعب المحددة.',
      });
      return;
    }

    setFeedbackMessage(null);
    setIsReviewModalOpen(true);
  };

  // Final Execution of Promotion
  const handleConfirmAndExecutePromotion = () => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      return;
    }

    const payload = candidates.map((item) => {
      let finalTargetSectionId = '';
      if (item.action === 'promote') {
        finalTargetSectionId = studentTargetSections[item.student.id] || '';
      } else if (item.action === 'repeat') {
        finalTargetSectionId = item.student.sectionId || '';
      }

      return {
        sourceStudentId: item.student.id,
        studentName: item.student.name,
        registrationNumber: item.student.registrationNumber,
        fatherPhone: item.student.fatherPhone,
        nationalId: item.student.nationalId,
        gender: item.student.gender,
        notes: item.student.notes,
        targetClassId: item.assignedTargetClassId,
        targetSectionId: finalTargetSectionId,
        action: item.action,
        reason: item.reason,
      };
    });

    const res = db.executeStudentPromotion({
      sourceYearId,
      targetYearId,
      sourceClassId,
      targetClassId: targetClassId === 'graduated' ? undefined : targetClassId,
      promotions: payload,
      executedBy: 'مدير المدرسة',
    });

    setIsReviewModalOpen(false);

    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: `تمت عملية الترحيل بنجاح! تم ترحيل ${res.promotedCount} طالب إلى الصف الجديد، وتم الحفاظ الكامل على كافة السجلات والدرجات القديمة في العام المنصرم.`,
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.message,
      });
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    const sourceYearObj = academicYears.find((y) => y.id === sourceYearId);
    const targetYearObj = academicYears.find((y) => y.id === targetYearId);
    const sourceClassObj = classes.find((c) => c.id === sourceClassId);
    const targetClassObj = classes.find((c) => c.id === targetClassId);

    const rows = candidates.map((item, idx) => {
      const assignedSecId = studentTargetSections[item.student.id];
      const targetSecObj = sections.find((s) => s.id === assignedSecId);

      let actionText = '';
      if (item.action === 'promote') actionText = 'ترقية إلى الصف الأعلى';
      else if (item.action === 'repeat') actionText = 'إعادة في الصف نفسه (راسب)';
      else if (item.action === 'graduate') actionText = 'خريج (تخرج)';
      else actionText = 'مستبعد (راسب أو نتيجة غير مكتملة)';

      return {
        'ت': idx + 1,
        'رقم القيد': item.student.registrationNumber || '—',
        'اسم الطالب': item.student.name,
        'الصف الحالي': sourceClassObj?.name || '—',
        'الشعبة الحالية': item.sourceSection?.name || '—',
        'النتيجة الرسمية': item.statusFinal,
        'الإجراء المستحق': actionText,
        'الصف الجديد': targetClassObj?.name || (item.action === 'graduate' ? 'خريج' : '—'),
        'الشعبة الجديدة المحددة': targetSecObj?.name || (item.action === 'promote' ? 'غير محدد' : '—'),
        'سبب المسار': item.reason,
        'حالة الترحيل': item.isAlreadyMigrated ? 'مُرحّل مسبقاً' : 'جاهز للترحيل',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'ترحيل الطلاب');
    XLSX.writeFile(
      wb,
      `ترحيل_طلاب_${sourceClassObj?.name || ''}_من_${sourceYearObj?.name || ''}_إلى_${targetYearObj?.name || ''}.xlsx`
    );
  };

  // Inline Add Academic Year
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
        text: `تم إنشاء العام الدراسي الجديد «${res.year.name}» وتعيينه كوجهة للترحيل.`,
      });
    } else {
      setAddYearError(res.message || 'حدث خطأ أثناء إضافة العام الدراسي.');
    }
  };

  // Inline Add Section to Target Class
  const handleCreateSection = () => {
    if (!targetClassId || targetClassId === 'graduated') return;
    if (!newSectionName.trim()) {
      setAddSectionError('اسم الشعبة مطلوب (مثال: أ أو ب أو ج).');
      return;
    }
    try {
      const newSec = db.addSection({
        classId: targetClassId,
        name: newSectionName.trim(),
      });
      if (newSec && newSec.id) {
        setIsAddSectionModalOpen(false);
        setNewSectionName('');
        setAddSectionError(null);
        setSelectedTargetSectionIds((prev) => [...prev, newSec.id]);
        setFeedbackMessage({
          type: 'success',
          text: `تمت إضافة شعبة «${newSec.name}» إلى الصف الجديد بنجاح.`,
        });
      } else {
        setAddSectionError('حدث خطأ أثناء إضافة الشعبة.');
      }
    } catch (e) {
      setAddSectionError('حدث خطأ أثناء إضافة الشعبة.');
    }
  };

  const sourceYearObj = academicYears.find((y) => y.id === sourceYearId);
  const targetYearObj = academicYears.find((y) => y.id === targetYearId);
  const sourceClassObj = classes.find((c) => c.id === sourceClassId);
  const targetClassObj = classes.find((c) => c.id === targetClassId);

  return (
    <div className="w-full flex flex-col gap-6 pb-20" dir="rtl">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 flex items-center gap-2 flex-wrap">
              <span>ترحيل الطلاب من صف إلى الصف الأعلى للسنة الجديدة</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                حماية تامة للسجلات والدرجات التاريخية
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              ترقية الطلاب الناجحين والمعفين، وتوزيعهم يدوياً أو تلقائياً بالتساوي على الشُعب المتاحة، مع الاحتفاظ الكامل ببيانات وسجلات ونتائج السنة المنصرمة.
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
            <span>تصدير قائمة الترحيل Excel</span>
          </button>
          {onNavigateToStudents && (
            <button
              type="button"
              onClick={onNavigateToStudents}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>إدارة الطلاب</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-red-950/40 border-red-800/60 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
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

      {/* SECTION 1: Parameters Selection (السنة، الصف، والشعب) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
              ١
            </div>
            <h2 className="text-base font-bold text-slate-100">
              تحديد السنوات والصفوف والشُعب (المصدر والوجهة)
            </h2>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            حدد الصف والشُعب الحالية، والصف والشُعب المستهدفة في العام الدراسي الجديد
          </span>
        </div>

        {/* 1. Academic Years */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Source Academic Year */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>السنة الدراسية الحالية (المصدر)</span>
            </label>
            <select
              value={sourceYearId}
              onChange={(e) => setSourceYearId(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-emerald-500 focus:outline-hidden"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? '(العام الحالي)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Direction Icon */}
          <div className="hidden lg:flex items-center justify-center pb-2 text-emerald-400">
            <ArrowRightLeft className="w-6 h-6" />
          </div>

          {/* Target Academic Year */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>السنة الدراسية الجديدة (الوجهة)</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(true)}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ إنشاء عام جديد</span>
              </button>
            </div>
            <select
              value={targetYearId}
              onChange={(e) => setTargetYearId(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-emerald-500 focus:outline-hidden"
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
              تنبيه: يجب اختيار عامين دراسيين مختلفين. يرجى اختيار العام الجديد للترحيل إليه أو النقر على «+ إنشاء عام جديد».
            </span>
          </div>
        )}

        {/* 2. Source Class & Target Class */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-800">
          {/* Source Class (الصف الحالي) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>الصف الحالي (المراد ترحيل طلابه)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                إجمالي طلاب الصف: {sourceYearStudents.filter((s) => s.classId === sourceClassId).length}
              </span>
            </div>

            <select
              value={sourceClassId}
              onChange={(e) => setSourceClassId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-hidden"
            >
              {availableSourceClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stage})
                </option>
              ))}
            </select>

            {/* Source Sections Multi-select / checkboxes */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">
                  الشُعب الحالية التي ستُرحّل منها قوائم الطلاب:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSourceSectionIds(availableSourceSections.map((s) => s.id))}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceSectionIds([])}
                    className="text-[10px] text-slate-400 hover:text-slate-300 font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>

              {availableSourceSections.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic">هذا الصف لا يتضمن شُعب منفصلة</span>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {availableSourceSections.map((sec) => {
                    const isChecked = selectedSourceSectionIds.includes(sec.id);
                    const secCount = sourceYearStudents.filter(
                      (s) => s.classId === sourceClassId && s.sectionId === sec.id
                    ).length;

                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setSelectedSourceSectionIds((prev) => prev.filter((id) => id !== sec.id));
                          } else {
                            setSelectedSourceSectionIds((prev) => [...prev, sec.id]);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5" />}
                          <span>شعبة {sec.name}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                          {secCount} طالب
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Target Class (الصف الذي سينتقل إليه الطلاب) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>الصف الذي سينتقل إليه الطلاب (الوجهة)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                الشُعب المتاحة: {availableTargetSections.length}
              </span>
            </div>

            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-hidden"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stage})
                </option>
              ))}
              <option value="graduated">🎓 تخرج / خريجون (لا يوجد صف أعلى)</option>
            </select>

            {/* Target Sections */}
            {targetClassId !== 'graduated' && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">
                    الشُعب المتاحة في الصف الجديد (المستقبلة للطلاب):
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddSectionModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ إضافة شعبة للصف الجديد</span>
                  </button>
                </div>

                {availableTargetSections.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex items-center justify-between">
                    <span>الصف الجديد لا يحتوي على أي شُعب بعد.</span>
                    <button
                      type="button"
                      onClick={() => setIsAddSectionModalOpen(true)}
                      className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                    >
                      إضافة شعبة الآن
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableTargetSections.map((sec) => {
                      const isChecked = selectedTargetSectionIds.includes(sec.id);
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedTargetSectionIds((prev) => prev.filter((id) => id !== sec.id));
                            } else {
                              setSelectedTargetSectionIds((prev) => [...prev, sec.id]);
                            }
                          }}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5" />}
                            <span>شعبة {sec.name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Options Row: Failing students handling */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex-wrap gap-3">
          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeFailingAsRepeaters}
              onChange={(e) => setIncludeFailingAsRepeaters(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-500"
            />
            <span className="font-bold">
              تسجيل الطلاب الراسبين كـ «معيدين» في الصف نفسه ({sourceClassObj?.name || 'الصف الحالي'}) للعام الدراسي الجديد.
            </span>
          </label>
          <span className="text-[11px] text-slate-500">
            {includeFailingAsRepeaters
              ? 'الطلاب الراسبون سيسجلون كمعيدين في الصف القديم ولن يُرقوا للصف الأعلى'
              : 'الطلاب الراسبون والمكملون يُستبعدون من الترحيل للصف الجديد'}
          </span>
        </div>
      </div>

      {/* SECTION 2: Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col">
          <span className="text-[11px] text-slate-400">إجمالي طلاب الشُعب</span>
          <span className="text-xl font-bold font-mono text-white mt-1">{stats.total}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col">
          <span className="text-[11px] text-emerald-400 font-bold">المستحقون للترقية</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.eligiblePromote}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col">
          <span className="text-[11px] text-amber-400">الراسبون (غير مستحق)</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.failingTotal}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col">
          <span className="text-[11px] text-rose-400">المكمّلون / غير مكتمل</span>
          <span className="text-xl font-bold font-mono text-rose-400 mt-1">{stats.incompleteTotal}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col">
          <span className="text-[11px] text-purple-400">مُرحّلون مسبقاً</span>
          <span className="text-xl font-bold font-mono text-purple-400 mt-1">{stats.alreadyMigrated}</span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/50 p-3.5 rounded-xl flex flex-col bg-emerald-950/20">
          <span className="text-[11px] text-emerald-300 font-bold">الجاهزون للتوزيع الآن</span>
          <span className="text-xl font-black font-mono text-emerald-300 mt-1">{stats.pendingEligible}</span>
        </div>
      </div>

      {/* SECTION 3: Distribution Methods & Live Section Counters */}
      {targetClassId !== 'graduated' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
                ٢
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  اختيار طريقة التوزيع على الشُعب الجديدة ({targetClassObj?.name})
                </h2>
                <p className="text-xs text-slate-400">
                  اختر بين التوزيع التلقائي المتوازن بالتساوي، أو التوزيع اليدوي لكل طالب
                </p>
              </div>
            </div>

            {/* Method Tabs */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setDistributionMethod('manual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  distributionMethod === 'manual'
                    ? 'bg-emerald-600 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>الطريقة الأولى: التوزيع اليدوي</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDistributionMethod('auto_balanced');
                  executeBalancedDistribution();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  distributionMethod === 'auto_balanced'
                    ? 'bg-emerald-600 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>الطريقة الثانية: التوزيع التلقائي المتوازن</span>
              </button>
            </div>
          </div>

          {/* Method Details & Action banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex flex-col gap-1 text-xs">
              {distributionMethod === 'auto_balanced' ? (
                <>
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>التوزيع التلقائي المتوازن مفعّل:</span>
                  </span>
                  <span className="text-slate-300">
                    يقوم النظام بتوزيع الطلاب المستحقين للترحيل تلقائياً على الشُعب المتاحة بأعداد متقاربة قدر الإمكان، دون اشتراط بقاء الشعبة القديمة في شعبة واحدة.
                  </span>
                  <span className="text-[11px] text-slate-500">
                    يمكنك تعديل شعبة أي طالب بشكل فردي من القائمة أدناه قبل الاعتماد النهائي.
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span>التوزيع اليدوي مفعّل:</span>
                  </span>
                  <span className="text-slate-300">
                    يمكنك تحديد الشعبة الجديدة لكل طالب على حدة عبر القائمة المنسدلة في جدول الطلاب أدناه.
                  </span>
                </>
              )}
            </div>

            {distributionMethod === 'auto_balanced' && (
              <button
                type="button"
                onClick={executeBalancedDistribution}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-500/30 transition-colors shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة تشغيل التوزيع المتوازن</span>
              </button>
            )}
          </div>

          {/* Live Section Counters Bar */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-bold text-slate-300">
              توزيع الأعداد الحالي على شُعب الصف الجديد ({targetClassObj?.name}):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {activeTargetSections.map((sec) => {
                const count = targetSectionCounts.counts[sec.id] || 0;
                return (
                  <div
                    key={sec.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <span className="font-bold text-xs text-slate-200">شعبة ({sec.name})</span>
                    <span className="text-sm font-black font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-800/40">
                      {count} طالب
                    </span>
                  </div>
                );
              })}

              {targetSectionCounts.unassignedCount > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/50 flex items-center justify-between">
                  <span className="font-bold text-xs text-rose-300">غير محدد</span>
                  <span className="text-sm font-black font-mono text-rose-400 bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-800">
                    {targetSectionCounts.unassignedCount} طالب
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Ledger Table & Review Trigger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
              ٣
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">قائمة الطلاب وتعيينات الشُعب</h2>
              <p className="text-xs text-slate-400">
                راجع الطلاب المستحقين للترقية والشعبة الجديدة المخصصة لكل منهم قبل الانتقال للمراجعة النهائية
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={stats.pendingEligible === 0 || sourceYearId === targetYearId}
            onClick={handleProceedToReview}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GraduationCap className="w-4 h-4" />
            <span>الانتقال لمراجعة الترحيل والتأكيد ({stats.pendingEligible} طالب)</span>
          </button>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
              مستحقو الترقية ({stats.eligiblePromote})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('exclude')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'exclude' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-rose-400 hover:bg-slate-800'
              }`}
            >
              غير المستحقين ({stats.excluded})
            </button>
            {includeFailingAsRepeaters && (
              <button
                type="button"
                onClick={() => setStatusFilter('repeat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  statusFilter === 'repeat' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-amber-400 hover:bg-slate-800'
                }`}
              >
                معيدون ({stats.repeating})
              </button>
            )}
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
              className="w-full h-9 pr-8 pl-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
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
                <th className="p-3 border-l border-slate-800 text-center min-w-[180px]">الشعبة الجديدة المقترحة</th>
                <th className="p-3 text-center min-w-[110px]">حالة الطالب</th>
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
                  const assignedTargetSecId = studentTargetSections[item.student.id] || '';
                  const isEligible = item.action === 'promote' && !item.isAlreadyMigrated;

                  return (
                    <tr
                      key={item.student.id}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        item.isAlreadyMigrated ? 'opacity-60 bg-purple-950/10' : ''
                      }`}
                    >
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
                            item.statusFinal === 'ناجح' ||
                            item.statusFinal === 'ناجح — إعفاء عام' ||
                            item.statusFinal === 'معفى عام'
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
                            <span>خريج</span>
                          </span>
                        )}
                        {item.action === 'exclude' && (
                          <span
                            className="inline-flex items-center gap-1 text-rose-400 font-bold"
                            title={item.reason}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>مستبعد ({item.statusFinal})</span>
                          </span>
                        )}
                      </td>

                      {/* Target Section dropdown for each student individually */}
                      <td className="p-2.5 text-center border-l border-slate-800">
                        {isEligible ? (
                          targetClassId === 'graduated' ? (
                            <span className="text-slate-500 font-mono">خريج</span>
                          ) : (
                            <select
                              value={assignedTargetSecId}
                              onChange={(e) => handleStudentSectionChange(item.student.id, e.target.value)}
                              className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-emerald-300 focus:outline-hidden focus:border-emerald-500"
                            >
                              <option value="">— اختر الشعبة الجديدة —</option>
                              {activeTargetSections.map((ts) => (
                                <option key={ts.id} value={ts.id}>
                                  شعبة {ts.name}
                                </option>
                              ))}
                            </select>
                          )
                        ) : (
                          <span className="text-slate-500 font-sans text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-2.5 text-center">
                        {item.isAlreadyMigrated ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            مُرحّل مسبقاً
                          </span>
                        ) : isEligible ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            جاهز للترحيل
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                            غير مؤهل
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

      {/* SECTION 5: Review & Confirmation Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-white">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">مراجعة وتأكيد ترحيل الطلاب النهائي</h3>
                  <p className="text-xs text-slate-400">
                    يرجى تدقيق تفاصيل العملية وأعداد الشُعب قبل الاعتماد النهائي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              {/* Summary Specs Card */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">السنة الدراسية القديمة:</span>
                  <span className="font-bold text-slate-100 font-sans">{sourceYearObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">السنة الدراسية الجديدة:</span>
                  <span className="font-bold text-emerald-400 font-sans">{targetYearObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">الصف الحالي:</span>
                  <span className="font-bold text-slate-100 font-sans">{sourceClassObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">الصف الجديد الوجهة:</span>
                  <span className="font-bold text-emerald-400 font-sans">
                    {targetClassId === 'graduated' ? 'خريجون (تخرج)' : targetClassObj?.name}
                  </span>
                </div>
                <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-slate-850">
                  <span className="text-slate-400 font-sans">إجمالي الطلاب المستحقين للترقية:</span>
                  <span className="text-base font-black text-emerald-400">
                    {stats.pendingEligible} طالب
                  </span>
                </div>
              </div>

              {/* Target Section Breakdown in Review */}
              {targetClassId !== 'graduated' && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    أعداد الطلاب المقترحين لكل شعبة جديدة:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {activeTargetSections.map((sec) => (
                      <div
                        key={sec.id}
                        className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-300 font-bold">شعبة ({sec.name})</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {targetSectionCounts.counts[sec.id] || 0} طالب
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ineligible notice */}
              {stats.excluded > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-300 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    تنبيه: يوجد {stats.excluded} طالب غير مستحقين للترقية (راسبون أو مكملون) تم استبعادهم ولن يتم ترحيلهم للصف الأعلى كـ ناجحين، وستبقى سجلاتهم التاريخية محفوظة كما هي.
                  </span>
                </div>
              )}

              {/* Data Safety Notice */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  ضمان حفظ السجلات: لن يتم حذف أو تعديل أي سجل أو درجة من العام السابق {sourceYearObj?.name}. ستنشأ انتسابات مستقلة في السنة الجديدة {targetYearObj?.name} ويمكن دائماً الرجوع للسجلات السابقة عبر الفلاتر.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                العودة للتعديل (إلغاء)
              </button>
              <button
                type="button"
                onClick={handleConfirmAndExecutePromotion}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد وتنفيذ عملية الترحيل نهائياً</span>
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
                className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-slate-100 focus:outline-hidden focus:border-emerald-500"
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

      {/* Modal: Inline Add Section to Target Class */}
      {isAddSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>إضافة شعبة جديدة للصف ({targetClassObj?.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddSectionModalOpen(false);
                  setAddSectionError(null);
                }}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">اسم الشعبة (مثال: أ، ب، ج، د)</label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => {
                  setNewSectionName(e.target.value);
                  if (addSectionError) setAddSectionError(null);
                }}
                placeholder="أ"
                className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-slate-100 focus:outline-hidden focus:border-emerald-500"
              />
              {addSectionError && <span className="text-xs text-rose-400 font-bold">{addSectionError}</span>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddSectionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateSection}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                إضافة الشعبة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
