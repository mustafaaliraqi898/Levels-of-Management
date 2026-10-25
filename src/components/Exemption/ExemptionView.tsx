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
} from 'lucide-react';
import { ReportHeader } from '../Common/ReportHeader';
import { ExportCertificatesPdfModal } from './ExportCertificatesPdfModal';

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

  // Classes & sections available for selected year
  const availableClasses = useMemo(() => {
    return [...classes].sort((a, b) => a.order - b.order);
  }, [classes]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  useEffect(() => {
    if (!availableClasses.some((c) => c.id === selectedClassId) && availableClasses.length > 0) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  const availableSections = useMemo(() => {
    return sections.filter((s) => s.classId === selectedClassId);
  }, [sections, selectedClassId]);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(availableSections[0]?.id || '');

  useEffect(() => {
    if (!availableSections.some((s) => s.id === selectedSectionId) && availableSections.length > 0) {
      setSelectedSectionId(availableSections[0].id);
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
  const savedSettings = useMemo(() => {
    return db.getExemptionSettings(selectedYearId);
  }, [selectedYearId, grades]); // refreshed on db updates

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

  // Track if there are unsaved draft changes
  const isDirty = useMemo(() => {
    return (
      draftSettings.generalMinAverage !== savedSettings.generalMinAverage ||
      draftSettings.generalMinSubjectScore !== savedSettings.generalMinSubjectScore ||
      draftSettings.enableGeneralJabr !== savedSettings.enableGeneralJabr ||
      draftSettings.individualMinScore !== savedSettings.individualMinScore ||
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
      if (r.status === 'معفى عام') return true;
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
      .filter((r) => r.status === 'معفى عام')
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

  // Individual Exemption Eligible Students Grouping:
  // Rules:
  // 1. Exclude students who are granted General Exemption ('معفى عام')
  // 2. Exclude students with 0 qualifying individual subjects
  // 3. For each qualifying student, display ONLY the subjects where they qualify (yearlyScore >= individualMinScore)
  // 4. Group by student so each student appears exactly once with all their qualifying subjects
  const eligibleIndividualStudents = useMemo(() => {
    return evaluatedResults
      .filter((res) => {
        // Exclude general exempt students!
        if (res.status === 'معفى عام') return false;

        // Keep only students who have at least one qualifying individual subject
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
          }));

        return {
          student: res.student,
          eligibleSubjects,
          eligibleCount: eligibleSubjects.length,
          requiredScore: savedSettings.individualMinScore,
        };
      });
  }, [evaluatedResults, savedSettings.individualMinScore]);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Printable Official Header with School Logo (Visible ONLY during print) */}
      <div className="hidden print:block text-black bg-white">
        <ReportHeader
          settings={settings}
          title={
            activeTab === 'general'
              ? `كشف الطلبة المشمولين بالإعفاء العام — ${activeClass?.name || ''} (شعبة ${activeSection?.name || ''})`
              : `كشف الطلبة المشمولين بالإعفاء الفردي — ${activeClass?.name || ''} (شعبة ${activeSection?.name || ''})`
          }
          subTitle={`استناداً إلى درجات السعي السنوي • العام الدراسي: ${activeYear?.name || ''}`}
          academicYearName={activeYear?.name}
          classNameStr={activeClass?.name}
          sectionNameStr={activeSection?.name}
        />
      </div>

      {/* 1. Header Bar */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Award className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
                الإعفاء العام والفردي
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  ضوابط واستحقاق الطلبة
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                تحديد الطلبة المشمولين بالإعفاء العام والإعفاء الفردي في المواد الدراسية استناداً إلى درجات السعي السنوي
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowTestCasesGuide(!showTestCasesGuide)}
            className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            title="عرض دليل حالات الاختبار التجريبية"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>دليل حالات الاختبار</span>
            {showTestCasesGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleCompleteSeedData}
            className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            title="التحقق من اكتمال درجات جميع الطلاب والمواد وتحديثها بأمان"
          >
            <Database className="w-4 h-4 text-teal-400" />
            استكمال بيانات الاختبار
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            طباعة الكشف
          </button>
        </div>
      </div>

      {/* Seed Sync Feedback Alert */}
      {seedSyncFeedback && (
        <div className="bg-teal-500/15 border-2 border-teal-500/30 rounded-2xl p-4 flex items-center gap-3 text-teal-200 text-xs sm:text-sm font-semibold animate-fadeIn shadow-md">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <span>{seedSyncFeedback}</span>
        </div>
      )}

      {/* Interactive Test Cases Guide Panel (Collapsible) */}
      {showTestCasesGuide && (
        <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                دليل حالات الاختبار السريع (البيانات النموذجية المهيأة في الخامس العلمي - شعبة أ)
              </h3>
            </div>
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full font-bold">
              جاهزة للاختبار الفوري
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Case 1 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>1. أحمد محمد علي التميمي</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">معفى عام + 7 فردي</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                معدله 97.71% وجميع درجاته بين 96 و 100. يختبر التفوق الشامل والاستحقاق لكلا النوعين.
              </p>
            </div>

            {/* Case 2 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="font-bold text-amber-400 flex items-center justify-between">
                <span>2. باقر حيدر شاكر الحسني</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">معفى عام + 2 فردي</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                معدله 88.14%، جميع مواده &ge; 75. لديه إعفاء فردي في الإنكليزية (90) والإسلامية (92) فقط.
              </p>
            </div>

            {/* Case 3 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="font-bold text-rose-400 flex items-center justify-between">
                <span>3. جعفر جاسم حميد الكعبي</span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">معدل 89.29% ومرفوض عام!</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                معدله 89.29%، لكن الكيمياء 72 (&lt; 75). يثبت رفض الإعفاء العام وتوضيح السبب، مع نيله 5 إعفاءات فردية!
              </p>
            </div>

            {/* Case 4 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="font-bold text-cyan-400 flex items-center justify-between">
                <span>4. حسين علي عبد الزهرة</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">اختبار الجبر (84.57%)</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                معدله 84.57%. مع إيقاف الجبر: غير مشمول (&lt; 85). مع تفعيل الجبر: معفى عام (85%).
              </p>
            </div>

            {/* Case 5 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="font-bold text-amber-300 flex items-center justify-between">
                <span>5. ذو الفقار صلاح مهدي</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">غير مكتمل (نقص مادة)</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                سعي مادة الأحياء غير مكتمل (فصل ثانٍ ناقص). يحجب الإعفاء العام ويظهر كـ «غير مكتمل».
              </p>
            </div>

            {/* Case 6 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="font-bold text-teal-400 flex items-center justify-between">
                <span>6. سجاد قاسم هاشم الشمري</span>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded">فردي فقط دون عام</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                مستحق للإعفاء الفردي في الرياضيات (93) والفيزياء (91)، وغير مشمول بالعام (معدله 78.29%).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Notification Banner if Exemption Settings not yet saved/configured for this year */}
      {!savedSettings.isConfigured && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-md">
          <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm">
            <h4 className="font-bold text-amber-300 text-sm sm:text-base">
              تنبيه: شروط الإعفاء للعام الدراسي ({activeYearObj?.name || 'المحدد'}) لم تُعتمد وتُحفظ بعد
            </h4>
            <p className="text-amber-200/80 mt-1 leading-relaxed">
              يُرجى مراجعة إعدادات شروط الإعفاء المقترحة أدناه والضغط على زر{' '}
              <strong className="text-amber-300 underline font-bold">«حفظ الشروط»</strong> لاعتماد النتائج الرسمية
              والتأكد من تطبيقها على طلاب هذا العام الدراسي.
            </p>
          </div>
        </div>
      )}

      {/* 3. Settings Section: "إعدادات شروط الإعفاء" */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 bg-slate-850/80 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base sm:text-lg text-slate-100">
              إعدادات شروط الإعفاء للعام الدراسي:
              <span className="text-amber-400 font-extrabold mr-2">
                {activeYearObj?.name || selectedYearId}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isDirty && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5" />
                توجد تعديلات بانتظار الحفظ
              </span>
            )}

            <button
              onClick={handleResetToDefaults}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="استعادة القيم الافتراضية المقترحة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              افتراضي
            </button>

            <button
              onClick={handleSaveSettings}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                isDirty || !savedSettings.isConfigured
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              حفظ الشروط
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {saveFeedback && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-2.5 flex items-center gap-2 text-emerald-300 text-xs sm:text-sm font-semibold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {saveFeedback}
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* أ. شروط الإعفاء العام */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-200">
                    أ. شروط الإعفاء العام
                  </h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  معدل جميع المواد
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. المعدل العام المطلوب */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>المعدل العام المطلوب للإعفاء العام</span>
                    <span className="text-[11px] text-amber-400 font-bold">(افتراضي: 85)</span>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    الحد الأدنى لمعدل السعي السنوي لجميع المواد.
                  </p>
                </div>

                {/* 2. أقل درجة مسموحة في أي مادة */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>أقل درجة مسموحة في أي مادة</span>
                    <span className="text-[11px] text-amber-400 font-bold">(افتراضي: 75)</span>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">درجة</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    لا يجوز أن تقل درجة السعي السنوي لأي مادة عن هذا الحد.
                  </p>
                </div>
              </div>

              {/* 3. مربع اختيار: تفعيل جبر كسر المعدل العام */}
              <div className="pt-2 border-t border-slate-800/80">
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
                      className="w-5 h-5 rounded-md text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 focus:ring-offset-slate-950 cursor-pointer accent-amber-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                        تفعيل جبر كسر المعدل العام
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          draftSettings.enableGeneralJabr
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {draftSettings.enableGeneralJabr ? 'مفعّل' : 'معطّل (استخدام المعدل الدقيق)'}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400 leading-relaxed bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        نظام الجبر المعتمد في إعدادات مدرستك حالياً:
                        <span className="text-amber-300 font-bold">
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
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                    <h3 className="font-bold text-sm sm:text-base text-slate-200">
                      ب. شروط الإعفاء الفردي
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    لكل مادة مستقلة
                  </span>
                </div>

                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>درجة السعي السنوي المطلوبة للإعفاء الفردي</span>
                    <span className="text-[11px] text-teal-400 font-bold">(افتراضي: 90)</span>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-center"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">درجة</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تُقيّم كل مادة دراسية بصورة مستقلة، ويُعد الطالب مستحقاً للإعفاء الفردي في المادة إذا بلغت درجة سعيها السنوي هذا الحد أو تجاوزته.
                  </p>
                </div>
              </div>

              {/* ملاحظة رسمية واضحة كما طلب المستخدم */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-[11px] text-amber-200/90 leading-relaxed">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Year Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              العام الدراسي
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
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
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              الصف الدراسي
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
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
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              الشعبة
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>
                  شعبة {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              بحث سريع عن طالب
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم أو رقم القيد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5. Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400">إجمالي طلاب الشعبة</p>
              <p className="text-lg font-black text-slate-100">{stats.totalStudents}</p>
            </div>
            <Users className="w-6 h-6 text-slate-500" />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-amber-300 font-semibold">المعفون عاماً</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-black text-amber-400">{stats.generalExempt}</p>
                <span className="text-[10px] text-amber-400/80">
                  ({stats.totalStudents > 0 ? Math.round((stats.generalExempt / stats.totalStudents) * 100) : 0}%)
                </span>
              </div>
            </div>
            <Award className="w-6 h-6 text-amber-400" />
          </div>

          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-teal-300 font-semibold">مستحقون لإعفاء فردي</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-black text-teal-400">{stats.individualExemptCount}</p>
                <span className="text-[10px] text-teal-400/80">طالب (غير معفى عام)</span>
              </div>
            </div>
            <CheckCircle2 className="w-6 h-6 text-teal-400" />
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400">حالات غير مكتملة</p>
              <p className="text-lg font-black text-slate-300">{stats.generalIncomplete}</p>
            </div>
            <Clock className="w-6 h-6 text-slate-500" />
          </div>
        </div>
      </div>

      {/* 6. Tabs to Switch Between General Exemption & Individual Exemption */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <Award className="w-4 h-4" />
          نتائج الإعفاء العام
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'general' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
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
              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          نتائج الإعفاء الفردي في المواد
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'individual' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {stats.individualExemptCount}
          </span>
        </button>
      </div>

      {/* 7. SECTION A: RESULTS OF GENERAL EXEMPTION (نتائج الإعفاء العام) */}
      {activeTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 bg-slate-850/80 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-100 text-base sm:text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                قائمة المستحقين للإعفاء العام
                <span className="text-xs text-slate-400 font-normal">
                  ({activeClassObj?.name} - شعبة {activeSectionObj?.name})
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
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
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95"
                title="تصدير شهادات شكر وتقدير للإعفاء العام بصيغة PDF للطلبة المحددين"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
                <span>تصدير الشهادات PDF</span>
                {strictlyGeneralExemptStudents.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-950/25 text-slate-950">
                    {selectedForCertificateIds.length} / {strictlyGeneralExemptStudents.length}
                  </span>
                )}
              </button>

              {/* Toggle Button for Near-Eligible Students */}
              <button
                type="button"
                onClick={() => setShowNearEligible(!showNearEligible)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border shadow-xs ${
                  showNearEligible
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
                }`}
                title="إظهار الطلبة الذين يحققون شرط المعدل ولديهم مادة أو مادتان دون الحد الأدنى"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    showNearEligible
                      ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                      : 'border-slate-500 bg-slate-900'
                  }`}
                >
                  {showNearEligible && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>إظهار الطلبة الذين لديهم مادة أو مادتان دون الحد الأدنى</span>
                {stats.nearEligibleCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-200">
                    {stats.nearEligibleCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Near-Eligible Filter Notification */}
          {showNearEligible && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 text-xs text-amber-200/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  يتم حالياً عرض الطلبة المستحقين فعلياً للإعفاء العام بالإضافة إلى الطلبة{' '}
                  <strong className="text-amber-300 font-bold">«القريبين من الاستحقاق»</strong> (الذين استوفوا شرط المعدل ولديهم مادة واحدة أو مادتان فقط دون {savedSettings.generalMinSubjectScore}).
                </span>
              </div>
              <span className="text-[11px] text-amber-400 font-bold whitespace-nowrap">
                {stats.nearEligibleCount} طالب قريب
              </span>
            </div>
          )}

          {/* Notification when trying to export with 0 students selected */}
          {noStudentSelectedNotice && (
            <div className="bg-rose-500/15 border-b border-rose-500/30 px-5 py-3 text-xs sm:text-sm text-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{noStudentSelectedNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setNoStudentSelectedNotice(null)}
                className="text-rose-400 hover:text-rose-200 p-1"
                aria-label="إغلاق"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
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
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/30 bg-slate-800 border-slate-600 cursor-pointer accent-amber-500"
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
              <tbody className="divide-y divide-slate-800/60">
                {filteredGeneralResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
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
                              ? 'bg-amber-500/10 hover:bg-amber-500/15'
                              : 'bg-amber-500/5 hover:bg-amber-500/10'
                            : isNear
                            ? 'bg-amber-500/10 hover:bg-amber-500/15 border-r-2 border-r-amber-400'
                            : 'hover:bg-slate-800/40'
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
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/30 bg-slate-800 border-slate-600 cursor-pointer accent-amber-500"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* 1. التسلسل */}
                        <td className="py-3 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 2. اسم الطالب */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            {row.student.name}
                            {isExempt && (
                              <span title="معفى عام">
                                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
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
                                className={`font-mono font-black text-sm ${
                                  isExempt
                                    ? 'text-amber-400'
                                    : isNear
                                    ? 'text-amber-300'
                                    : 'text-slate-200'
                                }`}
                              >
                                {row.rawAverage.toFixed(2)}%
                              </span>
                              {row.appliedJabr && row.evaluatedAverage !== null && row.evaluatedAverage !== row.rawAverage && (
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-0.5">
                                  المعتمد بالجبر: {row.evaluatedAverage}%
                                </span>
                              )}
                              {row.appliedJabr && row.evaluatedAverage !== null && row.evaluatedAverage === row.rawAverage && (
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  (معتمد بالجبر)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* 4. أقل درجة في المواد */}
                        <td className="py-3 px-3 text-center">
                          {row.minSubjectScore !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-mono font-bold ${
                                  row.minSubjectScore < savedSettings.generalMinSubjectScore
                                    ? 'text-rose-400'
                                    : 'text-slate-200'
                                }`}
                              >
                                {row.minSubjectScore}
                              </span>
                              {row.lowestSubjectName && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                                  ({row.lowestSubjectName})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* 5. حالة الاستحقاق */}
                        <td className="py-3 px-4 text-center">
                          {isExempt && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs">
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              معفى عام
                            </span>
                          )}
                          {isNear && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              قريب من الاستحقاق
                            </span>
                          )}
                        </td>

                        {/* 6. سبب عدم الاستحقاق / الملاحظات */}
                        <td className="py-3 px-4 text-xs">
                          {isExempt ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5" />
                              مستوفٍ لكافة الشروط المقررة
                            </span>
                          ) : isNear ? (
                            <div className="text-amber-200/90 leading-relaxed">
                              <span className="font-semibold">المعدل مستوفٍ ({row.evaluatedAverage}%)</span>
                              <span className="text-slate-400 mr-1.5">
                                • لديه {row.subjectsBelowMin?.length === 1 ? 'مادة واحدة' : 'مادتان'} دون الحد الأدنى ({savedSettings.generalMinSubjectScore}):{' '}
                                <strong className="text-rose-300">
                                  {row.subjectsBelowMin?.map((s) => `${s.subjectName} (${s.score})`).join('، ')}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">{row.reason}</span>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-0">
          <div className="p-4 sm:p-5 bg-slate-850/80 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-100 text-base sm:text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                قائمة المستحقين للإعفاء الفردي في المواد
                <span className="text-xs text-slate-400 font-normal">
                  ({activeClassObj?.name} - شعبة {activeSectionObj?.name})
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                الطلبة المشمولون فعلياً بالإعفاء الفردي بمادة أو أكثر (الدرجة المطلوبة: {savedSettings.individualMinScore} فأعلى في السعي السنوي، مع استبعاد المشمولين بالإعفاء العام تلقائياً)
              </p>
            </div>

            {/* Filter by Subject */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <span className="text-xs text-slate-400 whitespace-nowrap">تصفية بمادة:</span>
              <select
                value={individualSubjectFilter}
                onChange={(e) => setIndividualSubjectFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">جميع المواد المعتمدة</option>
                {classSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-3 text-center w-14">التسلسل</th>
                  <th className="py-3 px-4">اسم الطالب</th>
                  <th className="py-3 px-4 text-center">عدد المواد المعفى فيها</th>
                  <th className="py-3 px-4">المواد المشمولة بالإعفاء ودرجة السعي السنوي</th>
                  <th className="py-3 px-4 text-center">درجة الإعفاء المطلوبة</th>
                  <th className="py-3 px-4 text-center">حالة الاستحقاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredIndividualStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      {searchQuery || individualSubjectFilter !== 'all'
                        ? 'لا توجد نتائج مطابقة لبحثك أو للمادة المختارة'
                        : 'لا يوجد طلبة مشمولون بالإعفاء الفردي في هذه الشعبة (تم استبعاد المعفين عاماً والطلبة غير المستوفين للحد المطلوب).'}
                    </td>
                  </tr>
                ) : (
                  filteredIndividualStudents.map((row, idx) => {
                    return (
                      <tr
                        key={row.student.id}
                        className="bg-teal-500/5 hover:bg-teal-500/10 transition-colors"
                      >
                        {/* 1. التسلسل */}
                        <td className="py-3.5 px-3 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>

                        {/* 2. اسم الطالب */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            {row.student.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/30">
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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-teal-500/30 shadow-xs"
                              >
                                <span className="text-xs font-medium text-slate-200">
                                  {sub.subjectName}
                                </span>
                                <span className="font-mono font-black text-xs text-teal-300 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-500/30">
                                  {sub.yearlyScore}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* 5. درجة الإعفاء المطلوبة */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                          {row.requiredScore}
                        </td>

                        {/* 6. حالة الاستحقاق */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                            مستحق للإعفاء الفردي
                          </span>
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
    </div>
  );
};

