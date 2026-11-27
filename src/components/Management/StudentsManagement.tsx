import React, { useState, useMemo, useRef } from 'react';
import { Student, StudentStatus, SchoolClass, Section, AcademicYear } from '../../types';
import { StudentStatusBadge } from '../Common/StudentStatusBadge';
import { db } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
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
  GraduationCap,
} from 'lucide-react';

interface StudentsManagementProps {
  students: Student[];
  classes: SchoolClass[];
  sections: Section[];
  academicYears: AcademicYear[];
  onNavigateToPromotion?: () => void;
}

export const StudentsManagement: React.FC<StudentsManagementProps> = ({
  students,
  classes,
  sections,
  academicYears,
  onNavigateToPromotion,
}) => {
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];

  // Filters state
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  // Classes filtered strictly by selected academic year
  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSectionId, setFilterSectionId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'regular' | 'affiliated'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset or align filterClassId if selection is not in availableClasses
  React.useEffect(() => {
    if (filterClassId !== 'all' && !availableClasses.some((c) => c.id === filterClassId)) {
      setFilterClassId('all');
      setFilterSectionId('all');
    }
  }, [availableClasses, filterClassId]);

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
  const [addClassId, setAddClassId] = useState<string>(availableClasses[0]?.id || '');
  const [addSectionId, setAddSectionId] = useState<string>('');
  const [addStatus, setAddStatus] = useState<StudentStatus>('regular');
  const [addError, setAddError] = useState<string | null>(null);

  // Sync addClassId with availableClasses
  React.useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === addClassId)) {
        setAddClassId(availableClasses[0].id);
      }
    } else if (addClassId !== '') {
      setAddClassId('');
    }
  }, [availableClasses, addClassId]);

  // Sync add modal section with selected class
  const addAvailableSections = useMemo(
    () => sections.filter((s) => s.classId === addClassId),
    [sections, addClassId]
  );

  React.useEffect(() => {
    if (addAvailableSections.length === 0) {
      setAddSectionId('');
    } else if (addAvailableSections.length === 1) {
      setAddSectionId(addAvailableSections[0].id);
    } else {
      if (!addAvailableSections.some((s) => s.id === addSectionId)) {
        setAddSectionId('');
      }
    }
  }, [addAvailableSections, addSectionId]);

  // 2. Edit Student Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editRegNumber, setEditRegNumber] = useState('');
  const [editFatherPhone, setEditFatherPhone] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editStatus, setEditStatus] = useState<StudentStatus>('regular');
  const [editError, setEditError] = useState<string | null>(null);

  const editAvailableSections = useMemo(
    () => sections.filter((s) => s.classId === editClassId),
    [sections, editClassId]
  );

  React.useEffect(() => {
    if (!editingStudent) return;
    if (editAvailableSections.length === 0) {
      setEditSectionId('');
    } else if (editAvailableSections.length === 1) {
      setEditSectionId(editAvailableSections[0].id);
    } else {
      if (!editAvailableSections.some((s) => s.id === editSectionId)) {
        setEditSectionId('');
      }
    }
  }, [editAvailableSections, editSectionId, editingStudent]);

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditRegNumber(student.registrationNumber || '');
    setEditFatherPhone(student.fatherPhone || '');
    setEditClassId(student.classId);
    setEditSectionId(student.sectionId || '');
    setEditStatus(student.status === 'affiliated' ? 'affiliated' : 'regular');
    setEditError(null);
  };

  // 3. Transfer Student Modal state
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState('');
  const [transferTargetSectionId, setTransferTargetSectionId] = useState('');
  const [isTransferConfirming, setIsTransferConfirming] = useState(false);
  const [isTransferCorrection, setIsTransferCorrection] = useState(false);

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
    setIsTransferCorrection(false);
  };

  // 4. Delete Student Modal state
  const [deletingStudent, setDeletingStudent] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteModal = (student: Student) => {
    setDeletingStudent({ id: student.id, name: student.name });
  };

  // 5. Excel Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importYearId, setImportYearId] = useState<string>(currentYear?.id || '');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Multi-select state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Filtered students for table
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        const matchesYear = !selectedYearId || s.academicYearId === selectedYearId;
        const matchesClass = filterClassId === 'all' || s.classId === filterClassId;
        const matchesSection =
          filterSectionId === 'all' ||
          s.sectionId === filterSectionId ||
          (filterSectionId === 'none' && !s.sectionId);
        const matchesStatus =
          filterStatus === 'all' ||
          (filterStatus === 'affiliated' ? s.status === 'affiliated' : s.status !== 'affiliated');

        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
          (s.fatherPhone && s.fatherPhone.includes(q));

        return matchesYear && matchesClass && matchesSection && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        // Sort by class, then section, then registration number or seat number
        if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
        if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
        return (a.seatNumber || 0) - (b.seatNumber || 0);
      });
  }, [students, selectedYearId, filterClassId, filterSectionId, filterStatus, searchQuery]);

  // Bulk select handlers
  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0 || isBulkDeleting) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const id of selectedStudentIds) {
        const res = await db.deleteStudent(id);
        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (failCount === 0) {
        showToast(`تم حذف ${successCount} طالب بنجاح مع كافة سجلاتهم.`, 'success');
      } else {
        showToast(`تم حذف ${successCount} طالب، وفشل حذف ${failCount} طالب.`, 'error');
      }
      setSelectedStudentIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast('حدث خطأ أثناء عملية الحذف الجماعي.', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

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

    if (!addClassId) {
      setAddError('يرجى تحديد الصف الدراسي للطالب.');
      return;
    }

    let finalSectionId = '';
    if (addAvailableSections.length > 0) {
      if (!addSectionId) {
        setAddError('يرجى اختيار الشعبة الدراسية للطالب، لأن هذا الصف يحتوي على عدة شعب.');
        return;
      }
      if (!addAvailableSections.some((s) => s.id === addSectionId)) {
        setAddError('الشعبة المحددة لا تنتمي إلى الصف الدراسي المختار.');
        return;
      }
      finalSectionId = addSectionId;
    }

    db.addStudent({
      name: cleanName,
      registrationNumber: cleanReg || undefined,
      fatherPhone: addFatherPhone.trim() || undefined,
      academicYearId: selectedYearId,
      classId: addClassId,
      sectionId: finalSectionId,
      gender: 'male',
      status: addStatus,
    });

    showToast(`تمت إضافة الطالب «${cleanName}» بنجاح.`);
    setIsAddModalOpen(false);
    setAddName('');
    setAddRegNumber('');
    setAddFatherPhone('');
    setAddStatus('regular');
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

    if (!editClassId) {
      setEditError('يرجى تحديد الصف الدراسي للطالب.');
      return;
    }

    let finalSectionId = '';
    if (editAvailableSections.length > 0) {
      if (!editSectionId) {
        setEditError('يرجى اختيار الشعبة الدراسية للطالب، لأن هذا الصف يحتوي على عدة شعب.');
        return;
      }
      if (!editAvailableSections.some((s) => s.id === editSectionId)) {
        setEditError('الشعبة المحددة لا تنتمي إلى هذا الصف.');
        return;
      }
      finalSectionId = editSectionId;
    }

    const updatedStudent: Student = {
      ...editingStudent,
      name: cleanName,
      registrationNumber: cleanReg || undefined,
      fatherPhone: editFatherPhone.trim() || undefined,
      classId: editClassId,
      sectionId: finalSectionId,
      status: editStatus,
    };

    db.updateStudent(updatedStudent);
    showToast(`تم تعديل بيانات الطالب «${cleanName}» وحفظها بنجاح.`);
    setEditingStudent(null);
  };

  // Handler: Confirm Transfer
  const handleExecuteTransfer = () => {
    if (!transferringStudent || !transferTargetClassId) return;

    const targetSections = sections.filter((s) => s.classId === transferTargetClassId);
    let finalTransferSecId = '';
    if (targetSections.length > 0) {
      if (!transferTargetSectionId || !targetSections.some((s) => s.id === transferTargetSectionId)) {
        showToast('يرجى اختيار شعبة صالحة تابعة للصف المستهدف.', 'error');
        return;
      }
      finalTransferSecId = transferTargetSectionId;
    }

    const fromClass = classes.find((c) => c.id === transferringStudent.classId)?.name || 'غير محدد';
    const fromSec = sections.find((s) => s.id === transferringStudent.sectionId)?.name || 'بدون شعبة';
    const toClass = classes.find((c) => c.id === transferTargetClassId)?.name || 'غير محدد';
    const toSec = sections.find((s) => s.id === finalTransferSecId)?.name || 'بدون شعبة';

    const res = db.transferStudent(
      transferringStudent.id,
      transferTargetClassId,
      finalTransferSecId,
      { isCorrection: isTransferCorrection }
    );

    if (res.success) {
      showToast(
        `تم نقل الطالب «${transferringStudent.name}» بنجاح من (${fromClass} - ${fromSec === 'بدون شعبة' ? 'بدون شعبة' : `شعبة ${fromSec}`}) إلى (${toClass} - ${toSec === 'بدون شعبة' ? 'بدون شعبة' : `شعبة ${toSec}`}). ${
          isTransferCorrection ? 'تم تصحيح صف سجلات الدرجات الحالية.' : 'تم الحفاظ على درجات الطالب السابقة بأمان.'
        }`
      );
      setTransferringStudent(null);
      setIsTransferConfirming(false);
    } else {
      showToast(res.message || 'فشلت عملية النقل.', 'error');
    }
  };

  // Handler: Confirm Delete Student
  const handleConfirmDelete = async () => {
    if (!deletingStudent || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await db.deleteStudent(deletingStudent.id);
      if (res.success) {
        showToast(`تم حذف الطالب «${deletingStudent.name}» وجميع سجلاته بنجاح.`, 'success');
        setDeletingStudent(null);
      } else {
        showToast(res.error || 'فشل حذف الطالب من قاعدة البيانات.', 'error');
      }
    } catch (err) {
      console.error('Delete student error:', err);
      showToast('حدث خطأ غير متوقع أثناء محاولة حذف الطالب.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: File Upload for Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    setIsParsingExcel(true);
    setParseResult(null);

    const parsed = await parseStudentExcelFile(file, existingRegNumbers);

    // Resolve each row's class/section directly from its Excel values.
    const normalizeSchoolLabel = (value: string) =>
      value
        .normalize('NFKC')
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase();

    const allRows = [...parsed.validRows, ...parsed.invalidRows].sort(
      (a, b) => a.rowNumber - b.rowNumber
    );
    const resolvedRows = parsed.success
      ? allRows.map((row) => {
          const errors = [...row.errors];
          let classId = '';
          let sectionId = '';
          let resolvedClass: SchoolClass | undefined;

          if (row.className.trim()) {
            const matchingClasses = classes.filter(
              (schoolClass) => normalizeSchoolLabel(schoolClass.name) === normalizeSchoolLabel(row.className)
            );
            if (matchingClasses.length === 0) {
              errors.push(`الصف «${row.className}» غير موجود في النظام؛ تأكد من كتابة اسمه كما هو مسجل.`);
            } else if (matchingClasses.length > 1) {
              errors.push(`اسم الصف «${row.className}» غير فريد في النظام، ولا يمكن تحديده تلقائياً.`);
            } else {
              resolvedClass = matchingClasses[0];
              classId = resolvedClass.id;
            }
          }

          if (resolvedClass) {
            const classSections = sections.filter((section) => section.classId === resolvedClass!.id);
            if (row.sectionName.trim()) {
              if (classSections.length === 0) {
                errors.push(`الصف «${resolvedClass.name}» لا يحتوي على شعب؛ اترك حقل الشعبة فارغاً.`);
              } else {
                const matchingSections = classSections.filter(
                  (section) => normalizeSchoolLabel(section.name) === normalizeSchoolLabel(row.sectionName)
                );
                if (matchingSections.length === 0) {
                  errors.push(`الشعبة «${row.sectionName}» غير موجودة ضمن الصف «${resolvedClass.name}».`);
                } else if (matchingSections.length > 1) {
                  errors.push(`اسم الشعبة «${row.sectionName}» غير فريد ضمن الصف «${resolvedClass.name}».`);
                } else {
                  sectionId = matchingSections[0].id;
                }
              }
            } else if (classSections.length === 1) {
              // A single section is selected automatically; no-section classes keep an empty sectionId.
              sectionId = classSections[0].id;
            } else if (classSections.length > 1) {
              errors.push(`حقل الشعبة فارغ، والصف «${resolvedClass.name}» يحتوي على عدة شعب؛ حدد الشعبة في ملف Excel.`);
            }
          }

          const uniqueErrors = [...new Set(errors)];
          return { ...row, classId, sectionId, errors: uniqueErrors, isValid: uniqueErrors.length === 0 };
        })
      : allRows;

    setParseResult({
      ...parsed,
      validRows: resolvedRows.filter((row) => row.isValid),
      invalidRows: resolvedRows.filter((row) => !row.isValid),
      totalRows: resolvedRows.length,
    });
    setIsParsingExcel(false);

    // Reset input so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handler: Execute Batch Excel Import
  const handleConfirmBatchImport = () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    if (!importYearId) {
      showToast('يرجى تحديد العام الدراسي.', 'error');
      return;
    }

    const studentsToImport = parseResult.validRows.map((row) => ({
      name: row.name,
      registrationNumber: row.registrationNumber || undefined,
      fatherPhone: row.fatherPhone || undefined,
      academicYearId: importYearId,
      classId: row.classId || '',
      // Empty sectionId is valid for classes without sections.
      sectionId: row.sectionId || '',
    }));

    const result = db.addStudentsBatch(studentsToImport);
    const importedClassCount = new Set(parseResult.validRows.map((row) => row.classId)).size;
    showToast(`تم استيراد ${result.addedCount} طالب بنجاح وتوزيعهم تلقائياً على ${importedClassCount} صف حسب ملف Excel.`);

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
              ? 'bg-[#059669] dark:bg-[#10B981] text-white dark:text-[#0B1420] border-[#10B981]/50'
              : toastMessage.type === 'error'
              ? 'bg-[#C83D4B] dark:bg-[#E35D6A] text-white dark:text-[#0B1420] border-[#E35D6A]/50'
              : 'bg-[#1C2939] text-[#E2E8F0] border-[#2D3B4D]'
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
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-[#FFFFFF] via-[#F4F7FF] to-[#EAF0FF] dark:from-[#1C2939] dark:via-[#1D3048] dark:to-[#17283D] border border-[#DCE3ED] dark:border-[#34465D] p-5 sm:p-6 rounded-[22px] shadow-sm dark:shadow-[0_12px_32px_rgba(0,0,0,0.24)] flex flex-col xl:flex-row xl:items-center justify-between gap-5 before:absolute before:inset-y-0 before:right-0 before:w-1 before:bg-[#3156C9] dark:before:bg-[#60A5FA]">
        {/* Soft circular background motif — decorative only */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-28 h-80 w-80 rounded-full border border-[#3156C9]/15 dark:border-[#60A5FA]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-5 -top-12 h-52 w-52 rounded-full border border-[#3156C9]/15 dark:border-[#60A5FA]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-8 h-64 w-64 rounded-full bg-[#60A5FA]/10 dark:bg-[#60A5FA]/[0.08] blur-3xl" />
        <div className="relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#3156C9]/8 dark:bg-[#2785F5]/12 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/25">
              <Sparkles className="w-3.5 h-3.5" />
              سجل قيد وشؤون الطلاب
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#047857]/50 text-[#047857] dark:text-[#34D399]">
              إجمالي الطلاب: <strong className="font-mono tabular-nums">{students.length}</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" />
            إدارة وسجل الطلاب
          </h1>

        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {/* Student Promotion Button */}
          {onNavigateToPromotion && (
            <button
              type="button"
              onClick={onNavigateToPromotion}
              className="px-3.5 py-2.5 rounded-xl bg-[#3156C9]/8 hover:bg-[#3156C9]/15 dark:bg-[#2785F5]/12 dark:hover:bg-[#2785F5]/20 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/25 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              title="ترحيل الطلاب من صف إلى الصف الأعلى للسنة الدراسية الجديدة"
            >
              <GraduationCap className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>ترحيل الطلاب للعام الجديد</span>
            </button>
          )}

          {/* Download Excel Template */}
          <button
            type="button"
            onClick={downloadStudentTemplate}
            className="px-3.5 py-2.5 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            title="تنزيل قالب Excel جاهز ومفرغ لإدخال بيانات الطلاب"
          >
            <Download className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />
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
            className="px-3.5 py-2.5 rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            title="استيراد قائمة الطلاب من ملف Excel خارجي"
          >
            <Upload className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>استيراد الطلاب من Excel</span>
          </button>

          {/* Add Student Button */}
          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setAddError(null);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طالب جديد</span>
          </button>

          {/* Bulk Delete Button (Visible only if students are selected) */}
          {selectedStudentIds.length > 0 && (
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#C83D4B] hover:bg-[#B02E3C] text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-colors animate-in fade-in zoom-in duration-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المحدّد (<span className="font-mono tabular-nums">{selectedStudentIds.length}</span>)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3.5 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs app-card-surface">
        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Academic Year */}
          <div className="relative">
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/10 appearance-none cursor-pointer transition-colors"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? '(الحالي)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
          </div>

          {/* Class Filter */}
          <div className="relative">
            <select
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setFilterSectionId('all');
              }}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
            >
              <option value="all">كل الصفوف الدراسية</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
          </div>

          {/* Section Filter */}
          <div className="relative">
            <select
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
            >
              <option value="all">كل الشعب</option>
              {filterClassId !== 'all' && sections.filter((s) => s.classId === filterClassId).length === 0 && (
                <option value="none">(الصف لا يتضمن شُعب)</option>
              )}
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
            <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'regular' | 'affiliated')}
              className="h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:border-[#2785F5] focus:outline-hidden appearance-none cursor-pointer"
            >
              <option value="all">كل الحالات (الكل)</option>
              <option value="regular">منتظم فقط</option>
              <option value="affiliated">انتساب فقط</option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2.5 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72 lg:w-80 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم القيد أو هاتف الأب..."
            className="w-full h-10 pr-9 pl-4 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:border-[#2785F5] focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/10 transition-colors"
          />
          <Search className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute right-3 top-3 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-[#475569] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] absolute left-3 top-3 cursor-pointer"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* Students Data Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] shadow-sm dark:shadow-xl">
        <table className="w-full border-collapse text-right text-xs">
          <thead>
            <tr className="bg-[#EDF1F7] dark:bg-[#26364B] border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] font-bold">
              <th className="p-3 text-center w-12 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                <input
                  type="checkbox"
                  checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded-sm border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#26364B] accent-[#3156C9] dark:accent-[#2785F5] focus:ring-0 cursor-pointer"
                />
              </th>
              <th className="p-3 text-center w-14 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">ت</th>
              <th className="p-3 min-w-[200px] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">اسم الطالب</th>
              <th className="p-3 w-36 border-l border-[#DCE3ED] dark:border-[#2D3B4D] font-mono">رقم القيد</th>
              <th className="p-3 w-40 border-l border-[#DCE3ED] dark:border-[#2D3B4D] font-mono">رقم هاتف الأب</th>
              <th className="p-3 w-32 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">الصف</th>
              <th className="p-3 w-28 border-l border-[#DCE3ED] dark:border-[#2D3B4D]">الشعبة</th>
              <th className="p-3 text-center w-36">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D]">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-[#64748B] dark:text-[#8493A8] text-sm">
                  {searchQuery
                    ? 'لا توجد نتائج مطابقة لمعايير البحث الحالية.'
                    : 'لا يوجد طلاب مسجلون في هذا الصف أو الشعبة. يمكنك إضافة طلاب أو استيرادهم من Excel.'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((stu, idx) => {
                const studentClass = classes.find((c) => c.id === stu.classId);
                const studentSection = sections.find((s) => s.id === stu.sectionId);

                const isSelected = selectedStudentIds.includes(stu.id);

                return (
                  <tr key={stu.id} className={`h-14 hover:bg-[#F4F7FC] dark:hover:bg-[#243449] transition-colors duration-150 group ${isSelected ? 'bg-[#3156C9]/8 dark:bg-[#2785F5]/12' : ''}`}>
                    {/* Checkbox */}
                    <td className="p-3 text-center border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectStudent(stu.id)}
                        className="w-4 h-4 rounded-sm border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#26364B] accent-[#3156C9] dark:accent-[#2785F5] focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Index */}
                    <td className="p-3 text-center font-mono tabular-nums text-[#64748B] dark:text-[#8493A8] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      {idx + 1}
                    </td>

                    {/* Student Name */}
                    <td className="p-3 font-bold text-[#1E293B] dark:text-[#E2E8F0] text-sm border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      <div className="flex items-center gap-2">
                        <span className="group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] transition-colors">{stu.name}</span>
                        <StudentStatusBadge status={stu.status} />
                      </div>
                    </td>

                    {/* Registration Number (رقم القيد) */}
                    <td className="p-3 font-mono tabular-nums font-bold text-[#B45309] dark:text-[#D69B42] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      {stu.registrationNumber || '—'}
                    </td>

                    {/* Father Phone (رقم هاتف الأب) */}
                    <td className="p-3 font-mono tabular-nums text-[#475569] dark:text-[#A8B5C7] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      {stu.fatherPhone ? (
                        <div className="flex items-center gap-1.5" dir="ltr">
                          <Phone className="w-3 h-3 text-[#64748B] dark:text-[#8493A8] shrink-0" />
                          <span>{stu.fatherPhone}</span>
                        </div>
                      ) : (
                        <span className="text-[#64748B] dark:text-[#8493A8]">—</span>
                      )}
                    </td>

                    {/* Class */}
                    <td className="p-3 text-[#475569] dark:text-[#A8B5C7] border-l border-[#DCE3ED] dark:border-[#2D3B4D] font-medium">
                      {studentClass?.name || '—'}
                    </td>

                    {/* Section */}
                    <td className="p-3 text-[#475569] dark:text-[#A8B5C7] border-l border-[#DCE3ED] dark:border-[#2D3B4D]">
                      {studentSection?.name ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 text-[#3156C9] dark:text-[#60A5FA] font-bold">
                          شعبة {studentSection.name}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#64748B] dark:text-[#8493A8] font-medium text-[11px]">
                          بدون شعبة
                        </span>
                      )}
                    </td>

                    {/* Actions: Edit, Transfer, Delete */}
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(stu)}
                          className="px-3 py-1.5 rounded-lg bg-[#EEF3FF] hover:bg-[#E2EAFF] dark:bg-[#263B63] dark:hover:bg-[#304A78] text-[#3156C9] dark:text-[#8DB5FF] border border-[#D3DFFF] dark:border-[#3B4D78] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="تعديل معلومات الطالب"
                        >
                          <Edit className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                          <span>تعديل</span>
                        </button>

                        {/* Transfer Button */}
                        <button
                          type="button"
                          onClick={() => openTransferModal(stu)}
                          className="px-3 py-1.5 rounded-lg bg-[#FFF7ED] hover:bg-[#FFEDD5] dark:bg-[#422D1A] dark:hover:bg-[#54391F] text-[#B45309] dark:text-[#F0B45B] border border-[#FED7AA] dark:border-[#76502A] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="نقل الطالب إلى شعبة أو صف آخر"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-[#B45309] dark:text-[#D69B42]" />
                          <span>نقل</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => openDeleteModal(stu)}
                          className="p-2 rounded-lg hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/30 text-[#C83D4B] dark:text-[#F87171] transition-colors cursor-pointer"
                          title="حذف الطالب وسجلاته"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[22px] shadow-2xl p-5 sm:p-7 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 w-11 h-11 rounded-xl bg-[#E8EFFF] dark:bg-[#263B63] border border-[#D3DFFF] dark:border-[#3B4D78] text-[#3156C9] dark:text-[#8DB5FF] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1E293B] dark:text-[#E2E8F0]">إضافة طالب جديد</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="flex flex-col gap-4">
              {/* 1. Student Name */}
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                  1. اسم الطالب الرباعي واللقب <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="مثال: حسين علي عبد الزهرة الخفاجي"
                  className="w-full h-11 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] focus:border-[#2785F5] focus:outline-hidden"
                  required
                  autoFocus
                />
              </div>

              {/* 2. Registration Number & Father Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#B45309] dark:text-[#D69B42]" />
                    <span>2. رقم القيد</span>
                  </label>
                  <input
                    type="text"
                    value={addRegNumber}
                    onChange={(e) => setAddRegNumber(e.target.value)}
                    placeholder="مثال: 1045"
                    className="w-full h-11 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] font-mono focus:border-[#2785F5] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] mt-1 block">
                    يجب أن يكون رقم القيد فريداً وغير مكرر
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                    <span>3. رقم هاتف الأب</span>
                  </label>
                  <input
                    type="text"
                    value={addFatherPhone}
                    onChange={(e) => setAddFatherPhone(e.target.value)}
                    placeholder="07701234567"
                    className="w-full h-11 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] font-mono focus:border-[#2785F5] focus:outline-hidden"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Academic Organization: Class & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F6F8FC] dark:bg-[#202E40] p-4 rounded-2xl border border-[#DCE3ED] dark:border-[#33465F]">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">الصف الدراسي</label>
                  <div className="relative">
                    <select
                      value={addClassId}
                      onChange={(e) => setAddClassId(e.target.value)}
                      className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                    >
                      {availableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                    الشعبة {addAvailableSections.length > 0 && <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>}
                  </label>
                  <div className="relative">
                    <select
                      value={addSectionId}
                      disabled={addAvailableSections.length === 0}
                      onChange={(e) => setAddSectionId(e.target.value)}
                      className={`w-full h-9 px-3 pr-3 pl-8 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition ${
                        addAvailableSections.length === 0 ? 'opacity-60 cursor-not-allowed bg-[#EDF1F7] dark:bg-[#1C2939]' : ''
                      }`}
                    >
                      {addAvailableSections.length === 0 ? (
                        <option value="">(هذا الصف لا يحتوي على شُعب)</option>
                      ) : (
                        <>
                          {addAvailableSections.length > 1 && (
                            <option value="">-- اختر الشعبة الدراسية --</option>
                          )}
                          {addAvailableSections.map((s) => (
                            <option key={s.id} value={s.id}>
                              الشعبة {s.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* حالة الطالب (منتظم / انتساب) */}
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center justify-between">
                  <span>حالة الطالب</span>
                  <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] font-normal">الافتراضي: منتظم</span>
                </label>
                <div className="relative">
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as StudentStatus)}
                    className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                  >
                    <option value="regular">منتظم</option>
                    <option value="affiliated">انتساب</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DCE3ED] dark:border-[#2D3B4D] mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] shadow-2xl p-6 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 w-11 h-11 rounded-xl bg-[#E8EFFF] dark:bg-[#263B63] border border-[#D3DFFF] dark:border-[#3B4D78] text-[#3156C9] dark:text-[#8DB5FF] flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1E293B] dark:text-[#E2E8F0]">تعديل معلومات الطالب</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-2 text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSubmit} className="flex flex-col gap-4">
              {/* 1. Student Name */}
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                  1. اسم الطالب الرباعي واللقب <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
              </div>

              {/* 2. Registration Number & Father Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#B45309] dark:text-[#D69B42]" />
                    <span>2. رقم القيد</span>
                  </label>
                  <input
                    type="text"
                    value={editRegNumber}
                    onChange={(e) => setEditRegNumber(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-mono focus:border-[#2785F5] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                    <span>3. رقم هاتف الأب</span>
                  </label>
                  <input
                    type="text"
                    value={editFatherPhone}
                    onChange={(e) => setEditFatherPhone(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-[#F6F8FC] dark:bg-[#26364B] border border-[#D5E0F0] dark:border-[#3B4D66] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-mono focus:border-[#2785F5] focus:outline-hidden"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Class & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F6F8FC] dark:bg-[#202E40] p-4 rounded-2xl border border-[#DCE3ED] dark:border-[#33465F]">
                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">الصف الدراسي</label>
                  <div className="relative">
                    <select
                      value={editClassId}
                      onChange={(e) => setEditClassId(e.target.value)}
                      className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                    الشعبة {editAvailableSections.length > 0 && <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>}
                  </label>
                  <div className="relative">
                    <select
                      value={editSectionId}
                      disabled={editAvailableSections.length === 0}
                      onChange={(e) => setEditSectionId(e.target.value)}
                      className={`w-full h-9 px-3 pr-3 pl-8 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition ${
                        editAvailableSections.length === 0 ? 'opacity-60 cursor-not-allowed bg-[#EDF1F7] dark:bg-[#1C2939]' : ''
                      }`}
                    >
                      {editAvailableSections.length === 0 ? (
                        <option value="">(هذا الصف لا يحتوي على شُعب)</option>
                      ) : (
                        <>
                          {editAvailableSections.length > 1 && (
                            <option value="">-- اختر الشعبة الدراسية --</option>
                          )}
                          {editAvailableSections.map((s) => (
                            <option key={s.id} value={s.id}>
                              الشعبة {s.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* حالة الطالب (منتظم / انتساب) */}
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5 flex items-center justify-between">
                  <span>حالة الطالب</span>
                  <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] font-normal">الحالة الحالية قابلة للتعديل</span>
                </label>
                <div className="relative">
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as StudentStatus)}
                    className="w-full h-10 px-3 pr-3 pl-8 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                  >
                    <option value="regular">منتظم</option>
                    <option value="affiliated">انتساب</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="text-[11px] text-[#475569] dark:text-[#A8B5C7] bg-[#F8FAFC] dark:bg-[#202E40] p-2.5 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center gap-2">
                <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA] shrink-0" />
                <span>سيتم تحديث اسم الطالب ورقم قيده وحالته في جميع الجداول وكشوفات الدرجات تلقائياً.</span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DCE3ED] dark:border-[#2D3B4D] mt-1">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] shadow-2xl p-6 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 w-11 h-11 rounded-xl bg-[#FFF3DF] dark:bg-[#49371F] border border-[#F2D6A7] dark:border-[#76552B] text-[#B7791F] dark:text-[#F0B85A] flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1E293B] dark:text-[#E2E8F0]">نقل الطالب بين الصفوف والشُعب</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferringStudent(null)}
                className="p-2 text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Student Info Card */}
            <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#8493A8]">اسم الطالب:</span>
                <span className="text-sm font-black text-[#1E293B] dark:text-[#E2E8F0]">{transferringStudent.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#8493A8]">رقم القيد:</span>
                <span className="text-xs font-mono tabular-nums font-bold text-[#B45309] dark:text-[#D69B42]">
                  {transferringStudent.registrationNumber || 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#DCE3ED] dark:border-[#2D3B4D] pt-2 mt-1">
                <span className="text-xs text-[#64748B] dark:text-[#8493A8]">الموقع الحالي:</span>
                <span className="text-xs font-bold text-[#059669] dark:text-[#10B981]">
                  {classes.find((c) => c.id === transferringStudent.classId)?.name} — شعبة{' '}
                  {sections.find((s) => s.id === transferringStudent.sectionId)?.name}
                </span>
              </div>
            </div>

            {/* Target Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">الصف الجديد</label>
                <div className="relative">
                  <select
                    value={transferTargetClassId}
                    onChange={(e) => setTransferTargetClassId(e.target.value)}
                    className="w-full h-9 px-3 pr-3 pl-8 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                  الشعبة الجديدة {transferAvailableSections.length > 0 && <span className="text-[#C83D4B] dark:text-[#E35D6A]">*</span>}
                </label>
                <div className="relative">
                  <select
                    value={transferTargetSectionId}
                    disabled={transferAvailableSections.length === 0}
                    onChange={(e) => setTransferTargetSectionId(e.target.value)}
                    className={`w-full h-9 px-3 pr-3 pl-8 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition ${
                      transferAvailableSections.length === 0 ? 'opacity-60 cursor-not-allowed bg-[#EDF1F7] dark:bg-[#1C2939]' : ''
                    }`}
                  >
                    {transferAvailableSections.length === 0 ? (
                      <option value="">(الصف المختار لا يحتوي على شُعب)</option>
                    ) : (
                      <>
                        {transferAvailableSections.length > 1 && (
                          <option value="">-- اختر الشعبة المستهدفة --</option>
                        )}
                        {transferAvailableSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            الشعبة {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-2.5 pointer-events-none" />
                </div>
                {transferAvailableSections.length === 0 && (
                  <span className="text-[10px] text-[#059669] dark:text-[#10B981] mt-1 block">
                    ✓ سيتم نقل الطالب إلى الصف مباشرة دون ربطه بشعبة
                  </span>
                )}
              </div>
            </div>

            {/* Confirmation Alert Box */}
            <div className="bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 p-3.5 rounded-xl text-xs flex items-start gap-2.5 text-[#B45309] dark:text-[#D69B42]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>تأكيد نقل الطالب:</strong> سيتم نقل الطالب «{transferringStudent.name}» إلى (
                {classes.find((c) => c.id === transferTargetClassId)?.name} - شعبة{' '}
                {sections.find((s) => s.id === transferTargetSectionId)?.name}).
                <span className="block mt-1 text-[#475569] dark:text-[#A8B5C7]">
                  سيتم الحفاظ على درجات الطالب السابقة تلقائياً تحت صفه الأصلي لتفادي خلط الدرجات بين الصفوف.
                </span>
              </div>
            </div>

            {/* Correction Checkbox Option */}
            <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-3 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D]">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#1E293B] dark:text-[#E2E8F0] font-bold">
                <input
                  type="checkbox"
                  checked={isTransferCorrection}
                  onChange={(e) => setIsTransferCorrection(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#D69B42] bg-white dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D]"
                />
                <span>تصحيح خطأ إدخال (تحويل سجلات الدرجات الحالية للصف الجديد)</span>
              </label>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1 pr-6">
                فعّل هذا الخيار فقط إذا كان الطالب قد سُجِّل بالخطأ في صف غير صفه الحقيقي، وتريد تصحيح درجة السجل الحالية وتغيير صفها للصف المستهدف.
              </p>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setTransferringStudent(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
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
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] shadow-2xl p-6 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 w-11 h-11 rounded-xl bg-[#E8EFFF] dark:bg-[#263B63] border border-[#D3DFFF] dark:border-[#3B4D78] text-[#3156C9] dark:text-[#8DB5FF] flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1E293B] dark:text-[#E2E8F0]">استيراد الطلاب من ملف Excel</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                    قالب موحّد لكل الصفوف والشعب؛ يحدد البرنامج موقع كل طالب تلقائياً من ملف Excel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Choose year; classes and sections are assigned from each Excel row. */}
            <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col gap-2.5">
              <span className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3156C9] text-white font-black flex items-center justify-center text-[10px]">١</span>
                <span>حدد العام الدراسي فقط؛ الصف والشعبة سيُحددان تلقائياً من بيانات كل طالب.</span>
              </span>
              <div className="mt-1 max-w-sm">
                <label className="block text-[11px] text-[#64748B] dark:text-[#8493A8] mb-1">العام الدراسي</label>
                <div className="relative">
                  <select
                    value={importYearId}
                    onChange={(e) => setImportYearId(e.target.value)}
                    className="w-full h-9 px-2.5 pr-2.5 pl-7 text-xs bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] font-bold appearance-none cursor-pointer focus:border-[#3976DB] focus:ring-2 focus:ring-[#3976DB]/15 focus:outline-none transition"
                  >
                    {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B] dark:text-[#8493A8] absolute left-2 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Step 2: File Picker */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#3156C9] text-white font-black flex items-center justify-center text-[10px]">
                    ٢
                  </span>
                  <span>اختيار ملف Excel (.xlsx أو .xls):</span>
                </span>
                <button
                  type="button"
                  onClick={downloadStudentTemplate}
                  className="text-xs text-[#3156C9] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل القالب الرسمي الفارغ</span>
                </button>
              </span>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5] bg-[#F8FAFC] dark:bg-[#202E40] hover:bg-[#3156C9]/5 dark:hover:bg-[#2785F5]/10 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-[#EDF1F7] dark:bg-[#26364B] group-hover:bg-[#3156C9]/12 dark:group-hover:bg-[#2785F5]/20 flex items-center justify-center text-[#64748B] dark:text-[#8493A8] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] mb-2 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                  {importedFileName ? importedFileName : 'انقر لاختيار ملف Excel من جهازك'}
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">
                  يدعم أعمدة: اسم الطالب، الصف، الشعبة (إن وجدت)، رقم القيد، رقم هاتف الأب
                </p>
              </div>
            </div>

            {/* Loading state */}
            {isParsingExcel && (
              <div className="text-center py-6 text-sm text-[#475569] dark:text-[#A8B5C7] flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
                <span>جاري قراءة الملف والتحقق من الأسماء وأرقام القيد...</span>
              </div>
            )}

            {/* Step 3: Analysis & Preview Results */}
            {parseResult && (
              <div className="flex flex-col gap-3">
                {/* Parse Error on File level */}
                {!parseResult.success ? (
                  <div className="bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] p-4 rounded-xl text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{parseResult.errorMessage}</span>
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-3 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] text-center">
                        <span className="text-[11px] text-[#64748B] dark:text-[#8493A8]">إجمالي السجلات</span>
                        <div className="text-base font-black text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums mt-0.5">
                          {parseResult.totalRows}
                        </div>
                      </div>

                      <div className="bg-[#10B981]/12 dark:bg-[#10B981]/15 p-3 rounded-lg border border-[#10B981]/30 text-center">
                        <span className="text-[11px] text-[#059669] dark:text-[#10B981]">صالحة للاستيراد</span>
                        <div className="text-base font-black text-[#059669] dark:text-[#10B981] font-mono tabular-nums mt-0.5">
                          {parseResult.validRows.length}
                        </div>
                      </div>

                      <div className="bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 p-3 rounded-lg border border-[#E35D6A]/30 text-center">
                        <span className="text-[11px] text-[#C83D4B] dark:text-[#E35D6A]">مرفوضة لوجود أخطاء</span>
                        <div className="text-base font-black text-[#C83D4B] dark:text-[#E35D6A] font-mono tabular-nums mt-0.5">
                          {parseResult.invalidRows.length}
                        </div>
                      </div>
                    </div>

                    {/* Rejected Rows Alerts */}
                    {parseResult.invalidRows.length > 0 && (
                      <div className="bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 p-3.5 rounded-xl text-xs flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-[#C83D4B] dark:text-[#E35D6A] font-bold mb-1">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            تم رصد أخطاء في {parseResult.invalidRows.length} سجل (لن يتم استيرادها لمنع التكرار
                            أو الأخطاء):
                          </span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-[#C83D4B] dark:text-[#E35D6A] font-medium">
                          {parseResult.invalidRows.slice(0, 5).map((row, i) => (
                            <li key={i}>
                              صف Excel {row.rowNumber}: {row.name || '«بدون اسم»'} —{' '}
                              {row.errors.join('، ')}
                            </li>
                          ))}
                          {parseResult.invalidRows.length > 5 && (
                            <li className="text-[#64748B] dark:text-[#8493A8]">
                              ... بالإضافة إلى {parseResult.invalidRows.length - 5} سجل آخر يحتوي على أخطاء.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Preview Table of Valid Rows */}
                    {parseResult.validRows.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">
                          معاينة الطلاب الجاهزين للاستيراد (<span className="font-mono tabular-nums">{parseResult.validRows.length}</span> طالب):
                        </span>
                        <div className="max-h-44 overflow-y-auto border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg">
                          <table className="w-full text-xs text-right border-collapse">
                            <thead className="bg-[#EDF1F7] dark:bg-[#26364B] sticky top-0 border-b border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7]">
                              <tr>
                                <th className="p-2 w-10 text-center">#</th>
                                <th className="p-2">اسم الطالب</th>
                                <th className="p-2 w-28">الصف</th>
                                <th className="p-2 w-20">الشعبة</th>
                                <th className="p-2 w-28">رقم القيد</th>
                                <th className="p-2 w-32">هاتف الأب</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#DCE3ED] dark:divide-[#2D3B4D] bg-white dark:bg-[#1C2939]">
                              {parseResult.validRows.map((r, i) => (
                                <tr key={i} className="hover:bg-[#F8FAFC] dark:hover:bg-[#202E40]">
                                  <td className="p-2 text-center text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums">{i + 1}</td>
                                  <td className="p-2 font-bold text-[#1E293B] dark:text-[#E2E8F0]">{r.name}</td>
                                  <td className="p-2 text-[#475569] dark:text-[#A8B5C7]">{r.className}</td>
                                  <td className="p-2 text-[#475569] dark:text-[#A8B5C7]">{r.sectionName || '—'}</td>
                                  <td className="p-2 font-mono tabular-nums text-[#B45309] dark:text-[#D69B42]">
                                    {r.registrationNumber || '—'}
                                  </td>
                                  <td className="p-2 font-mono tabular-nums text-[#475569] dark:text-[#A8B5C7]">
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
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchImport}
                disabled={!parseResult || parseResult.validRows.length === 0}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
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

      {/* =========================================================================
          MODAL 5: DELETE STUDENT CONFIRMATION
          ========================================================================= */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] shadow-2xl p-6 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1E293B] dark:text-[#E2E8F0]">تأكيد حذف الطالب</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">إجراء نهائي لا يمكن التراجع عنه</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setDeletingStudent(null)}
                disabled={isDeleting}
                className="p-2 text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] rounded-lg cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 p-4 rounded-xl text-xs flex flex-col gap-2.5 text-[#C83D4B] dark:text-[#E35D6A]">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                  هل أنت متأكد من رغبتك في حذف الطالب <strong className="underline font-bold px-1">{deletingStudent.name}</strong>؟
                </div>
              </div>
              <div className="text-[11px] text-[#C83D4B] dark:text-[#E35D6A] bg-white/80 dark:bg-[#202E40] p-2.5 rounded-lg border border-[#E35D6A]/30 leading-normal">
                ⚠️ <strong>تنبيه هام:</strong> سيؤدي تأكيد الحذف إلى مسح سجل الطالب وجميع درجاته المحفوظة في كافة المواد والمراحل، والقرارات الوزارية المرتبطة به نهائياً من قاعدة البيانات.
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#C83D4B] hover:bg-[#B02E3C] text-white shadow-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =========================================================================
          MODAL 6: BULK DELETE CONFIRMATION
          ========================================================================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#1C2939] border border-[#E35D6A]/40 rounded-[16px] shadow-2xl p-6 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-4">
            <div className="flex items-center gap-3 text-[#C83D4B] dark:text-[#E35D6A] border-b border-[#DCE3ED] dark:border-[#2D3B4D] pb-3">
              <div className="p-2 rounded-lg bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#1E293B] dark:text-[#E2E8F0]">تأكيد الحذف الجماعي</h3>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                هل أنت متأكد من رغبتك في حذف <span className="text-[#C83D4B] dark:text-[#E35D6A] underline font-mono tabular-nums">{selectedStudentIds.length}</span> طلاب دفعة واحدة؟
              </p>
              <div className="p-3 bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 rounded-xl space-y-2">
                <p className="text-xs text-[#C83D4B] dark:text-[#E35D6A] leading-relaxed font-bold">
                  تحذير نهائي: هذا الإجراء سيؤدي إلى مسح الطلاب المحددّين وكافة سجلات درجاتهم وتقاريرهم من قاعدة البيانات بصورة نهائية ولا يمكن التراجع عن ذلك.
                </p>
              </div>
              
              {isBulkDeleting && (
                <div className="flex items-center gap-2 text-xs text-[#B45309] dark:text-[#D69B42] font-bold">
                  <div className="w-4 h-4 border-2 border-[#B45309] dark:border-[#D69B42] border-t-transparent rounded-full animate-spin" />
                  جاري معالجة الحذف الجماعي... يرجى الانتظار
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
                className="px-6 py-2 text-xs font-black rounded-xl bg-[#C83D4B] hover:bg-[#B02E3C] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isBulkDeleting ? 'جاري الحذف...' : 'نعم، احذف الكل نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
