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
    <div className="flex flex-col gap-6 pb-16" dir="rtl">
      {saveSuccessNotification && (
        <div className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold animate-in fade-in slide-in-from-bottom duration-200 bg-[#059669] dark:bg-[#10B981] text-white dark:text-[#0B1420] border-[#10B981]/50">
          <Check className="w-5 h-5 shrink-0" />
          <span>{saveSuccessNotification}</span>
          <button type="button" onClick={() => setSaveSuccessNotification(null)} className="p-1 hover:bg-black/20 rounded cursor-pointer mr-2"><X className="w-4 h-4" /></button>
        </div>
      )}

      {!isAddPageOpen ? (
        <>
          {/* نفس شريط العنوان والإحصائيات في إدارة الصفوف والشعب */}
          <section className="relative overflow-hidden rounded-[22px] border border-[#BFD2FF] dark:border-[#31517E] bg-gradient-to-l from-[#2455D6] via-[#3269E8] to-[#4C83F2] p-4 sm:p-5 shadow-[0_10px_28px_rgba(37,84,190,0.16)]">
            <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div aria-hidden="true" className="pointer-events-none absolute left-[38%] -bottom-24 h-52 w-52 rounded-full bg-[#9CC0FF]/20 blur-3xl" />
            <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              <div className="flex items-center gap-3 shrink-0 text-white">
                <span className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
                  <BookOpen className="w-7 h-7" />
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">إدارة المواد الدراسية</h1>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full xl:max-w-[760px]">
                <div className="min-h-[78px] rounded-2xl border border-white/70 bg-white/95 dark:bg-[#1C2939]/95 p-3 flex items-center justify-between gap-3 shadow-sm">
                  <div><p className="text-[11px] font-bold text-[#526174] dark:text-[#A8B5C7]">إجمالي المواد</p><p className="mt-1 text-2xl font-black tabular-nums text-[#185B9D] dark:text-[#A8D5FF]">{subjects.length}</p></div>
                  <span className="w-11 h-11 rounded-xl bg-[#E4EEFF] dark:bg-[#24476B] text-[#2563EB] dark:text-[#8FC8FF] flex items-center justify-center"><BookOpen className="w-6 h-6" /></span>
                </div>
                <div className="min-h-[78px] rounded-2xl border border-white/70 bg-white/95 dark:bg-[#1C2939]/95 p-3 flex items-center justify-between gap-3 shadow-sm">
                  <div><p className="text-[11px] font-bold text-[#526174] dark:text-[#A8B5C7]">الصفوف التي لديها مواد</p><p className="mt-1 text-2xl font-black tabular-nums text-[#087E59] dark:text-[#70E0B7]">{availableClasses.filter((cl) => subjects.some((s) => s.classId === cl.id)).length}</p></div>
                  <span className="w-11 h-11 rounded-xl bg-[#DDF5EA] dark:bg-[#205344] text-[#087E59] dark:text-[#70E0B7] flex items-center justify-center"><Layers className="w-6 h-6" /></span>
                </div>
                <div className="min-h-[78px] rounded-2xl border border-white/70 bg-white/95 dark:bg-[#1C2939]/95 p-3 flex items-center justify-between gap-3 shadow-sm">
                  <div><p className="text-[11px] font-bold text-[#526174] dark:text-[#A8B5C7]">مواد الصف المحدد</p><p className="mt-1 text-2xl font-black tabular-nums text-[#7045B5] dark:text-[#C5A9FF]">{classSubjects.length}</p></div>
                  <span className="w-11 h-11 rounded-xl bg-[#EEE7FF] dark:bg-[#49366D] text-[#7045B5] dark:text-[#C5A9FF] flex items-center justify-center"><ListChecks className="w-6 h-6" /></span>
                </div>
              </div>
            </div>
          </section>

          {/* شريط اختيار العام والصف وإضافة المواد بنفس أسلوب إدارة الصفوف */}
          <section className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-3.5 sm:p-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {academicYears && academicYears.length > 0 && (
                  <div className="relative">
                    <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} aria-label="العام الدراسي"
                      className="h-11 min-w-[210px] px-3 pl-9 text-xs bg-[#F5F8FD] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none appearance-none cursor-pointer">
                      {academicYears.map((y) => <option key={y.id} value={y.id}>العام الدراسي {y.name} {y.isCurrent ? '(الحالي)' : ''}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#A8B5C7] absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                )}
                <div className="relative">
                  <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} aria-label="الصف الدراسي"
                    className="h-11 min-w-[210px] px-3 pl-9 text-xs bg-[#F5F8FD] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none appearance-none cursor-pointer">
                    {availableClasses.map((cl) => <option key={cl.id} value={cl.id}>{cl.name} ({cl.stage})</option>)}
                    {availableClasses.length === 0 && <option value="">لا توجد صفوف</option>}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#A8B5C7] absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>
              <button type="button" onClick={openAddSubjectsPage}
                className="h-11 px-5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3979E6] dark:hover:bg-[#4B8CF0] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_5px_14px_rgba(49,86,201,0.2)] hover:-translate-y-0.5">
                <Plus className="w-4 h-4" /><span>إضافة مواد دراسية جديدة</span>
              </button>
            </div>
          </section>

          {/* جدول المواد بنفس بطاقة وجدول إدارة الصفوف والشعب */}
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <h3 className="text-sm font-black text-[#263B5A] dark:text-[#E2E8F0]">المواد الدراسية المسجلة</h3>
              <span className="text-[11px] px-3 py-1.5 rounded-lg bg-[#EEF3FF] dark:bg-[#263B63] border border-[#D5E0FF] dark:border-[#3B4D78] text-[#3156C9] dark:text-[#A9C3FF] font-bold tabular-nums">{classSubjects.length} مادة</span>
            </div>
            {classSubjects.length === 0 ? (
              <div className="text-center py-16 text-[#64748B] dark:text-[#8493A8] text-sm flex flex-col items-center justify-center gap-3">
                <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#64748B] dark:text-[#8493A8]"><BookOpen className="w-8 h-8" /></div>
                <p>لا توجد مواد دراسية مسجلة لهذا الصف.</p>
                <button type="button" onClick={openAddSubjectsPage} className="px-4 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"><Plus className="w-4 h-4" /><span>إضافة مواد دراسية الآن</span></button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-[#D5E0F0] dark:border-[#3B4D66] text-xs font-black text-[#334B6D] dark:text-[#C1D0E3] bg-[#EAF0FC] dark:bg-[#26364B]">
                      <th className="py-3 px-4 rounded-r-xl w-16 text-center">ت</th>
                      <th className="py-3 px-4">اسم المادة الدراسية</th>
                      <th className="py-3 px-4 text-center">النهاية العظمى</th>
                      <th className="py-3 px-4 text-center">درجة النجاح</th>
                      <th className="py-3 px-4 text-center rounded-l-xl">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D] text-xs">
                    {classSubjects.map((sub, idx) => {
                      const isBeingDragged = draggedSubjectId === sub.id;
                      const isOverThis = dragOverSubjectId === sub.id;
                      return (
                        <tr key={sub.id} draggable
                          onDragStart={(e) => handleDragStart(e as any, sub.id)}
                          onDragOver={(e) => handleDragOver(e as any, sub.id)}
                          onDragLeave={handleDragLeave as any}
                          onDrop={(e) => handleDrop(e as any, sub.id)}
                          onDragEnd={handleDragEnd}
                          className={`transition-colors ${isBeingDragged ? 'opacity-40' : isOverThis ? 'bg-[#EEF3FF] dark:bg-[#263B63]/50' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#202E40]'}`}>
                          <td className="py-4 px-4 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8]">{idx + 1}</td>
                          <td className="py-4 px-4 font-black text-[#1E293B] dark:text-[#E2E8F0] text-sm"><span className="inline-flex items-center gap-2"><GripVertical className="w-4 h-4 text-[#94A3B8] cursor-grab" />{sub.name}</span></td>
                          <td className="py-4 px-4 text-center"><span className="inline-flex min-w-14 justify-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#3156C9]/8 dark:bg-[#2785F5]/12 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/25 font-mono tabular-nums">{sub.maxScore}</span></td>
                          <td className="py-4 px-4 text-center"><span className="inline-flex min-w-14 justify-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#DDF5EA] dark:bg-[#205344] text-[#087E59] dark:text-[#70E0B7] border border-[#087E59]/15 font-mono tabular-nums">{sub.passScore}</span></td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button type="button" onClick={() => handleMove(sub.id, 'up')} disabled={idx === 0} className="p-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] disabled:opacity-30" title="تحريك لأعلى"><ChevronUp className="w-4 h-4" /></button>
                              <button type="button" onClick={() => handleMove(sub.id, 'down')} disabled={idx === classSubjects.length - 1} className="p-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] disabled:opacity-30" title="تحريك لأسفل"><ChevronDown className="w-4 h-4" /></button>
                              <button type="button" onClick={() => startEditing(sub)} className="p-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] hover:text-[#3156C9] dark:hover:text-[#60A5FA]" title="تعديل المادة"><Edit3 className="w-4 h-4" /></button>
                              <button type="button" onClick={() => setDeletingSubject(sub)} className="p-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#E35D6A]/15 dark:bg-[#26364B] dark:hover:bg-[#E35D6A]/20 text-[#475569] dark:text-[#A8B5C7] hover:text-[#C83D4B] dark:hover:text-[#E35D6A]" title="حذف المادة"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-3">اسحب المادة لإعادة ترتيبها أو استخدم أزرار التحريك. يتم حفظ الترتيب تلقائياً.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <section className="max-w-5xl w-full mx-auto rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex items-start justify-between gap-3">
            <div>
              <button type="button" onClick={() => { setIsAddPageOpen(false); setAddStep(1); }} className="text-xs font-bold text-[#64748B] dark:text-[#A8B5C7] hover:text-[#3156C9] mb-3 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> العودة لإدارة المواد</button>
              <h1 className="text-xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2"><BookOpen className="w-6 h-6 text-[#3156C9]" /> إضافة مواد دراسية</h1>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">اختر الصف والمواد، ثم حدد درجاتها قبل اعتماد الإضافة.</p>
            </div>
            <button type="button" onClick={() => setIsAddPageOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#26364B] text-slate-500"><X className="w-5 h-5" /></button>
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
                    <button type="button" onClick={() => setSelectedNewSubjects(availableCatalogSubjects)} className="text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] hover:underline">تحديد كل المواد المتاحة</button>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-[#B8C7E2] dark:border-[#3B4D66] p-4">
                  <h3 className="text-xs font-black text-[#1E293B] dark:text-[#E2E8F0] mb-2">إضافة مادة يدوية</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={customSubjectName} onChange={(e) => setCustomSubjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCatalogSubject(); } }} placeholder="اكتب اسم المادة الجديدة..." className="flex-1 h-10 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F8FAFC] dark:bg-[#26364B] px-3 text-xs text-[#1E293B] dark:text-[#E2E8F0]" />
                    <button type="button" onClick={addCustomCatalogSubject} disabled={!customSubjectName.trim()} className="h-10 px-4 rounded-lg bg-[#EEF3FF] dark:bg-[#263B63] text-[#3156C9] dark:text-[#8DB5FF] text-xs font-bold disabled:opacity-40"><Plus className="inline w-4 h-4 ml-1" /> إضافة للقائمة</button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">المادة اليدوية تُحفظ في قائمة المواد الجاهزة على هذا الجهاز وتُحدد تلقائياً.</p>
                </div>
                <div className="flex justify-end pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <button type="button" onClick={proceedToGradeSetup} disabled={!selectedClassId || selectedNewSubjects.length === 0} className="h-10 px-5 rounded-lg bg-[#3156C9] hover:bg-[#2749B0] text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-2">متابعة تحديد الدرجات <ArrowLeft className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div><h2 className="font-black text-sm text-[#1E293B] dark:text-[#E2E8F0]">تحديد درجات المواد</h2><p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">يمكنك تخصيص النهاية العظمى ودرجة النجاح لكل مادة قبل اعتمادها.</p></div>
                <div className="overflow-x-auto rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <table className="w-full min-w-[560px] text-xs text-right">
                    <thead className="bg-[#EAF0FC] dark:bg-[#26364B] text-[#334B6D] dark:text-[#C1D0E3]"><tr><th className="p-3">اسم المادة</th><th className="p-3 w-40">النهاية العظمى</th><th className="p-3 w-40">درجة النجاح</th></tr></thead>
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
                  <button type="button" onClick={() => setAddStep(1)} className="h-10 px-4 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">رجوع لاختيار المواد</button>
                  <button type="button" onClick={confirmBulkAddSubjects} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2"><Check className="w-4 h-4" /> اعتماد وإضافة {selectedNewSubjects.length} مادة</button>
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
