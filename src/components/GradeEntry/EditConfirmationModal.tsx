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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111C2A]/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1C2939] border border-[#D69B42]/40 rounded-2xl shadow-2xl p-6 text-[#1E293B] dark:text-[#E2E8F0] flex flex-col gap-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#D69B42]/10 border border-[#D69B42]/30 rounded-xl text-[#B45309] dark:text-[#D69B42] shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#B45309] dark:text-[#D69B42]">
              تنبيه حماية وتعديل الدرجات السابقة
            </h3>
            <p className="text-[#475569] dark:text-[#A8B5C7] mt-2 text-sm leading-relaxed">
              أنت على وشك تعديل <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0]">«{fieldArabic}»</span> للطالب <span className="font-bold text-[#1E293B] dark:text-white underline decoration-[#D69B42] decoration-2">«{studentName}»</span>.
            </p>
            <p className="text-[#B45309] dark:text-[#D69B42] mt-1.5 text-xs font-semibold">
              قد يؤثر هذا التعديل على درجة السعي السنوي والدرجة النهائية المحسوبة للطالب. هل تريد المتابعة؟
            </p>
          </div>
        </div>

        <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-3.5 flex items-center justify-between text-sm">
          <div className="flex flex-col">
            <span className="text-[#64748B] dark:text-[#8493A8] text-xs">الدرجة الحالية:</span>
            <span className="font-mono tabular-nums text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              {currentValue !== null ? currentValue : 'غير مدخلة'}
            </span>
          </div>
          <div className="text-[#64748B] dark:text-[#8493A8] text-lg">←</div>
          <div className="flex flex-col text-left">
            <span className="text-[#64748B] dark:text-[#8493A8] text-xs">الدرجة الجديدة:</span>
            <span className="font-mono tabular-nums text-base font-bold text-[#059669] dark:text-[#10B981]">
              {newValue !== null ? newValue : 'حذف (فارغة)'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold rounded-xl bg-[#D69B42] hover:bg-[#B45309] text-white transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Check className="w-4 h-4" />
            تأكيد التعديل
          </button>
        </div>
      </div>
    </div>
  );
};
