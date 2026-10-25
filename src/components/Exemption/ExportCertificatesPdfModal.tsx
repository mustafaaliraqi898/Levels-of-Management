import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [currentStudentName, setCurrentStudentName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Hidden container ref for rendering each certificate for html2canvas
  const hiddenRenderContainerRef = useRef<HTMLDivElement>(null);
  const [renderStudent, setRenderStudent] = useState<Student | null>(null);

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

  // Execute multi-page PDF generation
  const handleExportPdf = async () => {
    if (selectedStudents.length === 0) {
      setErrorMessage('يرجى تحديد طالب واحد على الأقل لتصدير شهاداته.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setIsFinished(false);
    setProgressIndex(0);

    try {
      // 0. Fetch the absolute latest template configuration from DB to avoid stale props
      const currentConfig: CertificateTemplateConfig = db.getCertificateTemplate();

      // 1. Initialize A4 Landscape PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      // 2. Iterate through each selected student, rendering to canvas
      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        setProgressIndex(i + 1);
        setCurrentStudentName(student.name);
        setRenderStudent(student);

        // A. Wait for React state update & DOM element rendering in container
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

        if (!hiddenRenderContainerRef.current) {
          throw new Error('تعذر العثور على حاوية إنشاء الشهادة.');
        }

        // B. Load and verify required fonts AFTER student element is rendered in DOM
        const textElements = [
          { el: currentConfig.elements.studentName, text: student.name },
          { el: currentConfig.elements.academicYear, text: academicYearName },
          { el: currentConfig.elements.directorName, text: settings.directorName || 'إدارة المدرسة' },
        ];

        for (const item of textElements) {
          if (!item.el || !item.el.visible) continue;
          const family = item.el.fontFamily || 'Cairo';
          const weight =
            item.el.fontWeight === 'black'
              ? '900'
              : item.el.fontWeight === 'bold'
              ? '700'
              : '400';
          const size = item.el.fontSize || 24;
          const fontSpec = `${weight} ${size}px "${family}"`;

          try {
            if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
              await document.fonts.load(fontSpec, item.text);
              await document.fonts.load(fontSpec);
            }
          } catch (e) {
            console.warn(`Font spec preloading error for ${fontSpec}:`, e);
          }

          // Verify font availability before capturing canvas
          if (typeof document !== 'undefined' && document.fonts && document.fonts.check) {
            const isLoaded = document.fonts.check(fontSpec, item.text);
            if (!isLoaded) {
              throw new Error(
                `تعذر تحميل خط النص المطلوب "${family}" بالوزن المحدد (${weight}) لإصدار شهادة الطالب «${student.name}». يرجى التثبت من الاتصال بالإنترنت لضمان عدم التصدير بخط بديل.`
              );
            }
          }
        }

        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        // C. Wait for all images inside container to finish loading and decode
        const containerImgs = Array.from(
          hiddenRenderContainerRef.current.querySelectorAll('img')
        );
        await Promise.all(
          containerImgs.map(async (img) => {
            if (!img.complete || img.naturalWidth === 0) {
              await new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              });
            }
            if ('decode' in img && typeof img.decode === 'function') {
              try {
                await img.decode();
              } catch {
                // ignore decode failure if image is already rendered
              }
            }
          })
        );

        // Extra stabilization tick before canvas capture
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));

        // D. Render with html2canvas at scale 2 for crisp vector-like text and images
        const canvas = await html2canvas(hiddenRenderContainerRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1123,
          windowHeight: 794,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.94);

        // If not first page, add a new A4 Landscape page
        if (i > 0) {
          pdf.addPage('a4', 'landscape');
        }

        // Add edge-to-edge on 297mm x 210mm A4
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
      }

      // 3. Save with custom file name
      const sanitizedName = fileName.trim().endsWith('.pdf')
        ? fileName.trim()
        : `${fileName.trim()}.pdf`;

      pdf.save(sanitizedName);
      setIsFinished(true);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء إنشاء ملف PDF.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm select-none"
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
                تم بنجاح تصدير وحفظ ملف الشهادات بصيغة PDF بعدد ({selectedStudents.length}) صفحة مستقلة!
              </span>
            </div>
          )}

          {/* Generation Progress Display */}
          {isGenerating && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>
                    جاري تجهيز الشهادة ({progressIndex} من {selectedStudents.length}):
                  </span>
                </div>
                <span className="font-mono text-indigo-400 font-bold">
                  {Math.round((progressIndex / selectedStudents.length) * 100)}%
                </span>
              </div>

              <div className="text-xs text-white font-bold pr-6">
                «{currentStudentName}»
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-200 rounded-full"
                  style={{
                    width: `${(progressIndex / selectedStudents.length) * 100}%`,
                  }}
                />
              </div>

              <span className="text-[11px] text-slate-400 block text-center">
                يتم دمج الشهادات في ملف PDF واحد عالي الدقة بحجم A4 أفقي...
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
              سيتم حفظ الملف في المكان الذي تحدده على جهازك بعد الضغط على زر التصدير.
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

        {/* Offscreen / Hidden Canvas Render Container for html2canvas */}
        {/* Rendered at fixed 1123px x 794px (exact A4 landscape ratio) */}
        <div
          style={{
            position: 'fixed',
            left: '0px',
            top: '0px',
            width: '1123px',
            height: '794px',
            overflow: 'hidden',
            pointerEvents: 'none',
            opacity: 0.001,
            zIndex: -9999,
          }}
        >
          <div ref={hiddenRenderContainerRef} style={{ width: '1123px', height: '794px' }}>
            {renderStudent && (
              <CertificateCanvas
                config={db.getCertificateTemplate()}
                settings={settings}
                studentName={renderStudent.name}
                academicYear={academicYearName}
                directorName={settings.directorName || 'إدارة المدرسة'}
                isForPrint={true}
                fixedScale={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
