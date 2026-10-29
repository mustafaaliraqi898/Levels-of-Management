import React, { useState, useMemo, useEffect } from 'react';
import { Subject, SchoolClass, AcademicYear } from '../../types';
import { db } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import {
  BookOpen,
  Plus,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Check,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowUpDown,
  Sparkles,
  Info,
  X,
} from 'lucide-react';

interface SubjectsManagementProps {
  subjects: Subject[];
  classes: SchoolClass[];
  academicYears?: AcademicYear[];
}

export const SubjectsManagement: React.FC<SubjectsManagementProps> = ({
  subjects,
  classes,
  academicYears,
}) => {
  const currentYear = academicYears?.find((y) => y.isCurrent) || academicYears?.[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId || currentYear?.id, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  const [newName, setNewName] = useState('');
  const [newMaxScore, setNewMaxScore] = useState(100);
  const [newPassScore, setNewPassScore] = useState(50);

  // Drag and Drop States
  const [draggedSubjectId, setDraggedSubjectId] = useState<string | null>(null);
  const [dragOverSubjectId, setDragOverSubjectId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<string | null>(null);

  // Edit Modal State
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaxScore, setEditMaxScore] = useState(100);
  const [editPassScore, setEditPassScore] = useState(50);

  // Delete Confirmation Modal State
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // Auto-dismiss notification after 3 seconds
  useEffect(() => {
    if (saveSuccessNotification) {
      const timer = setTimeout(() => {
        setSaveSuccessNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessNotification]);

  // Current subjects for the selected class, strictly sorted by order
  const classSubjects = useMemo(() => {
    return subjects
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [subjects, selectedClassId]);

  const activeClass = classes.find((c) => c.id === selectedClassId);

  // Add new subject
  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !selectedClassId) return;

    db.addSubject({
      classId: selectedClassId,
      name: newName.trim(),
      maxScore: newMaxScore,
      passScore: newPassScore,
      order: classSubjects.length + 1,
    });

    setNewName('');
    setSaveSuccessNotification(`تمت إضافة مادة «${newName.trim()}» وحفظ ترتيبها تلقائياً.`);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, subjectId: string) => {
    setDraggedSubjectId(subjectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', subjectId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetSubjectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedSubjectId || draggedSubjectId === targetSubjectId) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = e.clientY;
    const midpoint = rect.top + rect.height / 2;

    const newPos: 'before' | 'after' = clientY < midpoint ? 'before' : 'after';

    if (dragOverSubjectId !== targetSubjectId || dropPosition !== newPos) {
      setDragOverSubjectId(targetSubjectId);
      setDropPosition(newPos);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the card itself (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSubjectId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetSubjectId: string) => {
    e.preventDefault();

    if (!draggedSubjectId || draggedSubjectId === targetSubjectId) {
      setDraggedSubjectId(null);
      setDragOverSubjectId(null);
      setDropPosition(null);
      return;
    }

    const currentIds = classSubjects.map((s) => s.id);
    const fromIndex = currentIds.indexOf(draggedSubjectId);
    const toTargetIndex = currentIds.indexOf(targetSubjectId);

    if (fromIndex === -1 || toTargetIndex === -1) {
      setDraggedSubjectId(null);
      setDragOverSubjectId(null);
      setDropPosition(null);
      return;
    }

    const newIds = [...currentIds];
    const [movedId] = newIds.splice(fromIndex, 1);

    // Calculate insertion index based on before / after
    let insertIndex = newIds.indexOf(targetSubjectId);
    if (dropPosition === 'after') {
      insertIndex += 1;
    }

    newIds.splice(insertIndex, 0, movedId);

    // Save immediately and centrally
    db.reorderSubjects(selectedClassId, newIds);

    const movedSubject = classSubjects.find((s) => s.id === movedId);
    setSaveSuccessNotification(`تم تغيير ترتيب «${movedSubject?.name || 'المادة'}» وحفظه في النظام تلقائياً.`);

    setDraggedSubjectId(null);
    setDragOverSubjectId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedSubjectId(null);
    setDragOverSubjectId(null);
    setDropPosition(null);
  };

  // Quick Move Up / Down Buttons (Ideal for mobile touch & keyboard accessibility)
  const handleMove = (subjectId: string, direction: 'up' | 'down') => {
    const currentIds = classSubjects.map((s) => s.id);
    const index = currentIds.indexOf(subjectId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const newIds = [...currentIds];
      const temp = newIds[index - 1];
      newIds[index - 1] = newIds[index];
      newIds[index] = temp;
      db.reorderSubjects(selectedClassId, newIds);
      const sub = classSubjects.find((s) => s.id === subjectId);
      setSaveSuccessNotification(`تم تقديم مادة «${sub?.name}» وحفظ الترتيب تلقائياً.`);
    } else if (direction === 'down' && index < currentIds.length - 1) {
      const newIds = [...currentIds];
      const temp = newIds[index + 1];
      newIds[index + 1] = newIds[index];
      newIds[index] = temp;
      db.reorderSubjects(selectedClassId, newIds);
      const sub = classSubjects.find((s) => s.id === subjectId);
      setSaveSuccessNotification(`تم تأخير مادة «${sub?.name}» وحفظ الترتيب تلقائياً.`);
    }
  };

  // Open Edit Modal
  const startEditing = (sub: Subject) => {
    setEditingSubject(sub);
    setEditName(sub.name);
    setEditMaxScore(sub.maxScore);
    setEditPassScore(sub.passScore);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editName.trim()) return;

    db.updateSubject({
      ...editingSubject,
      name: editName.trim(),
      maxScore: editMaxScore,
      passScore: editPassScore,
    });

    setSaveSuccessNotification(`تم تحديث بيانات مادة «${editName.trim()}» بنجاح.`);
    setEditingSubject(null);
  };

  // Delete Subject
  const confirmDelete = () => {
    if (!deletingSubject) return;
    const name = deletingSubject.name;
    db.deleteSubject(deletingSubject.id);
    setSaveSuccessNotification(`تم حذف مادة «${name}» وتحديث تسلسل المواد تلقائياً.`);
    setDeletingSubject(null);
  };

  return (
    <div className="flex flex-col gap-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>ترتيب موحّد ومركزي</span>
            </span>
            <span className="text-slate-400 text-xs">
              ينعكس الترتيب مباشرة في كشوف الدرجات والتقارير
            </span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-purple-400" />
            <span>إدارة وترتيب المواد الدراسية</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            اسحب البطاقات وأفلتها لإعادة الترتيب باليد، أو استخدم الأسهم للتحريك السريع. الحفظ تلقائي ولحظي.
          </p>
        </div>

        {/* Real-time Save Toast */}
        {saveSuccessNotification && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-lg shadow-emerald-500/10 animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{saveSuccessNotification}</span>
          </div>
        )}
      </div>

      {/* Helpful Hint Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-purple-400 shrink-0" />
        <div>
          <span className="font-bold text-white ml-1">تنبيه هام:</span>
          ترتيب المواد في هذه الصفحة موحّد ومركزي؛ أي تعديل هنا يغيّر تسلسل المواد فوراً في شاشة إدخال الدرجات، وقوائم النتائج، والشيتات المدرسية المطبوعة دون الحاجة لأي حفظ إضافي.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Add New Subject */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg h-fit">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>إضافة مادة دراسية جديدة</span>
          </h3>

          <form onSubmit={handleAddSubject} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">الصف التابع له</label>
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold focus:border-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.stage})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم المادة</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: الرياضيات، الأحياء، التاريخ"
                className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">النهاية العظمى</label>
                <input
                  type="number"
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(Number(e.target.value))}
                  min={1}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">درجة النجاح</label>
                <input
                  type="number"
                  value={newPassScore}
                  onChange={(e) => setNewPassScore(Number(e.target.value))}
                  min={1}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة المادة واعتماد ترتيبها</span>
            </button>
          </form>
        </div>

        {/* Existing Subjects with Drag-and-Drop Reordering */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
          {/* Header & Class Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  المواد المقررة لـ {activeClass?.name || 'الصف المختار'}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 font-mono font-bold">
                  {classSubjects.length} مواد
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                اسحب المقبض <span className="font-mono text-purple-400">⠿</span> لإعادة ترتيب المادة، أو استخدم أسهم الصعود والنزول
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {academicYears && academicYears.length > 1 && (
                <div className="relative min-w-[150px]">
                  <select
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(الحالي)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              )}

              <div className="relative min-w-[180px]">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
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
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Subjects List (Drag and Drop Container) */}
          {classSubjects.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold">لا توجد مواد مضافة لهذا الصف بعد</p>
              <p className="text-xs text-slate-500 mt-1">
                استخدم النموذج الجانبي لإضافة مواد دراسية لهذا الصف.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {classSubjects.map((sub, idx) => {
                const isBeingDragged = draggedSubjectId === sub.id;
                const isOverThis = dragOverSubjectId === sub.id;

                return (
                  <div key={sub.id} className="relative transition-all duration-200">
                    {/* Visual Drop Indicator: Before */}
                    {isOverThis && dropPosition === 'before' && (
                      <div className="h-1 bg-gradient-to-r from-purple-500 via-emerald-400 to-purple-500 rounded-full mb-1.5 shadow-sm shadow-emerald-400/50 animate-pulse flex items-center justify-center">
                        <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.2 rounded-full absolute">
                          إفلات هنا (الترتيب: {idx + 1})
                        </span>
                      </div>
                    )}

                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, sub.id)}
                      onDragOver={(e) => handleDragOver(e, sub.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, sub.id)}
                      onDragEnd={handleDragEnd}
                      className={`group bg-slate-950 border p-3.5 rounded-xl flex items-center justify-between gap-3 transition-all duration-200 select-none ${
                        isBeingDragged
                          ? 'opacity-40 scale-[0.99] border-dashed border-emerald-500 bg-emerald-500/5'
                          : isOverThis
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/20'
                          : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Drag Handle & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Drag Handle */}
                        <div
                          className="p-1 rounded-md text-slate-500 group-hover:text-purple-400 hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
                          title="اسحب لإعادة الترتيب"
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>

                        {/* Consecutive Order Number Badge */}
                        <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-800 group-hover:bg-purple-600/20 text-slate-300 group-hover:text-purple-300 font-mono font-bold text-xs flex items-center justify-center border border-slate-700/60 transition-colors">
                          {idx + 1}
                        </span>

                        {/* Subject Details */}
                        <div className="truncate">
                          <h4 className="font-bold text-sm text-white group-hover:text-purple-200 transition-colors truncate">
                            {sub.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span className="font-mono">
                              العظمى: <strong className="text-slate-200">{sub.maxScore}</strong>
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              النجاح: <strong className="text-emerald-400">{sub.passScore}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Move Up, Move Down, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Move Up Button */}
                        <button
                          type="button"
                          onClick={() => handleMove(sub.id, 'up')}
                          disabled={idx === 0}
                          title="تحريك لأعلى"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        {/* Move Down Button */}
                        <button
                          type="button"
                          onClick={() => handleMove(sub.id, 'down')}
                          disabled={idx === classSubjects.length - 1}
                          title="تحريك لأسفل"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <div className="w-[1px] h-4 bg-slate-800 mx-1" />

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => startEditing(sub)}
                          title="تعديل المادة"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeletingSubject(sub)}
                          title="حذف المادة"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Drop Indicator: After */}
                    {isOverThis && dropPosition === 'after' && (
                      <div className="h-1 bg-gradient-to-r from-purple-500 via-emerald-400 to-purple-500 rounded-full mt-1.5 shadow-sm shadow-emerald-400/50 animate-pulse flex items-center justify-center">
                        <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.2 rounded-full absolute">
                          إفلات هنا (الترتيب: {idx + 2})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                <span>تعديل بيانات المادة الدراسية</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المادة</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">النهاية العظمى</label>
                  <input
                    type="number"
                    value={editMaxScore}
                    onChange={(e) => setEditMaxScore(Number(e.target.value))}
                    min={1}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-blue-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">درجة النجاح</label>
                  <input
                    type="number"
                    value={editPassScore}
                    onChange={(e) => setEditPassScore(Number(e.target.value))}
                    min={1}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-blue-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md shadow-blue-600/20 transition-colors"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
      {deletingSubject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">تأكيد حذف المادة</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  هل أنت متأكد من حذف مادة «{deletingSubject.name}»؟
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-red-500/10 border border-red-500/20 p-3 rounded-lg leading-relaxed mb-4">
              سيتم حذف هذه المادة وإعادة ضبط تسلسل بقية المواد تلقائياً. تأكد من أنك لا تحتاج إلى الدرجات المرصودة مسبقاً لهذه المادة.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingSubject(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-md shadow-red-600/20 transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
