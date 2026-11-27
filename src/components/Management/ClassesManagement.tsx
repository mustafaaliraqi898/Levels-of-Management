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
    <div className="flex flex-col gap-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold animate-in fade-in slide-in-from-bottom duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-500 dark:border-emerald-400'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 dark:bg-rose-500 text-white border-rose-500 dark:border-rose-400'
              : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/20 rounded cursor-pointer mr-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">
              <Layers className="w-3.5 h-3.5" />
              الهيكل التنظيمي للمدرسة
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              إجمالي الصفوف: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{filteredClasses.length}</strong> | إجمالي الشعب: <strong className="text-amber-700 dark:text-amber-400 font-mono">{sections.filter(s => filteredClasses.some(c => c.id === s.classId)).length}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-teal-700 dark:text-teal-400" />
            إدارة الصفوف والشعب الدراسية
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إضافة وإدارة الصفوف والمراحل التعليمية والشعب التابعة لها لكل عام دراسي عبر نافذة منبثقة تفاعلية.
          </p>
        </div>

        {/* Academic Year Filter, Copy Structure & Add Class Button */}
        <div className="flex flex-wrap items-center gap-3">
          {academicYears.length > 0 && (
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="h-10 px-3 pr-3 pl-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden appearance-none cursor-pointer"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    العام الدراسي {y.name} {y.isCurrent ? '(الحالي)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCopyModalOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            title="نسخ الهيكل التنظيمي للصفوف والمواد من عام دراسي سابق"
          >
            <Copy className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>نسخ صفوف من عام سابق</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewClassName('');
              setNewClassStage('إعدادي');
              setManualStageSelected(false);
              setSelectedPresetSections({});
              setManualSectionsInput('');
              setAddClassError(null);
              setIsAddClassModalOpen(true);
            }}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صف دراسي جديد</span>
          </button>
        </div>
      </div>

      {/* Main Table View: Registered Classes & Sections */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>جدول الصفوف والشعب الدراسية المسجلة</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              عرض تفصيلي لصفوف العام الدراسي المحدد مع إمكانية تعديل البيانات، إدارة الشعب، أو الحذف والأرشفة.
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 font-mono font-bold self-start sm:self-auto">
            {filteredClasses.length} صفوف مسجلة
          </span>
        </div>

        {filteredClasses.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
              <Layers className="w-8 h-8" />
            </div>
            <p>لا توجد صفوف دراسية مسجلة في هذا العام الدراسي.</p>
            <button
              type="button"
              onClick={() => {
                setNewClassName('');
                setNewClassStage('إعدادي');
                setManualStageSelected(false);
                setSelectedPresetSections({});
                setManualSectionsInput('');
                setAddClassError(null);
                setIsAddClassModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صف دراسي جديد الآن</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                  <th className="py-3 px-4 rounded-r-xl">اسم الصف الدراسي</th>
                  <th className="py-3 px-4">المرحلة الدراسية</th>
                  <th className="py-3 px-4">الشعب التابعة</th>
                  <th className="py-3 px-4 text-center">الإحصائيات</th>
                  <th className="py-3 px-4 text-center rounded-l-xl">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredClasses.map((cls) => {
                  const classSections = sections.filter((s) => s.classId === cls.id);
                  const classStudents = students.filter((s) => s.classId === cls.id);
                  const classSubjects = subjects.filter((s) => s.classId === cls.id);

                  return (
                    <tr
                      key={cls.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${cls.isArchived ? 'opacity-75 bg-slate-50/70 dark:bg-slate-950/30' : ''}`}
                    >
                      {/* Class Name */}
                      <td className="py-4 px-4 font-black text-slate-900 dark:text-white text-sm">
                        <div className="flex items-center gap-2">
                          <span>{cls.name}</span>
                          {cls.isArchived && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                              <Archive className="w-3 h-3" />
                              مؤرشف
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">
                          {cls.stage}
                        </span>
                      </td>

                      {/* Sections */}
                      <td className="py-4 px-4">
                        {classSections.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {classSections.map((sec) => (
                              <span
                                key={sec.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs"
                              >
                                <span>شعبة {sec.name}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">بدون شعب</span>
                        )}
                      </td>

                      {/* Stats */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                          <span className="flex items-center gap-1" title="عدد الطلاب">
                            <Users className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                            <span className="font-mono">{classStudents.length}</span>
                          </span>
                          <span className="flex items-center gap-1" title="عدد المواد">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span className="font-mono">{classSubjects.length}</span>
                          </span>
                          <span className="flex items-center gap-1" title="عدد الشعب">
                            <FolderPlus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="font-mono">{classSections.length}</span>
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Manage Sections */}
                          <button
                            type="button"
                            onClick={() => {
                              setManagingClass(cls);
                              setNewSectionNameInput('');
                              setManageSectionError(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/15 dark:hover:bg-teal-500/25 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="إدارة الشعب التابعة لهذا الصف"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            <span>إدارة الشعب</span>
                          </button>

                          {/* Edit Class */}
                          <button
                            type="button"
                            onClick={() => openEditClassModal(cls)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                            title="تعديل بيانات الصف"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete / Archive Class */}
                          <button
                            type="button"
                            onClick={() => openDeleteClassModal(cls)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="حذف أو أرشفة الصف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: Add Class (إضافة صف دراسي جديد) - Refined per prompt
          ========================================================================= */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">إضافة صف دراسي جديد</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">أدخل اسم الصف، واسترشد بالتحديد التلقائي أو اختر يدوياً مع تحديد الشعب</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClassModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addClassError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{addClassError}</span>
              </div>
            )}

            <form onSubmit={handleAddClassSubmit} className="flex flex-col gap-4">
              {/* 1. Class Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الصف الدراسي <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <input
                  ref={newClassNameInputRef}
                  type="text"
                  value={newClassName}
                  onChange={(e) => handleNewClassNameChange(e.target.value)}
                  placeholder="مثال: الأول المتوسط، الرابع العلمي، السادس الأدبي"
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                  required
                />
              </div>

              {/* 2. Stage (Auto-detected + 4 Manual Options) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المرحلة الدراسية <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <select
                  value={newClassStage}
                  onChange={(e) => handleNewClassStageChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden cursor-pointer font-bold"
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  يحدد النظام المرحلة تلقائياً بناءً على اسم الصف، ويمكنك تعديلها يدوياً عند الحاجة.
                </p>
              </div>

              {/* 3. Preset Sections Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  الشعب الدراسية الجاهزة (اختياري)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_SECTIONS.map((sec) => {
                    const isChecked = Boolean(selectedPresetSections[sec]);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setSelectedPresetSections((prev) => ({
                            ...prev,
                            [sec]: !prev[sec],
                          }));
                        }}
                        className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                        <span>شعبة {sec}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Manual Sections Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  إضافة شعب يدوياً (اختياري)
                </label>
                <input
                  type="text"
                  value={manualSectionsInput}
                  onChange={(e) => setManualSectionsInput(e.target.value)}
                  placeholder="مثال: ك، ل، م، شعبة المسائي"
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  افصل بين أسماء الشعب اليدوية بالفواصل (، أو ,). يمكنك الجمع بين مربعات الاختيار والإدخال اليدوي.
                </p>
              </div>

              {/* 5. Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ الصف وإضافة الشعب</span>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">إدارة الشعب الدراسية</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    الصف: <strong className="text-slate-900 dark:text-white">{managingClass.name}</strong> ({managingClass.stage})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingClass(null)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Section Form inside Modal */}
            <form onSubmit={handleAddSectionToClass} className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>إضافة شعبة جديدة لهذا الصف</span>
              </h4>

              {manageSectionError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
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
                  className="flex-1 h-10 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-600 dark:focus:border-teal-400 focus:outline-hidden"
                  required
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-400 dark:hover:bg-teal-300 dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
            </form>

            {/* Sections List */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">الشعب المسجلة حالياً:</h4>
              {sections.filter((s) => s.classId === managingClass.id).length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
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
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-slate-900 dark:text-white text-sm">شعبة {sec.name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                              {secStudents.length} طالب
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditSectionModal(sec)}
                              className="p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-500/15 text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                              title="تعديل اسم الشعبة"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteSectionModal(sec)}
                              className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
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

            <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setManagingClass(null)}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">تعديل بيانات الصف الدراسي</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تحديث اسم الصف والمرحلة الدراسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editClassError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{editClassError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditClass} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الصف الدراسي</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => handleEditClassNameChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المرحلة الدراسية</label>
                <select
                  value={editClassStage}
                  onChange={(e) => handleEditClassStageChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden cursor-pointer font-bold"
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg border ${
                    deletingClassDetails.isBlocked
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                      : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">إدارة حذف وأرشفة الصف الدراسي</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    الصف: <strong className="text-slate-800 dark:text-slate-200">{deletingClass.name}</strong> ({deletingClass.stage})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deletingClassDetails.isBlocked ? (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>يحتوي هذا الصف على سجلات وبيانات مرتبطة بالنظام:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pr-2 text-slate-700 dark:text-slate-300">
                    {deletingClassDetails.sectionsCount > 0 && (
                      <li>الشعب المسجلة: <strong className="text-amber-800 dark:text-amber-300 font-mono">{deletingClassDetails.sectionsCount}</strong> شعبة</li>
                    )}
                    {deletingClassDetails.studentsCount > 0 && (
                      <li>الطلاب المقيدون: <strong className="text-amber-800 dark:text-amber-300 font-mono">{deletingClassDetails.studentsCount}</strong> طالب</li>
                    )}
                    {deletingClassDetails.subjectsCount > 0 && (
                      <li>المواد الدراسية: <strong className="text-amber-800 dark:text-amber-300 font-mono">{deletingClassDetails.subjectsCount}</strong> مادة</li>
                    )}
                    {deletingClassDetails.gradesCount > 0 && (
                      <li>سجلات الدرجات: <strong className="text-amber-800 dark:text-amber-300 font-mono">{deletingClassDetails.gradesCount}</strong> سجل درجات</li>
                    )}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Archive className="w-4 h-4" />
                      الخيار الأنسب: أرشفة الصف وإغلاقه
                    </span>
                    <button
                      type="button"
                      onClick={handleArchiveClassConfirm}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      أرشفة الصف
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    يتم إغلاق الصف وتغيير حالته إلى مؤرشف للمحافظة على التاريخ الأكاديمي وسجلات السنين الماضية دون أي فقدان للبيانات.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      حذف نهائي شامل لكافة البيانات
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-rose-700 dark:text-rose-300 font-bold">
                      <input
                        type="checkbox"
                        checked={confirmCascadeDelete}
                        onChange={(e) => setConfirmCascadeDelete(e.target.checked)}
                        className="w-4 h-4 rounded accent-rose-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                      />
                      <span>أنا أتحمل المسؤولية</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    سيتم حذف الصف وكافة الشعب والطلاب والدرجات والمواد التابعة له نهائياً من قاعدة البيانات داخل معاملة آمنة (Transaction).
                  </p>
                  {confirmCascadeDelete && (
                    <button
                      type="button"
                      onClick={handleCascadeDeleteConfirm}
                      className="mt-1 w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف شامل ونهائي لجميع بيانات الصف</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف الصف الدراسي «<strong className="text-slate-900 dark:text-white">{deletingClass.name}</strong>» نهائياً من النظام؟
                </p>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  هذا الصف فارغ ولا يحتوي على أي شعب أو طلاب أو مواد مرتبطة به. هذا الإجراء لا يمكن التراجع عنه بعد تنفيذه.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              {!deletingClassDetails.isBlocked && (
                <button
                  type="button"
                  onClick={handleDeleteClassConfirm}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">تعديل الشعبة</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تعديل اسم أو رمز الشعبة الدراسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSectionError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{editSectionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSection} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم أو رمز الشعبة</label>
                <input
                  type="text"
                  value={editSectionName}
                  onChange={(e) => {
                    setEditSectionName(e.target.value);
                    if (editSectionError) setEditSectionError(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg border ${
                    deletingSectionDetails.isBlocked
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                      : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {deletingSectionDetails.isBlocked ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {deletingSectionDetails.isBlocked ? 'تعذر حذف الشعبة الدراسية' : 'تأكيد حذف الشعبة'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    شعبة: <strong className="text-slate-800 dark:text-slate-200">{deletingSection.name}</strong> - صف:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{deletingSectionDetails.parentClass?.name || ''}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingSection(null)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deletingSectionDetails.isBlocked ? (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>لا يمكن حذف هذه الشعبة لوجود طلاب وسجلات مسجلة بها:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pr-2 text-slate-700 dark:text-slate-300">
                    <li>
                      عدد الطلاب المسجلين حالياً: <strong className="text-amber-800 dark:text-amber-300 font-mono">{deletingSectionDetails.studentsCount}</strong> طالب
                    </li>
                    {deletingSectionDetails.gradesCount > 0 && (
                      <li>
                        سجلات الدرجات المسجلة في الشعبة: <strong className="text-amber-800 dark:text-amber-300 font-mono">{deletingSectionDetails.gradesCount}</strong> سجل
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف الشعبة «<strong className="text-slate-900 dark:text-white">{deletingSection.name}</strong>» نهائياً؟
                </p>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  هذه الشعبة لا تحتوي على أي طلاب أو درجات مسجلة، ويمكن حذفها بأمان تام.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSection(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {deletingSectionDetails.isBlocked ? 'إغلاق' : 'إلغاء'}
              </button>

              {!deletingSectionDetails.isBlocked && (
                <button
                  type="button"
                  onClick={handleDeleteSectionConfirm}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
