import React, { useState, useMemo, useEffect } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  ExemptionSettings,
  GeneralExemptionResult,
} from '../../types';
import { db, buildGradeKey } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import {
  evaluateStudentExemption,
  ROUNDING_RULE_LABELS,
} from '../../services/calculations';
import {
  Award,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  Search,
  Filter,
  AlertCircle,
  HelpCircle,
  Printer,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Users,
  Check,
  RotateCcw,
  Database,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Eye,
} from 'lucide-react';
import { ReportHeader } from '../Common/ReportHeader';
import { ExportCertificatesPdfModal } from './ExportCertificatesPdfModal';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { StudentStatusBadge } from '../Common/StudentStatusBadge';

interface ExemptionViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
}

export const ExemptionView: React.FC<ExemptionViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
}) => {
  // 1. Academic selection filters
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  // Ensure year selection valid
  useEffect(() => {
    if (!selectedYearId && currentYear?.id) {
      setSelectedYearId(currentYear.id);
    }
  }, [selectedYearId, currentYear]);

  // Classes & sections available strictly for selected year
  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  const availableSections = useMemo(() => {
    return sections.filter((s) => s.classId === selectedClassId);
  }, [sections, selectedClassId]);

  useEffect(() => {
    if (availableSections.length === 0) {
      if (selectedSectionId !== '') setSelectedSectionId('');
    } else if (availableSections.length === 1) {
      setSelectedSectionId(availableSections[0].id);
    } else {
      if (!availableSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(availableSections[0].id);
      }
    }
  }, [availableSections, selectedSectionId]);

  // Subjects for the selected class
  const classSubjects = useMemo(() => {
    return subjects
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [subjects, selectedClassId]);

  // Students in selected year, class, and section
  const sectionStudents = useMemo(() => {
    return students
      .filter(
        (stu) =>
          stu.academicYearId === selectedYearId &&
          stu.classId === selectedClassId &&
          stu.sectionId === selectedSectionId
      )
      .sort((a, b) => a.seatNumber - b.seatNumber);
  }, [students, selectedYearId, selectedClassId, selectedSectionId]);

  const activeYear = academicYears.find((y) => y.id === selectedYearId);
  const activeClass = classes.find((c) => c.id === selectedClassId);
  const activeSection = sections.find((s) => s.id === selectedSectionId);

  // 2. Exemption Settings State (Tied strictly to selectedYearId)
  // 2. Exemption Settings State (Tied strictly to selectedYearId)
  const [savedSettings, setSavedSettings] = useState<ExemptionSettings>(() =>
    db.getExemptionSettings(selectedYearId)
  );

  // Sync savedSettings on selectedYearId or reactive db updates
  useEffect(() => {
    setSavedSettings(db.getExemptionSettings(selectedYearId));
    const unsubscribe = db.subscribe(() => {
      setSavedSettings(db.getExemptionSettings(selectedYearId));
    });
    return () => {
      unsubscribe();
    };
  }, [selectedYearId]);

  // Draft settings state for editing before clicking "حفظ الشروط"
  const [draftSettings, setDraftSettings] = useState<ExemptionSettings>(() =>
    db.getExemptionSettings(selectedYearId)
  );

  // Sync draft settings whenever selectedYearId changes
  useEffect(() => {
    const fresh = db.getExemptionSettings(selectedYearId);
    setDraftSettings(fresh);
    setSaveFeedback(null);
  }, [selectedYearId]);

  // Immediate toggle handlers ensuring 100% sync and instant calculation update
  const handleToggleGeneralExemption = (enabled: boolean) => {
    const updated: ExemptionSettings = {
      ...draftSettings,
      academicYearId: selectedYearId,
      isGeneralExemptionEnabled: enabled,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };
    setDraftSettings(updated);
    db.saveExemptionSettings(updated);
  };

  const handleToggleIndividualExemption = (enabled: boolean) => {
    const updated: ExemptionSettings = {
      ...draftSettings,
      academicYearId: selectedYearId,
      isIndividualExemptionEnabled: enabled,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };
    setDraftSettings(updated);
    db.saveExemptionSettings(updated);
  };

  // Track if there are unsaved draft changes
  const isDirty = useMemo(() => {
    return (
      draftSettings.generalMinAverage !== savedSettings.generalMinAverage ||
      draftSettings.generalMinSubjectScore !== savedSettings.generalMinSubjectScore ||
      draftSettings.enableGeneralJabr !== savedSettings.enableGeneralJabr ||
      draftSettings.individualMinScore !== savedSettings.individualMinScore ||
      draftSettings.isGeneralExemptionEnabled !== savedSettings.isGeneralExemptionEnabled ||
      draftSettings.isIndividualExemptionEnabled !== savedSettings.isIndividualExemptionEnabled ||
      draftSettings.isConfigured !== savedSettings.isConfigured
    );
  }, [draftSettings, savedSettings]);

  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const handleSaveSettings = () => {
    const toSave: ExemptionSettings = {
      ...draftSettings,
      academicYearId: selectedYearId,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };
    db.saveExemptionSettings(toSave);
    setSaveFeedback('تم حفظ واعتماد شروط الإعفاء للعام الدراسي بنجاح!');
    setTimeout(() => {
      setSaveFeedback(null);
    }, 4000);
  };

  const handleResetToDefaults = () => {
    const defaults = db.getDefaultExemptionSettings(selectedYearId);
    setDraftSettings(defaults);
    db.saveExemptionSettings(defaults);
  };

  // 3. View filters and tabs
  const [activeTab, setActiveTab] = useState<'general' | 'individual'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [individualSubjectFilter, setIndividualSubjectFilter] = useState<string>('all');
  const [showNearEligible, setShowNearEligible] = useState<boolean>(false);

  // 4. Evaluation of all students for the selected class/section using the SAVED settings
  const evaluatedResults: GeneralExemptionResult[] = useMemo(() => {
    return sectionStudents.map((student) => {
      // Map grades for each subject of this student
      const studentGrades: Record<string, GradeRecord | undefined> = {};
      classSubjects.forEach((sub) => {
        const key = buildGradeKey(
          selectedYearId,
          selectedClassId,
          selectedSectionId,
          sub.id,
          student.id
        );
        studentGrades[sub.id] = grades[key];
      });

      return evaluateStudentExemption(
        student,
        classSubjects,
        studentGrades,
        savedSettings,
        settings.roundingRule
      );
    });
  }, [
    sectionStudents,
    classSubjects,
    selectedYearId,
    selectedClassId,
    selectedSectionId,
    grades,
    savedSettings,
    settings.roundingRule,
  ]);

  // Filtered General Exemption Results:
  // Default: ONLY students who are actually eligible ('معفى عام')
  // If showNearEligible is active: ALSO show students with meetsAverage and strictly 1 or 2 subjects < minSubjectScore ('قريب من الاستحقاق')
  const filteredGeneralResults = useMemo(() => {
    const base = evaluatedResults.filter((r) => {
      if (savedSettings.isGeneralExemptionEnabled && r.status === 'معفى عام') return true;
      if (showNearEligible && r.isNearEligible) return true;
      return false;
    });

    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter(
      (r) =>
        r.student.name.toLowerCase().includes(q) ||
        (r.student.registrationNumber && r.student.registrationNumber.includes(q))
    );
  }, [evaluatedResults, showNearEligible, searchQuery]);

  // Students strictly eligible for General Exemption ('معفى عام') in current active selection
  const strictlyGeneralExemptStudents = useMemo(() => {
    return evaluatedResults
      .filter((r) => savedSettings.isGeneralExemptionEnabled && r.status === 'معفى عام')
      .map((r) => r.student);
  }, [evaluatedResults]);

  // Certificate selection & modal states
  const [selectedForCertificateIds, setSelectedForCertificateIds] = useState<string[]>([]);
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
  const [noStudentSelectedNotice, setNoStudentSelectedNotice] = useState<string | null>(null);

  // Auto-select all eligible students whenever active class/section/evaluation changes
  useEffect(() => {
    setSelectedForCertificateIds(strictlyGeneralExemptStudents.map((s) => s.id));
  }, [strictlyGeneralExemptStudents]);

  const toggleStudentForCertificate = (studentId: string) => {
    setSelectedForCertificateIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleSelectAllForCertificates = () => {
    if (selectedForCertificateIds.length === strictlyGeneralExemptStudents.length) {
      setSelectedForCertificateIds([]);
    } else {
      setSelectedForCertificateIds(strictlyGeneralExemptStudents.map((s) => s.id));
    }
  };

  const handleOpenExportCertificates = () => {
    if (selectedForCertificateIds.length === 0) {
      setNoStudentSelectedNotice(
        strictlyGeneralExemptStudents.length === 0
          ? 'لا يوجد طلبة معفون عاماً في هذا الصف والشعبة حالياً لإصدار شهادات لهم.'
          : 'يرجى تحديد طالب واحد على الأقل من قائمة الطلبة المعفين عاماً لتصدير شهاداتهم.'
      );
      setTimeout(() => setNoStudentSelectedNotice(null), 5000);
      return;
    }
    setNoStudentSelectedNotice(null);
    setIsExportPdfModalOpen(true);
  };

  // Diagnostics UI state
  const [expandedStudentDiagnosticIds, setExpandedStudentDiagnosticIds] = useState<string[]>([]);
  const [showAllSectionDiagnostic, setShowAllSectionDiagnostic] = useState<boolean>(false);

  const toggleStudentDiagnostic = (studentId: string) => {
    setExpandedStudentDiagnosticIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleExpandAllDiagnostics = () => {
    if (expandedStudentDiagnosticIds.length > 0) {
      setExpandedStudentDiagnosticIds([]);
    } else {
      setExpandedStudentDiagnosticIds(filteredIndividualStudents.map((s) => s.student.id));
    }
  };

  // Individual Exemption Eligible Students Grouping:
  // Rules:
  // 1. Evaluate each subject independently (Requirement 5: Individual exemption is independent of General Exemption)
  // 2. Exclude students with 0 qualifying individual subjects
  // 3. For each qualifying student, display their qualifying subjects and diagnostics
  // 4. Group by student so each student appears with all their qualifying subjects
  const eligibleIndividualStudents = useMemo(() => {
    // If individual exemption is disabled for this year, return empty list
    if (!savedSettings.isIndividualExemptionEnabled) return [];

    return evaluatedResults
      .filter((res) => {
        // Keep students who have at least one qualifying individual subject
        const qualifying = res.individualResults.filter(
          (sub) => sub.status === 'مستحق للإعفاء الفردي' && sub.yearlyScore !== null && sub.yearlyScore >= savedSettings.individualMinScore
        );
        return qualifying.length > 0;
      })
      .map((res) => {
        const eligibleSubjects = res.individualResults
          .filter(
            (sub) => sub.status === 'مستحق للإعفاء الفردي' && sub.yearlyScore !== null && sub.yearlyScore >= savedSettings.individualMinScore
          )
          .map((sub) => ({
            subjectId: sub.subjectId,
            subjectName: sub.subjectName,
            yearlyScore: sub.yearlyScore as number,
            requiredScore: sub.requiredScore,
            diagnosticReason: sub.diagnosticReason,
          }));

        return {
          student: res.student,
          isGeneralExempt: res.status === 'معفى عام',
          eligibleSubjects,
          eligibleCount: eligibleSubjects.length,
          requiredScore: savedSettings.individualMinScore,
          allSubjectsResults: res.individualResults,
        };
      });
  }, [evaluatedResults, savedSettings.individualMinScore, savedSettings.isIndividualExemptionEnabled]);

  // Filtered Individual Exemption Students by Search Query & Subject Filter
  const filteredIndividualStudents = useMemo(() => {
    return eligibleIndividualStudents.filter((row) => {
      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = row.student.name.toLowerCase().includes(q);
        const matchesReg = row.student.registrationNumber && row.student.registrationNumber.includes(q);
        const matchesSub = row.eligibleSubjects.some((s) => s.subjectName.toLowerCase().includes(q));
        if (!matchesName && !matchesReg && !matchesSub) return false;
      }

      // Subject Filter (Filter students eligible in selected subject)
      if (individualSubjectFilter !== 'all') {
        const hasSubject = row.eligibleSubjects.some((s) => s.subjectId === individualSubjectFilter);
        if (!hasSubject) return false;
      }

      return true;
    });
  }, [eligibleIndividualStudents, searchQuery, individualSubjectFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalStudents = evaluatedResults.length;
    const generalExempt = evaluatedResults.filter((r) => r.status === 'معفى عام').length;
    const nearEligibleCount = evaluatedResults.filter((r) => r.isNearEligible).length;
    const generalIncomplete = evaluatedResults.filter((r) => !r.isComplete).length;
    const generalNotEligible = evaluatedResults.filter((r) => r.status === 'غير مشمول' && !r.isNearEligible).length;

    // Distinct count of students benefiting from Individual Exemption (excluding general exempt)
    const individualExemptCount = eligibleIndividualStudents.length;

    return {
      totalStudents,
      generalExempt,
      nearEligibleCount,
      generalIncomplete,
      generalNotEligible,
      individualExemptCount,
    };
  }, [evaluatedResults, eligibleIndividualStudents]);

  const activeYearObj = academicYears.find((y) => y.id === selectedYearId);
  const activeClassObj = classes.find((c) => c.id === selectedClassId);
  const activeSectionObj = sections.find((s) => s.id === selectedSectionId);

  // Print Action
  const [seedSyncFeedback, setSeedSyncFeedback] = useState<string | null>(null);
  const [showTestCasesGuide, setShowTestCasesGuide] = useState<boolean>(false);

  const handleCompleteSeedData = () => {
    const res = db.completeSeedData();
    if (res.newGradesCount > 0 || res.newStudentsCount > 0 || res.newSubjectsCount > 0) {
      setSeedSyncFeedback(
        `تم استكمال البيانات التجريبية بنجاح: (${res.newGradesCount} سجل درجات جديد، ${res.newStudentsCount} طالب، ${res.newSubjectsCount} مواد).`
      );
    } else {
      setSeedSyncFeedback('جميع البيانات التجريبية مكتملة مسبقاً بنسبة 100% لجميع الصفوف والمواد والطلاب دون أي نواقص.');
    }
    setTimeout(() => {
      setSeedSyncFeedback(null);
    }, 6000);
  };

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* 1. Header Bar */}
      <div className="no-print bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 flex items-center justify-center text-[#3156C9] dark:text-[#60A5FA] shadow-xs">
              <Award className="w-6 h-6 font-bold" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2 flex-wrap">
                الإعفاء العام والفردي
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30 font-bold">
                  ضوابط واستحقاق الطلبة
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#8493A8] mt-1">
                تحديد الطلبة المشمولين بالإعفاء العام والإعفاء الفردي في المواد الدراسية استناداً إلى درجات السعي السنوي
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            title="معاينة وطباعة كشف نتائج الإعفاء الحالي"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة ومعاينة الكشف</span>
          </button>

          <button
            onClick={handleCompleteSeedData}
            className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="التحقق من اكتمال درجات جميع الطلاب والمواد وتحديثها بأمان"
          >
            <Database className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
            استكمال بيانات الاختبار
          </button>
        </div>
      </div>

      {/* 2. Notification Banner if Exemption Settings not yet saved/configured for this year */}
      {!savedSettings.isConfigured && (
        <div className="bg-[#D69B42]/10 border border-[#D69B42]/35 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-sm">
          <AlertCircle className="w-6 h-6 text-[#B45309] dark:text-[#D69B42] shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm">
            <h4 className="font-bold text-[#B45309] dark:text-[#D69B42] text-sm sm:text-base">
              تنبيه: شروط الإعفاء للعام الدراسي ({activeYearObj?.name || 'المحدد'}) لم تُعتمد وتُحفظ بعد
            </h4>
            <p className="text-[#475569] dark:text-[#A8B5C7] mt-1 leading-relaxed">
              يُرجى مراجعة إعدادات شروط الإعفاء المقترحة أدناه والضغط على زر{' '}
              <strong className="text-[#B45309] dark:text-[#D69B42] underline font-bold">«حفظ الشروط»</strong> لاعتماد النتائج الرسمية
              والتأكد من تطبيقها على طلاب هذا العام الدراسي.
            </p>
          </div>
        </div>
      )}

      {/* 3. Settings Section: "إعدادات شروط الإعفاء" */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 bg-[#F8FAFC] dark:bg-[#202E40] border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
            <h2 className="font-bold text-base sm:text-lg text-[#1E293B] dark:text-[#E2E8F0]">
              إعدادات شروط الإعفاء للعام الدراسي:
              <span className="text-[#3156C9] dark:text-[#60A5FA] font-extrabold mr-2">
                {activeYearObj?.name || selectedYearId}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {isDirty && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#D69B42]/10 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                توجد تعديلات بانتظار الحفظ
              </span>
            )}

            <button
              onClick={handleResetToDefaults}
              className="px-3 py-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-medium border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="استعادة القيم الافتراضية المقترحة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              افتراضي
            </button>

            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white"
            >
              <Save className="w-4 h-4" />
              حفظ الشروط
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {saveFeedback && (
          <div className="bg-[#10B981]/10 border-b border-[#10B981]/30 px-5 py-2.5 flex items-center gap-2 text-[#059669] dark:text-[#10B981] text-xs sm:text-sm font-semibold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {saveFeedback}
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* أ. شروط الإعفاء العام */}
            <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D69B42]" />
                  <h3 className="font-bold text-sm sm:text-base text-[#1E293B] dark:text-[#E2E8F0]">
                    أ. شروط الإعفاء العام
                  </h3>
                </div>
                <span className="text-xs text-[#475569] dark:text-[#A8B5C7] bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] px-2 py-0.5 rounded">
                  معدل جميع المواد
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. المعدل العام المطلوب */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#475569] dark:text-[#A8B5C7] flex items-center justify-between">
                    <span>المعدل العام المطلوب للإعفاء العام</span>
                    <span className="text-[11px] text-[#B45309] dark:text-[#D69B42] font-bold">(افتراضي: 85)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={50}
                      max={100}
                      step={0.5}
                      value={draftSettings.generalMinAverage}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          generalMinAverage: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-3 py-2 text-[#1E293B] dark:text-[#E2E8F0] font-bold font-mono tabular-nums text-sm focus:outline-none focus:border-[#2785F5] text-center"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-[#64748B] dark:text-[#8493A8]">%</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8493A8]">
                    الحد الأدنى لمعدل السعي السنوي لجميع المواد.
                  </p>
                </div>

                {/* 2. أقل درجة مسموحة في أي مادة */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#475569] dark:text-[#A8B5C7] flex items-center justify-between">
                    <span>أقل درجة مسموحة في أي مادة</span>
                    <span className="text-[11px] text-[#B45309] dark:text-[#D69B42] font-bold">(افتراضي: 75)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={50}
                      max={100}
                      step={1}
                      value={draftSettings.generalMinSubjectScore}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          generalMinSubjectScore: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-3 py-2 text-[#1E293B] dark:text-[#E2E8F0] font-bold font-mono tabular-nums text-sm focus:outline-none focus:border-[#2785F5] text-center"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-[#64748B] dark:text-[#8493A8]">درجة</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8493A8]">
                    لا يجوز أن تقل درجة السعي السنوي لأي مادة عن هذا الحد.
                  </p>
                </div>
              </div>

              {/* 3. مربع اختيار: تفعيل جبر كسر المعدل العام */}
              <div className="pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D] space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={draftSettings.isGeneralExemptionEnabled}
                      onChange={(e) => handleToggleGeneralExemption(e.target.checked)}
                      className="w-5 h-5 rounded-md text-[#3156C9] bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D] focus:ring-[#2785F5] cursor-pointer accent-[#3156C9] dark:accent-[#2785F5]"
                    />
                  </div>
                  <div className="flex-1">
                     <span className="text-xs sm:text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] transition-colors">
                        تفعيل نظام الإعفاء العام لهذا العام
                     </span>
                     <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-0.5">عند تعطيله، لن يُعتبر أي طالب معفى عاماً، حتى لو استوفى الشروط.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={draftSettings.enableGeneralJabr}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          enableGeneralJabr: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded-md text-[#3156C9] bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D] focus:ring-[#2785F5] cursor-pointer accent-[#3156C9] dark:accent-[#2785F5]"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] transition-colors">
                        تفعيل جبر كسر المعدل العام
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          draftSettings.enableGeneralJabr
                            ? 'bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] border-[#10B981]/30'
                            : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border-[#DCE3ED] dark:border-[#2D3B4D]'
                        }`}
                      >
                        {draftSettings.enableGeneralJabr ? 'مفعّل' : 'معطّل (استخدام المعدل الدقيق)'}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-[#475569] dark:text-[#A8B5C7] leading-relaxed bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg p-2.5">
                      <div className="font-semibold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-1.5 mb-1">
                        <Info className="w-3.5 h-3.5 text-[#B45309] dark:text-[#D69B42] shrink-0" />
                        نظام الجبر المعتمد في إعدادات مدرستك حالياً:
                        <span className="text-[#B45309] dark:text-[#D69B42] font-bold">
                          {ROUNDING_RULE_LABELS[settings.roundingRule]?.title || 'التقريب الرياضي'}
                        </span>
                      </div>
                      <p>
                        {draftSettings.enableGeneralJabr ? (
                          <>
                            عند التفعيل، يُطبّق نظام التقريب المعتمد أعلاه على معدل الطالب لتقييم استحقاق الإعفاء العام.
                            <br />
                            <strong>مثال:</strong> إذا كان الحد 85 والمعدل الأصلي 84.5، فإن المعدل بعد الجبر يصبح 85 ويُعتبر الطالب مستحقاً للإعفاء العام (بشرط استيفاء بقية المواد).
                          </>
                        ) : (
                          <>
                            عند إلغاء التفعيل، يُقارن المعدل الدقيق دون أي جبر بالحد الأدنى المطلوب.
                            <br />
                            <strong>مثال:</strong> إذا كان الحد 85 وكان المعدل الأصلي 84.5، لا يُعد الطالب مستحقاً لأن 84.5 &lt; 85.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* ب. شروط الإعفاء الفردي وملاحظات النظام */}
            <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2785F5]" />
                    <h3 className="font-bold text-sm sm:text-base text-[#1E293B] dark:text-[#E2E8F0]">
                      ب. شروط الإعفاء الفردي
                    </h3>
                  </div>
                  <span className="text-xs text-[#475569] dark:text-[#A8B5C7] bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] px-2 py-0.5 rounded">
                    لكل مادة مستقلة
                  </span>
                </div>

                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-medium text-[#475569] dark:text-[#A8B5C7] flex items-center justify-between">
                    <span>درجة السعي السنوي المطلوبة للإعفاء الفردي</span>
                    <span className="text-[11px] text-[#3156C9] dark:text-[#60A5FA] font-bold">(افتراضي: 90)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={50}
                      max={100}
                      step={1}
                      value={draftSettings.individualMinScore}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          individualMinScore: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-3 py-2 text-[#1E293B] dark:text-[#E2E8F0] font-bold font-mono tabular-nums text-sm focus:outline-none focus:border-[#2785F5] text-center"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-[#64748B] dark:text-[#8493A8]">درجة</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] leading-relaxed">
                    تُقيّم كل مادة دراسية بصورة مستقلة، ويُعد الطالب مستحقاً للإعفاء الفردي في المادة إذا بلغت درجة سعيها السنوي هذا الحد أو تجاوزته.
                  </p>

                  <label className="flex items-start gap-3 cursor-pointer group select-none pt-4 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={draftSettings.isIndividualExemptionEnabled}
                        onChange={(e) => handleToggleIndividualExemption(e.target.checked)}
                        className="w-5 h-5 rounded-md text-[#3156C9] bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D] focus:ring-[#2785F5] cursor-pointer accent-[#3156C9] dark:accent-[#2785F5]"
                      />
                    </div>
                    <div className="flex-1">
                       <span className="text-xs sm:text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] transition-colors">
                          تفعيل نظام الإعفاء الفردي لهذا العام
                       </span>
                       <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-0.5">عند تعطيله، لن يُعتبر أي طالب معفى فردياً، حتى لو استوفى الشروط.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* ملاحظة رسمية واضحة كما طلب المستخدم */}
              <div className="bg-[#D69B42]/10 border border-[#D69B42]/25 rounded-xl p-3.5 text-[11px] text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                <div className="font-bold text-[#B45309] dark:text-[#D69B42] flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  ملاحظة تنظيمية هامة:
                </div>
                القيم المذكورة أعلاه (85 للمعدل، 75 لأقل مادة، 90 للإعفاء الفردي) هي قيم افتراضية مقترحة ومتاح للمدير تعديلها وحفظها وفق الضوابط والتعليمات الوزارية المعتمدة للعام الدراسي الحالي.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar: Year, Class, Section, and Quick Search */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Year Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              العام الدراسي
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#1E293B] dark:text-[#E2E8F0] font-medium focus:outline-none focus:border-[#2785F5] cursor-pointer"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? '(الحالي)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              الصف الدراسي
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#1E293B] dark:text-[#E2E8F0] font-medium focus:outline-none focus:border-[#2785F5] cursor-pointer"
            >
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stage})
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              الشعبة
            </label>
            <select
              value={selectedSectionId}
              disabled={availableSections.length === 0}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className={`w-full bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#1E293B] dark:text-[#E2E8F0] font-medium focus:outline-none focus:border-[#2785F5] cursor-pointer ${
                availableSections.length === 0 ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {availableSections.length === 0 ? (
                <option value="">(الصف لا يحتوي على شُعب)</option>
              ) : (
                availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    شعبة {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Search Query */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
              بحث سريع عن طالب
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم أو رقم القيد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:outline-none focus:border-[#2785F5]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2.5 text-[#64748B] hover:text-[#1E293B] dark:text-[#8493A8] dark:hover:text-[#E2E8F0] cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5. Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
          <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8]">إجمالي طلاب الشعبة</p>
              <p className="text-lg font-black font-mono tabular-nums text-[#1E293B] dark:text-[#E2E8F0]">{stats.totalStudents}</p>
            </div>
            <Users className="w-6 h-6 text-[#64748B] dark:text-[#8493A8]" />
          </div>

          <div className="bg-[#D69B42]/10 border border-[#D69B42]/30 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#B45309] dark:text-[#D69B42] font-semibold">المعفون عاماً</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-black font-mono tabular-nums text-[#B45309] dark:text-[#D69B42]">{stats.generalExempt}</p>
                <span className="text-[10px] font-mono tabular-nums text-[#B45309]/80 dark:text-[#D69B42]/80">
                  ({stats.totalStudents > 0 ? Math.round((stats.generalExempt / stats.totalStudents) * 100) : 0}%)
                </span>
              </div>
            </div>
            <Award className="w-6 h-6 text-[#B45309] dark:text-[#D69B42]" />
          </div>

          <div className="bg-[#2785F5]/10 border border-[#2785F5]/30 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#3156C9] dark:text-[#60A5FA] font-semibold">مستحقون لإعفاء فردي</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-black font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA]">{stats.individualExemptCount}</p>
                <span className="text-[10px] text-[#3156C9]/80 dark:text-[#60A5FA]/80">
                  {savedSettings.isIndividualExemptionEnabled ? 'طالب مستحق' : '(معطّل)'}
                </span>
              </div>
            </div>
            <CheckCircle2 className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" />
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8]">حالات غير مكتملة</p>
              <p className="text-lg font-black font-mono tabular-nums text-[#475569] dark:text-[#A8B5C7]">{stats.generalIncomplete}</p>
            </div>
            <Clock className="w-6 h-6 text-[#64748B] dark:text-[#8493A8]" />
          </div>
        </div>
      </div>

      {/* 6. Tabs to Switch Between General Exemption & Individual Exemption */}
      <div className="flex items-center gap-2 border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'bg-[#3156C9] text-white shadow-sm'
              : 'text-[#475569] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B]'
          }`}
        >
          <Award className="w-4 h-4" />
          نتائج الإعفاء العام
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono tabular-nums ${
              activeTab === 'general'
                ? 'bg-white/20 text-white'
                : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7]'
            }`}
          >
            {showNearEligible && stats.nearEligibleCount > 0
              ? `${stats.generalExempt} (+${stats.nearEligibleCount})`
              : stats.generalExempt}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('individual')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'individual'
              ? 'bg-[#3156C9] text-white shadow-sm'
              : 'text-[#475569] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          نتائج الإعفاء الفردي في المواد
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono tabular-nums ${
              activeTab === 'individual'
                ? 'bg-white/20 text-white'
                : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7]'
            }`}
          >
            {stats.individualExemptCount}
          </span>
        </button>
      </div>

      {/* 7. SECTION A: RESULTS OF GENERAL EXEMPTION (نتائج الإعفاء العام) */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 bg-[#F8FAFC] dark:bg-[#202E40] border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-[#1E293B] dark:text-[#E2E8F0] text-base sm:text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
                قائمة المستحقين للإعفاء العام
                <span className="text-xs text-[#64748B] dark:text-[#8493A8] font-normal">
                  ({activeClassObj?.name} - شعبة {activeSectionObj?.name})
                </span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-0.5">
                المعدل المطلوب: {savedSettings.generalMinAverage}% | أقل درجة مسموحة: {savedSettings.generalMinSubjectScore} | جبر المعدل:{' '}
                {savedSettings.enableGeneralJabr
                  ? `مفعّل (${ROUNDING_RULE_LABELS[settings.roundingRule]?.title || 'تقريب'})`
                  : 'معطّل (معدل دقيق)'}
              </p>
            </div>

            {/* Actions: Export PDF & Toggle Near-Eligible */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
              {/* Export PDF Button */}
              <button
                type="button"
                onClick={handleOpenExportCertificates}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white shadow-sm active:scale-95"
                title="تصدير شهادات شكر وتقدير للإعفاء العام بصيغة PDF للطلبة المحددين"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
                <span>تصدير الشهادات PDF</span>
                {strictlyGeneralExemptStudents.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black font-mono tabular-nums bg-white/20 text-white">
                    {selectedForCertificateIds.length} / {strictlyGeneralExemptStudents.length}
                  </span>
                )}
              </button>

              {/* Toggle Button for Near-Eligible Students */}
              <button
                type="button"
                onClick={() => setShowNearEligible(!showNearEligible)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  showNearEligible
                    ? 'bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border-[#3156C9]/30 dark:border-[#2785F5]/40'
                    : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] border-[#DCE3ED] dark:border-[#2D3B4D] hover:bg-[#DCE3ED] dark:hover:bg-[#2D3B4D]'
                }`}
                title="إظهار الطلبة الذين يحققون شرط المعدل ولديهم مادة أو مادتان دون الحد الأدنى"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    showNearEligible
                      ? 'bg-[#3156C9] dark:bg-[#2785F5] border-[#3156C9] dark:border-[#2785F5] text-white font-bold'
                      : 'border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939]'
                  }`}
                >
                  {showNearEligible && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>إظهار الطلبة الذين لديهم مادة أو مادتان دون الحد الأدنى</span>
                {stats.nearEligibleCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono tabular-nums bg-[#D69B42]/15 text-[#B45309] dark:text-[#D69B42]">
                    {stats.nearEligibleCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Near-Eligible Filter Notification */}
          {showNearEligible && (
            <div className="bg-[#D69B42]/10 border-b border-[#D69B42]/25 px-5 py-2.5 text-xs text-[#B45309] dark:text-[#D69B42] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  يتم حالياً عرض الطلبة المستحقين فعلياً للإعفاء العام بالإضافة إلى الطلبة{' '}
                  <strong className="font-bold">«القريبين من الاستحقاق»</strong> (الذين استوفوا شرط المعدل ولديهم مادة واحدة أو مادتان فقط دون {savedSettings.generalMinSubjectScore}).
                </span>
              </div>
              <span className="text-[11px] font-bold whitespace-nowrap font-mono tabular-nums">
                {stats.nearEligibleCount} طالب قريب
              </span>
            </div>
          )}

          {/* Notification when trying to export with 0 students selected */}
          {noStudentSelectedNotice && (
            <div className="bg-[#E35D6A]/10 border-b border-[#E35D6A]/30 px-5 py-3 text-xs sm:text-sm text-[#C83D4B] dark:text-[#E35D6A] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{noStudentSelectedNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setNoStudentSelectedNotice(null)}
                className="hover:opacity-80 p-1 cursor-pointer"
                aria-label="إغلاق"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#EDF1F7] dark:bg-[#26364B] border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] font-semibold">
                  <th className="py-3 px-3 text-center w-12">
                    {strictlyGeneralExemptStudents.length > 0 && (
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={
                            strictlyGeneralExemptStudents.length > 0 &&
                            selectedForCertificateIds.length === strictlyGeneralExemptStudents.length
                          }
                          onChange={toggleSelectAllForCertificates}
                          title="تحديد أو إلغاء تحديد جميع الطلبة المعفين عاماً لتصدير شهاداتهم"
                          className="w-4 h-4 rounded text-[#3156C9] focus:ring-[#2785F5]/30 bg-white dark:bg-[#1C2939] border-[#DCE3ED] dark:border-[#2D3B4D] cursor-pointer accent-[#3156C9] dark:accent-[#2785F5]"
                        />
                      </div>
                    )}
                  </th>
                  <th className="py-3 px-3 text-center w-14">التسلسل</th>
                  <th className="py-3 px-4">اسم الطالب</th>
                  <th className="py-3 px-3 text-center">المعدل العام</th>
                  <th className="py-3 px-3 text-center">أقل درجة في المواد</th>
                  <th className="py-3 px-4 text-center">حالة الاستحقاق</th>
                  <th className="py-3 px-4">الملاحظات وتفاصيل الاستحقاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                {filteredGeneralResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748B] dark:text-[#8493A8]">
                      {searchQuery
                        ? 'لا توجد نتائج مطابقة لبحثك'
                        : 'لا يوجد طلبة مستحقون للإعفاء العام في هذا الصف والشعبة حالياً'}
                    </td>
                  </tr>
                ) : (
                  filteredGeneralResults.map((row, idx) => {
                    const isExempt = row.status === 'معفى عام';
                    const isNear = row.isNearEligible && !isExempt;
                    const isSelected = selectedForCertificateIds.includes(row.student.id);

                    return (
                      <tr
                        key={row.student.id}
                        className={`transition-colors ${
                          isExempt
                            ? isSelected
                              ? 'bg-[#10B981]/10 hover:bg-[#10B981]/15'
                              : 'bg-[#10B981]/[0.05] hover:bg-[#10B981]/10'
                            : isNear
                            ? 'bg-[#D69B42]/10 hover:bg-[#D69B42]/15'
                            : 'hover:bg-[#F8FAFC] dark:hover:bg-[#26364B]/60'
                        }`}
                      >
                        {/* 0. تحديد لإصدار الشهادة */}
                        <td className="py-3 px-3 text-center">
                          {isExempt ? (
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentForCertificate(row.student.id)}
                                title={`تحديد ${row.student.name} لإصدار شهادة الإعفاء`}
                                className="w-4 h-4 rounded text-[#3156C9] focus:ring-[#2785F5]/30 bg-white dark:bg-[#1C2939] border-[#DCE3ED] dark:border-[#2D3B4D] cursor-pointer accent-[#3156C9] dark:accent-[#2785F5]"
                              />
                            </div>
                          ) : (
                            <span className="text-[#64748B] dark:text-[#8493A8] text-xs">—</span>
                          )}
                        </td>

                        {/* 1. التسلسل */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8]">
                          {idx + 1}
                        </td>

                        {/* 2. اسم الطالب */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                            <span>{row.student.name}</span>
                            <StudentStatusBadge status={row.student.status} />
                            {isExempt && (
                              <span title="معفى عام">
                                <Award className="w-4 h-4 text-[#059669] dark:text-[#10B981] shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#8493A8] flex items-center gap-2 mt-0.5">
                            {row.student.registrationNumber && (
                              <span>رقم القيد: {row.student.registrationNumber}</span>
                            )}
                            {row.student.fatherPhone && (
                              <span>• هاتف الأب: {row.student.fatherPhone}</span>
                            )}
                          </div>
                        </td>

                        {/* 3. المعدل العام */}
                        <td className="py-3 px-3 text-center">
                          {row.rawAverage !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-mono tabular-nums font-black text-sm ${
                                  isExempt
                                    ? 'text-[#059669] dark:text-[#10B981]'
                                    : isNear
                                    ? 'text-[#B45309] dark:text-[#D69B42]'
                                    : 'text-[#1E293B] dark:text-[#E2E8F0]'
                                }`}
                              >
                                {row.rawAverage.toFixed(2)}%
                              </span>
                              {row.appliedJabr && row.evaluatedAverage !== null && row.evaluatedAverage !== row.rawAverage && (
                                <span className="text-[10px] text-[#059669] dark:text-[#10B981] font-bold bg-[#10B981]/10 px-1.5 py-0.5 rounded border border-[#10B981]/30 mt-0.5">
                                  المعتمد بالجبر: {row.evaluatedAverage}%
                                </span>
                              )}
                              {row.appliedJabr && row.evaluatedAverage !== null && row.evaluatedAverage === row.rawAverage && (
                                <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] mt-0.5">
                                  (معتمد بالجبر)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#64748B] dark:text-[#8493A8] font-mono">—</span>
                          )}
                        </td>

                        {/* 4. أقل درجة في المواد */}
                        <td className="py-3 px-3 text-center">
                          {row.minSubjectScore !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-mono tabular-nums font-bold ${
                                  row.minSubjectScore < savedSettings.generalMinSubjectScore
                                    ? 'text-[#C83D4B] dark:text-[#E35D6A]'
                                    : 'text-[#1E293B] dark:text-[#E2E8F0]'
                                }`}
                              >
                                {row.minSubjectScore}
                              </span>
                              {row.lowestSubjectName && (
                                <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] truncate max-w-[100px]">
                                  ({row.lowestSubjectName})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#64748B] dark:text-[#8493A8] font-mono">—</span>
                          )}
                        </td>

                        {/* 5. حالة الاستحقاق */}
                        <td className="py-3 px-4 text-center">
                          {isExempt && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                              <Award className="w-3.5 h-3.5" />
                              معفى عام
                            </span>
                          )}
                          {isNear && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D69B42]/10 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30">
                              <AlertCircle className="w-3.5 h-3.5" />
                              قريب من الاستحقاق
                            </span>
                          )}
                        </td>

                        {/* 6. سبب عدم الاستحقاق / الملاحظات */}
                        <td className="py-3 px-4 text-xs">
                          {isExempt ? (
                            <span className="text-[#059669] dark:text-[#10B981] flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5" />
                              مستوفٍ لكافة الشروط المقررة
                            </span>
                          ) : isNear ? (
                            <div className="text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                              <span className="font-semibold text-[#B45309] dark:text-[#D69B42]">المعدل مستوفٍ ({row.evaluatedAverage}%)</span>
                              <span className="mr-1.5">
                                • لديه {row.subjectsBelowMin?.length === 1 ? 'مادة واحدة' : 'مادتان'} دون الحد الأدنى ({savedSettings.generalMinSubjectScore}):{' '}
                                <strong className="text-[#C83D4B] dark:text-[#E35D6A]">
                                  {row.subjectsBelowMin?.map((s) => `${s.subjectName} (${s.score})`).join('، ')}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#64748B] dark:text-[#8493A8]">{row.reason}</span>
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
      )}

      {/* 8. SECTION B: RESULTS OF INDIVIDUAL EXEMPTION (نتائج الإعفاء الفردي) */}
      {activeTab === 'individual' && (
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl overflow-hidden shadow-sm space-y-0">
          {/* Activation Notice Banner if Individual Exemption is Disabled */}
          {!savedSettings.isIndividualExemptionEnabled && (
            <div className="bg-[#E35D6A]/10 border-b border-[#E35D6A]/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-[#C83D4B] dark:text-[#E35D6A] shrink-0" />
                <div>
                  <h4 className="font-bold text-[#C83D4B] dark:text-[#E35D6A] text-sm sm:text-base">
                    نظام الإعفاء الفردي معطّل حالياً للعام الدراسي ({activeYearObj?.name || selectedYearId})
                  </h4>
                  <p className="text-[#475569] dark:text-[#A8B5C7] text-xs mt-0.5 leading-relaxed">
                    تم إيقاف تطبيق الإعفاء الفردي في المواد بقرار إداري. لن يُعتمد أي طالب كمعفى فردياً حتى يتم تفعيل الخيار مجدداً.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleIndividualExemption(true)}
                className="px-4 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-all shrink-0 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                تفعيل الإعفاء الفردي الآن
              </button>
            </div>
          )}

          {/* Active Status Info Bar when Individual Exemption is Enabled */}
          {savedSettings.isIndividualExemptionEnabled && (
            <div className="bg-[#2785F5]/10 border-b border-[#2785F5]/25 px-5 py-2.5 text-xs text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  نظام الإعفاء الفردي <strong>مفعّل للعام الدراسي ({activeYearObj?.name || selectedYearId})</strong> • شرط الاستحقاق: بلوغ درجة السعي السنوي <strong>{savedSettings.individualMinScore} فأعلى</strong> لكل مادة بصورة مستقلة.
                </span>
              </div>
              <span className="text-[11px] font-bold bg-[#2785F5]/15 px-2.5 py-0.5 rounded-full border border-[#2785F5]/30 font-mono tabular-nums">
                {stats.individualExemptCount} طالب مستحق في الشعبة
              </span>
            </div>
          )}

          <div className="p-4 sm:p-5 bg-[#F8FAFC] dark:bg-[#202E40] border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#1E293B] dark:text-[#E2E8F0] text-base sm:text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
                قائمة المستحقين للإعفاء الفردي في المواد
                <span className="text-xs text-[#64748B] dark:text-[#8493A8] font-normal">
                  ({activeClassObj?.name} - شعبة {activeSectionObj?.name})
                </span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-0.5">
                تُقيّم كل مادة دراسية بصورة مستقلة استناداً إلى درجة السعي السنوي، دون استبعاد المستحقين للإعفاء العام.
              </p>
            </div>

            {/* Diagnostic Actions & Filters */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
              {/* Filter by Subject */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#64748B] dark:text-[#8493A8] whitespace-nowrap">تصفية بمادة:</span>
                <select
                  value={individualSubjectFilter}
                  onChange={(e) => setIndividualSubjectFilter(e.target.value)}
                  className="bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg px-2.5 py-1.5 text-xs text-[#1E293B] dark:text-[#E2E8F0] focus:outline-none focus:border-[#2785F5] cursor-pointer"
                >
                  <option value="all">جميع المواد المعتمدة</option>
                  {classSubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle All Student Diagnostics */}
              {filteredIndividualStudents.length > 0 && (
                <button
                  type="button"
                  onClick={toggleExpandAllDiagnostics}
                  className="px-3 py-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-semibold flex items-center gap-1.5 border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors cursor-pointer"
                  title="عرض أو طي جدول تشخيص الدرجات لجميع الطلبة المعروضين"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                  <span>{expandedStudentDiagnosticIds.length > 0 ? 'طي التشخيص' : 'عرض تشخيص المواد'}</span>
                  {expandedStudentDiagnosticIds.length > 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              {/* Diagnostics for All Section Students (even non-qualifying) */}
              <button
                type="button"
                onClick={() => setShowAllSectionDiagnostic(!showAllSectionDiagnostic)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  showAllSectionDiagnostic
                    ? 'bg-[#D69B42]/15 text-[#B45309] dark:text-[#D69B42] border-[#D69B42]/40'
                    : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] border-[#DCE3ED] dark:border-[#2D3B4D] hover:bg-[#DCE3ED] dark:hover:bg-[#2D3B4D]'
                }`}
                title="فحص درجات جميع طلاب الشعبة ومعرفة أسباب عدم استحقاق المواد"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#B45309] dark:text-[#D69B42]" />
                <span>{showAllSectionDiagnostic ? 'عرض المستحقين فقط' : 'فحص جميع طلاب الشعبة'}</span>
              </button>
            </div>
          </div>

          {/* Full Section Diagnostics Banner when active */}
          {showAllSectionDiagnostic && (
            <div className="bg-[#D69B42]/10 border-b border-[#D69B42]/25 px-5 py-3 text-xs text-[#475569] dark:text-[#A8B5C7] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#B45309] dark:text-[#D69B42] shrink-0" />
                <span>
                  يتم حالياً عرض <strong className="text-[#B45309] dark:text-[#D69B42]">تشخيص درجات جميع طلاب الشعبة ({evaluatedResults.length} طالب)</strong> للتحقق من أسباب استحقاق أو عدم استحقاق كل مادة.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllSectionDiagnostic(false)}
                className="text-xs text-[#B45309] dark:text-[#D69B42] underline font-bold hover:opacity-80 cursor-pointer shrink-0"
              >
                إغلاق وضع الفحص الشامل
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#EDF1F7] dark:bg-[#26364B] border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] font-semibold">
                  <th className="py-3 px-3 text-center w-14">التسلسل</th>
                  <th className="py-3 px-4">اسم الطالب</th>
                  <th className="py-3 px-4 text-center">عدد المواد المستحقة</th>
                  <th className="py-3 px-4">المواد المستحقة ودرجة السعي السنوي</th>
                  <th className="py-3 px-4 text-center">درجة الإعفاء المطلوبة</th>
                  <th className="py-3 px-4 text-center">حالة الاستحقاق والإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                {/* 1. All Students Diagnostics View Mode */}
                {showAllSectionDiagnostic ? (
                  evaluatedResults.map((row, idx) => {
                    const isExpanded = expandedStudentDiagnosticIds.includes(row.student.id);
                    const eligibleSubs = row.individualResults.filter((s) => s.status === 'مستحق للإعفاء الفردي');

                    return (
                      <React.Fragment key={row.student.id}>
                        <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#26364B]/60 transition-colors">
                          <td className="py-3 px-3 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8]">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                              <span>{row.student.name}</span>
                              <StudentStatusBadge status={row.student.status} />
                              {row.status === 'معفى عام' && (
                                <span className="text-[10px] bg-[#D69B42]/15 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1" title="مشمول بالإعفاء العام أيضاً">
                                  <Award className="w-3 h-3" />
                                  معفى عام أيضاً
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-0.5">
                              رقم القيد: {row.student.registrationNumber || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tabular-nums border ${
                              eligibleSubs.length > 0
                                ? 'bg-[#2785F5]/10 text-[#3156C9] dark:text-[#60A5FA] border-[#2785F5]/30 font-black'
                                : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border-[#DCE3ED] dark:border-[#2D3B4D]'
                            }`}>
                              {eligibleSubs.length} مواد
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {eligibleSubs.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {eligibleSubs.map((sub) => (
                                  <span key={sub.subjectId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2785F5]/10 border border-[#2785F5]/30 text-xs text-[#3156C9] dark:text-[#60A5FA]">
                                    <span>{sub.subjectName}</span>
                                    <strong className="font-mono tabular-nums">({sub.yearlyScore})</strong>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#64748B] dark:text-[#8493A8] text-xs">لا توجد مواد مستوفية للحد ({savedSettings.individualMinScore})</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8]">{savedSettings.individualMinScore}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleStudentDiagnostic(row.student.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-medium border border-[#DCE3ED] dark:border-[#2D3B4D] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-[#3156C9] dark:text-[#60A5FA]" />
                              <span>{isExpanded ? 'إخفاء الفحص' : 'فحص المواد'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Diagnostic Panel for this student */}
                        {isExpanded && (
                          <tr className="bg-[#F8FAFC] dark:bg-[#111C2A]/60 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                            <td colSpan={6} className="p-4">
                              <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-3.5 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-2">
                                  <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                                    <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                                    تقرير تشخيص وفحص درجات المواد للطالب: <strong className="text-[#3156C9] dark:text-[#60A5FA]">{row.student.name}</strong>
                                  </span>
                                  <span className="text-[11px] text-[#64748B] dark:text-[#8493A8]">
                                    الحد المطلوب: {savedSettings.individualMinScore} درجة في السعي السنوي
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-right text-xs">
                                    <thead>
                                      <tr className="text-[#475569] dark:text-[#A8B5C7] border-b border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B]">
                                        <th className="py-2 px-3">المادة الدراسية</th>
                                        <th className="py-2 px-3 text-center">درجة السعي المقروءة</th>
                                        <th className="py-2 px-3 text-center">الشرط المطلوب</th>
                                        <th className="py-2 px-3 text-center">استيفاء الدرجة</th>
                                        <th className="py-2 px-3 text-center">حالة تفعيل الإعفاء</th>
                                        <th className="py-2 px-3">النتيجة والتشخيص النهائي</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                                      {row.individualResults.map((subRes) => (
                                        <tr key={subRes.subjectId} className="hover:bg-[#F8FAFC] dark:hover:bg-[#26364B]/50">
                                          <td className="py-2 px-3 font-semibold text-[#1E293B] dark:text-[#E2E8F0]">{subRes.subjectName}</td>
                                          <td className="py-2 px-3 text-center font-mono tabular-nums font-bold">
                                            {subRes.yearlyScore !== null ? (
                                              <span className={subRes.meetsScoreCondition ? 'text-[#3156C9] dark:text-[#60A5FA] font-black' : 'text-[#475569] dark:text-[#A8B5C7]'}>
                                                {subRes.yearlyScore}
                                              </span>
                                            ) : (
                                              <span className="text-[#C83D4B] dark:text-[#E35D6A] font-medium">سعي غير مكتمل</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums">
                                            &gt;= {subRes.requiredScore}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {subRes.meetsScoreCondition ? (
                                              <span className="text-[10px] bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30 px-2 py-0.5 rounded-full font-bold">
                                                مستوفٍ للدرجة
                                              </span>
                                            ) : subRes.yearlyScore === null ? (
                                              <span className="text-[10px] bg-[#D69B42]/10 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30 px-2 py-0.5 rounded-full font-bold">
                                                نقص رصد
                                              </span>
                                            ) : (
                                              <span className="text-[10px] bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] px-2 py-0.5 rounded-full">
                                                دون الحد
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {subRes.isExemptionEnabled ? (
                                              <span className="text-[10px] bg-[#2785F5]/10 text-[#3156C9] dark:text-[#60A5FA] px-2 py-0.5 rounded-full font-bold">
                                                مفعّل
                                              </span>
                                            ) : (
                                              <span className="text-[10px] bg-[#E35D6A]/10 text-[#C83D4B] dark:text-[#E35D6A] px-2 py-0.5 rounded-full font-bold">
                                                معطّل
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-xs">
                                            {subRes.status === 'مستحق للإعفاء الفردي' ? (
                                              <span className="text-[#3156C9] dark:text-[#60A5FA] font-bold flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" />
                                                {subRes.diagnosticReason}
                                              </span>
                                            ) : (
                                              <span className="text-[#64748B] dark:text-[#8493A8]">
                                                {subRes.diagnosticReason}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : filteredIndividualStudents.length === 0 ? (
                  /* 2. Normal View: Empty State */
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#64748B] dark:text-[#8493A8]">
                      {!savedSettings.isIndividualExemptionEnabled ? (
                        <div className="space-y-3 max-w-md mx-auto">
                          <p className="text-[#C83D4B] dark:text-[#E35D6A] font-semibold text-sm">
                            نظام الإعفاء الفردي معطّل حالياً لهذا العام الدراسي بقرار الإدارة.
                          </p>
                          <p className="text-xs text-[#64748B] dark:text-[#8493A8] leading-relaxed">
                            لتطبيق الإعفاء الفردي وعرض الطلبة المستحقين، اضغط على زر التفعيل أعلاه أو قم بتفعيله من إعدادات شروط الإعفاء.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleToggleIndividualExemption(true)}
                            className="px-4 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            تفعيل نظام الإعفاء الفردي فوراً
                          </button>
                        </div>
                      ) : searchQuery || individualSubjectFilter !== 'all' ? (
                        'لا توجد نتائج مطابقة لبحثك أو للمادة المختارة'
                      ) : (
                        <div className="space-y-2 max-w-md mx-auto">
                          <p className="text-[#64748B] dark:text-[#8493A8] text-sm">
                            لا يوجد طلبة استوفوا شرط الإعفاء الفردي (سعي سنوي {savedSettings.individualMinScore} فأعلى) في هذا الصف والشعبة حالياً.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowAllSectionDiagnostic(true)}
                            className="text-xs text-[#3156C9] dark:text-[#60A5FA] underline hover:opacity-80 font-semibold cursor-pointer"
                          >
                            اضغط هنا لفحص درجات جميع طلاب الشعبة ومعرفة أسباب عدم الاستحقاق
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  /* 3. Normal View: Qualifying Students List */
                  filteredIndividualStudents.map((row, idx) => {
                    const isExpanded = expandedStudentDiagnosticIds.includes(row.student.id);

                    return (
                      <React.Fragment key={row.student.id}>
                        <tr className="bg-[#2785F5]/[0.04] hover:bg-[#2785F5]/[0.09] transition-colors">
                          {/* 1. التسلسل */}
                          <td className="py-3.5 px-3 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8] font-bold">
                            {idx + 1}
                          </td>

                          {/* 2. اسم الطالب */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2 flex-wrap">
                              <span>{row.student.name}</span>
                              <StudentStatusBadge status={row.student.status} />
                              {row.isGeneralExempt && (
                                <span className="text-[10px] bg-[#D69B42]/15 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1" title="مستوفٍ أيضاً لشروط الإعفاء العام">
                                  <Award className="w-3 h-3" />
                                  معفى عام أيضاً
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#64748B] dark:text-[#8493A8] flex items-center gap-2 mt-0.5">
                              {row.student.registrationNumber && (
                                <span>رقم القيد: {row.student.registrationNumber}</span>
                              )}
                              {row.student.fatherPhone && (
                                <span>• هاتف الأب: {row.student.fatherPhone}</span>
                              )}
                            </div>
                          </td>

                          {/* 3. عدد المواد المعفى فيها */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-[#2785F5]/10 text-[#3156C9] dark:text-[#60A5FA] border border-[#2785F5]/30">
                              {row.eligibleCount === 1
                                ? 'مادة واحدة'
                                : row.eligibleCount === 2
                                ? 'مادتان'
                                : `${row.eligibleCount} مواد`}
                            </span>
                          </td>

                          {/* 4. المواد المشمولة بالإعفاء ودرجة السعي */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-2">
                              {row.eligibleSubjects.map((sub) => (
                                <div
                                  key={sub.subjectId}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#26364B] border border-[#2785F5]/30 shadow-xs"
                                  title={sub.diagnosticReason || 'مستحق للإعفاء الفردي'}
                                >
                                  <span className="text-xs font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                                    {sub.subjectName}
                                  </span>
                                  <span className="font-mono tabular-nums font-black text-xs text-[#3156C9] dark:text-[#60A5FA] bg-[#2785F5]/10 px-1.5 py-0.5 rounded border border-[#2785F5]/30">
                                    {sub.yearlyScore}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* 5. درجة الإعفاء المطلوبة */}
                          <td className="py-3.5 px-4 text-center font-mono tabular-nums font-bold text-[#64748B] dark:text-[#8493A8]">
                            {row.requiredScore}
                          </td>

                          {/* 6. حالة الاستحقاق والإجراءات */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-[#2785F5]/10 text-[#3156C9] dark:text-[#60A5FA] border border-[#2785F5]/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                مستحق للإعفاء الفردي
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleStudentDiagnostic(row.student.id)}
                                className="text-[11px] px-2 py-0.5 rounded text-[#64748B] dark:text-[#8493A8] hover:text-[#3156C9] dark:hover:text-[#60A5FA] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title="عرض فحص وتشخيص درجات جميع المواد لهذا الطالب"
                              >
                                <Sparkles className="w-3 h-3 text-[#3156C9] dark:text-[#60A5FA]" />
                                <span>{isExpanded ? 'إخفاء التشخيص' : 'تشخيص جميع المواد'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Diagnostic Table for this Qualifying Student */}
                        {isExpanded && (
                          <tr className="bg-[#F8FAFC] dark:bg-[#111C2A]/60 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                            <td colSpan={6} className="p-4">
                              <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-3.5 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-2">
                                  <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                                    <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                                    تقرير تشخيص وفحص المواد للطالب: <strong className="text-[#3156C9] dark:text-[#60A5FA]">{row.student.name}</strong>
                                  </span>
                                  <span className="text-[11px] text-[#64748B] dark:text-[#8493A8]">
                                    الحد المطلوب: {row.requiredScore} درجة في السعي السنوي
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-right text-xs">
                                    <thead>
                                      <tr className="text-[#475569] dark:text-[#A8B5C7] border-b border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B]">
                                        <th className="py-2 px-3">المادة الدراسية</th>
                                        <th className="py-2 px-3 text-center">درجة السعي المقروءة</th>
                                        <th className="py-2 px-3 text-center">الشرط المطلوب</th>
                                        <th className="py-2 px-3 text-center">استيفاء الدرجة</th>
                                        <th className="py-2 px-3 text-center">حالة تفعيل الإعفاء</th>
                                        <th className="py-2 px-3">النتيجة والتشخيص النهائي</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                                      {row.allSubjectsResults.map((subRes) => (
                                        <tr key={subRes.subjectId} className="hover:bg-[#F8FAFC] dark:hover:bg-[#26364B]/50">
                                          <td className="py-2 px-3 font-semibold text-[#1E293B] dark:text-[#E2E8F0]">{subRes.subjectName}</td>
                                          <td className="py-2 px-3 text-center font-mono tabular-nums font-bold">
                                            {subRes.yearlyScore !== null ? (
                                              <span className={subRes.meetsScoreCondition ? 'text-[#3156C9] dark:text-[#60A5FA] font-black' : 'text-[#475569] dark:text-[#A8B5C7]'}>
                                                {subRes.yearlyScore}
                                              </span>
                                            ) : (
                                              <span className="text-[#C83D4B] dark:text-[#E35D6A] font-medium">سعي غير مكتمل</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums">
                                            &gt;= {subRes.requiredScore}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {subRes.meetsScoreCondition ? (
                                              <span className="text-[10px] bg-[#10B981]/10 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30 px-2 py-0.5 rounded-full font-bold">
                                                مستوفٍ للدرجة
                                              </span>
                                            ) : subRes.yearlyScore === null ? (
                                              <span className="text-[10px] bg-[#D69B42]/10 text-[#B45309] dark:text-[#D69B42] border border-[#D69B42]/30 px-2 py-0.5 rounded-full font-bold">
                                                نقص رصد
                                              </span>
                                            ) : (
                                              <span className="text-[10px] bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] px-2 py-0.5 rounded-full">
                                                دون الحد
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {subRes.isExemptionEnabled ? (
                                              <span className="text-[10px] bg-[#2785F5]/10 text-[#3156C9] dark:text-[#60A5FA] px-2 py-0.5 rounded-full font-bold">
                                                مفعّل
                                              </span>
                                            ) : (
                                              <span className="text-[10px] bg-[#E35D6A]/10 text-[#C83D4B] dark:text-[#E35D6A] px-2 py-0.5 rounded-full font-bold">
                                                معطّل
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-xs">
                                            {subRes.status === 'مستحق للإعفاء الفردي' ? (
                                              <span className="text-[#3156C9] dark:text-[#60A5FA] font-bold flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" />
                                                {subRes.diagnosticReason}
                                              </span>
                                            ) : (
                                              <span className="text-[#64748B] dark:text-[#8493A8]">
                                                {subRes.diagnosticReason}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. Export Certificates Multi-page PDF Modal */}
      {isExportPdfModalOpen && (
        <ExportCertificatesPdfModal
          isOpen={isExportPdfModalOpen}
          onClose={() => setIsExportPdfModalOpen(false)}
          eligibleStudents={strictlyGeneralExemptStudents}
          initialSelectedStudentIds={selectedForCertificateIds}
          settings={settings}
          templateConfig={db.getCertificateTemplate()}
          academicYearName={activeYear?.name || ''}
          classNameStr={activeClass?.name || ''}
          sectionNameStr={activeSection?.name || ''}
        />
      )}

      {/* Unified Interactive Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title={
          activeTab === 'general'
            ? `كشف الطلبة المشمولين بالإعفاء العام — ${activeClass?.name || ''} (${activeSection?.name || ''})`
            : `كشف الطلبة المشمولين بالإعفاء الفردي — ${activeClass?.name || ''} (${activeSection?.name || ''})`
        }
        subtitle={`استناداً إلى درجات السعي السنوي • العام الدراسي: ${activeYear?.name || ''}`}
        defaultOrientation="landscape"
        suggestedFileName={activeTab === 'general' ? 'كشف_الإعفاء_العام' : 'كشف_الإعفاء_الفردي'}
      >
        <div className="bg-white text-black font-sans p-6 rounded-lg" dir="rtl">
          <ReportHeader
            settings={settings}
            title={
              activeTab === 'general'
                ? `كشف الطلبة المشمولين بالإعفاء العام — ${activeClass?.name || ''} (${activeSection?.name || ''})`
                : `كشف الطلبة المشمولين بالإعفاء الفردي — ${activeClass?.name || ''} (${activeSection?.name || ''})`
            }
            subTitle={`استناداً إلى درجات السعي السنوي • العام الدراسي: ${activeYear?.name || ''}`}
            academicYearName={activeYear?.name}
            classNameStr={activeClass?.name}
            sectionNameStr={activeSection?.name}
          />

          <div className="mt-4">
            <p className="text-xs font-bold text-slate-700 mb-2">
              الصف: {activeClass?.name || '—'} | الشعبة: {activeSection?.name || '—'} | العام الدراسي: {activeYear?.name || '—'}
            </p>
            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-black">
                  <th className="border border-black p-2 text-center w-10 font-bold">ت</th>
                  <th className="border border-black p-2 text-right font-bold">اسم الطالب</th>
                  {activeTab === 'general' ? (
                    <>
                      <th className="border border-black p-2 text-center font-bold">المعدل العام</th>
                      <th className="border border-black p-2 text-center font-bold">أدنى درجة درس</th>
                      <th className="border border-black p-2 text-center font-bold">حالة الإعفاء العام</th>
                    </>
                  ) : (
                    <>
                      <th className="border border-black p-2 text-center font-bold">المواد المشمولة بالإعفاء الفردي</th>
                      <th className="border border-black p-2 text-center font-bold">عدد المواد</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeTab === 'general' ? (
                  evaluatedResults.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 font-bold">
                        لا توجد نتائج مسجلة لهذه الشعبة.
                      </td>
                    </tr>
                  ) : (
                    evaluatedResults.map((res, idx) => (
                      <tr key={res.student.id} className="border-b border-slate-400">
                        <td className="border border-black p-1.5 text-center font-mono">{idx + 1}</td>
                        <td className="border border-black p-1.5 font-bold">{res.student.name}</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">
                          {res.evaluatedAverage !== null ? `${res.evaluatedAverage}%` : '—'}
                        </td>
                        <td className="border border-black p-1.5 text-center font-mono">
                          {res.minSubjectScore !== null ? res.minSubjectScore : '—'}
                        </td>
                        <td className="border border-black p-1.5 text-center font-bold">
                          {res.status === 'معفى عام' ? (
                            <span className="text-emerald-800 font-black">مشمول بالإعفاء العام</span>
                          ) : (
                            <span className="text-slate-600">{res.status}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  evaluatedResults.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 font-bold">
                        لا توجد نتائج مسجلة لهذه الشعبة.
                      </td>
                    </tr>
                  ) : (
                    evaluatedResults.map((res, idx) => {
                      const indivExemptSubs = res.individualResults.filter((s) => s.status === 'مستحق للإعفاء الفردي');
                      return (
                        <tr key={res.student.id} className="border-b border-slate-400">
                          <td className="border border-black p-1.5 text-center font-mono">{idx + 1}</td>
                          <td className="border border-black p-1.5 font-bold">{res.student.name}</td>
                          <td className="border border-black p-1.5 text-right font-bold text-blue-900">
                            {indivExemptSubs.length > 0
                              ? indivExemptSubs.map((s) => `${s.subjectName} (${s.yearlyScore})`).join(' ، ')
                              : '—'}
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono font-bold">
                            {indivExemptSubs.length}
                          </td>
                        </tr>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 pt-4 border-t border-black flex justify-end text-right text-xs font-bold text-slate-900">
            <div className="flex flex-col items-center text-center">
              <p className="font-black">مدير المدرسة والختم الرسمي</p>
              <p className="font-black text-sm mt-2">{settings.directorName || ''}</p>
              <div className="mt-8 border-b border-dotted border-black w-36" />
            </div>
          </div>
        </div>
      </PrintPreviewModal>
    </div>
  );
};

