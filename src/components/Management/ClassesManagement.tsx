import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SchoolClass, Section, Student, Subject, GradeRecord, AcademicYear } from '../../types';
import { db } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import {
  Layers,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  FolderPlus,
  Users,
  BookOpen,
  ShieldAlert,
  Info,
  Check,
  Archive,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Settings2,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ClassesManagementProps {
  classes: SchoolClass[];
  sections: Section[];
  students?: Student[];
  subjects?: Subject[];
  grades?: Record<string, GradeRecord>;
  academicYears?: AcademicYear[];
}

const PRESET_SECTIONS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
const STAGE_OPTIONS = ['ابتدائي', 'متوسطة', 'ثانوي', 'إعدادي'];

// Helper to auto-detect stage from class name
function autoDetectStage(className: string): string {
  const clean = className.trim().toLowerCase();
  if (!clean) return '';

  if (clean.includes('متوسط') || clean.includes('المتوسط')) {
    return 'متوسطة';
  }
  if (clean.includes('ابتدائي') || clean.includes('الابتدائي') || clean.includes('ابتدائية')) {
    return 'ابتدائي';
  }
  if (
    clean.includes('علمي') ||
    clean.includes('أدبي') ||
    clean.includes('ادبي') ||
    clean.includes('إعدادي') ||
    clean.includes('اعدادي') ||
    clean.includes('تطبيقي') ||
    clean.includes('إحيائي') ||
    clean.includes('احيائي') ||
    clean.includes('رابع') ||
    clean.includes('خامس') ||
    clean.includes('سادس')
  ) {
    if (clean.includes('ابتدائي') || clean.includes('ابتدائية')) return 'ابتدائي';
    return 'إعدادي';
  }
  if (clean.includes('ثانوي') || clean.includes('الثانوي')) {
    return 'ثانوي';
  }
  return '';
}

export const ClassesManagement: React.FC<ClassesManagementProps> = ({
  classes,
  sections,
  students = [],
  subjects = [],
  grades = {},
  academicYears = [],
}) => {
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  // Add Class Modal State
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const newClassNameInputRef = useRef<HTMLInputElement>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassStage, setNewClassStage] = useState('إعدادي');
  const [manualStageSelected, setManualStageSelected] = useState(false);
  const [selectedPresetSections, setSelectedPresetSections] = useState<Record<string, boolean>>({});
  const [manualSectionsInput, setManualSectionsInput] = useState('');
  const [addClassError, setAddClassError] = useState<string | null>(null);

  // Copy Structure Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceYearId, setCopySourceYearId] = useState<string>('');

  // Edit Class Modal State
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassStage, setEditClassStage] = useState('إعدادي');
  const [editManualStageSelected, setEditManualStageSelected] = useState(false);
  const [editClassError, setEditClassError] = useState<string | null>(null);

  // Delete Class Modal State
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);
  const [confirmCascadeDelete, setConfirmCascadeDelete] = useState(false);

  // Manage Sections Modal State (for a specific class)
  const [managingClass, setManagingClass] = useState<SchoolClass | null>(null);
  const [newSectionNameInput, setNewSectionNameInput] = useState('');
  const [manageSectionError, setManageSectionError] = useState<string | null>(null);

  // Edit Section Modal State
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [editSectionError, setEditSectionError] = useState<string | null>(null);

  // Delete Section Modal State
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    if (currentYear && !selectedYearId) {
      setSelectedYearId(currentYear.id);
    }
  }, [currentYear, selectedYearId]);

  // Filter classes strictly by selected academic year
  const filteredClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const classTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filteredClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!filteredClasses.some((cls) => cls.id === selectedClassId)) {
      setSelectedClassId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedClassId]);

  const selectedClass = useMemo(
    () => filteredClasses.find((cls) => cls.id === selectedClassId) || null,
    [filteredClasses, selectedClassId]
  );
  const selectedClassSections = useMemo(
    () => selectedClass ? sections.filter((section) => section.classId === selectedClass.id) : [],
    [sections, selectedClass]
  );
  const selectedClassStudents = useMemo(
    () => selectedClass ? students.filter((student) => student.classId === selectedClass.id) : [],
    [students, selectedClass]
  );
  const selectedClassSubjects = useMemo(
    () => selectedClass ? subjects.filter((subject) => subject.classId === selectedClass.id) : [],
    [subjects, selectedClass]
  );

  const scrollClassTabs = (direction: 'left' | 'right') => {
    classTabsRef.current?.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  const visibleClassIds = useMemo(() => new Set(filteredClasses.map((cls) => cls.id)), [filteredClasses]);
  const visibleSectionCount = useMemo(
    () => sections.filter((section) => visibleClassIds.has(section.classId)).length,
    [sections, visibleClassIds]
  );
  const visibleStudentCount = useMemo(
    () => students.filter((student) => visibleClassIds.has(student.classId)).length,
    [students, visibleClassIds]
  );

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
  };

  // Handle auto-detection of stage when typing new class name
  const handleNewClassNameChange = (val: string) => {
    setNewClassName(val);
    if (addClassError) setAddClassError(null);

    if (!manualStageSelected) {
      const detected = autoDetectStage(val);
      if (detected) {
        setNewClassStage(detected);
      }
    }
  };

  const handleNewClassStageChange = (val: string) => {
    setNewClassStage(val);
    setManualStageSelected(true);
  };

  // Handle auto-detection of stage when editing class name
  const handleEditClassNameChange = (val: string) => {
    setEditClassName(val);
    if (editClassError) setEditClassError(null);

    if (!editManualStageSelected) {
      const detected = autoDetectStage(val);
      if (detected) {
        setEditClassStage(detected);
      }
    }
  };

  const handleEditClassStageChange = (val: string) => {
    setEditClassStage(val);
    setEditManualStageSelected(true);
  };

  // --- Handlers: Add Class with Checkboxes and Manual Sections ---
  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddClassError(null);

    const cleanName = newClassName.trim();
    if (!cleanName) {
      setAddClassError('يرجى إدخال اسم الصف الدراسي.');
      return;
    }

    if (!newClassStage) {
      setAddClassError('يرجى تحديد المرحلة الدراسية.');
      return;
    }

    if (db.isClassNameTaken(cleanName, undefined, selectedYearId)) {
      setAddClassError(`اسم الصف «${cleanName}» مسجل مسبقاً في هذا العام الدراسي.`);
      return;
    }

    // Collect all selected preset sections
    const presetChosen = PRESET_SECTIONS.filter((sec) => selectedPresetSections[sec]);

    // Collect manual sections
    const manualClean = manualSectionsInput.trim();
    const manualChosen = manualClean
      ? manualClean
          .split(/[,،;]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    // Combine and deduplicate
    const combinedSections = Array.from(new Set([...presetChosen, ...manualChosen]));

    // Create the class
    const newClass = db.addClass({
      name: cleanName,
      stage: newClassStage,
      order: filteredClasses.length + 1,
      academicYearId: selectedYearId,
    });

    // Create all sections safely
    for (const secName of combinedSections) {
      if (!db.isSectionNameTaken(newClass.id, secName)) {
        db.addSection({
          classId: newClass.id,
          name: secName,
        });
      }
    }

    // Reset form
    setNewClassName('');
    setNewClassStage('إعدادي');
    setManualStageSelected(false);
    setSelectedPresetSections({});
    setManualSectionsInput('');
    setIsAddClassModalOpen(false);

    showToast(`تمت إضافة الصف الدراسي «${cleanName}» (${newClassStage}) مع ${combinedSections.length} شعبة بنجاح.`);
  };

  // --- Handlers: Copy Structure from Previous Year ---
  const handleCopyStructure = () => {
    if (!copySourceYearId) {
      showToast('يرجى اختيار العام الدراسي المصدر للنسخ.', 'error');
      return;
    }
    if (copySourceYearId === selectedYearId) {
      showToast('لا يمكن النسخ من نفس العام الدراسي المحدد.', 'error');
      return;
    }

    const res = db.copyClassesAndSubjectsFromYear(copySourceYearId, selectedYearId);
    if (res.success) {
      showToast(res.message, 'success');
      setIsCopyModalOpen(false);
      setCopySourceYearId('');
    } else {
      showToast(res.message, 'error');
    }
  };

  // --- Handlers: Add Section to a Class (from Manage Sections Modal) ---
  const handleAddSectionToClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingClass) return;
    setManageSectionError(null);

    const cleanName = newSectionNameInput.trim();
    if (!cleanName) {
      setManageSectionError('يرجى إدخال اسم أو رمز الشعبة.');
      return;
    }

    if (db.isSectionNameTaken(managingClass.id, cleanName)) {
      setManageSectionError(`الشعبة «${cleanName}» مسجلة مسبقاً في صف «${managingClass.name}».`);
      return;
    }

    db.addSection({
      classId: managingClass.id,
      name: cleanName,
    });

    setNewSectionNameInput('');
    showToast(`تمت إضافة شعبة «${cleanName}» إلى صف «${managingClass.name}» بنجاح.`);
  };

  // --- Handlers: Edit Class ---
  const openEditClassModal = (cls: SchoolClass) => {
    setEditingClass(cls);
    setEditClassName(cls.name);
    setEditClassStage(cls.stage);
    setEditManualStageSelected(false);
    setEditClassError(null);
  };

  const handleSaveEditClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setEditClassError(null);

    const cleanName = editClassName.trim();
    if (!cleanName) {
      setEditClassError('اسم الصف الدراسي لا يمكن أن يكون فارغاً.');
      return;
    }

    if (!editClassStage) {
      setEditClassError('يرجى تحديد المرحلة الدراسية.');
      return;
    }

    const result = db.updateClass({
      ...editingClass,
      name: cleanName,
      stage: editClassStage,
    });

    if (!result.success) {
      setEditClassError(result.message || 'فشل تحديث بيانات الصف.');
      return;
    }

    showToast(`تم تحديث بيانات الصف الدراسي «${cleanName}» بنجاح.`);
    setEditingClass(null);
  };

  // --- Handlers: Delete / Archive Class ---
  const openDeleteClassModal = (cls: SchoolClass) => {
    setDeletingClass(cls);
    setConfirmCascadeDelete(false);
  };

  const handleArchiveClassConfirm = () => {
    if (!deletingClass) return;
    const res = db.archiveClass(deletingClass.id);
    if (res.success) {
      showToast(`تمت أرشفة الصف الدراسي «${deletingClass.name}» وإغلاقه للمحافظة على التاريخ.`, 'info');
      setDeletingClass(null);
    } else {
      showToast(res.message || 'فشلت أرشفة الصف.', 'error');
    }
  };

  const handleCascadeDeleteConfirm = async () => {
    if (!deletingClass) return;
    const res = await db.deleteClassCascade(deletingClass.id);
    if (res.success) {
      showToast(`تم حذف الصف الدراسي «${deletingClass.name}» وكافة البيانات وسجلات الدرجات المرتبطة به نهائياً.`, 'success');
      setDeletingClass(null);
      setConfirmCascadeDelete(false);
    } else {
      showToast((res as any).error || (res as any).message || 'فشل الحذف الشامل للصف.', 'error');
    }
  };

  const handleDeleteClassConfirm = () => {
    if (!deletingClass) return;

    const result = db.deleteClass(deletingClass.id);
    if (!result.success) {
      showToast(result.message || 'تعذر حذف الصف لوجود بيانات مرتبطة.', 'error');
      return;
    }

    showToast(`تم حذف الصف الدراسي «${deletingClass.name}» نهائياً.`, 'success');
    setDeletingClass(null);
  };

  // --- Handlers: Edit Section ---
  const openEditSectionModal = (sec: Section) => {
    setEditingSection(sec);
    setEditSectionName(sec.name);
    setEditSectionError(null);
  };

  const handleSaveEditSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    setEditSectionError(null);

    const cleanName = editSectionName.trim();
    if (!cleanName) {
      setEditSectionError('اسم أو رمز الشعبة لا يمكن أن يكون فارغاً.');
      return;
    }

    if (db.isSectionNameTaken(editingSection.classId, cleanName, editingSection.id)) {
      setEditSectionError('الشعبة مسجلة مسبقاً في هذا الصف.');
      return;
    }

    const result = db.updateSection({
      ...editingSection,
      name: cleanName,
    });

    if (!result.success) {
      setEditSectionError(result.message || 'فشل تحديث اسم الشعبة.');
      return;
    }

    showToast(`تم تحديث اسم الشعبة إلى «${cleanName}» بنجاح.`);
    setEditingSection(null);
  };

  // --- Handlers: Delete Section ---
  const openDeleteSectionModal = (sec: Section) => {
    setDeletingSection(sec);
  };

  const handleDeleteSectionConfirm = () => {
    if (!deletingSection) return;

    const result = db.deleteSection(deletingSection.id);
    if (!result.success) {
      showToast(result.message || 'تعذر حذف الشعبة لاحتوائها على بيانات مسجلة.', 'error');
      return;
    }

    showToast(`تم حذف الشعبة «${deletingSection.name}» بنجاح.`, 'success');
    setDeletingSection(null);
  };

  // Calculate detailed link counts for the class being deleted
  const deletingClassDetails = useMemo(() => {
    if (!deletingClass) return null;
    const classSections = sections.filter((s) => s.classId === deletingClass.id);
    const classStudents = students.filter((s) => s.classId === deletingClass.id);
    const classSubjects = subjects.filter((s) => s.classId === deletingClass.id);
    const classGradesCount = Object.values(grades).filter((g) => g.classId === deletingClass.id).length;

    const isBlocked =
      classSections.length > 0 ||
      classStudents.length > 0 ||
      classSubjects.length > 0 ||
      classGradesCount > 0;

    return {
      sectionsCount: classSections.length,
      studentsCount: classStudents.length,
      subjectsCount: classSubjects.length,
      gradesCount: classGradesCount,
      isBlocked,
    };
  }, [deletingClass, sections, students, subjects, grades]);

  // Calculate detailed link counts for the section being deleted
  const deletingSectionDetails = useMemo(() => {
    if (!deletingSection) return null;
    const parentClass = classes.find((c) => c.id === deletingSection.classId);
    const sectionStudents = students.filter((s) => s.sectionId === deletingSection.id);
    const sectionGradesCount = Object.values(grades).filter((g) => g.sectionId === deletingSection.id).length;

    const isBlocked = sectionStudents.length > 0 || sectionGradesCount > 0;

    return {
      parentClass,
      studentsCount: sectionStudents.length,
      gradesCount: sectionGradesCount,
      isBlocked,
    };
  }, [deletingSection, classes, students, grades]);

  return (
    <div className="flex flex-col gap-5 pb-10" dir="rtl">
      {toastMessage && (
        <div className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold animate-in fade-in slide-in-from-bottom duration-200 ${toastMessage.type === 'success' ? 'bg-[#059669] dark:bg-[#10B981] text-white dark:text-[#0B1420] border-[#10B981]/50' : toastMessage.type === 'error' ? 'bg-[#C83D4B] dark:bg-[#E35D6A] text-white dark:text-[#0B1420] border-[#E35D6A]/50' : 'bg-[#1E293B] dark:bg-[#1C2939] text-white border-[#2D3B4D]'}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="p-1 hover:bg-black/20 rounded cursor-pointer mr-2"><X className="w-4 h-4" /></button>
        </div>
      )}

      <section className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3156C9]/20 bg-[#3156C9]/8 dark:bg-[#2785F5]/12 px-3 py-1 text-[11px] font-bold text-[#3156C9] dark:text-[#60A5FA] mb-2">
              <Layers className="w-3.5 h-3.5" /> إدارة الهيكل الدراسي
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" /> إدارة الصفوف والشُعب
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">اختر الصف الدراسي لعرض الشُعب التابعة له وإحصائياته وإدارته.</p>
          </div>
          <button type="button" onClick={() => {
            setNewClassName('');
            setNewClassStage('إعدادي');
            setManualStageSelected(false);
            setSelectedPresetSections({});
            setManualSectionsInput('');
            setAddClassError(null);
            setIsAddClassModalOpen(true);
          }} className="h-11 px-5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0 cursor-pointer">
            <Plus className="w-4 h-4" /> إضافة صف دراسي جديد
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الصفوف', value: filteredClasses.length, icon: Layers, tone: 'blue' },
          { label: 'إجمالي الشُعب', value: visibleSectionCount, icon: FolderPlus, tone: 'violet' },
          { label: 'إجمالي الطلاب', value: visibleStudentCount, icon: Users, tone: 'green' },
          { label: 'إجمالي المواد', value: subjects.filter((subject) => visibleClassIds.has(subject.classId)).length, icon: BookOpen, tone: 'amber' },
        ].map((item) => {
          const tones: Record<string, string> = {
            blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900',
            violet: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900',
            green: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900',
            amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900',
          };
          const Icon = item.icon;
          return <div key={item.label} className={`rounded-2xl border p-4 ${tones[item.tone]}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold opacity-85">{item.label}</span><Icon className="w-5 h-5 opacity-80" /></div>
            <div className="text-2xl font-black font-mono tabular-nums mt-2">{item.value}</div>
          </div>;
        })}
      </div>

      <section className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-3.5 sm:p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2"><GraduationCap className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" /> الصفوف الدراسية</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} aria-label="العام الدراسي"
                className="h-10 min-w-[210px] px-3 pl-9 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#3976DB] focus:outline-none appearance-none cursor-pointer">
                {academicYears.map((year) => <option key={year.id} value={year.id}>العام الدراسي {year.name} {year.isCurrent ? '(الحالي)' : ''}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#A8B5C7] absolute left-3 top-3 pointer-events-none" />
            </div>
            <button type="button" onClick={() => setIsCopyModalOpen(true)}
              className="h-10 px-4 rounded-xl bg-[#F1F5FB] hover:bg-[#E5EDF8] dark:bg-[#26364B] dark:hover:bg-[#30435C] border border-[#D8E2F0] dark:border-[#3B4D66] text-[#263B5A] dark:text-[#D8E4F4] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors">
              <Copy className="w-4 h-4 text-[#3156C9] dark:text-[#8DB5FF]" /> نسخ صفوف من عام سابق
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => scrollClassTabs('right')} disabled={filteredClasses.length < 2} aria-label="تمرير الصفوف إلى اليمين"
            className="w-9 h-9 shrink-0 rounded-lg border border-[#DCE3ED] dark:border-[#3B4D66] bg-[#F8FAFC] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:text-[#3156C9] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          <div ref={classTabsRef} className="flex-1 min-w-0 overflow-x-auto flex items-center gap-2.5 py-1 scroll-smooth [scrollbar-width:thin] [scrollbar-color:#B8C7E2_transparent]">
            {filteredClasses.map((cls) => {
              const isActive = selectedClassId === cls.id;
              const count = sections.filter((section) => section.classId === cls.id).length;
              return <button key={cls.id} type="button" onClick={() => setSelectedClassId(cls.id)}
                aria-pressed={isActive}
                className={`shrink-0 min-w-[170px] h-12 px-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${isActive ? 'bg-[#3156C9] border-[#3156C9] text-white shadow-[0_4px_12px_rgba(49,86,201,0.2)]' : 'bg-[#F8FAFC] dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#3B4D66] text-[#334155] dark:text-[#C1D0E3] hover:border-[#9DB7F5] dark:hover:border-[#5278BA]'}`}>
                <span className="text-xs font-black whitespace-nowrap">{cls.name}</span>
                <span className={`text-[10px] font-bold rounded-full px-2 py-1 ${isActive ? 'bg-white/20 text-white' : 'bg-[#E8EEF8] dark:bg-[#1C2939] text-[#64748B] dark:text-[#A8B5C7]'}`}>{count} شُعب</span>
              </button>;
            })}
            {filteredClasses.length === 0 && <p className="text-xs text-[#64748B] dark:text-[#8493A8] py-3 px-2">لا توجد صفوف مسجلة في هذا العام الدراسي.</p>}
          </div>
          <button type="button" onClick={() => scrollClassTabs('left')} disabled={filteredClasses.length < 2} aria-label="تمرير الصفوف إلى اليسار"
            className="w-9 h-9 shrink-0 rounded-lg border border-[#DCE3ED] dark:border-[#3B4D66] bg-[#F8FAFC] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:text-[#3156C9] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
        </div>
      </section>

      {selectedClass ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
          <section className="min-w-0 rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div>
                <h3 className="text-sm font-black text-[#263B5A] dark:text-[#E2E8F0]">الصفوف والشُعب المسجلة: {selectedClass.name}</h3>
                <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1">{selectedClassSections.length} شعبة تابعة لهذا الصف</p>
              </div>
              <button type="button" onClick={() => { setManagingClass(selectedClass); setNewSectionNameInput(''); setManageSectionError(null); }}
                className="h-9 px-3 rounded-lg bg-[#3156C9]/10 hover:bg-[#3156C9]/15 dark:bg-[#2785F5]/15 dark:hover:bg-[#2785F5]/25 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer">
                <Plus className="w-4 h-4" /> إضافة شعبة جديدة
              </button>
            </div>

            {selectedClassSections.length === 0 ? (
              <div className="text-center py-12 text-[#64748B] dark:text-[#8493A8] text-xs">
                <FolderPlus className="w-9 h-9 mx-auto mb-3 opacity-60" />
                لا توجد شعب لهذا الصف حالياً. يمكنك إضافة أول شعبة من الزر أعلاه.
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full min-w-[650px] text-right border-collapse">
                  <thead><tr className="bg-[#EAF0FC] dark:bg-[#26364B] text-xs font-black text-[#334B6D] dark:text-[#C1D0E3] border-b border-[#D5E0F0] dark:border-[#3B4D66]">
                    <th className="py-3 px-4 w-14 text-center rounded-tr-xl">ت</th>
                    <th className="py-3 px-4">اسم الشعبة</th>
                    <th className="py-3 px-4 text-center">عدد الطلاب</th>
                    <th className="py-3 px-4 text-center rounded-tl-xl">الإجراءات</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D] text-xs">
                    {selectedClassSections.map((section, index) => {
                      const count = students.filter((student) => student.sectionId === section.id).length;
                      return <tr key={section.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#202E40] transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-[#64748B] dark:text-[#8493A8]">{index + 1}</td>
                        <td className="py-3.5 px-4 font-black text-sm text-[#1E293B] dark:text-[#E2E8F0]">شعبة {section.name}</td>
                        <td className="py-3.5 px-4 text-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 px-3 py-1 text-emerald-700 dark:text-emerald-300 font-bold tabular-nums"><Users className="w-3.5 h-3.5" />{count}</span></td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => { setManagingClass(selectedClass); setNewSectionNameInput(''); setManageSectionError(null); }} className="h-8 px-2.5 rounded-lg bg-[#3156C9]/10 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/20 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer hover:bg-[#3156C9]/15 transition-colors"><FolderPlus className="w-3.5 h-3.5" /> إدارة الشعبة</button>
                            <button type="button" onClick={() => openEditSectionModal(section)} title="تعديل الشعبة" className="p-2 rounded-lg bg-[#EDF1F7] dark:bg-[#26364B] text-[#3156C9] dark:text-[#60A5FA] hover:bg-[#DCE8FF] dark:hover:bg-[#30435C] transition-colors cursor-pointer"><Edit3 className="w-4 h-4" /></button>
                            <button type="button" onClick={() => openDeleteSectionModal(section)} title="حذف الشعبة" className="p-2 rounded-lg bg-[#FDEBEC] dark:bg-[#4A252D] text-[#C83D4B] dark:text-[#FF7B86] hover:bg-[#FBD5D8] dark:hover:bg-[#60303A] transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-[#1E293B] dark:text-[#E2E8F0]">معلومات الصف</h3>
              <Layers className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
            </div>
            <div className="rounded-xl bg-[#EEF3FF] dark:bg-[#263B63]/60 border border-[#D5E0FF] dark:border-[#3B4D78] p-4 text-center">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 text-[#3156C9] dark:text-[#8DB5FF]" />
              <h4 className="text-base font-black text-[#1E293B] dark:text-[#E2E8F0]">{selectedClass.name}</h4>
              <span className="inline-flex mt-2 px-3 py-1 rounded-full bg-white dark:bg-[#1C2939] text-[#3156C9] dark:text-[#8DB5FF] text-[11px] font-bold">{selectedClass.stage}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3 text-center">
                <Users className="w-4 h-4 mx-auto text-emerald-600 dark:text-emerald-400" />
                <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums mt-1">{selectedClassStudents.length}</div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">عدد الطلاب</div>
              </div>
              <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 p-3 text-center">
                <FolderPlus className="w-4 h-4 mx-auto text-violet-600 dark:text-violet-400" />
                <div className="text-xl font-black text-violet-700 dark:text-violet-300 tabular-nums mt-1">{selectedClassSections.length}</div>
                <div className="text-[10px] text-violet-700 dark:text-violet-300 font-bold">عدد الشعب</div>
              </div>
              <div className="col-span-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> المواد الدراسية</span>
                <strong className="text-lg font-black text-amber-700 dark:text-amber-300 tabular-nums">{selectedClassSubjects.length}</strong>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button type="button" onClick={() => openEditClassModal(selectedClass)} className="h-9 rounded-lg bg-[#3156C9]/10 hover:bg-[#3156C9]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/20 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"><Edit3 className="w-4 h-4" /> تعديل بيانات الصف</button>
              <button type="button" onClick={() => openDeleteClassModal(selectedClass)} className="h-9 rounded-lg bg-[#EDF1F7] hover:bg-red-50 dark:bg-[#26364B] dark:hover:bg-red-950/30 text-[#475569] dark:text-[#A8B5C7] hover:text-red-600 border border-[#DCE3ED] dark:border-[#2D3B4D] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"><Settings2 className="w-4 h-4" /> أرشفة أو حذف الصف</button>
            </div>
          </aside>
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#3B4D66] bg-white dark:bg-[#1C2939] p-12 text-center text-sm text-[#64748B] dark:text-[#8493A8]">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-50" />لا توجد صفوف دراسية لعرضها في العام المحدد.
        </section>
      )}
      {/* Add Class Modal */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[22px] w-full max-w-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 text-[#1E293B] dark:text-[#E2E8F0] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#E8EFFF] dark:bg-[#263B63] border border-[#D3DFFF] dark:border-[#3B4D78] text-[#3156C9] dark:text-[#8DB5FF] flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-[#1E293B] dark:text-[#E2E8F0]">إضافة صف دراسي جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClassModalOpen(false)}
                aria-label="إغلاق"
                className="p-2 rounded-xl text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addClassError && (
              <div className="p-3 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addClassError}</span>
              </div>
            )}

            <form onSubmit={handleAddClassSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-2">
                    اسم الصف الدراسي <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>
                  </label>
                  <input
                    ref={newClassNameInputRef}
                    type="text"
                    value={newClassName}
                    onChange={(e) => handleNewClassNameChange(e.target.value)}
                    placeholder="مثال: الرابع العلمي"
                    className="w-full h-12 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#8493A8] focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-2">
                    المرحلة الدراسية <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>
                  </label>
                  <select
                    value={newClassStage}
                    onChange={(e) => handleNewClassStageChange(e.target.value)}
                    className="w-full h-12 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none cursor-pointer font-bold transition"
                  >
                    {STAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <section className="rounded-2xl border border-[#E0E8F5] dark:border-[#33465F] bg-[#F8FAFE] dark:bg-[#202E40] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-[#3156C9] dark:text-[#8DB5FF]" />
                  <h4 className="text-sm font-black text-[#334B6D] dark:text-[#D5E2F2]">الشُعب الدراسية</h4>
                  <span className="text-[10px] font-semibold text-[#8493A8]">(اختياري)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PRESET_SECTIONS.map((sec) => {
                    const isChecked = Boolean(selectedPresetSections[sec]);
                    return (
                      <button
                        key={sec}
                        type="button"
                        aria-pressed={isChecked}
                        onClick={() => {
                          setSelectedPresetSections((prev) => ({
                            ...prev,
                            [sec]: !prev[sec],
                          }));
                        }}
                        className={`min-h-11 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#E8EFFF] dark:bg-[#263B63] border-[#8EAAEF] dark:border-[#5277C8] text-[#244DB5] dark:text-[#A9C3FF] shadow-sm'
                            : 'bg-white dark:bg-[#26364B] border-[#DCE5F1] dark:border-[#3B4D66] text-[#475569] dark:text-[#B8C6D8] hover:border-[#9CB5E8] dark:hover:border-[#5877A5]'
                        }`}
                      >
                        <span>شعبة {sec}</span>
                        {isChecked ? <CheckSquare className="w-4 h-4 shrink-0" /> : <Square className="w-4 h-4 shrink-0 text-[#94A3B8]" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E0E8F5] dark:border-[#33465F] bg-white dark:bg-[#202E40] p-4">
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-2">
                  إضافة شُعب أخرى <span className="font-medium text-[#8493A8]">(اختياري)</span>
                </label>
                <input
                  type="text"
                  value={manualSectionsInput}
                  onChange={(e) => setManualSectionsInput(e.target.value)}
                  placeholder="أدخل أسماء الشُعب"
                  className="w-full h-12 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#8493A8] focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                />
              </section>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-start gap-2.5 pt-4 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                <button
                  type="submit"
                  className="px-5 h-11 text-xs font-bold rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3979E6] dark:hover:bg-[#4B8CF0] text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_5px_14px_rgba(49,86,201,0.2)]"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ الصف وإضافة الشُعب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  className="px-5 h-11 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#334155] dark:text-[#E2E8F0] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: Manage Sections (إدارة الشعب التابعة للصف)
          ========================================================================= */}
      {managingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA]">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">إدارة الشعب الدراسية</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                    الصف: <strong className="text-[#1E293B] dark:text-[#E2E8F0]">{managingClass.name}</strong> ({managingClass.stage})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingClass(null)}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Section Form inside Modal */}
            <form onSubmit={handleAddSectionToClass} className="flex flex-col gap-3 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D]">
              <h4 className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                <span>إضافة شعبة جديدة لهذا الصف</span>
              </h4>

              {manageSectionError && (
                <div className="p-2.5 rounded-lg bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{manageSectionError}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSectionNameInput}
                  onChange={(e) => {
                    setNewSectionNameInput(e.target.value);
                    if (manageSectionError) setManageSectionError(null);
                  }}
                  placeholder="اسم أو رمز الشعبة (مثال: أ، ب، ج)"
                  className="flex-1 h-10 px-3 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-lg bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
            </form>

            {/* Sections List */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">الشعب المسجلة حالياً:</h4>
              {sections.filter((s) => s.classId === managingClass.id).length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-dashed border-[#CBD5E1] dark:border-[#2D3B4D] text-xs text-[#64748B] dark:text-[#8493A8]">
                  لا توجد شعب مسجلة لهذا الصف حتى الآن.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {sections
                    .filter((s) => s.classId === managingClass.id)
                    .map((sec) => {
                      const secStudents = students.filter((st) => st.sectionId === sec.id);
                      return (
                        <div
                          key={sec.id}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-[#1E293B] dark:text-[#E2E8F0] text-sm">شعبة {sec.name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] font-mono tabular-nums">
                              {secStudents.length} طالب
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditSectionModal(sec)}
                              className="p-1.5 rounded hover:bg-[#D69B42]/15 text-[#64748B] dark:text-[#8493A8] hover:text-[#B45309] dark:hover:text-[#D69B42] transition-colors cursor-pointer"
                              title="تعديل اسم الشعبة"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteSectionModal(sec)}
                              className="p-1.5 rounded hover:bg-[#E35D6A]/15 text-[#64748B] dark:text-[#8493A8] hover:text-[#C83D4B] dark:hover:text-[#E35D6A] transition-colors cursor-pointer"
                              title="حذف الشعبة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setManagingClass(null)}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: Edit Class (تعديل بيانات الصف)
          ========================================================================= */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">تعديل بيانات الصف الدراسي</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">تحديث اسم الصف والمرحلة الدراسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editClassError && (
              <div className="p-3 rounded-lg bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editClassError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditClass} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1">اسم الصف الدراسي</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => handleEditClassNameChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1">المرحلة الدراسية</label>
                <select
                  value={editClassStage}
                  onChange={(e) => handleEditClassStageChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden cursor-pointer font-bold"
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: Delete / Archive School Class
          ========================================================================= */}
      {deletingClass && deletingClassDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg border ${
                    deletingClassDetails.isBlocked
                      ? 'bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42]'
                      : 'bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">إدارة حذف وأرشفة الصف الدراسي</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                    الصف: <strong className="text-[#1E293B] dark:text-[#E2E8F0]">{deletingClass.name}</strong> ({deletingClass.stage})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deletingClassDetails.isBlocked ? (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#1E293B] dark:text-[#E2E8F0] text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-[#B45309] dark:text-[#D69B42]">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>يحتوي هذا الصف على سجلات وبيانات مرتبطة بالنظام:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pr-2 text-[#475569] dark:text-[#A8B5C7]">
                    {deletingClassDetails.sectionsCount > 0 && (
                      <li>الشعب المسجلة: <strong className="text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">{deletingClassDetails.sectionsCount}</strong> شعبة</li>
                    )}
                    {deletingClassDetails.studentsCount > 0 && (
                      <li>الطلاب المقيدون: <strong className="text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">{deletingClassDetails.studentsCount}</strong> طالب</li>
                    )}
                    {deletingClassDetails.subjectsCount > 0 && (
                      <li>المواد الدراسية: <strong className="text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">{deletingClassDetails.subjectsCount}</strong> مادة</li>
                    )}
                    {deletingClassDetails.gradesCount > 0 && (
                      <li>سجلات الدرجات: <strong className="text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">{deletingClassDetails.gradesCount}</strong> سجل درجات</li>
                    )}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#059669] dark:text-[#10B981] flex items-center gap-1.5">
                      <Archive className="w-4 h-4" />
                      الخيار الأنسب: أرشفة الصف وإغلاقه
                    </span>
                    <button
                      type="button"
                      onClick={handleArchiveClassConfirm}
                      className="px-3 py-1.5 rounded-lg bg-[#D69B42] hover:bg-[#B45309] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      أرشفة الصف
                    </button>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] leading-relaxed">
                    يتم إغلاق الصف وتغيير حالته إلى مؤرشف للمحافظة على التاريخ الأكاديمي وسجلات السنين الماضية دون أي فقدان للبيانات.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#C83D4B] dark:text-[#E35D6A] flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      حذف نهائي شامل لكافة البيانات
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#C83D4B] dark:text-[#E35D6A] font-bold">
                      <input
                        type="checkbox"
                        checked={confirmCascadeDelete}
                        onChange={(e) => setConfirmCascadeDelete(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#C83D4B] bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D]"
                      />
                      <span>أنا أتحمل المسؤولية</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                    سيتم حذف الصف وكافة الشعب والطلاب والدرجات والمواد التابعة له نهائياً من قاعدة البيانات داخل معاملة آمنة (Transaction).
                  </p>
                  {confirmCascadeDelete && (
                    <button
                      type="button"
                      onClick={handleCascadeDeleteConfirm}
                      className="mt-1 w-full py-2 rounded-lg bg-[#C83D4B] hover:bg-[#B02E3C] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف شامل ونهائي لجميع بيانات الصف</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف الصف الدراسي «<strong className="text-[#1E293B] dark:text-[#E2E8F0]">{deletingClass.name}</strong>» نهائياً من النظام؟
                </p>
                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs text-[#64748B] dark:text-[#8493A8]">
                  هذا الصف فارغ ولا يحتوي على أي شعب أو طلاب أو مواد مرتبطة به. هذا الإجراء لا يمكن التراجع عنه بعد تنفيذه.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              {!deletingClassDetails.isBlocked && (
                <button
                  type="button"
                  onClick={handleDeleteClassConfirm}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#C83D4B] hover:bg-[#B02E3C] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد حذف الصف</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: Edit Section (تعديل اسم أو رمز الشعبة)
          ========================================================================= */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">تعديل الشعبة</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">تعديل اسم أو رمز الشعبة الدراسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSectionError && (
              <div className="p-3 rounded-lg bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editSectionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSection} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1">اسم أو رمز الشعبة</label>
                <input
                  type="text"
                  value={editSectionName}
                  onChange={(e) => {
                    setEditSectionName(e.target.value);
                    if (editSectionError) setEditSectionError(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ التعديل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: Delete Section (حذف الشعبة مع التحقق الآمن)
          ========================================================================= */}
      {deletingSection && deletingSectionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg border ${
                    deletingSectionDetails.isBlocked
                      ? 'bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42]'
                      : 'bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]'
                  }`}
                >
                  {deletingSectionDetails.isBlocked ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                    {deletingSectionDetails.isBlocked ? 'تعذر حذف الشعبة الدراسية' : 'تأكيد حذف الشعبة'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                    شعبة: <strong className="text-[#1E293B] dark:text-[#E2E8F0]">{deletingSection.name}</strong> - صف:{' '}
                    <strong className="text-[#1E293B] dark:text-[#E2E8F0]">{deletingSectionDetails.parentClass?.name || ''}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingSection(null)}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deletingSectionDetails.isBlocked ? (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#1E293B] dark:text-[#E2E8F0] text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-[#B45309] dark:text-[#D69B42]">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>لا يمكن حذف هذه الشعبة لوجود طلاب وسجلات مسجلة بها:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pr-2 text-[#475569] dark:text-[#A8B5C7]">
                    <li>
                      عدد الطلاب المسجلين حالياً: <strong className="text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">{deletingSectionDetails.studentsCount}</strong> طالب
                    </li>
                    {deletingSectionDetails.gradesCount > 0 && (
                      <li>
                        سجلات الدرجات المسجلة في الشعبة: <strong className="text-[#B45309] dark:text-[#D69B42] font-mono tabular-nums">{deletingSectionDetails.gradesCount}</strong> سجل
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف الشعبة «<strong className="text-[#1E293B] dark:text-[#E2E8F0]">{deletingSection.name}</strong>» نهائياً؟
                </p>
                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs text-[#64748B] dark:text-[#8493A8]">
                  هذه الشعبة لا تحتوي على أي طلاب أو درجات مسجلة، ويمكن حذفها بأمان تام.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setDeletingSection(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
              >
                {deletingSectionDetails.isBlocked ? 'إغلاق' : 'إلغاء'}
              </button>

              {!deletingSectionDetails.isBlocked && (
                <button
                  type="button"
                  onClick={handleDeleteSectionConfirm}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#C83D4B] hover:bg-[#B02E3C] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد حذف الشعبة</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
