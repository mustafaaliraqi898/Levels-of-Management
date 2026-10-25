import React, { useState, useMemo, useRef } from 'react';
import { Student, SchoolClass, Section, AcademicYear } from '../../types';
import { db } from '../../services/storage';
import { downloadStudentTemplate, parseStudentExcelFile, ParsedStudentRow, ExcelParseResult } from '../../services/excelService';
import {
  Users,
  Plus,
  Search,
  Trash2,
  Edit,
  ArrowRightLeft,
  FileSpreadsheet,
  Download,
  Upload,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Phone,
  FileText,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface StudentsManagementProps {
  students: Student[];
  classes: SchoolClass[];
  sections: Section[];
  academicYears: AcademicYear[];
}

export const StudentsManagement: React.FC<StudentsManagementProps> = ({
  students,
  classes,
  sections,
  academicYears,
}) => {
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];

  // Filters state
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSectionId, setFilterSectionId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. Add Student Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRegNumber, setAddRegNumber] = useState('');
  const [addFatherPhone, setAddFatherPhone] = useState('');
  const [addClassId, setAddClassId] = useState<string>(classes[0]?.id || '');
  const [addSectionId, setAddSectionId] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);

  // Sync add modal section with selected class
  const addAvailableSections = useMemo(
    () => sections.filter((s) => s.classId === addClassId),
    [sections, addClassId]
  );

  React.useEffect(() => {
    if (addAvailableSections.length > 0) {
      if (!addAvailableSections.some((s) => s.id === addSectionId)) {
        setAddSectionId(addAvailableSections[0].id);
      }
    } else {
      setAddSectionId('');
    }
  }, [addAvailableSections, addSectionId]);

  // 2. Edit Student Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editRegNumber, setEditRegNumber] = useState('');
  const [editFatherPhone, setEditFatherPhone] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const editAvailableSections = useMemo(
    () => sections.filter((s) => s.classId === editClassId),
    [sections, editClassId]
  );

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditRegNumber(student.registrationNumber || '');
    setEditFatherPhone(student.fatherPhone || '');
    setEditClassId(student.classId);
    setEditSectionId(student.sectionId);
    setEditError(null);
  };

  // 3. Transfer Student Modal state
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState('');
  const [transferTargetSectionId, setTransferTargetSectionId] = useState('');
  const [isTransferConfirming, setIsTransferConfirming] = useState(false);

  const transferAvailableSections = useMemo(
    () => sections.filter((s) => s.classId === transferTargetClassId),
    [sections, transferTargetClassId]
  );

  React.useEffect(() => {
    if (transferAvailableSections.length > 0) {
      if (!transferAvailableSections.some((s) => s.id === transferTargetSectionId)) {
        setTransferTargetSectionId(transferAvailableSections[0].id);
      }
    } else {
      setTransferTargetSectionId('');
    }
  }, [transferAvailableSections, transferTargetSectionId]);

  const openTransferModal = (student: Student) => {
    setTransferringStudent(student);
    setTransferTargetClassId(student.classId);
    // Find next section if available, otherwise current
    const classSecs = sections.filter((s) => s.classId === student.classId);
    const otherSec = classSecs.find((s) => s.id !== student.sectionId);
    setTransferTargetSectionId(otherSec ? otherSec.id : student.sectionId);
    setIsTransferConfirming(false);
  };

  // 4. Excel Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importYearId, setImportYearId] = useState<string>(currentYear?.id || '');
  const [importClassId, setImportClassId] = useState<string>(classes[0]?.id || '');
  const [importSectionId, setImportSectionId] = useState<string>('');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importAvailableSections = useMemo(
    () => sections.filter((s) => s.classId === importClassId),
    [sections, importClassId]
  );

  React.useEffect(() => {
    if (importAvailableSections.length > 0) {
      if (!importAvailableSections.some((s) => s.id === importSectionId)) {
        setImportSectionId(importAvailableSections[0].id);
      }
    } else {
      setImportSectionId('');
    }
  }, [importAvailableSections, importSectionId]);

  // Filtered students for table
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        const matchesYear = !selectedYearId || s.academicYearId === selectedYearId;
        const matchesClass = filterClassId === 'all' || s.classId === filterClassId;
        const matchesSection = filterSectionId === 'all' || s.sectionId === filterSectionId;

        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
          (s.fatherPhone && s.fatherPhone.includes(q));

        return matchesYear && matchesClass && matchesSection && matchesSearch;
      })
      .sort((a, b) => {
        // Sort by class, then section, then registration number or seat number
        if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
        if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
        return (a.seatNumber || 0) - (b.seatNumber || 0);
      });
  }, [students, selectedYearId, filterClassId, filterSectionId, searchQuery]);

  // Set of all existing registration numbers in school (for fast duplicate detection)
  const existingRegNumbers = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.registrationNumber && s.registrationNumber.trim()) {
        set.add(s.registrationNumber.trim());
      }
    });
    return set;
  }, [students]);

  // Handler: Add Student
  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const cleanName = addName.trim();
    if (!cleanName) {
      setAddError('يرجى كتابة اسم الطالب، هذا الحقل إجباري.');
      return;
    }

    const cleanReg = addRegNumber.trim();
    if (cleanReg) {
      const check = db.isRegistrationNumberTaken(cleanReg, undefined, selectedYearId);
      if (check.isTaken) {
        setAddError(
          `رقم القيد «${cleanReg}» مسجل مسبقاً للطالب «${check.existingStudent?.name}». يرجى اختيار رقم قيد غير مكرر.`
        );
        return;
      }
    }

    if (!addClassId || !addSectionId) {
      setAddError('يرجى تحديد الصف والشعبة الدراسية للطالب.');
      return;
    }

    db.addStudent({
      name: cleanName,
      registrationNumber: cleanReg || undefined,
      fatherPhone: addFatherPhone.trim() || undefined,
      academicYearId: selectedYearId,
      classId: addClassId,
      sectionId: addSectionId,
      gender: 'male',
    });

    showToast(`تمت إضافة الطالب «${cleanName}» بنجاح.`);
    setIsAddModalOpen(false);
    setAddName('');
    setAddRegNumber('');
    setAddFatherPhone('');
    setAddError(null);
  };

  // Handler: Save Edited Student
  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditError(null);

    const cleanName = editName.trim();
    if (!cleanName) {
      setEditError('يرجى كتابة اسم الطالب، هذا الحقل إجباري.');
      return;
    }

    const cleanReg = editRegNumber.trim();
    if (cleanReg) {
      const check = db.isRegistrationNumberTaken(cleanReg, editingStudent.id, editingStudent.academicYearId);
      if (check.isTaken) {
        setEditError(
          `رقم القيد «${cleanReg}» مسجل مسبقاً لطالب آخر («${check.existingStudent?.name}»). لا يمكن تكرار رقم القيد.`
        );
        return;
      }
    }

    const updatedStudent: Student = {
      ...editingStudent,
      name: cleanName,
      registrationNumber: cleanReg || undefined,
      fatherPhone: editFatherPhone.trim() || undefined,
      classId: editClassId,
      sectionId: editSectionId,
    };

    db.updateStudent(updatedStudent);
    showToast(`تم تعديل بيانات الطالب «${cleanName}» وحفظها بنجاح.`);
    setEditingStudent(null);
  };

  // Handler: Confirm Transfer
  const handleExecuteTransfer = () => {
    if (!transferringStudent || !transferTargetClassId || !transferTargetSectionId) return;

    const fromClass = classes.find((c) => c.id === transferringStudent.classId)?.name || 'غير محدد';
    const fromSec = sections.find((s) => s.id === transferringStudent.sectionId)?.name || 'غير محدد';
    const toClass = classes.find((c) => c.id === transferTargetClassId)?.name || 'غير محدد';
    const toSec = sections.find((s) => s.id === transferTargetSectionId)?.name || 'غير محدد';

    const res = db.transferStudent(transferringStudent.id, transferTargetClassId, transferTargetSectionId);
    if (res.success) {
      showToast(
        `تم نقل الطالب «${transferringStudent.name}» بنجاح من (${fromClass} - شعبة ${fromSec}) إلى (${toClass} - شعبة ${toSec}) مع الحفاظ على كافة درجاته.`
      );
      setTransferringStudent(null);
      setIsTransferConfirming(false);
    } else {
      showToast(res.message || 'فشلت عملية النقل.', 'error');
    }
  };

  // Handler: Delete Student
  const handleDeleteStudent = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الطالب «${name}»؟\nتنبيه: سيتم حذف جميع درجاته المحفوظة.`)) {
      db.deleteStudent(id);
      showToast(`تم حذف الطالب «${name}» وسجلاته.`);
    }
  };

  // Handler: File Upload for Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    setIsParsingExcel(true);
    setParseResult(null);

    const result = await parseStudentExcelFile(file, existingRegNumbers);
    setParseResult(result);
    setIsParsingExcel(false);

    // Reset input so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handler: Execute Batch Excel Import
  const handleConfirmBatchImport = () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    if (!importClassId || !importSectionId) {
      showToast('يرجى اختيار الصف والشعبة أولاً.', 'error');
      return;
    }

    const studentsToImport = parseResult.validRows.map((row) => ({
      name: row.name,
      registrationNumber: row.registrationNumber || undefined,
      fatherPhone: row.fatherPhone || undefined,
      academicYearId: importYearId,
      classId: importClassId,
      sectionId: importSectionId,
    }));

    const result = db.addStudentsBatch(studentsToImport);

    const targetClassName = classes.find((c) => c.id === importClassId)?.name || '';
    const targetSectionName = sections.find((s) => s.id === importSectionId)?.name || '';

    showToast(
      `تم استيراد ${result.addedCount} طالب بنجاح إلى (${targetClassName} - شعبة ${targetSectionName}).`
    );

    setIsImportModalOpen(false);
    setParseResult(null);
    setImportedFileName('');
  };

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

      {/* Header Banner & Main Actions */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              سجل قيد وشؤون الطلاب
            </span>
            <span className="text-slate-400 text-xs">
              إجمالي الطلاب المسجلين: <strong className="text-emerald-400 font-mono">{students.length}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            إدارة وسجل الطلاب
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إضافة وتعديل بيانات الطلاب، رقم القيد، هاتف الأب، نقل الطلاب بين الشعب، واستيراد القوائم عبر Excel.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Excel Template */}
          <button
            type="button"
            onClick={downloadStudentTemplate}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
            title="تنزيل قالب Excel جاهز ومفرغ لإدخال بيانات الطلاب"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تنزيل قالب Excel</span>
          </button>

          {/* Import from Excel */}
          <button
            type="button"
            onClick={() => {
              setIsImportModalOpen(true);
              setParseResult(null);
              setImportedFileName('');
            }}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
            title="استيراد قائمة الطلاب من ملف Excel خارجي"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span>استيراد الطلاب من Excel</span>
          </button>

          {/* Add Student Button */}
          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setAddError(null);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طالب جديد</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Year */}
          <div className="relative">
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? '(الحالي)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
          </div>

          {/* Class Filter */}
          <div className="relative">
            <select
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setFilterSectionId('all');
              }}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
            >
              <option value="all">كل الصفوف الدراسية</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
          </div>

          {/* Section Filter */}
          <div className="relative">
            <select
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
            >
              <option value="all">كل الشعب</option>
              {(filterClassId === 'all'
                ? sections
                : sections.filter((s) => s.classId === filterClassId)
              ).map((s) => {
                const parentClass = classes.find((c) => c.id === s.classId)?.name || '';
                return (
                  <option key={s.id} value={s.id}>
                    شعبة {s.name} {filterClassId === 'all' ? `(${parentClass})` : ''}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم القيد أو هاتف الأب..."
            className="w-full h-10 pr-9 pl-4 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white absolute left-3 top-3 cursor-pointer"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* Students Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <table className="w-full border-collapse text-right text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700 text-slate-300 font-bold">
              <th className="p-3 text-center w-14 border-l border-slate-800">ت</th>
              <th className="p-3 min-w-[200px] border-l border-slate-800">اسم الطالب</th>
              <th className="p-3 w-36 border-l border-slate-800 font-mono">رقم القيد</th>
              <th className="p-3 w-40 border-l border-slate-800 font-mono">رقم هاتف الأب</th>
              <th className="p-3 w-32 border-l border-slate-800">الصف</th>
              <th className="p-3 w-28 border-l border-slate-800">الشعبة</th>
              <th className="p-3 text-center w-36">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500 text-sm">
                  {searchQuery
                    ? 'لا توجد نتائج مطابقة لمعايير البحث الحالية.'
                    : 'لا يوجد طلاب مسجلون في هذا الصف أو الشعبة. يمكنك إضافة طلاب أو استيرادهم من Excel.'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((stu, idx) => {
                const studentClass = classes.find((c) => c.id === stu.classId);
                const studentSection = sections.find((s) => s.id === stu.sectionId);

                return (
                  <tr key={stu.id} className="hover:bg-slate-900/50 transition-colors group">
                    {/* Index */}
                    <td className="p-3 text-center font-mono text-slate-400 border-l border-slate-800">
                      {idx + 1}
                    </td>

                    {/* Student Name */}
                    <td className="p-3 font-bold text-slate-200 text-sm border-l border-slate-800">
                      <span className="group-hover:text-emerald-400 transition-colors">{stu.name}</span>
                    </td>

                    {/* Registration Number (رقم القيد) */}
                    <td className="p-3 font-mono font-bold text-amber-400 border-l border-slate-800">
                      {stu.registrationNumber || '—'}
                    </td>

                    {/* Father Phone (رقم هاتف الأب) */}
                    <td className="p-3 font-mono text-slate-300 border-l border-slate-800">
                      {stu.fatherPhone ? (
                        <div className="flex items-center gap-1.5" dir="ltr">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{stu.fatherPhone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Class */}
                    <td className="p-3 text-slate-300 border-l border-slate-800 font-medium">
                      {studentClass?.name || '—'}
                    </td>

                    {/* Section */}
                    <td className="p-3 text-slate-300 border-l border-slate-800">
                      <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-bold">
                        شعبة {studentSection?.name || '—'}
                      </span>
                    </td>

                    {/* Actions: Edit, Transfer, Delete */}
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(stu)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="تعديل معلومات الطالب"
                        >
                          <Edit className="w-3.5 h-3.5 text-blue-400" />
                          <span>تعديل</span>
                        </button>

                        {/* Transfer Button */}
                        <button
                          type="button"
                          onClick={() => openTransferModal(stu)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="نقل الطالب إلى شعبة أو صف آخر"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                          <span>نقل</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(stu.id, stu.name)}
                          className="p-1.5 rounded-lg hover:bg-red-950 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          title="حذف الطالب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          MODAL 1: ADD NEW STUDENT
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">إضافة طالب جديد</h3>
                  <p className="text-xs text-slate-400">تسجيل طالب جديد وربطه بالصف والشعبة ورقم القيد</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="bg-red-950/40 border border-red-800 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="flex flex-col gap-4">
              {/* 1. Student Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  1. اسم الطالب الرباعي واللقب <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="مثال: حسين علي عبد الزهرة الخفاجي"
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden"
                  required
                  autoFocus
                />
              </div>

              {/* 2. Registration Number & Father Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. رقم القيد</span>
                  </label>
                  <input
                    type="text"
                    value={addRegNumber}
                    onChange={(e) => setAddRegNumber(e.target.value)}
                    placeholder="مثال: 1045"
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    يجب أن يكون رقم القيد فريداً وغير مكرر
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>3. رقم هاتف الأب</span>
                  </label>
                  <input
                    type="text"
                    value={addFatherPhone}
                    onChange={(e) => setAddFatherPhone(e.target.value)}
                    placeholder="07701234567"
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Academic Organization: Class & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف الدراسي</label>
                  <div className="relative">
                    <select
                      value={addClassId}
                      onChange={(e) => setAddClassId(e.target.value)}
                      className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold appearance-none cursor-pointer"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الشعبة</label>
                  <div className="relative">
                    <select
                      value={addSectionId}
                      onChange={(e) => setAddSectionId(e.target.value)}
                      className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold appearance-none cursor-pointer"
                    >
                      {addAvailableSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          الشعبة {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ وإضافة الطالب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: EDIT STUDENT INFORMATION
          ========================================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تعديل معلومات الطالب</h3>
                  <p className="text-xs text-slate-400">تعديل بيانات السجل مع الحفاظ على درجات الطالب</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-red-950/40 border border-red-800 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSubmit} className="flex flex-col gap-4">
              {/* 1. Student Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  1. اسم الطالب الرباعي واللقب <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* 2. Registration Number & Father Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. رقم القيد</span>
                  </label>
                  <input
                    type="text"
                    value={editRegNumber}
                    onChange={(e) => setEditRegNumber(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>3. رقم هاتف الأب</span>
                  </label>
                  <input
                    type="text"
                    value={editFatherPhone}
                    onChange={(e) => setEditFatherPhone(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-blue-500 focus:outline-hidden"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Class & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف الدراسي</label>
                  <div className="relative">
                    <select
                      value={editClassId}
                      onChange={(e) => setEditClassId(e.target.value)}
                      className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold appearance-none cursor-pointer"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الشعبة</label>
                  <div className="relative">
                    <select
                      value={editSectionId}
                      onChange={(e) => setEditSectionId(e.target.value)}
                      className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold appearance-none cursor-pointer"
                    >
                      {editAvailableSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          الشعبة {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>سيتم تحديث اسم الطالب ورقم قيده في جميع الجداول وكشوفات الدرجات تلقائياً.</span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-colors cursor-pointer"
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
          MODAL 3: TRANSFER STUDENT ("نقل الطالب بين الشعب")
          ========================================================================= */}
      {transferringStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">نقل الطالب بين الشعب</h3>
                  <p className="text-xs text-slate-400">نقل الطالب لشعبة أو صف آخر مع الحفاظ الكامل على درجاته</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferringStudent(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Student Info Card */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">اسم الطالب:</span>
                <span className="text-sm font-black text-white">{transferringStudent.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">رقم القيد:</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {transferringStudent.registrationNumber || 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 mt-1">
                <span className="text-xs text-slate-400">الموقع الحالي:</span>
                <span className="text-xs font-bold text-emerald-400">
                  {classes.find((c) => c.id === transferringStudent.classId)?.name} — شعبة{' '}
                  {sections.find((s) => s.id === transferringStudent.sectionId)?.name}
                </span>
              </div>
            </div>

            {/* Target Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف الجديد</label>
                <div className="relative">
                  <select
                    value={transferTargetClassId}
                    onChange={(e) => setTransferTargetClassId(e.target.value)}
                    className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold appearance-none cursor-pointer"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الشعبة الجديدة</label>
                <div className="relative">
                  <select
                    value={transferTargetSectionId}
                    onChange={(e) => setTransferTargetSectionId(e.target.value)}
                    className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold appearance-none cursor-pointer"
                  >
                    {transferAvailableSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        الشعبة {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Confirmation Alert Box */}
            <div className="bg-amber-950/30 border border-amber-500/40 p-3.5 rounded-xl text-xs flex items-start gap-2.5 text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>تأكيد نقل الطالب:</strong> سيتم نقل الطالب «{transferringStudent.name}» إلى (
                {classes.find((c) => c.id === transferTargetClassId)?.name} - شعبة{' '}
                {sections.find((s) => s.id === transferTargetSectionId)?.name}).
                <span className="block mt-1 text-slate-300">
                  سيتم الحفاظ على درجات الطالب السابقة تلقائياً وربطها بسجله الجديد دون حذف أو خلط.
                </span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTransferringStudent(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={
                  transferTargetClassId === transferringStudent.classId &&
                  transferTargetSectionId === transferringStudent.sectionId
                }
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد وتنفيذ النقل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: IMPORT STUDENTS FROM EXCEL ("استيراد الطلاب من Excel")
          ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">استيراد الطلاب من ملف Excel</h3>
                  <p className="text-xs text-slate-400">
                    استيراد جماعي مع التحقق من صحة الأسماء وأرقام القيد ومعاينة قبل الحفظ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Destination Selection (Year, Class, Section) */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                  ١
                </span>
                <span>تحديد موقع التسجيل المدرسي للطلاب المستوردين:</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {/* Year */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">العام الدراسي</label>
                  <div className="relative">
                    <select
                      value={importYearId}
                      onChange={(e) => setImportYearId(e.target.value)}
                      className="w-full h-9 px-2.5 pr-2.5 pl-7 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold appearance-none cursor-pointer"
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Class */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الصف الدراسي</label>
                  <div className="relative">
                    <select
                      value={importClassId}
                      onChange={(e) => setImportClassId(e.target.value)}
                      className="w-full h-9 px-2.5 pr-2.5 pl-7 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold appearance-none cursor-pointer"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Section */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الشعبة</label>
                  <div className="relative">
                    <select
                      value={importSectionId}
                      onChange={(e) => setImportSectionId(e.target.value)}
                      className="w-full h-9 px-2.5 pr-2.5 pl-7 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold appearance-none cursor-pointer"
                    >
                      {importAvailableSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          الشعبة {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: File Picker */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    ٢
                  </span>
                  <span>اختيار ملف Excel (.xlsx أو .xls):</span>
                </span>
                <button
                  type="button"
                  onClick={downloadStudentTemplate}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل القالب الرسمي الفارغ</span>
                </button>
              </span>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 bg-slate-950/60 hover:bg-slate-900/60 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-950/50 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 mb-2 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-200">
                  {importedFileName ? importedFileName : 'انقر لاختيار ملف Excel من جهازك'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم أعمدة: اسم الطالب، رقم القيد، رقم هاتف الأب
                </p>
              </div>
            </div>

            {/* Loading state */}
            {isParsingExcel && (
              <div className="text-center py-6 text-sm text-slate-400 flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>جاري قراءة الملف والتحقق من الأسماء وأرقام القيد...</span>
              </div>
            )}

            {/* Step 3: Analysis & Preview Results */}
            {parseResult && (
              <div className="flex flex-col gap-3">
                {/* Parse Error on File level */}
                {!parseResult.success ? (
                  <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-xl text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <span>{parseResult.errorMessage}</span>
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400">إجمالي السجلات</span>
                        <div className="text-base font-black text-white font-mono mt-0.5">
                          {parseResult.totalRows}
                        </div>
                      </div>

                      <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-800/40 text-center">
                        <span className="text-[11px] text-emerald-400">صالحة للاستيراد</span>
                        <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                          {parseResult.validRows.length}
                        </div>
                      </div>

                      <div className="bg-red-950/20 p-3 rounded-lg border border-red-800/40 text-center">
                        <span className="text-[11px] text-red-400">مرفوضة لوجود أخطاء</span>
                        <div className="text-base font-black text-red-400 font-mono mt-0.5">
                          {parseResult.invalidRows.length}
                        </div>
                      </div>
                    </div>

                    {/* Rejected Rows Alerts */}
                    {parseResult.invalidRows.length > 0 && (
                      <div className="bg-red-950/30 border border-red-800/60 p-3.5 rounded-xl text-xs flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-red-400 font-bold mb-1">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            تم رصد أخطاء في {parseResult.invalidRows.length} سجل (لن يتم استيرادها لمنع التكرار
                            أو الأخطاء):
                          </span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-red-300 font-medium">
                          {parseResult.invalidRows.slice(0, 5).map((row, i) => (
                            <li key={i}>
                              صف Excel {row.rowNumber}: {row.name || '«بدون اسم»'} —{' '}
                              {row.errors.join('، ')}
                            </li>
                          ))}
                          {parseResult.invalidRows.length > 5 && (
                            <li className="text-slate-400">
                              ... بالإضافة إلى {parseResult.invalidRows.length - 5} سجل آخر يحتوي على أخطاء.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Preview Table of Valid Rows */}
                    {parseResult.validRows.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-slate-300">
                          معاينة الطلاب الجاهزين للاستيراد ({parseResult.validRows.length} طالب):
                        </span>
                        <div className="max-h-44 overflow-y-auto border border-slate-800 rounded-lg">
                          <table className="w-full text-xs text-right border-collapse">
                            <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400">
                              <tr>
                                <th className="p-2 w-10 text-center">#</th>
                                <th className="p-2">اسم الطالب</th>
                                <th className="p-2 w-28">رقم القيد</th>
                                <th className="p-2 w-32">هاتف الأب</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                              {parseResult.validRows.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-800/40">
                                  <td className="p-2 text-center text-slate-500 font-mono">{i + 1}</td>
                                  <td className="p-2 font-bold text-slate-200">{r.name}</td>
                                  <td className="p-2 font-mono text-amber-400">
                                    {r.registrationNumber || '—'}
                                  </td>
                                  <td className="p-2 font-mono text-slate-300">
                                    {r.fatherPhone || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchImport}
                disabled={!parseResult || parseResult.validRows.length === 0}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  تأكيد واستيراد {parseResult?.validRows.length ? `(${parseResult.validRows.length}) طالب` : ''}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
