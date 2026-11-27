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
  GraduationCap,
  Layers,
  ListChecks,
  Search,
  ArrowLeft,
  X,
} from 'lucide-react';

interface SubjectsManagementProps {
  subjects: Subject[];
  classes: SchoolClass[];
  academicYears?: AcademicYear[];
}

const DEFAULT_SUBJECT_CATALOG = [
  'التربية الإسلامية', 'اللغة العربية', 'اللغة الإنكليزية', 'الرياضيات',
  'الأحياء', 'الكيمياء', 'الفيزياء', 'الحاسوب', 'التاريخ', 'الجغرافية',
  'الاقتصاد', 'التربية الرياضية', 'الفنية', 'الوطنية', 'اللغة الفرنسية',
];

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

  // Multi-subject setup workflow and reusable custom subject catalog
  const [isAddPageOpen, setIsAddPageOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [catalogSubjects, setCatalogSubjects] = useState<string[]>(DEFAULT_SUBJECT_CATALOG);
  const [selectedNewSubjects, setSelectedNewSubjects] = useState<string[]>([]);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [bulkGrades, setBulkGrades] = useState<Record<string, { maxScore: number; passScore: number }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('school_subject_catalog_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCatalogSubjects(Array.from(new Set([...DEFAULT_SUBJECT_CATALOG, ...parsed.filter((x) => typeof x === 'string' && x.trim())])));
        }
      }
    } catch { /* keep built-in catalog */ }
  }, []);

  const openAddSubjectsPage = () => {
    setSelectedNewSubjects([]);
    setCustomSubjectName('');
    setSubjectSearch('');
    setBulkGrades({});
    setAddStep(1);
    setIsAddPageOpen(true);
  };

  const toggleCatalogSubject = (name: string) => {
    setSelectedNewSubjects((current) => current.includes(name) ? current.filter((x) => x !== name) : [...current, name]);
  };

  const addCustomCatalogSubject = () => {
    const name = customSubjectName.trim();
    if (!name) return;
    const exists = catalogSubjects.some((x) => x.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    if (exists) {
      setSaveSuccessNotification('هذه المادة موجودة مسبقاً في قائمة المواد الجاهزة.');
      return;
    }
    const next = [...catalogSubjects, name];
    setCatalogSubjects(next);
    try { localStorage.setItem('school_subject_catalog_v1', JSON.stringify(next)); } catch { /* ignore storage limits */ }
    setSelectedNewSubjects((current) => current.includes(name) ? current : [...current, name]);
    setCustomSubjectName('');
  };

  const availableCatalogSubjects = catalogSubjects.filter((name) =>
    name.toLocaleLowerCase().includes(subjectSearch.trim().toLocaleLowerCase()) &&
    !subjects.some((subject) => subject.classId === selectedClassId && subject.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
  );

  const proceedToGradeSetup = () => {
    if (!selectedClassId || selectedNewSubjects.length === 0) return;
    const initial: Record<string, { maxScore: number; passScore: number }> = {};
    selectedNewSubjects.forEach((name) => {
      initial[name] = bulkGrades[name] || { maxScore: 100, passScore: 50 };
    });
    setBulkGrades(initial);
    setAddStep(2);
  };

  const confirmBulkAddSubjects = () => {
    if (!selectedClassId || selectedNewSubjects.length === 0) return;
    const invalid = selectedNewSubjects.find((name) => {
      const grade = bulkGrades[name] || { maxScore: 100, passScore: 50 };
      return !Number.isFinite(grade.maxScore) || !Number.isFinite(grade.passScore) ||
        grade.maxScore < 1 || grade.passScore < 1 || grade.passScore > grade.maxScore;
    });
    if (invalid) {
      setSaveSuccessNotification(`تحقق من درجات مادة «${invalid}»: درجة النجاح يجب ألا تتجاوز النهاية العظمى.`);
      return;
    }
    const existingNames = new Set(subjects.filter((s) => s.classId === selectedClassId).map((s) => s.name.trim().toLocaleLowerCase()));
    const toAdd = selectedNewSubjects.filter((name) => !existingNames.has(name.trim().toLocaleLowerCase()));
    toAdd.forEach((name, index) => {
      const grade = bulkGrades[name] || { maxScore: 100, passScore: 50 };
      db.addSubject({
        classId: selectedClassId,
        name,
        maxScore: grade.maxScore,
        passScore: grade.passScore,
        order: classSubjects.length + index + 1,
      });
    });
    setSaveSuccessNotification(toAdd.length
      ? `تمت إضافة ${toAdd.length} مادة وحفظ ترتيبها بنجاح.`
      : 'المواد المحددة موجودة مسبقاً لهذا الصف.');
    setIsAddPageOpen(false);
    setSelectedNewSubjects([]);
    setAddStep(1);
  };

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
    <div className="flex flex-col gap-5 pb-10" dir="rtl">
      {saveSuccessNotification && (
        <div role="status" className="fixed top-5 left-5 z-[70] flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#1C2939] px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 shadow-lg">
          <Check className="w-4 h-4 shrink-0" />{saveSuccessNotification}
          <button type="button" onClick={() => setSaveSuccessNotification(null)} className="mr-2 text-slate-400 hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed"><X className="w-4 h-4" /></button>
        </div>
      )}

      {!isAddPageOpen ? (
        <>
          <section className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#3156C9]/20 bg-[#3156C9]/8 dark:bg-[#2785F5]/12 px-3 py-1 text-[11px] font-bold text-[#3156C9] dark:text-[#60A5FA] mb-2">
                  <BookOpen className="w-3.5 h-3.5" /> إدارة المناهج والمواد
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" /> إدارة المواد الدراسية
                </h1>
                <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">إدارة المواد المقررة لكل صف وتحديد درجاتها وترتيبها.</p>
              </div>
              <button type="button" onClick={openAddSubjectsPage} className="h-11 px-5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
                <Plus className="w-4 h-4" /> إضافة مواد دراسية
              </button>
            </div>
          </section>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'إجمالي المواد', value: subjects.length, icon: BookOpen, tone: 'blue' },
              { label: 'الصفوف الدراسية', value: availableClasses.length, icon: GraduationCap, tone: 'violet' },
              { label: 'صفوف لديها مواد', value: availableClasses.filter((cl) => subjects.some((s) => s.classId === cl.id)).length, icon: Layers, tone: 'green' },
              { label: 'مواد الصف المحدد', value: classSubjects.length, icon: ListChecks, tone: 'amber' },
            ].map((item) => {
              const tones: Record<string, string> = {
                blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900',
                violet: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900',
                green: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900',
                amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900',
              };
              const Icon = item.icon;
              return (
                <div key={item.label} className={`rounded-2xl border p-4 ${tones[item.tone]}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold opacity-85">{item.label}</span>
                    <Icon className="w-5 h-5 opacity-80" />
                  </div>
                  <div className="text-2xl font-black font-mono tabular-nums mt-2">{item.value}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-4 items-start">
            <aside className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-sm text-[#1E293B] dark:text-[#E2E8F0]">الصفوف الدراسية</h2>
                <Layers className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
              </div>
              <div className="flex flex-col gap-1.5">
                {availableClasses.map((cl) => {
                  const count = subjects.filter((s) => s.classId === cl.id).length;
                  const active = selectedClassId === cl.id;
                  return (
                    <button key={cl.id} type="button" onClick={() => setSelectedClassId(cl.id)}
                      className={`w-full rounded-xl px-3 py-3 text-right flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed ${active ? 'bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/20 dark:border-[#2785F5]/25' : 'text-[#475569] dark:text-[#A8B5C7] hover:bg-[#F4F7FC] dark:hover:bg-[#26364B] border border-transparent'}`}>
                      <span className="text-xs font-bold">{cl.name}</span>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 font-bold ${active ? 'bg-white/80 dark:bg-[#1C2939]' : 'bg-[#EDF1F7] dark:bg-[#26364B]'}`}>{count}</span>
                    </button>
                  );
                })}
                {availableClasses.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">لا توجد صفوف لهذا العام الدراسي.</p>}
              </div>
            </aside>

            <section className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-4 sm:p-5 shadow-sm min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
                <div>
                  <h2 className="text-base font-black text-[#1E293B] dark:text-[#E2E8F0]">مواد الصف: {activeClass?.name || '—'}</h2>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">{classSubjects.length} مادة دراسية</p>
                </div>
                <div className="flex items-center gap-2">
                  {academicYears && academicYears.length > 1 && (
                    <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} className="h-9 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] px-3 text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                      {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(الحالي)' : ''}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={openAddSubjectsPage} className="h-9 px-3 rounded-lg bg-[#EEF3FF] dark:bg-[#263B63] text-[#3156C9] dark:text-[#8DB5FF] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#E2EAFF] dark:hover:bg-[#304A78] cursor-pointer disabled:cursor-not-allowed">
                    <Plus className="w-3.5 h-3.5" /> إضافة مواد
                  </button>
                </div>
              </div>

              {classSubjects.length === 0 ? (
                <div className="py-14 text-center">
                  <BookOpen className="w-10 h-10 mx-auto text-[#94A3B8] mb-3" />
                  <h3 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0]">لا توجد مواد لهذا الصف</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1 mb-4">ابدأ بإضافة المواد المقررة للصف.</p>
                  <button type="button" onClick={openAddSubjectsPage} className="h-9 px-4 rounded-lg bg-[#3156C9] text-white text-xs font-bold cursor-pointer disabled:cursor-not-allowed"><Plus className="inline w-4 h-4 ml-1" /> إضافة مواد دراسية</button>
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full min-w-[680px] text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7]">
                        <th className="p-3 w-12 text-center rounded-tr-lg">ت</th>
                        <th className="p-3">اسم المادة</th>
                        <th className="p-3 w-32 text-center">النهاية العظمى</th>
                        <th className="p-3 w-32 text-center">درجة النجاح</th>
                        <th className="p-3 w-40 text-center rounded-tl-lg">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                      {classSubjects.map((sub, idx) => {
                        const isBeingDragged = draggedSubjectId === sub.id;
                        const isOverThis = dragOverSubjectId === sub.id;
                        return (
                          <tr key={sub.id} draggable onDragStart={(e) => handleDragStart(e as any, sub.id)} onDragOver={(e) => handleDragOver(e as any, sub.id)} onDragLeave={handleDragLeave as any} onDrop={(e) => handleDrop(e as any, sub.id)} onDragEnd={handleDragEnd}
                            className={`group h-14 transition-colors ${isBeingDragged ? 'opacity-40' : isOverThis ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#202E40]'}`}>
                            <td className="p-3 text-center font-mono text-[#64748B] dark:text-[#8493A8] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                              <span className="inline-flex items-center gap-1"><GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab" />{idx + 1}</span>
                            </td>
                            <td className="p-3 font-bold text-[#1E293B] dark:text-[#E2E8F0]">{sub.name}</td>
                            <td className="p-3 text-center"><span className="inline-flex min-w-14 justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3 py-1 font-mono font-bold">{sub.maxScore}</span></td>
                            <td className="p-3 text-center"><span className="inline-flex min-w-14 justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 font-mono font-bold">{sub.passScore}</span></td>
                            <td className="p-2">
                              <div className="flex items-center justify-center gap-1">
                                <button type="button" onClick={() => handleMove(sub.id, 'up')} disabled={idx === 0} title="تحريك لأعلى" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#26364B] disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"><ChevronUp className="w-4 h-4" /></button>
                                <button type="button" onClick={() => handleMove(sub.id, 'down')} disabled={idx === classSubjects.length - 1} title="تحريك لأسفل" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#26364B] disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"><ChevronDown className="w-4 h-4" /></button>
                                <button type="button" onClick={() => startEditing(sub)} title="تعديل" className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer disabled:cursor-not-allowed"><Edit3 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => setDeletingSubject(sub)} title="حذف" className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-3">يمكن سحب المادة من مقبض الترتيب أو استخدام الأسهم. يتم حفظ الترتيب تلقائياً.</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <section className="max-w-5xl w-full mx-auto rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex items-start justify-between gap-3">
            <div>
              <button type="button" onClick={() => { setIsAddPageOpen(false); setAddStep(1); }} className="text-xs font-bold text-[#64748B] dark:text-[#A8B5C7] hover:text-[#3156C9] mb-3 inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"><ArrowLeft className="w-4 h-4" /> العودة لإدارة المواد</button>
              <h1 className="text-xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2"><BookOpen className="w-6 h-6 text-[#3156C9]" /> إضافة مواد دراسية</h1>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">اختر الصف والمواد، ثم حدد درجاتها قبل اعتماد الإضافة.</p>
            </div>
            <button type="button" onClick={() => setIsAddPageOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#26364B] text-slate-500 cursor-pointer disabled:cursor-not-allowed"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-5 sm:px-6 pt-5">
            <div className="flex items-center justify-center gap-2 max-w-xl mx-auto">
              {[{n:1,label:'اختيار المواد'},{n:2,label:'تحديد الدرجات'}].map((step) => (
                <React.Fragment key={step.n}>
                  <div className={`flex items-center gap-2 text-xs font-bold ${addStep === step.n ? 'text-[#3156C9] dark:text-[#60A5FA]' : addStep > step.n ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center ${addStep === step.n ? 'bg-[#3156C9] text-white' : addStep > step.n ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-[#26364B]'}`}>{addStep > step.n ? <Check className="w-4 h-4" /> : step.n}</span>{step.label}
                  </div>
                  {step.n === 1 && <div className="h-px flex-1 max-w-24 bg-slate-200 dark:bg-slate-700" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {addStep === 1 ? (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-2">الصف الدراسي</label>
                  <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedNewSubjects([]); }} className="w-full h-11 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] px-3 text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]" disabled={availableClasses.length === 0}>
                    {availableClasses.map((cl) => <option key={cl.id} value={cl.id}>{cl.name} ({cl.stage})</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div><h2 className="font-black text-sm text-[#1E293B] dark:text-[#E2E8F0]">المواد الجاهزة</h2><p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1">حدد مادة واحدة أو عدة مواد دفعة واحدة.</p></div>
                    <div className="relative w-full sm:w-64"><input value={subjectSearch} onChange={(e) => setSubjectSearch(e.target.value)} placeholder="بحث عن مادة..." className="w-full h-9 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] pr-9 pl-3 text-xs text-[#1E293B] dark:text-[#E2E8F0]" /><Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {availableCatalogSubjects.map((name) => {
                      const checked = selectedNewSubjects.includes(name);
                      return <label key={name} className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 cursor-pointer transition-colors ${checked ? 'border-[#3156C9]/40 bg-[#3156C9]/8 dark:bg-[#2785F5]/12' : 'border-[#DCE3ED] dark:border-[#2D3B4D] hover:bg-slate-50 dark:hover:bg-[#26364B]'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCatalogSubject(name)} className="w-4 h-4 accent-[#3156C9]" />
                        <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0]">{name}</span>
                      </label>;
                    })}
                    {availableCatalogSubjects.length === 0 && <p className="col-span-full text-center text-xs text-slate-500 py-6">لا توجد مواد مطابقة أو أن جميع المواد موجودة لهذا الصف.</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    <span className="text-xs text-[#64748B] dark:text-[#8493A8]">تم تحديد <strong className="text-[#3156C9] dark:text-[#60A5FA]">{selectedNewSubjects.length}</strong> مادة</span>
                    <button type="button" onClick={() => setSelectedNewSubjects(availableCatalogSubjects)} className="text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] hover:underline cursor-pointer disabled:cursor-not-allowed">تحديد كل المواد المتاحة</button>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-[#B8C7E2] dark:border-[#3B4D66] p-4">
                  <h3 className="text-xs font-black text-[#1E293B] dark:text-[#E2E8F0] mb-2">إضافة مادة يدوية</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={customSubjectName} onChange={(e) => setCustomSubjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCatalogSubject(); } }} placeholder="اكتب اسم المادة الجديدة..." className="flex-1 h-10 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] px-3 text-xs text-[#1E293B] dark:text-[#E2E8F0]" />
                    <button type="button" onClick={addCustomCatalogSubject} disabled={!customSubjectName.trim()} className="h-10 px-4 rounded-lg bg-[#EEF3FF] dark:bg-[#263B63] text-[#3156C9] dark:text-[#8DB5FF] text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"><Plus className="inline w-4 h-4 ml-1" /> إضافة للقائمة</button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">المادة اليدوية تُحفظ في قائمة المواد الجاهزة على هذا الجهاز وتُحدد تلقائياً.</p>
                </div>
                <div className="flex justify-end pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <button type="button" onClick={proceedToGradeSetup} disabled={!selectedClassId || selectedNewSubjects.length === 0} className="h-10 px-5 rounded-lg bg-[#3156C9] hover:bg-[#2749B0] text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed">متابعة تحديد الدرجات <ArrowLeft className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div><h2 className="font-black text-sm text-[#1E293B] dark:text-[#E2E8F0]">تحديد درجات المواد</h2><p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">يمكنك تخصيص النهاية العظمى ودرجة النجاح لكل مادة قبل اعتمادها.</p></div>
                <div className="overflow-x-auto rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <table className="w-full min-w-[560px] text-xs text-right">
                    <thead className="bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7]"><tr><th className="p-3">اسم المادة</th><th className="p-3 w-40">النهاية العظمى</th><th className="p-3 w-40">درجة النجاح</th></tr></thead>
                    <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
                      {selectedNewSubjects.map((name) => {
                        const grade = bulkGrades[name] || { maxScore: 100, passScore: 50 };
                        return <tr key={name}><td className="p-3 font-bold text-[#1E293B] dark:text-[#E2E8F0]">{name}</td>
                          <td className="p-2"><input type="number" min={1} value={grade.maxScore} onChange={(e) => setBulkGrades((old) => ({ ...old, [name]: { ...grade, maxScore: Number(e.target.value) } }))} className="w-full h-9 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] px-3 font-mono text-center text-[#1E293B] dark:text-[#E2E8F0]" /></td>
                          <td className="p-2"><input type="number" min={1} max={grade.maxScore} value={grade.passScore} onChange={(e) => setBulkGrades((old) => ({ ...old, [name]: { ...grade, passScore: Number(e.target.value) } }))} className="w-full h-9 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] px-3 font-mono text-center text-[#1E293B] dark:text-[#E2E8F0]" /></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <button type="button" onClick={() => setAddStep(1)} className="h-10 px-4 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-bold text-[#475569] dark:text-[#A8B5C7] cursor-pointer disabled:cursor-not-allowed">رجوع لاختيار المواد</button>
                  <button type="button" onClick={confirmBulkAddSubjects} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"><Check className="w-4 h-4" /> اعتماد وإضافة {selectedNewSubjects.length} مادة</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

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
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] p-1.5 rounded-[8px] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] cursor-pointer disabled:cursor-not-allowed"
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
                  className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] cursor-pointer transition-colors disabled:cursor-not-allowed"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white cursor-pointer shadow-xs transition-colors disabled:cursor-not-allowed"
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
                className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] cursor-pointer transition-colors disabled:cursor-not-allowed"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-[8px] text-xs font-bold bg-[#C83D4B] hover:bg-[#B02E3C] text-white cursor-pointer shadow-xs transition-colors disabled:cursor-not-allowed"
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
