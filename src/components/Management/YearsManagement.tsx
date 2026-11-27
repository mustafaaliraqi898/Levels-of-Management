import React, { useState, useMemo } from 'react';
import { AcademicYear } from '../../types';
import { db } from '../../services/storage';
import {
  Calendar,
  Plus,
  CheckCircle,
  Star,
  Edit3,
  Trash2,
  AlertTriangle,
  Check,
  X,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface YearsManagementProps {
  years: AcademicYear[];
}

export const YearsManagement: React.FC<YearsManagementProps> = ({ years }) => {
  // Add Year Form State
  const [newYearName, setNewYearName] = useState('');
  const [isNewCurrent, setIsNewCurrent] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Year Modal State
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editYearName, setEditYearName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Year Modal State
  const [deletingYear, setDeletingYear] = useState<AcademicYear | null>(null);

  // Handle Add Academic Year
  const handleAddYear = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const trimmed = newYearName.trim();
    if (!trimmed) {
      setAddError('يرجى كتابة اسم العام الدراسي.');
      return;
    }

    const res = db.addAcademicYear({
      name: trimmed,
      isCurrent: isNewCurrent,
    });

    if (!res.success) {
      setAddError(res.message || 'تعذر إضافة العام الدراسي.');
      return;
    }

    setNewYearName('');
    setIsNewCurrent(false);
    setAddError(null);
  };

  // Set Current Active Year
  const handleSetCurrent = (id: string) => {
    db.setCurrentYear(id);
  };

  // Open Edit Modal
  const openEditModal = (year: AcademicYear) => {
    setEditingYear(year);
    setEditYearName(year.name);
    setEditError(null);
  };

  // Handle Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYear) return;
    setEditError(null);

    const trimmed = editYearName.trim();
    if (!trimmed) {
      setEditError('يرجى إدخال اسم العام الدراسي.');
      return;
    }

    const res = db.updateAcademicYear(editingYear.id, trimmed);
    if (!res.success) {
      setEditError(res.message || 'تعذر حفظ التعديلات.');
      return;
    }

    setEditingYear(null);
  };

  // Open Delete Modal
  const openDeleteModal = (year: AcademicYear) => {
    setDeletingYear(year);
  };

  // Compute Delete Verification Details
  const deletingYearDetails = useMemo(() => {
    if (!deletingYear) return null;
    const check = db.canDeleteAcademicYear(deletingYear.id);
    return {
      year: deletingYear,
      canDelete: check.canDelete,
      reason: check.reason,
      counts: check.counts,
    };
  }, [deletingYear]);

  // Handle Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingYear) return;
    const res = db.deleteAcademicYear(deletingYear.id);
    if (res.success) {
      setDeletingYear(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12" dir="rtl">
      {/* 1. Header Bar */}
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 app-card-surface">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex flex-wrap items-center gap-2.5">
            <span className="p-2 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/20 dark:border-[#2785F5]/30">
              <Calendar className="w-5 h-5" />
            </span>
            <span>إدارة الأعوام الدراسية</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30 font-bold font-mono tabular-nums">
              {years.length} أعوام مسجلة
            </span>
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1.5">
            إضافة الأعوام الدراسية، تعديل أسمائها، حذف الأعوام الفارغة، وتعيين العام الدراسي الفعّال لضبط سجلات الدرجات تلقائياً.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2. Add Year Form */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs h-fit app-card-surface">
          <h3 className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
            <span>إضافة عام دراسي جديد</span>
          </h3>

          {addError && (
            <div className="mb-4 p-3 rounded-[10px] bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-xs text-[#C83D4B] dark:text-[#E35D6A] flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <form onSubmit={handleAddYear} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                اسم أو رقم العام الدراسي
              </label>
              <input
                type="text"
                value={newYearName}
                onChange={(e) => {
                  setNewYearName(e.target.value);
                  if (addError) setAddError(null);
                }}
                placeholder="مثال: 2027–2028"
                className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] placeholder:text-[#64748B] dark:placeholder:text-[#8493A8] font-mono tabular-nums focus:border-[#2785F5] focus:outline-hidden"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrent"
                checked={isNewCurrent}
                onChange={(e) => setIsNewCurrent(e.target.checked)}
                className="w-4 h-4 rounded accent-[#3156C9] dark:accent-[#2785F5] cursor-pointer"
              />
              <label htmlFor="isCurrent" className="text-xs text-[#475569] dark:text-[#A8B5C7] font-medium cursor-pointer">
                تعيين كعام دراسي نشط حالياً
              </label>
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-[8px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة العام الدراسي</span>
            </button>
          </form>
        </div>

        {/* 3. Existing Years List */}
        <div className="md:col-span-2 bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-5 shadow-xs app-card-surface">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
            <h3 className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              قائمة الأعوام المسجلة في قاعدة البيانات
            </h3>
            <span className="text-xs text-[#64748B] dark:text-[#8493A8] font-mono tabular-nums">
              إجمالي: {years.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {years.map((year) => (
              <div
                key={year.id}
                className={`p-4 rounded-[12px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  year.isCurrent
                    ? 'bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border-[#3156C9] dark:border-[#2785F5] shadow-xs'
                    : 'bg-[#F8FAFC] dark:bg-[#202E40] border-[#DCE3ED] dark:border-[#2D3B4D]'
                }`}
              >
                {/* Year Details */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-[10px] flex items-center justify-center font-bold shrink-0 ${
                      year.isCurrent
                        ? 'bg-[#3156C9]/15 dark:bg-[#2785F5]/20 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/30 dark:border-[#2785F5]/40'
                        : 'bg-white dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border border-[#DCE3ED] dark:border-[#2D3B4D]'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums">
                        {year.name}
                      </h4>
                      {year.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#10B981]/12 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                          العام الحالي
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#64748B] dark:text-[#8493A8]">
                      {year.isCurrent ? 'العام الدراسي المعتمد حالياً للرصد والتقارير' : 'عام سابق أو مؤرشف'}
                    </span>
                  </div>
                </div>

                {/* Actions & Status Controls */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  {year.isCurrent ? (
                    <span className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[#10B981]/12 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      نشط حالياً
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetCurrent(year.id)}
                      className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors cursor-pointer flex items-center gap-1.5"
                      title={`تعيين (${year.name}) كعام دراسي نشط`}
                    >
                      <Star className="w-3.5 h-3.5 text-[#D69B42]" />
                      <span>جعله العام الحالي</span>
                    </button>
                  )}

                  {/* Edit Action Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(year)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-[8px] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5]/50 bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#3156C9]/10 dark:hover:bg-[#2785F5]/15 text-[#475569] dark:text-[#A8B5C7] hover:text-[#3156C9] dark:hover:text-[#60A5FA] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={`تعديل اسم العام الدراسي (${year.name})`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                    <span className="hidden sm:inline">تعديل</span>
                  </button>

                  {/* Delete Action Button */}
                  <button
                    type="button"
                    onClick={() => openDeleteModal(year)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-[8px] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#E35D6A]/50 bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#E35D6A]/10 dark:hover:bg-[#E35D6A]/15 text-[#475569] dark:text-[#A8B5C7] hover:text-[#C83D4B] dark:hover:text-[#E35D6A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={`حذف العام الدراسي (${year.name})`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#C83D4B] dark:text-[#E35D6A]" />
                    <span className="hidden sm:inline">حذف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL 1: Edit Academic Year */}
      {editingYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">تعديل العام الدراسي</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">تحديث اسم العام الدراسي المسجل في النظام</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingYear(null)}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer p-1.5 rounded-[8px] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-[10px] bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-xs text-[#C83D4B] dark:text-[#E35D6A] flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">
                  اسم أو رقم العام الدراسي
                </label>
                <input
                  type="text"
                  value={editYearName}
                  onChange={(e) => {
                    setEditYearName(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums focus:border-[#2785F5] focus:outline-hidden"
                  placeholder="مثال: 2026–2027"
                  required
                  autoFocus
                />
              </div>

              <div className="p-3 rounded-[10px] bg-[#3156C9]/8 dark:bg-[#2785F5]/10 border border-[#3156C9]/25 dark:border-[#2785F5]/25 text-[11px] text-[#475569] dark:text-[#A8B5C7] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                <span>
                  يتم تحديث اسم العام الدراسي مع الحفاظ على جميع الطلاب والشعب والمواد والدرجات المرتبطة به بأمان تام دون أي تغيير في معرف العام.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                <button
                  type="button"
                  onClick={() => setEditingYear(null)}
                  className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-[8px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Delete Academic Year */}
      {deletingYear && deletingYearDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-[10px] border ${
                    deletingYearDetails.canDelete
                      ? 'bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 text-[#C83D4B] dark:text-[#E35D6A] border-[#E35D6A]/30'
                      : 'bg-[#D69B42]/10 dark:bg-[#D69B42]/15 text-[#B45309] dark:text-[#D69B42] border-[#D69B42]/30'
                  }`}
                >
                  {deletingYearDetails.canDelete ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                    {deletingYearDetails.canDelete
                      ? 'تأكيد حذف العام الدراسي'
                      : 'تعذر حذف العام الدراسي'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
                    العام الدراسي:{' '}
                    <span className="font-mono tabular-nums font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                      {deletingYear.name}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingYear(null)}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer p-1.5 rounded-[8px] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!deletingYearDetails.canDelete && (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 rounded-[10px] bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">تنبيه حماية السجلات والدرجات:</span>
                    <span>{deletingYearDetails.reason}</span>
                  </div>
                </div>

                {(deletingYearDetails.counts.students > 0 || deletingYearDetails.counts.grades > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-[10px] bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-between">
                      <span className="text-[#64748B] dark:text-[#8493A8]">الطلاب المسجلون:</span>
                      <span className="font-mono tabular-nums font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                        {deletingYearDetails.counts.students} طالب
                      </span>
                    </div>
                    <div className="p-2.5 rounded-[10px] bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-between">
                      <span className="text-[#64748B] dark:text-[#8493A8]">سجلات الدرجات:</span>
                      <span className="font-mono tabular-nums font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                        {deletingYearDetails.counts.grades} سجل
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <button
                    type="button"
                    onClick={() => setDeletingYear(null)}
                    className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer"
                  >
                    فهمت ذلك / إغلاق
                  </button>
                </div>
              </div>
            )}

            {deletingYearDetails.canDelete && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف العام الدراسي «
                  <strong className="text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums">{deletingYear.name}</strong>»؟
                </p>

                <div className="p-3 rounded-[10px] bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[11px] text-[#64748B] dark:text-[#8493A8] flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA] shrink-0" />
                  <span>
                    هذا العام الدراسي فارغ تماماً ولا يحتوي على أي طلاب أو سجلات درجات مرتبطة به.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <button
                    type="button"
                    onClick={() => setDeletingYear(null)}
                    className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#EDF1F7] dark:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 text-xs font-bold rounded-[8px] bg-[#C83D4B] hover:bg-[#B02E3C] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
