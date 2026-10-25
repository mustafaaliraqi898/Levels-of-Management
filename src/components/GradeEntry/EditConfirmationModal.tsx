import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface EditConfirmationModalProps {
  isOpen: boolean;
  studentName: string;
  fieldArabic: string;
  currentValue: number | null;
  newValue: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const EditConfirmationModal: React.FC<EditConfirmationModalProps> = ({
  isOpen,
  studentName,
  fieldArabic,
  currentValue,
  newValue,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-300">
              تنبيه حماية وتعديل الدرجات السابقة
            </h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              أنت على وشك تعديل <span className="font-bold text-amber-200">«{fieldArabic}»</span> للطالب <span className="font-bold text-white underline decoration-amber-400 decoration-2">«{studentName}»</span>.
            </p>
            <p className="text-amber-400/90 mt-1.5 text-xs font-semibold">
              ⚠️ قد يؤثر هذا التعديل على درجة السعي السنوي والدرجة النهائية المحسوبة للطالب. هل تريد المتابعة؟
            </p>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between text-sm">
          <div className="flex flex-col">
            <span className="text-slate-400 text-xs">الدرجة الحالية:</span>
            <span className="font-mono text-base font-bold text-slate-200">
              {currentValue !== null ? currentValue : 'غير مدخلة'}
            </span>
          </div>
          <div className="text-slate-500 text-lg">←</div>
          <div className="flex flex-col text-left">
            <span className="text-slate-400 text-xs">الدرجة الجديدة:</span>
            <span className="font-mono text-base font-bold text-emerald-400">
              {newValue !== null ? newValue : 'حذف (فارغة)'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            تأكيد التعديل
          </button>
        </div>
      </div>
    </div>
  );
};
