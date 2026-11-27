import React, { useState, useMemo, useEffect, useRef } from 'react';
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

  const subjectNameInputRef = useRef<HTMLInputElement>(null);
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
    requestAnimationFrame(() => {
      subjectNameInputRef.current?.focus();
    });
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
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>ترتيب موحّد ومركزي</span>
            </span>
            <span className="text-[#64748B] dark:text-[#8493A8] text-xs">
              ينعكس الترتيب مباشرة في كشوف الدرجات والتقارير
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>إدارة وترتيب المواد الدراسية</span>
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">
            اسحب البطاقات وأفلتها لإعادة الترتيب باليد، أو استخدم الأسهم للتحريك السريع. الحفظ تلقائي ولحظي.
          </p>
        </div>

        {/* Real-time Save Toast */}
        {saveSuccessNotification && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-xs font-bold shadow-xs animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{saveSuccessNotification}</span>
          </div>
        )}
      </div>

      {/* Helpful Hint Bar */}
      <div className="bg-[#3156C9]/8 dark:bg-[#2785F5]/10 border border-[#3156C9]/25 dark:border-[#2785F5]/25 rounded-[12px] p-3.5 flex items-center gap-3 text-xs text-[#475569] dark:text-[#A8B5C7]">
        <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA] shrink-0" />
        <div>
          <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0] ml-1">تنبيه هام:</span>
          ترتيب المواد في هذه الصفحة موحّد ومركزي؛ أي تعديل هنا يغيّر تسلسل المواد فوراً في شاشة إدخال الدرجات، وقوائم النتائج، والشيتات المدرسية المطبوعة دون الحاجة لأي حفظ إضافي.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Add New Subject */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs h-fit">
          <h3 className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>إضافة مادة دراسية جديدة</span>
          </h3>

          <form onSubmit={handleAddSubject} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">الصف التابع له</label>
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.stage})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">اسم المادة</label>
              <input
                ref={subjectNameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: الرياضيات، الأحياء، التاريخ"
                className="w-full h-10 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:border-[#2785F5] focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">النهاية العظمى</label>
                <input
                  type="number"
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(Number(e.target.value))}
                  min={1}
                  className="w-full h-10 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">درجة النجاح</label>
                <input
                  type="number"
                  value={newPassScore}
                  onChange={(e) => setNewPassScore(Number(e.target.value))}
                  min={1}
                  className="w-full h-10 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-10 mt-1 rounded-[8px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة المادة واعتماد ترتيبها</span>
            </button>
          </form>
        </div>

        {/* Existing Subjects with Drag-and-Drop Reordering */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-5 shadow-xs flex flex-col gap-4">
          {/* Header & Class Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                <h3 className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                  المواد المقررة لـ {activeClass?.name || 'الصف المختار'}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] font-mono tabular-nums font-bold">
                  {classSubjects.length} مواد
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-0.5">
                اسحب المقبض <span className="font-mono text-[#3156C9] dark:text-[#60A5FA]">⠿</span> لإعادة ترتيب المادة، أو استخدم أسهم الصعود والنزول
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {academicYears && academicYears.length > 1 && (
                <div className="relative min-w-[150px]">
                  <select
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(الحالي)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              )}

              <div className="relative min-w-[180px]">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
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
                <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Subjects List (Drag and Drop Container) */}
          {classSubjects.length === 0 ? (
            <div className="py-12 text-center text-[#64748B] dark:text-[#8493A8] border border-dashed border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[12px] bg-[#F8FAFC] dark:bg-[#202E40]">
              <BookOpen className="w-10 h-10 mx-auto text-[#64748B]/60 dark:text-[#8493A8]/60 mb-2" />
              <p className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">لا توجد مواد مضافة لهذا الصف بعد</p>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">
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
                      <div className="h-1 bg-[#2785F5] rounded-full mb-1.5 shadow-xs flex items-center justify-center">
                        <span className="text-[10px] bg-[#3156C9] text-white font-bold px-2.5 py-0.5 rounded-full absolute">
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
                      className={`group border p-3.5 rounded-[12px] flex items-center justify-between gap-3 transition-all duration-200 select-none ${
                        isBeingDragged
                          ? 'opacity-40 scale-[0.99] border-dashed border-[#2785F5] bg-[#3156C9]/8 dark:bg-[#2785F5]/12'
                          : isOverThis
                          ? 'border-[#2785F5] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 shadow-xs'
                          : 'bg-[#F8FAFC] dark:bg-[#202E40] border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5]/40 hover:bg-[#EDF1F7]/80 dark:hover:bg-[#26364B]'
                      }`}
                    >
                      {/* Drag Handle & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="p-1 rounded-[6px] text-[#64748B] dark:text-[#8493A8] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] cursor-grab active:cursor-grabbing transition-colors"
                          title="اسحب لإعادة الترتيب"
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>

                        <span className="w-7 h-7 shrink-0 rounded-[8px] bg-white dark:bg-[#26364B] group-hover:bg-[#3156C9]/10 dark:group-hover:bg-[#2785F5]/20 text-[#475569] dark:text-[#A8B5C7] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] font-mono tabular-nums font-bold text-xs flex items-center justify-center border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors">
                          {idx + 1}
                        </span>

                        <div className="truncate">
                          <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] transition-colors truncate">
                            {sub.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748B] dark:text-[#8493A8]">
                            <span className="font-mono tabular-nums">
                              العظمى: <strong className="text-[#1E293B] dark:text-[#E2E8F0]">{sub.maxScore}</strong>
                            </span>
                            <span>•</span>
                            <span className="font-mono tabular-nums">
                              النجاح: <strong className="text-[#059669] dark:text-[#10B981]">{sub.passScore}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Move Up, Move Down, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMove(sub.id, 'up')}
                          disabled={idx === 0}
                          title="تحريك لأعلى"
                          className="p-1.5 rounded-[8px] text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-white dark:hover:bg-[#26364B] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMove(sub.id, 'down')}
                          disabled={idx === classSubjects.length - 1}
                          title="تحريك لأسفل"
                          className="p-1.5 rounded-[8px] text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-white dark:hover:bg-[#26364B] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <div className="w-[1px] h-4 bg-[#DCE3ED] dark:bg-[#2D3B4D] mx-1" />

                        <button
                          type="button"
                          onClick={() => startEditing(sub)}
                          title="تعديل المادة"
                          className="p-1.5 rounded-[8px] text-[#64748B] dark:text-[#8493A8] hover:text-[#3156C9] dark:hover:text-[#60A5FA] hover:bg-[#3156C9]/10 dark:hover:bg-[#2785F5]/15 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingSubject(sub)}
                          title="حذف المادة"
                          className="p-1.5 rounded-[8px] text-[#64748B] dark:text-[#8493A8] hover:text-[#C83D4B] dark:hover:text-[#E35D6A] hover:bg-[#E35D6A]/10 dark:hover:bg-[#E35D6A]/15 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Drop Indicator: After */}
                    {isOverThis && dropPosition === 'after' && (
                      <div className="h-1 bg-[#2785F5] rounded-full mt-1.5 shadow-xs flex items-center justify-center">
                        <span className="text-[10px] bg-[#3156C9] text-white font-bold px-2.5 py-0.5 rounded-full absolute">
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
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] p-6 max-w-md w-full shadow-2xl animate-scale-up text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
                <span>تعديل بيانات المادة الدراسية</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] p-1.5 rounded-[8px] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">اسم المادة</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">النهاية العظمى</label>
                  <input
                    type="number"
                    value={editMaxScore}
                    onChange={(e) => setEditMaxScore(Number(e.target.value))}
                    min={1}
                    className="w-full h-10 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums focus:border-[#2785F5] focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">درجة النجاح</label>
                  <input
                    type="number"
                    value={editPassScore}
                    onChange={(e) => setEditPassScore(Number(e.target.value))}
                    min={1}
                    className="w-full h-10 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums focus:border-[#2785F5] focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white cursor-pointer shadow-xs transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] p-6 max-w-md w-full shadow-2xl animate-scale-up text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0]">تأكيد حذف المادة</h3>
                <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-0.5">
                  هل أنت متأكد من حذف مادة «{deletingSubject.name}»؟
                </p>
              </div>
            </div>

            <p className="text-xs text-[#C83D4B] dark:text-[#E35D6A] bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 p-3 rounded-[10px] leading-relaxed mb-4">
              سيتم حذف هذه المادة وإعادة ضبط تسلسل بقية المواد تلقائياً. تأكد من أنك لا تحتاج إلى الدرجات المرصودة مسبقاً لهذه المادة.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingSubject(null)}
                className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] cursor-pointer transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#C83D4B] hover:bg-[#B02E3C] text-white cursor-pointer shadow-xs transition-colors"
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
