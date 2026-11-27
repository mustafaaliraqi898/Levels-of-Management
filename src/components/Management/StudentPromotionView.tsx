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
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
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
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { StudentStatusBadge } from '../Common/StudentStatusBadge';

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

  // Filter Source Classes strictly belonging to Source Academic Year
  const availableSourceClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, sourceYearId, currentYear?.id);
  }, [classes, sourceYearId, currentYear?.id]);

  const [sourceClassId, setSourceClassId] = useState<string>('');

  // Sync default source class when availableSourceClasses changes
  useEffect(() => {
    if (availableSourceClasses.length > 0) {
      if (!availableSourceClasses.some((c) => c.id === sourceClassId)) {
        setSourceClassId(availableSourceClasses[0].id);
      }
    } else {
      setSourceClassId('');
    }
  }, [availableSourceClasses, sourceClassId]);

  // Available sections for the selected source class
  const availableSourceSections = useMemo(() => {
    return sections.filter((s) => s.classId === sourceClassId);
  }, [sections, sourceClassId]);

  // Selected source sections
  const [selectedSourceSectionIds, setSelectedSourceSectionIds] = useState<string[]>([]);

  // Auto-select all sections of the source class whenever source class changes
  useEffect(() => {
    if (availableSourceSections.length > 0) {
      setSelectedSourceSectionIds(availableSourceSections.map((s) => s.id));
    } else {
      setSelectedSourceSectionIds([]);
    }
  }, [availableSourceSections, sourceClassId]);

  // Filter Target Classes strictly belonging to Target Academic Year
  const availableTargetClasses = useMemo(() => {
    return classes
      .filter((c) => c.academicYearId === targetYearId)
      .sort((a, b) => a.order - b.order);
  }, [classes, targetYearId]);

  // Selected Target Class
  const [targetClassId, setTargetClassId] = useState<string>('');

  // Year and Class helper objects
  const sourceYearObj = useMemo(() => academicYears.find((y) => y.id === sourceYearId), [academicYears, sourceYearId]);
  const targetYearObj = useMemo(() => academicYears.find((y) => y.id === targetYearId), [academicYears, targetYearId]);
  const sourceClassObj = useMemo(() => classes.find((c) => c.id === sourceClassId), [classes, sourceClassId]);
  const targetClassObj = useMemo(() => classes.find((c) => c.id === targetClassId), [classes, targetClassId]);

  // Auto-suggest next higher class in Target Academic Year
  useEffect(() => {
    if (!sourceClassId) return;
    const currentSourceClass = classes.find((c) => c.id === sourceClassId);
    if (!currentSourceClass) return;

    if (availableTargetClasses.length === 0) {
      setTargetClassId('');
      return;
    }

    // Try finding matching higher class in Target Academic Year by order or stage
    const higherTargetClass = availableTargetClasses.find(
      (tc) => tc.order > currentSourceClass.order || (tc.stage === currentSourceClass.stage && tc.order >= currentSourceClass.order)
    );

    if (higherTargetClass) {
      setTargetClassId(higherTargetClass.id);
    } else {
      // If source class is the highest in stage, suggestion is 'graduated'
      setTargetClassId('graduated');
    }
  }, [sourceClassId, availableTargetClasses, classes]);

  // Available sections for the promoted target class in Target Year
  const availableTargetSections = useMemo(() => {
    if (!targetClassId || targetClassId === 'graduated') return [];
    return sections.filter((s) => s.classId === targetClassId);
  }, [sections, targetClassId]);

  // Selected target sections that will receive promoted students
  const [selectedTargetSectionIds, setSelectedTargetSectionIds] = useState<string[]>([]);

  useEffect(() => {
    if (availableTargetSections.length > 0) {
      setSelectedTargetSectionIds(availableTargetSections.map((s) => s.id));
    } else {
      setSelectedTargetSectionIds([]);
    }
  }, [availableTargetSections, targetClassId]);

  // 4. Repeater Target Class Selection (الصف الوجهة للمعيدين في السنة الجديدة)

  // Auto-find repeater class in Target Academic Year (class with same name or same order in Target Year)
  const repeaterTargetClassObj = useMemo(() => {
    if (!sourceClassObj || !targetYearId) return null;
    return availableTargetClasses.find(
      (tc) => tc.name.trim().toLowerCase() === sourceClassObj.name.trim().toLowerCase()
    ) || availableTargetClasses.find((tc) => tc.order === sourceClassObj.order) || null;
  }, [sourceClassObj, availableTargetClasses, targetYearId]);

  // Sections available for repeaters in Target Year
  const availableRepeaterSections = useMemo(() => {
    if (!repeaterTargetClassObj) return [];
    return sections.filter((s) => s.classId === repeaterTargetClassObj.id);
  }, [sections, repeaterTargetClassObj]);

  // Option: Include failing students as repeaters in the target year
  const [includeFailingAsRepeaters, setIncludeFailingAsRepeaters] = useState<boolean>(true);

  // Modal to add a new section to the target class inline
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addSectionError, setAddSectionError] = useState<string | null>(null);

  // Distribution Method: 'manual' or 'auto_balanced'
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('auto_balanced');

  // Student Section Assignments map: studentId -> targetSectionId
  const [studentTargetSections, setStudentTargetSections] = useState<Record<string, string>>({});

  // Repeater Section Assignments map: studentId -> targetSectionId
  const [repeaterTargetSections, setRepeaterTargetSections] = useState<Record<string, string>>({});

  // Search & Filter in list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'promote' | 'repeat' | 'exclude' | 'migrated'>('all');

  // Review & Confirmation Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get decision settings & exemption settings for source year
  const decisionSettings = useMemo(() => {
    return db.getDecisionSettings(sourceYearId);
  }, [sourceYearId]);

  const exemptionSettings = useMemo(() => {
    return db.getExemptionSettings(sourceYearId);
  }, [sourceYearId]);

  // Students of source year
  const sourceYearStudents = useMemo(() => {
    return students.filter((s) => s.academicYearId === sourceYearId);
  }, [students, sourceYearId]);

  // Students of target year (for duplicate checking)
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

  // Evaluate candidate students in the selected scope
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
          assignedTargetClassId = repeaterTargetClassObj?.id || null;
          reason = repeaterTargetClassObj
            ? `راسب في السنة المنصرمة (تسجيل كـ معيد في الصف نفسه للسنة الجديدة: ${repeaterTargetClassObj.name})`
            : 'راسب (تعذر العثور على صف مطابق للمعيدين في السنة الجديدة)';
        } else {
          action = 'exclude';
          assignedTargetClassId = null;
          reason = 'راسب (مستبعد من الترحيل بناءً على خيار المستخدم)';
        }
      } else if (statusFinal === 'مكمّل') {
        action = 'exclude';
        assignedTargetClassId = null;
        reason = 'مكمّل (بانتظار نتائج الدور الثاني ولا يُرحل الآن)';
      } else {
        action = 'exclude';
        assignedTargetClassId = null;
        reason = 'غير مكتمل (درجات الطالب ناقصة ولم تُحسم نتيجته)';
      }

      // Check for already migrated (Strict source-linked & non-empty registration number detection)
      const cleanReg = student.registrationNumber ? student.registrationNumber.trim() : '';

      const isAlreadyMigrated = targetYearStudents.some((s) => {
        // 1. Reliable link via source student ID stored in notes
        if (s.notes && s.notes.includes(`[src:${student.id}]`)) {
          return true;
        }
        // 2. Match by registration number ONLY if non-empty (never treat empty registration numbers as identical)
        if (cleanReg.length > 0 && s.registrationNumber && s.registrationNumber.trim() === cleanReg) {
          return true;
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
    repeaterTargetClassObj,
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

  // Candidates eligible for promotion
  const eligiblePromoteCandidates = useMemo(() => {
    return candidates.filter((c) => c.action === 'promote' && !c.isAlreadyMigrated);
  }, [candidates]);

  // Repeaters
  const repeaterCandidates = useMemo(() => {
    return candidates.filter((c) => c.action === 'repeat' && !c.isAlreadyMigrated);
  }, [candidates]);

  // Active target sections available for promoted students
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

    eligiblePromoteCandidates.forEach((item, index) => {
      const sectionIndex = index % numSections;
      const targetSec = activeTargetSections[sectionIndex];
      assignments[item.student.id] = targetSec.id;
    });

    setStudentTargetSections((prev) => ({
      ...prev,
      ...assignments,
    }));

    // Auto assign repeaters to repeater sections if available
    if (repeaterCandidates.length > 0 && availableRepeaterSections.length > 0) {
      const repAssignments: Record<string, string> = {};
      const numRepSecs = availableRepeaterSections.length;
      repeaterCandidates.forEach((item, index) => {
        const secIndex = index % numRepSecs;
        repAssignments[item.student.id] = availableRepeaterSections[secIndex].id;
      });
      setRepeaterTargetSections((prev) => ({
        ...prev,
        ...repAssignments,
      }));
    }

    setFeedbackMessage({
      type: 'success',
      text: `تم تنفيذ التوزيع التلقائي المتوازن بنجاح لعدد ${eligiblePromoteCandidates.length} طالب ناجح على شُعب الصف الجديد، وتخصيص شُعب المعيدين.`,
    });
  }, [activeTargetSections, eligiblePromoteCandidates, repeaterCandidates, availableRepeaterSections]);

  // Auto-assign sections when mode is auto_balanced
  useEffect(() => {
    if (distributionMethod === 'auto_balanced' && activeTargetSections.length > 0 && eligiblePromoteCandidates.length > 0) {
      const hasMissing = eligiblePromoteCandidates.some((c) => !studentTargetSections[c.student.id]);
      if (hasMissing) {
        const assignments: Record<string, string> = { ...studentTargetSections };
        const numSections = activeTargetSections.length;

        eligiblePromoteCandidates.forEach((item, index) => {
          if (!assignments[item.student.id]) {
            const sectionIndex = index % numSections;
            assignments[item.student.id] = activeTargetSections[sectionIndex].id;
          }
        });
        setStudentTargetSections(assignments);
      }
    }
  }, [distributionMethod, activeTargetSections, eligiblePromoteCandidates, studentTargetSections]);

  // Auto-assign repeater sections
  useEffect(() => {
    if (repeaterCandidates.length > 0 && availableRepeaterSections.length > 0) {
      const hasMissing = repeaterCandidates.some((c) => !repeaterTargetSections[c.student.id]);
      if (hasMissing) {
        const repAssignments: Record<string, string> = { ...repeaterTargetSections };
        const numRepSecs = availableRepeaterSections.length;

        repeaterCandidates.forEach((item, index) => {
          if (!repAssignments[item.student.id]) {
            const secIndex = index % numRepSecs;
            repAssignments[item.student.id] = availableRepeaterSections[secIndex].id;
          }
        });
        setRepeaterTargetSections(repAssignments);
      }
    }
  }, [repeaterCandidates, availableRepeaterSections, repeaterTargetSections]);

  // Copy structure handler
  const handleCopyClassStructure = () => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      setFeedbackMessage({ type: 'error', text: 'يرجى تحديد عامين دراسيين مختلفين أولاً.' });
      return;
    }

    const res = db.copyClassStructureToYear(sourceYearId, targetYearId);
    if (res.success) {
      setFeedbackMessage({ type: 'success', text: res.message });
    } else {
      setFeedbackMessage({ type: 'error', text: res.message });
    }
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

    if (availableTargetClasses.length === 0) {
      setFeedbackMessage({
        type: 'error',
        text: `السنة الدراسية الجديدة (${targetYearObj?.name || ''}) لا تحتوي على أي صفوف معرّفة بعد. يرجى النقر على زر «نسخ هيكل الصفوف والشُعب» أولاً.`,
      });
      return;
    }

    if (!targetClassId) {
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى اختيار الصف الوجهة للترحيل في السنة الجديدة.',
      });
      return;
    }

    if (targetClassId !== 'graduated') {
      if (activeTargetSections.length === 0) {
        setFeedbackMessage({
          type: 'error',
          text: 'الصف الجديد المختار في السنة الجديدة لا يحتوي على أي شُعب دراسية متاحة. يرجى إضافة شعبة للصف الجديد أولاً.',
        });
        return;
      }

      if (targetSectionCounts.unassignedCount > 0) {
        setFeedbackMessage({
          type: 'error',
          text: `يوجد ${targetSectionCounts.unassignedCount} طالب مستحق للترحيل لم تُحدد لهم شعبة جديدة بعد. يرجى تعيين شُعب لجميع الطلاب قبل الترفيع.`,
        });
        return;
      }
    }

    // Check repeaters validity if repeaters are included
    if (includeFailingAsRepeaters && stats.repeating > 0) {
      if (!repeaterTargetClassObj) {
        setFeedbackMessage({
          type: 'error',
          text: `تعذر تحديد صف معيدين مطابق للصف القديم (${sourceClassObj?.name}) في السنة الجديدة (${targetYearObj?.name}). يرجى التأكد من وجود صف (${sourceClassObj?.name}) في السنة الجديدة.`,
        });
        return;
      }

      const unassignedRepeaters = repeaterCandidates.some((c) => !repeaterTargetSections[c.student.id]);
      if (unassignedRepeaters) {
        setFeedbackMessage({
          type: 'error',
          text: 'يوجد طلاب معيدون لم تُحدد لهم شعبة في الصف المكرر بالسنة الجديدة. يرجى تحديد شعبة المعيدين.',
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
  const handleConfirmAndExecutePromotion = async () => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = candidates.map((item) => {
        let finalTargetClassId: string | null = null;
        let finalTargetSectionId = '';

        if (item.action === 'promote') {
          finalTargetClassId = targetClassId === 'graduated' ? null : targetClassId;
          finalTargetSectionId = studentTargetSections[item.student.id] || '';
        } else if (item.action === 'repeat') {
          finalTargetClassId = repeaterTargetClassObj ? repeaterTargetClassObj.id : null;
          finalTargetSectionId = repeaterTargetSections[item.student.id] || '';
        }

        return {
          sourceStudentId: item.student.id,
          studentName: item.student.name,
          registrationNumber: item.student.registrationNumber,
          fatherPhone: item.student.fatherPhone,
          nationalId: item.student.nationalId,
          gender: item.student.gender,
          notes: item.student.notes,
          targetClassId: finalTargetClassId,
          targetSectionId: finalTargetSectionId,
          action: item.action,
          reason: item.reason,
        };
      });

      const res = await db.executeStudentPromotion({
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
          text: `تمت عملية الترحيل بنجاح! تم ترفيع ${res.promotedCount} طالب وتسجيل ${res.repeatingCount} معيد في صفوف السنة الجديدة (${targetYearObj?.name})، وتم الحفاظ الكامل على درجات وسجلات السنة المنصرمة.`,
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'فشلت عملية الترحيل.',
        });
      }
    } catch (err: any) {
      setIsReviewModalOpen(false);
      setFeedbackMessage({
        type: 'error',
        text: `حدث خطأ غير متوقع أثناء تنفيذ الترحيل: ${err?.message || 'خطأ بالنظام'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    const targetClassObj = classes.find((c) => c.id === targetClassId);

    const rows = candidates.map((item, idx) => {
      let assignedSecName = '—';
      let assignedClassName = '—';

      if (item.action === 'promote') {
        assignedClassName = targetClassObj?.name || (targetClassId === 'graduated' ? 'خريج' : '—');
        const secId = studentTargetSections[item.student.id];
        assignedSecName = sections.find((s) => s.id === secId)?.name || '—';
      } else if (item.action === 'repeat') {
        assignedClassName = repeaterTargetClassObj?.name || '—';
        const secId = repeaterTargetSections[item.student.id];
        assignedSecName = sections.find((s) => s.id === secId)?.name || '—';
      }

      let actionText = '';
      if (item.action === 'promote') actionText = 'ترقية إلى الصف الأعلى';
      else if (item.action === 'repeat') actionText = 'إعادة في الصف نفسه (معيد في السنة الجديدة)';
      else if (item.action === 'graduate') actionText = 'خريج (تخرج)';
      else actionText = 'مستبعد (نتيجة غير مكتملة أو راسب)';

      return {
        'ت': idx + 1,
        'رقم القيد': item.student.registrationNumber || '—',
        'اسم الطالب': item.student.name,
        'الصف الحالي': sourceClassObj?.name || '—',
        'الشعبة الحالية': item.sourceSection?.name || '—',
        'النتيجة الرسمية': item.statusFinal,
        'الإجراء المستحق': actionText,
        'الصف في السنة الجديدة': assignedClassName,
        'الشعبة في السنة الجديدة': assignedSecName,
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
      `تقرير_ترحيل_طلاب_${sourceClassObj?.name || ''}_من_${sourceYearObj?.name || ''}_إلى_${targetYearObj?.name || ''}.xlsx`
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

  return (
    <div className="w-full flex flex-col gap-6 pb-20" dir="rtl">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 flex items-center justify-center text-[#3156C9] dark:text-[#60A5FA] shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2 flex-wrap">
              <span>ترحيل الطلاب وترقيتهم للسنة الدراسية الجديدة</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center gap-2 border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />
            <span>تصدير قائمة الترحيل Excel</span>
          </button>
          {onNavigateToStudents && (
            <button
              type="button"
              onClick={onNavigateToStudents}
              className="px-3.5 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center gap-2 border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
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
              ? 'bg-[#10B981]/12 dark:bg-[#10B981]/15 border-[#10B981]/30 text-[#059669] dark:text-[#10B981]'
              : 'bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
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

      {/* SECTION 1: Academic Years & Class Selection */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-5 shadow-sm dark:shadow-lg flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 text-[#3156C9] dark:text-[#60A5FA] font-black text-xs flex items-center justify-center font-mono">
              ١
            </div>
            <h2 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              تحديد الأعوام والصفوف الدراسية
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCopyClassStructure}
            className="text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] hover:bg-[#3156C9]/15 dark:hover:bg-[#2785F5]/20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>نسخ هيكل الصفوف والشُعب والمواد إلى السنة الجديدة</span>
          </button>
        </div>

        {/* Source and destination selection cards */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-stretch">
          <section className="relative overflow-hidden rounded-2xl border border-[#BFD5FF] dark:border-[#365681] bg-gradient-to-br from-[#F1F6FF] via-white to-[#E5EFFF] dark:from-[#1B2D46] dark:via-[#1C2939] dark:to-[#203657] p-4 sm:p-5 shadow-sm flex flex-col gap-4">
            <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-[#3976DB]/[0.07] dark:bg-[#60A5FA]/[0.08] pointer-events-none" />
            <div className="relative flex items-center justify-between gap-2 pb-3 border-b border-[#C9D9F2] dark:border-[#344D6E]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#DCE9FF] dark:bg-[#24466F] text-[#3156C9] dark:text-[#A9C3FF] flex items-center justify-center"><Calendar className="w-4 h-4" /></span>
                <div>
                  <h3 className="text-sm font-black text-[#23477F] dark:text-[#C9DCFF]">السنة والصف المصدر</h3>
                  <p className="text-[10px] text-[#6B82A5] dark:text-[#91A9CA]">البيانات الحالية للطلبة</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#DCE9FF] dark:bg-[#24466F] text-[#3156C9] dark:text-[#B7D0FF] border border-[#BFD5FF] dark:border-[#365681]">المصدر</span>
            </div>
            <div className="relative flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[#526987] dark:text-[#A8BBD5]">السنة الدراسية المنصرمة</label>
              <select value={sourceYearId} onChange={(e) => setSourceYearId(e.target.value)} className="w-full h-11 px-3 bg-white/90 dark:bg-[#26364B] border border-[#C7D7EF] dark:border-[#3B5577] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] text-sm font-bold shadow-xs focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none">
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(العام الحالي)' : ''}</option>)}
              </select>
            </div>
          {/* Source Class (تُعرض فقط صفوف السنة المنصرمة) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <label className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                <span>الصف المنصرم (من سنة {sourceYearObj?.name})</span>
              </label>
              <span className="text-[11px] font-mono tabular-nums text-[#64748B] dark:text-[#8493A8]">
                إجمالي طلاب الصف: {sourceYearStudents.filter((s) => s.classId === sourceClassId).length}
              </span>
            </div>

            <select
              value={sourceClassId}
              onChange={(e) => setSourceClassId(e.target.value)}
              className="w-full h-9 px-3 bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
            >
              {availableSourceClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stage})
                </option>
              ))}
            </select>

            {/* Source Sections Multi-select */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#475569] dark:text-[#A8B5C7]">
                  شُعب الصف المنصرم ({sourceYearObj?.name}):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSourceSectionIds(availableSourceSections.map((s) => s.id))}
                    className="text-[10px] text-[#3156C9] dark:text-[#60A5FA] hover:underline font-bold cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-[#DCE3ED] dark:text-[#2D3B4D]">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceSectionIds([])}
                    className="text-[10px] text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>

              {availableSourceSections.length === 0 ? (
                <span className="text-[11px] text-[#64748B] dark:text-[#8493A8] italic">لا توجد شُعب منفصلة لهذا الصف</span>
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
                            ? 'bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border-[#3156C9] dark:border-[#2785F5] text-[#3156C9] dark:text-[#60A5FA]'
                            : 'bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#EDF1F7] dark:hover:bg-[#2D3B4D]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" /> : <Square className="w-3.5 h-3.5" />}
                          <span>شعبة {sec.name}</span>
                        </span>
                        <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#EDF1F7] dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7]">
                          {secCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>


          </section>

          <div className="hidden xl:flex items-center justify-center px-1">
            <span className="w-12 h-12 rounded-full bg-white dark:bg-[#26364B] border border-[#D7E2F1] dark:border-[#3B5577] shadow-sm text-[#3156C9] dark:text-[#8DB5FF] flex items-center justify-center"><ArrowRightLeft className="w-6 h-6" /></span>
          </div>

          <section className="relative overflow-hidden rounded-2xl border border-[#BFE8D7] dark:border-[#326B58] bg-gradient-to-br from-[#EDFBF5] via-white to-[#E1F7EC] dark:from-[#193B34] dark:via-[#1C2939] dark:to-[#1B4038] p-4 sm:p-5 shadow-sm flex flex-col gap-4">
            <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-[#15966B]/[0.07] dark:bg-[#54D6A6]/[0.08] pointer-events-none" />
            <div className="relative flex items-center justify-between gap-2 pb-3 border-b border-[#C8E8D9] dark:border-[#326B58]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#DDF5EA] dark:bg-[#205344] text-[#087E59] dark:text-[#70E0B7] flex items-center justify-center"><GraduationCap className="w-4 h-4" /></span>
                <div>
                  <h3 className="text-sm font-black text-[#176447] dark:text-[#B8F0D8]">السنة والصف الوجهة</h3>
                  <p className="text-[10px] text-[#668E7D] dark:text-[#91BBA9]">الوجهة الجديدة للطلبة</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#DDF5EA] dark:bg-[#205344] text-[#087E59] dark:text-[#70E0B7] border border-[#BFE8D7] dark:border-[#326B58]">الوجهة</span>
            </div>
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-[#527969] dark:text-[#A8CBBB]">السنة الدراسية الجديدة</label>
                <button type="button" onClick={() => setIsAddYearModalOpen(true)} className="text-[10px] font-bold text-[#087E59] dark:text-[#70E0B7] hover:underline flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3" /> إنشاء عام</button>
              </div>
              <select value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)} className="w-full h-11 px-3 bg-white/90 dark:bg-[#26364B] border border-[#BFE0D0] dark:border-[#326B58] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] text-sm font-bold shadow-xs focus:border-[#15966B] focus:ring-2 focus:ring-[#15966B]/15 focus:outline-none">
                {academicYears.map((y) => <option key={y.id} value={y.id} disabled={y.id === sourceYearId}>{y.name} {y.id === sourceYearId ? '(نفس العام)' : ''}</option>)}
              </select>
            </div>
          {/* Target Class (تُعرض فقط صفوف السنة الجديدة) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <label className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />
                <span>الصف الوجهة للناجحين (في سنة {targetYearObj?.name})</span>
              </label>
              <span className="text-[11px] font-mono tabular-nums text-[#64748B] dark:text-[#8493A8]">
                شُعب الصف الجديد: {availableTargetSections.length}
              </span>
            </div>

            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full h-9 px-3 bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
            >
              {availableTargetClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stage})
                </option>
              ))}
              <option value="graduated">🎓 خريجون / تخرج المرحلة (لا يوجد صف أعلى)</option>
            </select>

            {/* Target Sections */}
            {targetClassId !== 'graduated' && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#475569] dark:text-[#A8B5C7]">
                    الشُعب المستقبلة للناجحين في السنة الجديدة ({targetYearObj?.name}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddSectionModalOpen(true)}
                    className="text-[11px] font-bold text-[#3156C9] dark:text-[#60A5FA] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ إضافة شعبة</span>
                  </button>
                </div>

                {availableTargetSections.length === 0 ? (
                  <div className="p-3 rounded-lg bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] text-xs flex items-center justify-between">
                    <span>الصف المختار في السنة الجديدة لا يحتوي على شُعب.</span>
                    <button
                      type="button"
                      onClick={() => setIsAddSectionModalOpen(true)}
                      className="px-2.5 py-1 rounded bg-[#D69B42] hover:bg-[#B45309] text-white font-bold text-[11px] cursor-pointer"
                    >
                      إضافة شعبة
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
                              ? 'bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border-[#3156C9] dark:border-[#2785F5] text-[#3156C9] dark:text-[#60A5FA]'
                              : 'bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#EDF1F7] dark:hover:bg-[#2D3B4D]'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" /> : <Square className="w-3.5 h-3.5" />}
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
          </section>
        </div>

        {/* Warning if target year has no classes */}
        {availableTargetClasses.length === 0 && targetYearId && (
          <div className="p-4 rounded-xl bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] text-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>السنة الدراسية الجديدة ({targetYearObj?.name}) لا تحتوي على أي صفوف معرّفة بعد.</span>
            </div>
            <button type="button" onClick={handleCopyClassStructure} className="px-3.5 py-1.5 rounded-lg bg-[#D69B42] hover:bg-[#B45309] text-white font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-xs">
              <Copy className="w-4 h-4" />
              <span>نسخ هيكل الصفوف والشُعب من السنة المنصرمة</span>
            </button>
          </div>
        )}

        {/* Options Row: Repeater Students Handling */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D]">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2.5 text-xs text-[#1E293B] dark:text-[#E2E8F0] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFailingAsRepeaters}
                onChange={(e) => setIncludeFailingAsRepeaters(e.target.checked)}
                className="w-4 h-4 rounded focus:ring-0 cursor-pointer accent-[#3156C9] dark:accent-[#2785F5]"
              />
              <span className="font-bold text-[#B45309] dark:text-[#D69B42]">
                تسجيل الطلاب الراسبين كـ «معيدين» في السنة الجديدة ({targetYearObj?.name})
              </span>
            </label>

            {includeFailingAsRepeaters && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#64748B] dark:text-[#8493A8]">صف المعيدين بالسنة الجديدة:</span>
                <span className="font-bold text-[#B45309] dark:text-[#D69B42] bg-[#D69B42]/10 dark:bg-[#D69B42]/15 px-2.5 py-1 rounded-lg border border-[#D69B42]/30">
                  {repeaterTargetClassObj ? repeaterTargetClassObj.name : 'غير متوفر (يرجى نسخ الهيكل)'}
                </span>
              </div>
            )}
          </div>

          {includeFailingAsRepeaters && (
            <p className="text-[11px] text-[#64748B] dark:text-[#8493A8]">
              * سيتم ربط الطلاب الراسبين بصف {repeaterTargetClassObj?.name || 'المعيدين'} التابع مباشرة للعام الدراسي الجديد {targetYearObj?.name} وليس بالصف القديم، مع تعيين شُعبهم المخصصة.
            </p>
          )}
        </div>
      </div>

      {/* SECTION 2: Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-xl flex flex-col shadow-xs">
          <span className="text-[11px] text-[#64748B] dark:text-[#8493A8]">إجمالي طلاب الشُعب</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#1E293B] dark:text-[#E2E8F0] mt-1">{stats.total}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-xl flex flex-col shadow-xs">
          <span className="text-[11px] text-[#059669] dark:text-[#10B981] font-bold">المستحقون للترقية</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#059669] dark:text-[#10B981] mt-1">{stats.eligiblePromote}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-xl flex flex-col shadow-xs">
          <span className="text-[11px] text-[#B45309] dark:text-[#D69B42] font-bold">المعيدون (الراسبون)</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#B45309] dark:text-[#D69B42] mt-1">{stats.repeating}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-xl flex flex-col shadow-xs">
          <span className="text-[11px] text-[#C83D4B] dark:text-[#E35D6A] font-bold">المكمّلون / غير مكتمل</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#C83D4B] dark:text-[#E35D6A] mt-1">{stats.incompleteTotal}</span>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 rounded-xl flex flex-col shadow-xs">
          <span className="text-[11px] text-[#3156C9] dark:text-[#60A5FA] font-bold">مُرحّلون مسبقاً</span>
          <span className="text-xl font-bold font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] mt-1">{stats.alreadyMigrated}</span>
        </div>

        <div className="bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/30 p-3.5 rounded-xl flex flex-col shadow-xs">
          <span className="text-[11px] text-[#3156C9] dark:text-[#60A5FA] font-bold">الجاهزون للتوزيع والترحيل</span>
          <span className="text-xl font-black font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] mt-1">
            {stats.pendingEligible + (includeFailingAsRepeaters ? stats.repeating : 0)}
          </span>
        </div>
      </div>

      {/* SECTION 3: Distribution Methods & Live Section Counters */}
      {targetClassId !== 'graduated' && (
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-5 shadow-sm dark:shadow-lg flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 text-[#3156C9] dark:text-[#60A5FA] font-black text-xs flex items-center justify-center font-mono">
                ٢
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                  توزيع الطلبة على شُعب السنة الجديدة
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                  اختر بين التوزيع التلقائي المتوازن بالتساوي، أو التوزيع اليدوي لكل طالب
                </p>
              </div>
            </div>

            {/* Distribution method cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:max-w-[720px]">
              <button
                type="button"
                aria-pressed={distributionMethod === 'manual'}
                onClick={() => setDistributionMethod('manual')}
                className={`group relative min-h-[104px] rounded-2xl border-2 p-4 flex items-center gap-4 text-right transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3976DB]/25 ${
                  distributionMethod === 'manual'
                    ? 'border-[#8B5CF6] bg-gradient-to-br from-[#F6F1FF] to-white dark:from-[#33264D] dark:to-[#202B3C] shadow-md shadow-[#8B5CF6]/10'
                    : 'border-[#DCE3ED] dark:border-[#3B4D66] bg-white dark:bg-[#202E40] hover:border-[#B7A0EA] dark:hover:border-[#7058A5]'
                }`}
              >
                <span className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-colors ${distributionMethod === 'manual' ? 'bg-[#E9DDFF] dark:bg-[#49366D] text-[#7045B5] dark:text-[#C5A9FF]' : 'bg-[#F1F5F9] dark:bg-[#2B3B52] text-[#71819A] dark:text-[#A8B5C7]'}`}>
                  <Sliders className="w-6 h-6" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-[#263B5A] dark:text-[#E2E8F0]">التوزيع اليدوي</span>
                  <span className="block mt-1 text-[11px] leading-5 text-[#71819A] dark:text-[#A8B5C7]">تحديد شعبة كل طالب من جدول المعاينة بشكل مستقل</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${distributionMethod === 'manual' ? 'border-[#8B5CF6]' : 'border-[#B8C4D3] dark:border-[#60738C]'}`}>
                  {distributionMethod === 'manual' && <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />}
                </span>
              </button>

              <button
                type="button"
                aria-pressed={distributionMethod === 'auto_balanced'}
                onClick={() => {
                  setDistributionMethod('auto_balanced');
                  executeBalancedDistribution();
                }}
                className={`group relative min-h-[104px] rounded-2xl border-2 p-4 flex items-center gap-4 text-right transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3976DB]/25 ${
                  distributionMethod === 'auto_balanced'
                    ? 'border-[#3976DB] bg-gradient-to-br from-[#EAF2FF] to-white dark:from-[#203D67] dark:to-[#202B3C] shadow-md shadow-[#3976DB]/10'
                    : 'border-[#DCE3ED] dark:border-[#3B4D66] bg-white dark:bg-[#202E40] hover:border-[#9BB9EE] dark:hover:border-[#4D79B8]'
                }`}
              >
                <span className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-colors ${distributionMethod === 'auto_balanced' ? 'bg-[#D7E6FF] dark:bg-[#2B5288] text-[#245BC5] dark:text-[#A9C3FF]' : 'bg-[#F1F5F9] dark:bg-[#2B3B52] text-[#71819A] dark:text-[#A8B5C7]'}`}>
                  <Shuffle className="w-6 h-6" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-[#263B5A] dark:text-[#E2E8F0]">التوزيع التلقائي المتوازن</span>
                  <span className="block mt-1 text-[11px] leading-5 text-[#71819A] dark:text-[#A8B5C7]">توزيع الطلبة بالتتابع على الشُعب المحددة لتحقيق تقارب في الأعداد</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${distributionMethod === 'auto_balanced' ? 'border-[#3976DB]' : 'border-[#B8C4D3] dark:border-[#60738C]'}`}>
                  {distributionMethod === 'auto_balanced' && <span className="w-2.5 h-2.5 rounded-full bg-[#3976DB]" />}
                </span>
              </button>
            </div>
          </div>

          {/* Live Section Balancer Counters */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">
              توزيع أعداد الناجحين على شُعب الصف الجديد ({targetClassObj?.name}):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {activeTargetSections.map((sec) => {
                const count = targetSectionCounts.counts[sec.id] || 0;
                return (
                  <div
                    key={sec.id}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-between"
                  >
                    <span className="font-bold text-xs text-[#1E293B] dark:text-[#E2E8F0]">شعبة ({sec.name})</span>
                    <span className="text-sm font-black font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/8 dark:bg-[#2785F5]/12 px-2 py-0.5 rounded-lg border border-[#3156C9]/25 dark:border-[#2785F5]/25">
                      {count} طالب
                    </span>
                  </div>
                );
              })}

              {targetSectionCounts.unassignedCount > 0 && (
                <div className="p-2.5 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 flex items-center justify-between">
                  <span className="font-bold text-xs text-[#C83D4B] dark:text-[#E35D6A]">غير محدد</span>
                  <span className="text-sm font-black font-mono tabular-nums text-[#C83D4B] dark:text-[#E35D6A] bg-white dark:bg-[#1C2939] px-2 py-0.5 rounded-lg border border-[#E35D6A]/30">
                    {targetSectionCounts.unassignedCount} طالب
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Ledger Table & Review Trigger */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 text-[#3156C9] dark:text-[#60A5FA] font-black text-xs flex items-center justify-center font-mono">
              ٣
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">جدول تعيينات الصفوف والشُعب للعام الجديد</h2>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                تأكد من صحة الصف والشعبة المسندة لكل طالب ناجح أو معيد قبل اعتماد العملية
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={stats.pendingEligible === 0 && (!includeFailingAsRepeaters || stats.repeating === 0)}
            onClick={handleProceedToReview}
            className="px-6 py-2.5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GraduationCap className="w-4 h-4" />
            <span>معاينة ومراجعة الترحيل قبل الاعتماد (<span className="font-mono tabular-nums">{stats.pendingEligible + (includeFailingAsRepeaters ? stats.repeating : 0)}</span> طالب)</span>
          </button>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D]'
              }`}
            >
              الكل (<span className="font-mono tabular-nums">{stats.total}</span>)
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('promote')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'promote'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#059669] dark:text-[#10B981] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D]'
              }`}
            >
              مستحقو الترقية (<span className="font-mono tabular-nums">{stats.eligiblePromote}</span>)
            </button>
            {includeFailingAsRepeaters && (
              <button
                type="button"
                onClick={() => setStatusFilter('repeat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  statusFilter === 'repeat'
                    ? 'bg-[#3156C9] text-white shadow-xs'
                    : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#B45309] dark:text-[#D69B42] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D]'
                }`}
              >
                المعيدون (<span className="font-mono tabular-nums">{stats.repeating}</span>)
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter('exclude')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'exclude'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#C83D4B] dark:text-[#E35D6A] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D]'
              }`}
            >
              المستبعدون (<span className="font-mono tabular-nums">{stats.excluded}</span>)
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('migrated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === 'migrated'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#3156C9] dark:text-[#60A5FA] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D]'
              }`}
            >
              مُرحّلون مسبقاً (<span className="font-mono tabular-nums">{stats.alreadyMigrated}</span>)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم الطالب أو رقم القيد..."
              className="w-full h-9 pr-8 pl-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-xs text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:outline-hidden focus:border-[#2785F5]"
            />
            <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-[#8493A8] absolute right-2.5 top-2.5" />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939]">
          <table className="w-full text-right border-collapse text-xs select-none">
            <thead>
              <tr className="bg-[#EDF1F7] dark:bg-[#26364B] border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] font-bold">
                <th className="p-3 text-center w-12 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">ت</th>
                <th className="p-3 border-l border-[#DCE3ED] dark:border-[#2D3B4D] min-w-[180px]">اسم الطالب ورقم القيد</th>
                <th className="p-3 border-l border-[#DCE3ED] dark:border-[#2D3B4D] text-center">النتيجة الرسمية</th>
                <th className="p-3 border-l border-[#DCE3ED] dark:border-[#2D3B4D] text-center min-w-[130px]">الصف والشعبة الحالية</th>
                <th className="p-3 border-l border-[#DCE3ED] dark:border-[#2D3B4D] text-center">الإجراء المعتمد</th>
                <th className="p-3 border-l border-[#DCE3ED] dark:border-[#2D3B4D] text-center min-w-[150px]">الصف في السنة الجديدة</th>
                <th className="p-3 border-l border-[#DCE3ED] dark:border-[#2D3B4D] text-center min-w-[160px]">الشعبة في السنة الجديدة</th>
                <th className="p-3 text-center min-w-[100px]">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D] font-sans">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B] dark:text-[#8493A8] font-bold">
                    لا توجد سجلات مطابقة للفلتر أو البحث المحدد.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((item, idx) => {
                  const isPromoted = item.action === 'promote' && !item.isAlreadyMigrated;
                  const isRepeater = item.action === 'repeat' && !item.isAlreadyMigrated;

                  return (
                    <tr
                      key={item.student.id}
                      className={`hover:bg-[#F8FAFC] dark:hover:bg-[#202E40] transition-colors ${
                        item.isAlreadyMigrated ? 'opacity-75 bg-[#3156C9]/5 dark:bg-[#2785F5]/8' : ''
                      }`}
                    >
                      <td className="p-2.5 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        <div className="font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-1.5">
                          <span>{item.student.name}</span>
                          <StudentStatusBadge status={item.student.status} />
                        </div>
                        <div className="text-[10px] text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums">
                          قيد: {item.student.registrationNumber || `#${item.student.seatNumber}`}
                        </div>
                      </td>
                      <td className="p-2.5 text-center border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.statusFinal === 'ناجح' ||
                            item.statusFinal === 'ناجح — إعفاء عام' ||
                            item.statusFinal === 'معفى عام'
                              ? 'bg-[#10B981]/12 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30'
                              : item.statusFinal === 'راسب'
                              ? 'bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 text-[#C83D4B] dark:text-[#E35D6A] border border-[#E35D6A]/30'
                              : 'bg-[#D69B42]/10 dark:bg-[#D69B42]/15 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30'
                          }`}
                        >
                          {item.statusFinal}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono text-[#475569] dark:text-[#A8B5C7] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        {item.sourceClass?.name} ({item.sourceSection?.name})
                      </td>
                      <td className="p-2.5 text-center border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        {item.action === 'promote' && (
                          <span className="inline-flex items-center gap-1 text-[#059669] dark:text-[#10B981] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ترقية للصف الأعلى</span>
                          </span>
                        )}
                        {item.action === 'repeat' && (
                          <span className="inline-flex items-center gap-1 text-[#B45309] dark:text-[#D69B42] font-bold">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>معيد بالصف نفسه</span>
                          </span>
                        )}
                        {item.action === 'graduate' && (
                          <span className="inline-flex items-center gap-1 text-[#3156C9] dark:text-[#60A5FA] font-bold">
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>خريج</span>
                          </span>
                        )}
                        {item.action === 'exclude' && (
                          <span
                            className="inline-flex items-center gap-1 text-[#C83D4B] dark:text-[#E35D6A] font-bold"
                            title={item.reason}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>مستبعد</span>
                          </span>
                        )}
                      </td>

                      {/* Target Class Name in New Academic Year */}
                      <td className="p-2.5 text-center font-bold text-[#1E293B] dark:text-[#E2E8F0] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        {item.action === 'promote' ? (
                          targetClassId === 'graduated' ? (
                            <span className="text-[#3156C9] dark:text-[#60A5FA] font-normal">خريج</span>
                          ) : (
                            <span className="text-[#059669] dark:text-[#10B981]">{targetClassObj?.name}</span>
                          )
                        ) : item.action === 'repeat' ? (
                          <span className="text-[#B45309] dark:text-[#D69B42]">
                            {repeaterTargetClassObj ? repeaterTargetClassObj.name : 'غير محدد'}
                          </span>
                        ) : (
                          <span className="text-[#64748B] dark:text-[#8493A8] font-normal">—</span>
                        )}
                      </td>

                      {/* Target Section dropdown in New Academic Year */}
                      <td className="p-2.5 text-center border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                        {isPromoted ? (
                          targetClassId === 'graduated' ? (
                            <span className="text-[#64748B] dark:text-[#8493A8] font-mono">خريج</span>
                          ) : (
                            <select
                              value={studentTargetSections[item.student.id] || ''}
                              onChange={(e) =>
                                setStudentTargetSections((prev) => ({
                                  ...prev,
                                  [item.student.id]: e.target.value,
                                }))
                              }
                              className="w-full h-8 px-2 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] focus:outline-hidden focus:border-[#2785F5]"
                            >
                              <option value="">— اختر الشعبة —</option>
                              {activeTargetSections.map((ts) => (
                                <option key={ts.id} value={ts.id}>
                                  شعبة {ts.name}
                                </option>
                              ))}
                            </select>
                          )
                        ) : isRepeater ? (
                          <select
                            value={repeaterTargetSections[item.student.id] || ''}
                            onChange={(e) =>
                              setRepeaterTargetSections((prev) => ({
                                ...prev,
                                [item.student.id]: e.target.value,
                              }))
                            }
                            className="w-full h-8 px-2 bg-[#D69B42]/10 dark:bg-[#26364B] border border-[#D69B42]/40 rounded-lg text-xs font-bold text-[#B45309] dark:text-[#D69B42] focus:outline-hidden focus:border-[#D69B42]"
                          >
                            <option value="">— شعبة المعيدين —</option>
                            {availableRepeaterSections.map((rs) => (
                              <option key={rs.id} value={rs.id}>
                                شعبة {rs.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[#64748B] dark:text-[#8493A8] font-sans text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-2.5 text-center">
                        {item.isAlreadyMigrated ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3156C9]/8 dark:bg-[#2785F5]/12 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/25">
                            مُرحّل مسبقاً
                          </span>
                        ) : isPromoted || isRepeater ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/12 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                            جاهز للترحيل
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border border-[#DCE3ED] dark:border-[#2D3B4D]">
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

      {/* SECTION 5: Review & Confirmation Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-[#1E293B] dark:text-[#E2E8F0]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 flex items-center justify-center text-[#3156C9] dark:text-[#60A5FA]">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">مراجعة وتأكيد ترحيل الطلاب النهائي</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                    تدقيق ربط صفوف وشُعب السنة الجديدة وتوزيع الطلاب قبل الاعتماد
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              {/* Summary Specs Card */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] font-mono">
                <div className="flex flex-col gap-1">
                  <span className="text-[#64748B] dark:text-[#8493A8] font-sans">السنة المنصرمة:</span>
                  <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0] font-sans">{sourceYearObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[#64748B] dark:text-[#8493A8] font-sans">السنة الجديدة المستقبلة:</span>
                  <span className="font-bold text-[#3156C9] dark:text-[#60A5FA] font-sans">{targetYearObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[#64748B] dark:text-[#8493A8] font-sans">الصف المنصرم:</span>
                  <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0] font-sans">{sourceClassObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[#64748B] dark:text-[#8493A8] font-sans">الصف الجديد للناجحين:</span>
                  <span className="font-bold text-[#059669] dark:text-[#10B981] font-sans">
                    {targetClassId === 'graduated' ? 'خريجون (تخرج)' : targetClassObj?.name}
                  </span>
                </div>
                {includeFailingAsRepeaters && (
                  <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                    <span className="text-[#64748B] dark:text-[#8493A8] font-sans">صف المعيدين في السنة الجديدة:</span>
                    <span className="font-bold text-[#B45309] dark:text-[#D69B42] font-sans">
                      {repeaterTargetClassObj?.name} (ربط بالسنة الجديدة: {targetYearObj?.name})
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <span className="text-[#64748B] dark:text-[#8493A8] font-sans">إجمالي الانتسابات التي ستُحدث بالسنة الجديدة:</span>
                  <span className="text-base font-black text-[#3156C9] dark:text-[#60A5FA] tabular-nums">
                    {stats.pendingEligible + (includeFailingAsRepeaters ? stats.repeating : 0)} طالب
                  </span>
                </div>
              </div>

              {/* Data Safety Notice */}
              <div className="p-3 rounded-xl bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  ضمان السجلات التاريخية: لن تمس درجات أو بيانات العام الماضي {sourceYearObj?.name}. ستُنشأ سجلات جديدة تماماً في السنة الجديدة {targetYearObj?.name} مع إمكانية الوصول للسجلات القديمة عبر الفلاتر دائماً.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                العودة للتعديل (إلغاء)
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAndExecutePromotion}
                className="px-5 py-2.5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-black transition-colors shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري تنفيذ وحفظ الترحيل...' : 'تأكيد وتنفيذ عملية الترحيل نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inline Add Academic Year */}
      {isAddYearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                <span>إنشاء عام دراسي جديد للترحيل</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddYearModalOpen(false);
                  setAddYearError(null);
                }}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">اسم العام الدراسي الجديد (مثال: 2027–2028)</label>
              <input
                type="text"
                value={newYearName}
                onChange={(e) => {
                  setNewYearName(e.target.value);
                  if (addYearError) setAddYearError(null);
                }}
                placeholder="2027–2028"
                className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:outline-hidden focus:border-[#2785F5]"
              />
              {addYearError && <span className="text-xs text-[#C83D4B] dark:text-[#E35D6A] font-bold">{addYearError}</span>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateAcademicYear}
                className="px-5 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-black transition-colors shadow-sm cursor-pointer"
              >
                إنشاء العام الدراسي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inline Add Section to Target Class */}
      {isAddSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                <span>إضافة شعبة جديدة للصف ({targetClassObj?.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddSectionModalOpen(false);
                  setAddSectionError(null);
                }}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">اسم الشعبة (مثال: أ، ب، ج، د)</label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => {
                  setNewSectionName(e.target.value);
                  if (addSectionError) setAddSectionError(null);
                }}
                placeholder="أ"
                className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:outline-hidden focus:border-[#2785F5]"
              />
              {addSectionError && <span className="text-xs text-[#C83D4B] dark:text-[#E35D6A] font-bold">{addSectionError}</span>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setIsAddSectionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateSection}
                className="px-5 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-black transition-colors shadow-sm cursor-pointer"
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
