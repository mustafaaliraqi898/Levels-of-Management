import React, { useState, useRef } from 'react';
import {
  Student,
  AppSettings,
  CertificateTemplateConfig,
} from '../../types';
import { CertificateCanvas } from '../CertificateTemplate/CertificateCanvas';
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Check,
  Award,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface ExportCertificatesPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleStudents: Student[];
  initialSelectedStudentIds: string[];
  settings: AppSettings;
  templateConfig: CertificateTemplateConfig;
  academicYearName: string;
  classNameStr: string;
  sectionNameStr: string;
}

import { db } from '../../services/storage';

export const ExportCertificatesPdfModal: React.FC<ExportCertificatesPdfModalProps> = ({
  isOpen,
  onClose,
  eligibleStudents,
  initialSelectedStudentIds,
  settings,
  templateConfig: initialTemplateConfig,
  academicYearName,
  classNameStr,
  sectionNameStr,
}) => {
  // Selected student IDs for export
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return initialSelectedStudentIds.length > 0
      ? initialSelectedStudentIds
      : eligibleStudents.map((s) => s.id);
  });

  // Target file name
  const defaultFileName = `شهادات_الإعفاء_العام_${classNameStr.replace(/\s+/g, '_')}_شعبة_${sectionNameStr.replace(/\s+/g, '_')}.pdf`;
  const [fileName, setFileName] = useState<string>(defaultFileName);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Dedicated DOM area used only for native browser printing.
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [printConfig, setPrintConfig] = useState<CertificateTemplateConfig>(
    () => db.getCertificateTemplate() || initialTemplateConfig
  );

  if (!isOpen) return null;

  const selectedStudents = eligibleStudents.filter((s) =>
    selectedIds.includes(s.id)
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === eligibleStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleStudents.map((s) => s.id));
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Use the browser's native print layout instead of rasterizing each page to JPEG.
  const handleExportPdf = async () => {
    if (selectedStudents.length === 0) {
      setErrorMessage('يرجى تحديد طالب واحد على الأقل لتصدير شهاداته.');
      return;
    }
    setErrorMessage(null);
    setIsGenerating(true);
    setIsFinished(false);
    try {
      const currentConfig: CertificateTemplateConfig = db.getCertificateTemplate();
      setPrintConfig(currentConfig);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const printArea = printAreaRef.current;
      if (!printArea) throw new Error('تعذر العثور على منطقة الطباعة الخاصة بالشهادات.');
      for (const student of selectedStudents) {
        const textElements = [
          { element: currentConfig.elements.studentName, text: student.name },
          { element: currentConfig.elements.academicYear, text: academicYearName },
          { element: currentConfig.elements.directorName, text: settings.directorName || 'إدارة المدرسة' },
        ];
        for (const item of textElements) {
          if (!item.element || !item.element.visible) continue;
          const family = item.element.fontFamily || 'Cairo';
          const weight = item.element.fontWeight === 'black' ? '900' : item.element.fontWeight === 'bold' ? '700' : '400';
          const size = item.element.fontSize || 24;
          const fontSpec = `${weight} ${size}px "${family}"`;
          if (document.fonts?.load) await document.fonts.load(fontSpec, item.text);
          if (document.fonts?.check && !document.fonts.check(fontSpec, item.text)) {
            throw new Error(`تعذر تحميل الخط "${family}" بالنمط المطلوب لشهادة الطالب «${student.name}». تحقق من اتصال الإنترنت ثم أعد المحاولة.`);
          }
        }
      }
      if (document.fonts?.ready) await document.fonts.ready;
      const images = Array.from(printArea.querySelectorAll('img'));
      await Promise.all(images.map(async (img) => {
        if (!img.complete) await new Promise<void>((resolve) => {
          const finish = () => resolve();
          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          if (img.complete) finish();
        });
        if (img.naturalWidth === 0) throw new Error('تعذر تحميل صورة قالب الشهادة. أعد رفع صورة القالب أو اختر قالباً صالحاً ثم حاول مجدداً.');
        if (typeof img.decode === 'function') {
          try { await img.decode(); } catch { if (img.naturalWidth === 0) throw new Error('تعذر تجهيز صورة قالب الشهادة للطباعة.'); }
        }
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const previousTitle = document.title;
      document.title = (fileName.trim() || defaultFileName).replace(/\.pdf$/i, '');
      const restoreTitle = () => { document.title = previousTitle; window.removeEventListener('afterprint', restoreTitle); };
      window.addEventListener('afterprint', restoreTitle, { once: true });
      window.print();
      restoreTitle();
      setIsFinished(true);
    } catch (err) {
      console.error('Native certificate printing failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء تجهيز الشهادات للطباعة.');
    } finally { setIsGenerating(false); }
  };

  return (
    <>
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm select-none"
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Award className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                تصدير شهادات الإعفاء العام بصيغة PDF
              </h2>
              <p className="text-xs text-slate-400">
                إنشاء ملف PDF موحد متعدد الصفحات بحجم A4 أفقي لجميع الطلبة المحددين
              </p>
            </div>
          </div>

          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-amber-300 font-bold block">
                ملخص بيانات التصدير:
              </span>
              <span className="text-xs text-slate-300">
                {classNameStr} • شعبة {sectionNameStr} • العام: {academicYearName}
              </span>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-slate-400 block">الشهادات المحددة</span>
              <span className="text-lg font-black font-mono text-amber-400">
                {selectedStudents.length} / {eligibleStudents.length}
              </span>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Notice */}
          {isFinished && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                انتهت نافذة الطباعة. تأكد من اختيار «حفظ بتنسيق PDF» وحفظ الملف من نافذة المتصفح.
              </span>
            </div>
          )}

          {/* Native print preparation status */}
          {isGenerating && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3">
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>جاري تجهيز الشهادات للطباعة...</span>
              </div>
              <div className="text-xs text-white font-bold pr-6">
                سيتم تجهيز صفحة مستقلة لكل طالب محدد مع الحفاظ على مواضع الخطوط وأحجامها.
              </div>
              <span className="text-[11px] text-slate-400 block text-center">
                ستفتح نافذة الطباعة؛ اختر «حفظ بتنسيق PDF» واترك الاتجاه أفقياً وحجم الورق A4.
              </span>
            </div>
          )}

          {/* PDF File Name Input Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              اسم ملف الـ PDF المراد حفظه:
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={isGenerating}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full h-10 px-3 pr-9 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:border-amber-500 focus:outline-hidden font-mono"
                placeholder="اسم_الملف.pdf"
              />
              <FileText className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              سيُقترح اسم الملف في نافذة الطباعة؛ اختر «حفظ بتنسيق PDF» لتحديد مكان الحفظ.
            </span>
          </div>

          {/* Student Selector List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>اختر الطلاب المراد إنشاء شهادات لهم:</span>
              </label>

              <button
                type="button"
                disabled={isGenerating}
                onClick={toggleSelectAll}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer disabled:opacity-50"
              >
                {selectedIds.length === eligibleStudents.length
                  ? 'إلغاء تحديد الكل'
                  : 'تحديد جميع الطلاب'}
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 divide-y divide-slate-800/60">
              {eligibleStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  لا يوجد طلاب معفون عاماً في هذا الصف والشعبة حالياً.
                </div>
              ) : (
                eligibleStudents.map((student, idx) => {
                  const isChecked = selectedIds.includes(student.id);

                  return (
                    <label
                      key={student.id}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-slate-800/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={isGenerating}
                          checked={isChecked}
                          onChange={() => toggleStudent(student.id)}
                          className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {idx + 1}. {student.name}
                          </span>
                          {student.registrationNumber && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              رقم القيد: {student.registrationNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        معفى عام
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {selectedStudents.length > 0 ? (
              <span>
                سيتم إنشاء ملف PDF بعدد{' '}
                <strong className="text-white font-bold">{selectedStudents.length}</strong>{' '}
                صفحة (شهادة لكل طالب).
              </span>
            ) : (
              <span className="text-rose-400 font-bold">لم يتم تحديد أي طالب.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={isGenerating}
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={isGenerating || selectedStudents.length === 0}
              onClick={handleExportPdf}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء الملف...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تصدير الشهادات PDF ({selectedStudents.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
    <style>{`
      .exemption-cert-print-root { display: none; }
      @media print {
        @page { size: A4 landscape; margin: 0; }
        html, body { width:297mm!important; height:auto!important; margin:0!important; padding:0!important; background:#fff!important; overflow:visible!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
        body * { visibility:hidden!important; }
        .exemption-cert-print-root, .exemption-cert-print-root * { visibility:visible!important; }
        .exemption-cert-print-root { display:block!important; position:absolute!important; top:0!important; left:0!important; width:297mm!important; margin:0!important; padding:0!important; background:#fff!important; z-index:2147483647!important; }
        .exemption-cert-print-page { display:block!important; position:relative!important; width:297mm!important; height:210mm!important; margin:0!important; padding:0!important; overflow:hidden!important; background:#fff!important; break-after:page!important; page-break-after:always!important; }
        .exemption-cert-print-page:last-child { break-after:auto!important; page-break-after:auto!important; }
        .exemption-cert-print-page .certificate-canvas-wrapper { display:block!important; position:relative!important; width:297mm!important; max-width:none!important; height:210mm!important; aspect-ratio:auto!important; overflow:hidden!important; margin:0!important; padding:0!important; }
        .exemption-cert-print-page .certificate-canvas-base { position:absolute!important; top:0!important; left:0!important; width:1123px!important; height:794px!important; transform:none!important; transform-origin:top left!important; }
      }
    `}</style>
    <div ref={printAreaRef} className="exemption-cert-print-root" aria-hidden="true" dir="rtl">
      {selectedStudents.map((student) => (
        <div key={student.id} className="exemption-cert-print-page">
          <CertificateCanvas config={printConfig} settings={settings} studentName={student.name} academicYear={academicYearName} directorName={settings.directorName || 'إدارة المدرسة'} isForPrint={true} fixedScale={true} style={{ width: '297mm', height: '210mm' }} />
        </div>
      ))}
    </div>
    </>
  );
};