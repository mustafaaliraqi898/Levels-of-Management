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
  ShieldCheck,
  Copy,
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

  // Filter Source Classes strictly belonging to Source Academic Year
  const availableSourceClasses = useMemo(() => {
    return classes
      .filter((c) => !c.academicYearId || c.academicYearId === sourceYearId)
      .sort((a, b) => a.order - b.order);
  }, [classes, sourceYearId]);

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

      // Check for already migrated (Refined Duplicate Detection)
      const cleanReg = student.registrationNumber ? student.registrationNumber.trim() : '';
      const cleanName = student.name.trim().toLowerCase();
      const cleanPhone = student.fatherPhone ? student.fatherPhone.trim() : '';

      const isAlreadyMigrated = targetYearStudents.some((s) => {
        // Match by registration number if non-empty
        if (cleanReg.length > 0 && s.registrationNumber && s.registrationNumber.trim() === cleanReg) {
          return true;
        }
        // Match by exact name and target class in target year
        if (s.name.trim().toLowerCase() === cleanName) {
          if (assignedTargetClassId && s.classId === assignedTargetClassId) {
            return true;
          }
          if (cleanPhone.length > 0 && s.fatherPhone && s.fatherPhone.trim() === cleanPhone) {
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
  const handleConfirmAndExecutePromotion = () => {
    if (!sourceYearId || !targetYearId || sourceYearId === targetYearId) {
      return;
    }

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
        text: `تمت عملية الترحيل بنجاح! تم ترفيع ${res.promotedCount} طالب وتسجيل ${res.repeatingCount} معيد في صفوف السنة الجديدة (${targetYearObj?.name})، وتم الحفاظ الكامل على درجات وسجلات السنة المنصرمة.`,
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 flex items-center gap-2 flex-wrap">
              <span>ترحيل الطلاب وترقيتهم للسنة الدراسية الجديدة</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ربط دقيق بين صفوف وشُعب كل سنة
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              ترقية الناجحين والمعفين وتأطير المعيدين في صفوف وشُعب السنة الجديدة الحصرية، مع حماية تامة وغير قابلة للتعديل للدرجات السابقة.
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

      {/* SECTION 1: Academic Years & Class Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
              ١
            </div>
            <h2 className="text-base font-bold text-slate-100">
              تحديد الأعوام الدراسية والصفوف المخصصة بكل سنة
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCopyClassStructure}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>نسخ هيكل الصفوف والشُعب والمواد إلى السنة الجديدة</span>
          </button>
        </div>

        {/* 1. Academic Years */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Source Academic Year */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>1. السنة الدراسية المنصرمة (المصدر)</span>
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

          {/* Direction Arrow */}
          <div className="hidden lg:flex items-center justify-center pb-2 text-emerald-400">
            <ArrowRightLeft className="w-6 h-6" />
          </div>

          {/* Target Academic Year */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>2. السنة الدراسية الجديدة (الوجهة)</span>
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

        {/* Warning if target year has no classes */}
        {availableTargetClasses.length === 0 && targetYearId && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                السنة الدراسية الجديدة ({targetYearObj?.name}) لا تحتوي على أي صفوف معرّفة بعد.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyClassStructure}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Copy className="w-4 h-4" />
              <span>نسخ هيكل الصفوف والشُعب من السنة المنصرمة فورياً</span>
            </button>
          </div>
        )}

        {/* 2. Source Class & Target Class Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-800">
          {/* Source Class (تُعرض فقط صفوف السنة المنصرمة) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>الصف المنصرم (من سنة {sourceYearObj?.name})</span>
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

            {/* Source Sections Multi-select */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">
                  شُعب الصف المنصرم ({sourceYearObj?.name}):
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
                <span className="text-[11px] text-slate-500 italic">لا توجد شُعب منفصلة لهذا الصف</span>
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
                          {secCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Target Class (تُعرض فقط صفوف السنة الجديدة) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>الصف الوجهة للناجحين (في سنة {targetYearObj?.name})</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                شُعب الصف الجديد: {availableTargetSections.length}
              </span>
            </div>

            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-hidden"
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
                  <span className="text-[11px] font-bold text-slate-300">
                    الشُعب المستقبلة للناجحين في السنة الجديدة ({targetYearObj?.name}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddSectionModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ إضافة شعبة</span>
                  </button>
                </div>

                {availableTargetSections.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex items-center justify-between">
                    <span>الصف المختار في السنة الجديدة لا يحتوي على شُعب.</span>
                    <button
                      type="button"
                      onClick={() => setIsAddSectionModalOpen(true)}
                      className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
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

        {/* Options Row: Repeater Students Handling */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFailingAsRepeaters}
                onChange={(e) => setIncludeFailingAsRepeaters(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-500"
              />
              <span className="font-bold text-amber-300">
                تسجيل الطلاب الراسبين كـ «معيدين» في السنة الجديدة ({targetYearObj?.name})
              </span>
            </label>

            {includeFailingAsRepeaters && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">صف المعيدين بالسنة الجديدة:</span>
                <span className="font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-800/40">
                  {repeaterTargetClassObj ? repeaterTargetClassObj.name : 'غير متوفر (يرجى نسخ الهيكل)'}
                </span>
              </div>
            )}
          </div>

          {includeFailingAsRepeaters && (
            <p className="text-[11px] text-slate-400">
              * سيتم ربط الطلاب الراسبين بصف {repeaterTargetClassObj?.name || 'المعيدين'} التابع مباشرة للعام الدراسي الجديد {targetYearObj?.name} وليس بالصف القديم، مع تعيين شُعبهم المخصصة.
            </p>
          )}
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
          <span className="text-[11px] text-amber-400 font-bold">المعيدون (الراسبون)</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.repeating}</span>
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
          <span className="text-[11px] text-emerald-300 font-bold">الجاهزون للتوزيع والترحيل</span>
          <span className="text-xl font-black font-mono text-emerald-300 mt-1">
            {stats.pendingEligible + (includeFailingAsRepeaters ? stats.repeating : 0)}
          </span>
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
                  توزيع الناجحين والمعيدين على شُعب السنة الجديدة ({targetYearObj?.name})
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
                <span>التوزيع اليدوي</span>
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
                <span>التوزيع التلقائي المتوازن</span>
              </button>
            </div>
          </div>

          {/* Live Section Balancer Counters */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-bold text-slate-300">
              توزيع أعداد الناجحين على شُعب الصف الجديد ({targetClassObj?.name}):
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
              <h2 className="text-base font-bold text-slate-100">جدول تعيينات الصفوف والشُعب للعام الجديد</h2>
              <p className="text-xs text-slate-400">
                تأكد من صحة الصف والشعبة المسندة لكل طالب ناجح أو معيد قبل اعتماد العملية
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={stats.pendingEligible === 0 && (!includeFailingAsRepeaters || stats.repeating === 0)}
            onClick={handleProceedToReview}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GraduationCap className="w-4 h-4" />
            <span>معاينة ومراجعة الترحيل قبل الاعتماد ({stats.pendingEligible + (includeFailingAsRepeaters ? stats.repeating : 0)} طالب)</span>
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
            {includeFailingAsRepeaters && (
              <button
                type="button"
                onClick={() => setStatusFilter('repeat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  statusFilter === 'repeat' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-950 text-amber-400 hover:bg-slate-800'
                }`}
              >
                المعيدون ({stats.repeating})
              </button>
            )}
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
                <th className="p-3 border-l border-slate-800 min-w-[180px]">اسم الطالب ورقم القيد</th>
                <th className="p-3 border-l border-slate-800 text-center">النتيجة الرسمية</th>
                <th className="p-3 border-l border-slate-800 text-center min-w-[130px]">الصف والشعبة الحالية</th>
                <th className="p-3 border-l border-slate-800 text-center">الإجراء المعتمد</th>
                <th className="p-3 border-l border-slate-800 text-center min-w-[150px]">الصف في السنة الجديدة</th>
                <th className="p-3 border-l border-slate-800 text-center min-w-[160px]">الشعبة في السنة الجديدة</th>
                <th className="p-3 text-center min-w-[100px]">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
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
                            <span>ترقية للصف الأعلى</span>
                          </span>
                        )}
                        {item.action === 'repeat' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>معيد بالصف نفسه</span>
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
                            <span>مستبعد</span>
                          </span>
                        )}
                      </td>

                      {/* Target Class Name in New Academic Year */}
                      <td className="p-2.5 text-center font-bold text-slate-200 border-l border-slate-800">
                        {item.action === 'promote' ? (
                          targetClassId === 'graduated' ? (
                            <span className="text-cyan-400 font-normal">خريج</span>
                          ) : (
                            <span className="text-emerald-400">{targetClassObj?.name}</span>
                          )
                        ) : item.action === 'repeat' ? (
                          <span className="text-amber-400">
                            {repeaterTargetClassObj ? repeaterTargetClassObj.name : 'غير محدد'}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">—</span>
                        )}
                      </td>

                      {/* Target Section dropdown in New Academic Year */}
                      <td className="p-2.5 text-center border-l border-slate-800">
                        {isPromoted ? (
                          targetClassId === 'graduated' ? (
                            <span className="text-slate-500 font-mono">خريج</span>
                          ) : (
                            <select
                              value={studentTargetSections[item.student.id] || ''}
                              onChange={(e) =>
                                setStudentTargetSections((prev) => ({
                                  ...prev,
                                  [item.student.id]: e.target.value,
                                }))
                              }
                              className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-emerald-300 focus:outline-hidden focus:border-emerald-500"
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
                            className="w-full h-8 px-2 bg-slate-900 border border-amber-800/60 rounded-lg text-xs font-bold text-amber-300 focus:outline-hidden focus:border-amber-500"
                          >
                            <option value="">— شعبة المعيدين —</option>
                            {availableRepeaterSections.map((rs) => (
                              <option key={rs.id} value={rs.id}>
                                شعبة {rs.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-500 font-sans text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-2.5 text-center">
                        {item.isAlreadyMigrated ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            مُرحّل مسبقاً
                          </span>
                        ) : isPromoted || isRepeater ? (
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
                    تدقيق ربط صفوف وشُعب السنة الجديدة وتوزيع الطلاب قبل الاعتماد
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
                  <span className="text-slate-400 font-sans">السنة المنصرمة:</span>
                  <span className="font-bold text-slate-100 font-sans">{sourceYearObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">السنة الجديدة المستقبلة:</span>
                  <span className="font-bold text-emerald-400 font-sans">{targetYearObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">الصف المنصرم:</span>
                  <span className="font-bold text-slate-100 font-sans">{sourceClassObj?.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-sans">الصف الجديد للناجحين:</span>
                  <span className="font-bold text-emerald-400 font-sans">
                    {targetClassId === 'graduated' ? 'خريجون (تخرج)' : targetClassObj?.name}
                  </span>
                </div>
                {includeFailingAsRepeaters && (
                  <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-slate-850">
                    <span className="text-slate-400 font-sans">صف المعيدين في السنة الجديدة:</span>
                    <span className="font-bold text-amber-400 font-sans">
                      {repeaterTargetClassObj?.name} (ربط بالسنة الجديدة: {targetYearObj?.name})
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-slate-850">
                  <span className="text-slate-400 font-sans">إجمالي الانتسابات التي ستُحدث بالسنة الجديدة:</span>
                  <span className="text-base font-black text-emerald-400">
                    {stats.pendingEligible + (includeFailingAsRepeaters ? stats.repeating : 0)} طالب
                  </span>
                </div>
              </div>

              {/* Data Safety Notice */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  ضمان السجلات التاريخية: لن تمس درجات أو بيانات العام الماضي {sourceYearObj?.name}. ستُنشأ سجلات جديدة تماماً في السنة الجديدة {targetYearObj?.name} مع إمكانية الوصول للسجلات القديمة عبر الفلاتر دائماً.
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
