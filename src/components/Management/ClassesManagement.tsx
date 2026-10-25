import React, { useState, useMemo, useEffect } from 'react';
import { SchoolClass, Section, Student, Subject, GradeRecord } from '../../types';
import { db } from '../../services/storage';
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
} from 'lucide-react';

interface ClassesManagementProps {
  classes: SchoolClass[];
  sections: Section[];
  students?: Student[];
  subjects?: Subject[];
  grades?: Record<string, GradeRecord>;
}

export const ClassesManagement: React.FC<ClassesManagementProps> = ({
  classes,
  sections,
  students = [],
  subjects = [],
  grades = {},
}) => {
  // Add Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassStage, setNewClassStage] = useState('إعدادي');
  const [addClassError, setAddClassError] = useState<string | null>(null);

  // Add Section Form State
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [newSectionName, setNewSectionName] = useState('');
  const [addSectionError, setAddSectionError] = useState<string | null>(null);

  // Edit Class Modal State
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassStage, setEditClassStage] = useState('إعدادي');
  const [editClassError, setEditClassError] = useState<string | null>(null);

  // Delete Class Modal State
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);

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

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Sync selectedClassId if current selection is invalid or deleted
  useEffect(() => {
    if (classes.length > 0 && !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
  };

  // --- Handlers: Add Class ---
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    setAddClassError(null);

    const cleanName = newClassName.trim();
    if (!cleanName) {
      setAddClassError('يرجى إدخال اسم الصف الدراسي.');
      return;
    }

    if (db.isClassNameTaken(cleanName)) {
      setAddClassError(`اسم الصف «${cleanName}» مسجل مسبقاً في النظام.`);
      return;
    }

    db.addClass({
      name: cleanName,
      stage: newClassStage,
      order: classes.length + 1,
    });

    setNewClassName('');
    showToast(`تمت إضافة الصف الدراسي «${cleanName}» بنجاح.`);
  };

  // --- Handlers: Add Section ---
  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    setAddSectionError(null);

    const cleanName = newSectionName.trim();
    if (!cleanName || !selectedClassId) {
      setAddSectionError('يرجى تحديد الصف وكتابة اسم أو رمز الشعبة.');
      return;
    }

    if (db.isSectionNameTaken(selectedClassId, cleanName)) {
      const parentClassName = classes.find((c) => c.id === selectedClassId)?.name || '';
      setAddSectionError(`الشعبة «${cleanName}» مسجلة مسبقاً في صف «${parentClassName}».`);
      return;
    }

    db.addSection({
      classId: selectedClassId,
      name: cleanName,
    });

    setNewSectionName('');
    const parentClass = classes.find((c) => c.id === selectedClassId);
    showToast(`تمت إضافة شعبة «${cleanName}» إلى صف «${parentClass?.name || ''}» بنجاح.`);
  };

  // --- Handlers: Edit Class ---
  const openEditClassModal = (cls: SchoolClass) => {
    setEditingClass(cls);
    setEditClassName(cls.name);
    setEditClassStage(cls.stage);
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

  // --- Handlers: Delete Class ---
  const openDeleteClassModal = (cls: SchoolClass) => {
    setDeletingClass(cls);
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

    const result = db.updateSection({
      ...editingSection,
      name: cleanName,
    });

    if (!result.success) {
      setEditSectionError(result.message || 'فشل تحديث اسم الشعبة.');
      return;
    }

    const parentClass = classes.find((c) => c.id === editingSection.classId);
    showToast(`تم تحديث اسم الشعبة إلى «${cleanName}» في صف «${parentClass?.name || ''}».`);
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

    const parentClass = classes.find((c) => c.id === deletingSection.classId);
    showToast(`تم حذف الشعبة «${deletingSection.name}» من صف «${parentClass?.name || ''}» بنجاح.`, 'success');
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
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toastMessage.type === 'error'
              ? 'bg-red-600 text-white border-red-500'
              : 'bg-slate-900 text-white border-slate-700'
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
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
              <Layers className="w-3.5 h-3.5" />
              الهيكل التنظيمي للمدرسة
            </span>
            <span className="text-slate-400 text-xs">
              إجمالي الصفوف: <strong className="text-emerald-400 font-mono">{classes.length}</strong> | إجمالي الشعب: <strong className="text-amber-400 font-mono">{sections.length}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-teal-400" />
            إدارة الصفوف والشعب الدراسية
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إضافة وتعديل وحذف الصفوف والمراحل التعليمية والشعب التابعة لها مع حماية كاملة لسجلات الطلاب والدرجات.
          </p>
        </div>
      </div>

      {/* Top Add Forms: Add Class & Add Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Add Class Form */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              إضافة صف دراسي جديد
            </h3>

            {addClassError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{addClassError}</span>
              </div>
            )}

            <form onSubmit={handleAddClass} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الصف</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => {
                    setNewClassName(e.target.value);
                    if (addClassError) setAddClassError(null);
                  }}
                  placeholder="مثال: الرابع الأدبي أو الأول المتوسط"
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المرحلة الدراسية</label>
                <select
                  value={newClassStage}
                  onChange={(e) => setNewClassStage(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="إعدادي">إعدادي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="ابتدائي">ابتدائي</option>
                </select>
              </div>

              <button
                type="submit"
                className="h-10 mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة الصف الدراسي</span>
              </button>
            </form>
          </div>
        </div>

        {/* 2. Add Section Form */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-400" />
              إضافة شعبة لصف دراسي
            </h3>

            {addSectionError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{addSectionError}</span>
              </div>
            )}

            <form onSubmit={handleAddSection} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الصف التابع له</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    if (addSectionError) setAddSectionError(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم أو رمز الشعبة</label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => {
                    setNewSectionName(e.target.value);
                    if (addSectionError) setAddSectionError(null);
                  }}
                  placeholder="مثال: أ أو ب أو ج"
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-amber-500 focus:outline-hidden"
                  required
                />
              </div>

              <button
                type="submit"
                className="h-10 mt-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-amber-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة الشعبة</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Grid: Registered Classes & Sections */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-400" />
              <span>الصفوف والشعب الحالية المسجلة بالنظام</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              يمكنك تعديل أي صف أو شعبة عبر أيقونة القلم <Edit3 className="w-3 h-3 inline mx-0.5 text-teal-400" /> أو حذف العناصر غير المرتبطة ببيانات عبر أيقونة السلة <Trash2 className="w-3 h-3 inline mx-0.5 text-red-400" />.
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-teal-300 font-mono font-bold self-start sm:self-auto">
            {classes.length} صفوف مسجلة
          </span>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            لا توجد صفوف دراسية مسجلة حالياً. استخدم النموذج أعلاه لإضافة صف دراسي جديد.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classes.map((cls) => {
              const classSections = sections.filter((s) => s.classId === cls.id);
              const classStudents = students.filter((s) => s.classId === cls.id);
              const classSubjects = subjects.filter((s) => s.classId === cls.id);

              return (
                <div
                  key={cls.id}
                  className="bg-slate-950 border border-slate-800 p-4.5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
                >
                  <div>
                    {/* Class Card Header & Edit/Delete Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-base text-white tracking-wide">
                            {cls.name}
                          </h4>
                          <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-800 text-teal-300 border border-slate-700">
                            {cls.stage}
                          </span>
                        </div>

                        {/* Quick Stats Pill */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 font-medium">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-indigo-400" />
                            <span>{classStudents.length} طالب</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-purple-400" />
                            <span>{classSubjects.length} مادة</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <FolderPlus className="w-3 h-3 text-amber-400" />
                            <span>{classSections.length} شعبة</span>
                          </span>
                        </div>
                      </div>

                      {/* Class Action Buttons: Edit & Delete */}
                      <div className="flex items-center gap-1 shrink-0 bg-slate-900 border border-slate-800 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => openEditClassModal(cls)}
                          className="p-1.5 rounded hover:bg-teal-500/10 text-slate-400 hover:text-teal-300 transition-colors cursor-pointer"
                          title={`تعديل بيانات الصف الدراسي (${cls.name})`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteClassModal(cls)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          title={`حذف الصف الدراسي (${cls.name})`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Class Sections List */}
                    <div className="pt-3 border-t border-slate-850">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-slate-300">الشعب التابعة للصف:</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {classSections.length} شعبة
                        </span>
                      </div>

                      {classSections.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {classSections.map((sec) => {
                            const secStudents = students.filter((s) => s.sectionId === sec.id);

                            return (
                              <div
                                key={sec.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-100">
                                    شعبة {sec.name}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                    {secStudents.length} طالب
                                  </span>
                                </div>

                                {/* Section Actions: Edit & Delete */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditSectionModal(sec)}
                                    className="p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors cursor-pointer"
                                    title={`تعديل شعبة (${sec.name})`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteSectionModal(sec)}
                                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                    title={`حذف شعبة (${sec.name})`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-center rounded-lg bg-slate-900/60 border border-dashed border-slate-800 text-xs text-slate-400">
                          لا توجد شعب مسجلة لهذا الصف بعد.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: Edit School Class (تعديل بيانات الصف الدراسي)
          ========================================================================= */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تعديل الصف الدراسي</h3>
                  <p className="text-xs text-slate-400">تحديث اسم الصف والمرحلة دون التأثير على الشعب والطلاب</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editClassError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{editClassError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditClass} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الصف الدراسي</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => {
                    setEditClassName(e.target.value);
                    if (editClassError) setEditClassError(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-teal-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المرحلة الدراسية</label>
                <select
                  value={editClassStage}
                  onChange={(e) => setEditClassStage(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-teal-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="إعدادي">إعدادي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="ابتدائي">ابتدائي</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  يتم الاحتفاظ بالمعرف الأساسي للصف وتبقى جميع الشعب والطلاب والمواد والدرجات مرتبطة به بأمان تام.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-teal-600/20"
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
          MODAL 2: Delete School Class (حذف الصف الدراسي مع التحقق الآمن)
          ========================================================================= */}
      {deletingClass && deletingClassDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg ${
                    deletingClassDetails.isBlocked
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {deletingClassDetails.isBlocked ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {deletingClassDetails.isBlocked
                      ? 'تعذر حذف الصف الدراسي'
                      : 'تأكيد حذف الصف الدراسي'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    الصف: <strong className="text-slate-200">{deletingClass.name}</strong> ({deletingClass.stage})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {deletingClassDetails.isBlocked ? (
              /* Blocked Deletion Notice */
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-200 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>لا يمكن حذف هذا الصف لوجود بيانات وسجلات مرتبطة به:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pr-2 text-slate-300">
                    {deletingClassDetails.sectionsCount > 0 && (
                      <li>
                        عدد الشعب المسجلة: <strong className="text-amber-300 font-mono">{deletingClassDetails.sectionsCount}</strong> شعبة
                      </li>
                    )}
                    {deletingClassDetails.studentsCount > 0 && (
                      <li>
                        عدد الطلاب المقيدين: <strong className="text-amber-300 font-mono">{deletingClassDetails.studentsCount}</strong> طالب
                      </li>
                    )}
                    {deletingClassDetails.subjectsCount > 0 && (
                      <li>
                        عدد المواد الدراسية: <strong className="text-amber-300 font-mono">{deletingClassDetails.subjectsCount}</strong> مادة
                      </li>
                    )}
                    {deletingClassDetails.gradesCount > 0 && (
                      <li>
                        سجلات درجات مسجلة: <strong className="text-amber-300 font-mono">{deletingClassDetails.gradesCount}</strong> سجل درجات
                      </li>
                    )}
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    لحماية بيانات وسجلات المدرسة، لا يسمح النظام بالحذف المباشر للصفوف التي تحتوي على شعب أو طلاب أو درجات. يرجى نقل الطلاب أو تفريغ الصف من الشعب والمواد أولاً قبل حذفه.
                  </span>
                </div>
              </div>
            ) : (
              /* Safe Deletion Confirmation */
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-200 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف الصف الدراسي «<strong className="text-white">{deletingClass.name}</strong>» نهائياً من النظام؟
                </p>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  هذا الصف فارغ ولا يحتوي على أي شعب أو طلاب أو مواد مرتبطة به. هذا الإجراء لا يمكن التراجع عنه بعد تنفيذه.
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {deletingClassDetails.isBlocked ? 'إغلاق' : 'إلغاء'}
              </button>

              {!deletingClassDetails.isBlocked && (
                <button
                  type="button"
                  onClick={handleDeleteClassConfirm}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-red-600/20"
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
          MODAL 3: Edit Section (تعديل اسم أو رمز الشعبة)
          ========================================================================= */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تعديل الشعبة</h3>
                  <p className="text-xs text-slate-400">
                    تعديل اسم أو رمز الشعبة لصف{' '}
                    <strong className="text-slate-200">
                      {classes.find((c) => c.id === editingSection.classId)?.name || ''}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSectionError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{editSectionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSection} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم أو رمز الشعبة</label>
                <input
                  type="text"
                  value={editSectionName}
                  onChange={(e) => {
                    setEditSectionName(e.target.value);
                    if (editSectionError) setEditSectionError(null);
                  }}
                  placeholder="مثال: أ أو ب أو ج"
                  className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-amber-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  يتم تحديث اسم الشعبة مباشرة مع الحفاظ على معرّفها وربطها بالصف نفسه، ويبقى جميع الطلاب المسجلين ودرجاتهم كما هي دون أي تغيير.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-600/20"
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
          MODAL 4: Delete Section (حذف الشعبة مع التحقق الآمن)
          ========================================================================= */}
      {deletingSection && deletingSectionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg ${
                    deletingSectionDetails.isBlocked
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {deletingSectionDetails.isBlocked ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {deletingSectionDetails.isBlocked
                      ? 'تعذر حذف الشعبة الدراسية'
                      : 'تأكيد حذف الشعبة'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    شعبة: <strong className="text-slate-200">{deletingSection.name}</strong> - صف:{' '}
                    <strong className="text-slate-200">
                      {deletingSectionDetails.parentClass?.name || ''}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingSection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {deletingSectionDetails.isBlocked ? (
              /* Blocked Deletion Notice */
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-200 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>لا يمكن حذف هذه الشعبة لوجود طلاب وسجلات مسجلة بها:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pr-2 text-slate-300">
                    <li>
                      عدد الطلاب المسجلين حالياً:{' '}
                      <strong className="text-amber-300 font-mono">
                        {deletingSectionDetails.studentsCount}
                      </strong>{' '}
                      طالب
                    </li>
                    {deletingSectionDetails.gradesCount > 0 && (
                      <li>
                        سجلات الدرجات المسجلة في الشعبة:{' '}
                        <strong className="text-amber-300 font-mono">
                          {deletingSectionDetails.gradesCount}
                        </strong>{' '}
                        سجل
                      </li>
                    )}
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    لحماية بيانات الطلاب وسجلات درجاتهم، يرجى الانتقال إلى صفحة «إدارة الطلاب» ونقل الطلاب إلى شعبة أخرى عبر زر «نقل»، أو إزالة قيدهم أولاً قبل حذف هذه الشعبة.
                  </span>
                </div>
              </div>
            ) : (
              /* Safe Deletion Confirmation */
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-200 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف الشعبة «
                  <strong className="text-white">{deletingSection.name}</strong>» من صف «
                  <strong className="text-white">
                    {deletingSectionDetails.parentClass?.name || ''}
                  </strong>
                  » نهائياً؟
                </p>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  هذه الشعبة لا تحتوي على أي طلاب أو درجات مسجلة، ويمكن حذفها بأمان تام.
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSection(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {deletingSectionDetails.isBlocked ? 'إغلاق' : 'إلغاء'}
              </button>

              {!deletingSectionDetails.isBlocked && (
                <button
                  type="button"
                  onClick={handleDeleteSectionConfirm}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-red-600/20"
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
