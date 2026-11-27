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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-700 dark:text-teal-400" />
            <span>إدارة الأعوام الدراسية</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 font-bold">
              {years.length} أعوام مسجلة
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إضافة الأعوام الدراسية، تعديل أسمائها، حذف الأعوام الفارغة، وتعيين العام الدراسي الفعّال لضبط سجلات الدرجات تلقائياً.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2. Add Year Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-lg h-fit">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>إضافة عام دراسي جديد</span>
          </h3>

          {addError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <form onSubmit={handleAddYear} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrent"
                checked={isNewCurrent}
                onChange={(e) => setIsNewCurrent(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600 dark:accent-emerald-400 cursor-pointer"
              />
              <label htmlFor="isCurrent" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                تعيين كعام دراسي نشط حالياً
              </label>
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة العام الدراسي</span>
            </button>
          </form>
        </div>

        {/* 3. Existing Years List */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              قائمة الأعوام المسجلة في قاعدة البيانات
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              إجمالي: {years.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {years.map((year) => (
              <div
                key={year.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  year.isCurrent
                    ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-600 dark:border-emerald-400 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Year Details */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                      year.isCurrent
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 font-mono">
                        {year.name}
                      </h4>
                      {year.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                          العام الحالي
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {year.isCurrent ? 'العام الدراسي المعتمد حالياً للرصد والتقارير' : 'عام سابق أو مؤرشف'}
                    </span>
                  </div>
                </div>

                {/* Actions & Status Controls */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  {year.isCurrent ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      نشط حالياً
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetCurrent(year.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                      title={`تعيين (${year.name}) كعام دراسي نشط`}
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>جعله العام الحالي</span>
                    </button>
                  )}

                  {/* Edit Action Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(year)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-500/15 text-slate-700 dark:text-slate-300 hover:text-teal-800 dark:hover:text-teal-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={`تعديل اسم العام الدراسي (${year.name})`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span className="hidden sm:inline">تعديل</span>
                  </button>

                  {/* Delete Action Button */}
                  <button
                    type="button"
                    onClick={() => openDeleteModal(year)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/40 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/15 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={`حذف العام الدراسي (${year.name})`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">تعديل العام الدراسي</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تحديث اسم العام الدراسي المسجل في النظام</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingYear(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم أو رقم العام الدراسي
                </label>
                <input
                  type="text"
                  value={editYearName}
                  onChange={(e) => {
                    setEditYearName(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:border-teal-600 dark:focus:border-teal-400 focus:outline-hidden"
                  placeholder="مثال: 2026–2027"
                  required
                  autoFocus
                />
              </div>

              <div className="p-3 rounded-lg bg-teal-50/70 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  يتم تحديث اسم العام الدراسي مع الحفاظ على جميع الطلاب والشعب والمواد والدرجات المرتبطة به بأمان تام دون أي تغيير في معرف العام.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingYear(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-400 dark:hover:bg-teal-300 dark:text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg border ${
                    deletingYearDetails.canDelete
                      ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                      : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                  }`}
                >
                  {deletingYearDetails.canDelete ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {deletingYearDetails.canDelete
                      ? 'تأكيد حذف العام الدراسي'
                      : 'تعذر حذف العام الدراسي'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    العام الدراسي:{' '}
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {deletingYear.name}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingYear(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!deletingYearDetails.canDelete && (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">تنبيه حماية السجلات والدرجات:</span>
                    <span>{deletingYearDetails.reason}</span>
                  </div>
                </div>

                {(deletingYearDetails.counts.students > 0 || deletingYearDetails.counts.grades > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">الطلاب المسجلون:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {deletingYearDetails.counts.students} طالب
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">سجلات الدرجات:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {deletingYearDetails.counts.grades} سجل
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeletingYear(null)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    فهمت ذلك / إغلاق
                  </button>
                </div>
              </div>
            )}

            {deletingYearDetails.canDelete && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف العام الدراسي «
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">{deletingYear.name}</strong>»؟
                </p>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>
                    هذا العام الدراسي فارغ تماماً ولا يحتوي على أي طلاب أو سجلات درجات مرتبطة به.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeletingYear(null)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
