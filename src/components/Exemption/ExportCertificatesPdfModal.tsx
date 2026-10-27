import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import {
  Student,
  AppSettings,
  CertificateTemplateConfig,
} from '../../types';
import { CertificateCanvas } from '../CertificateTemplate/CertificateCanvas';
import { db, buildGradeKey } from '../../services/storage';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Award,
  Loader2,
  Image as ImageIcon,
  Check,
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

export const ExportCertificatesPdfModal: React.FC<ExportCertificatesPdfModalProps> = ({
  isOpen,
  onClose,
  eligibleStudents,
  initialSelectedStudentIds,
  settings,
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
  const defaultBaseName = `شهادات_الإعفاء_${classNameStr.replace(/\s+/g, '_')}_${sectionNameStr ? `شعبة_${sectionNameStr.replace(/\s+/g, '_')}` : 'بدون_شعبة'}`;
  const [baseFileName, setBaseFileName] = useState<string>(defaultBaseName);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'pdf' | 'images' | null>(null);
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [currentStudentName, setCurrentStudentName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dedicated off-screen render container ref for html2canvas
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

  /** Computes the student's actual grades, total, and average to display on certificate */
  const getStudentGradesData = (student: Student) => {
    const state = db.getState();
    const classSubjects = state.subjects
      .filter((s) => s.classId === student.classId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let total = 0;
    let counted = 0;
    const subjectsList: { name: string; score: number | string; maxScore?: number }[] = [];

    classSubjects.forEach((sub) => {
      const key = buildGradeKey(
        student.academicYearId,
        student.classId,
        student.sectionId || '',
        sub.id,
        student.id
      );
      const rec = state.grades[key];
      const score = rec ? (rec.termYearlyScore ?? rec.finalScore) : null;
      if (score !== null && score !== undefined) {
        total += score;
        counted++;
        subjectsList.push({ name: sub.name, score, maxScore: sub.maxScore });
      } else {
        subjectsList.push({ name: sub.name, score: '—', maxScore: sub.maxScore });
      }
    });

    const avg = counted > 0 ? Math.round((total / counted) * 10) / 10 : null;

    return {
      subjects: subjectsList,
      total: counted > 0 ? total : '—',
      average: avg !== null ? `${avg}%` : '—',
      result: student.isGeneralExempt ? 'معفى عام' : 'ناجح بتفوق',
      status: 'متميز',
    };
  };

  /** Waits for DOM paint, web fonts, and container images to be completely ready */
  const waitForContainerReady = async (container: HTMLDivElement) => {
    // 1. Wait for React state change to reflect in DOM
    await new Promise((r) => setTimeout(r, 120));

    // 2. Wait for Arabic web fonts to be completely ready
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('Font loading wait warning:', e);
      }
    }

    // 3. Wait for all <img> elements in the container to load and decode
    const containerImgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      containerImgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          let resolved = false;
          const finish = () => {
            if (!resolved) {
              resolved = true;
              img.removeEventListener('load', finish);
              img.removeEventListener('error', finish);
              if (typeof img.decode === 'function') {
                img.decode().then(resolve).catch(resolve);
              } else {
                resolve();
              }
            }
          };
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
          setTimeout(finish, 1500); // 1.5s safety fallback
        });
      })
    );

    // 4. Final animation frame
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));
  };

  /** Captures a single student certificate to HTML5 Canvas */
  const renderStudentCanvas = async (student: Student) => {
    setRenderStudent(student);

    if (!hiddenRenderContainerRef.current) {
      throw new Error('تعذر العثور على حاوية تصيير الشهادة.');
    }

    const container = hiddenRenderContainerRef.current;
    await waitForContainerReady(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 1123,
      height: 794,
      windowWidth: 1123,
      windowHeight: 794,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error(`فشل تصيير شهادة الطالب «${student.name}».`);
    }

    return canvas;
  };

  /** Execute multi-page PDF generation */
  const handleExportPdf = async () => {
    if (selectedStudents.length === 0) {
      setErrorMessage('يرجى تحديد طالب واحد على الأقل لتصدير شهاداته.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGenerating(true);
    setExportMode('pdf');
    setProgressIndex(0);

    try {
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

        const canvas = await renderStudentCanvas(student);
        const imgData = canvas.toDataURL('image/jpeg', 0.96);

        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
      }

      // 3. Save PDF file
      const cleanName = baseFileName.trim().replace(/\.pdf$/i, '');
      const finalFileName = `${cleanName || 'شهادات_الإعفاء'}.pdf`;
      pdf.save(finalFileName);

      setSuccessMessage(
        `تم بنجاح تصدير ملف PDF موحد بعدد (${selectedStudents.length}) شهادة باسم «${finalFileName}».`
      );
    } catch (err) {
      console.error('PDF Generation failed:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء إنشاء وتصدير ملف PDF.'
      );
    } finally {
      setIsGenerating(false);
      setExportMode(null);
      setRenderStudent(null);
    }
  };

  /** Execute Image export (High-Resolution PNG) */
  const handleExportImages = async () => {
    if (selectedStudents.length === 0) {
      setErrorMessage('يرجى تحديد طالب واحد على الأقل لتصدير شهاداته.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGenerating(true);
    setExportMode('images');
    setProgressIndex(0);

    try {
      if (selectedStudents.length === 1) {
        // Single student: download PNG directly
        const student = selectedStudents[0];
        setProgressIndex(1);
        setCurrentStudentName(student.name);

        const canvas = await renderStudentCanvas(student);
        const pngUrl = canvas.toDataURL('image/png');

        const cleanStudentName = student.name.replace(/[\\/:*?"<>|]/g, '_');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `شهادة_الطالب_${cleanStudentName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSuccessMessage(`تم بنجاح تحميل صورة شهادة الطالب «${student.name}» بدقة عالية (PNG).`);
      } else {
        // Multiple students: package into a ZIP file
        const zip = new JSZip();

        for (let i = 0; i < selectedStudents.length; i++) {
          const student = selectedStudents[i];
          setProgressIndex(i + 1);
          setCurrentStudentName(student.name);

          const canvas = await renderStudentCanvas(student);
          const pngUrl = canvas.toDataURL('image/png');
          const base64Data = pngUrl.replace(/^data:image\/png;base64,/, '');

          const cleanStudentName = `${String(i + 1).padStart(2, '0')}_${student.name.replace(/[\\/:*?"<>|]/g, '_')}`;
          zip.file(`شهادة_${cleanStudentName}.png`, base64Data, { base64: true });
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const cleanName = baseFileName.trim().replace(/\.zip$/i, '');
        const zipFileName = `${cleanName || 'شهادات_الطلبة'}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSuccessMessage(
          `تم بنجاح تصدير (${selectedStudents.length}) صورة شهادة عالية الدقة مضغوطة في ملف «${zipFileName}».`
        );
      }
    } catch (err) {
      console.error('Image Export failed:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء إنشاء وتصدير صور الشهادات.'
      );
    } finally {
      setIsGenerating(false);
      setExportMode(null);
      setRenderStudent(null);
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
                تصدير شهادات التقدير والإعفاء المدرسي
              </h2>
              <p className="text-xs text-slate-400">
                إنشاء ملفات PDF أو صور عالية الدقة (PNG) متضمنة بيانات الطالب والدرجات والنتيجة
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
                بيانات التصدير الأكاديمية:
              </span>
              <span className="text-xs text-slate-300">
                {classNameStr} • {sectionNameStr ? `شعبة ${sectionNameStr}` : 'بدون شعبة'} • العام: {academicYearName}
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
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Generation Progress Display */}
          {isGenerating && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>
                    جاري تجهيز وتصيير الشهادة ({progressIndex} من {selectedStudents.length}):
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
                {exportMode === 'pdf'
                  ? 'يتم دمج الشهادات في ملف PDF واحد عالي الدقة بحجم A4 أفقي...'
                  : 'يتم استخراج صور الشهادات بدقة فائقة وحفظها...'}
              </span>
            </div>
          )}

          {/* File Name Input Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              اسم الملف الأساسي المراد تصديره:
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={isGenerating}
                value={baseFileName}
                onChange={(e) => setBaseFileName(e.target.value)}
                className="w-full h-10 px-3 pr-9 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:border-amber-500 focus:outline-hidden font-mono"
                placeholder="اسم_الملف"
              />
              <FileText className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              سيُضاف الامتداد (.pdf أو .zip) تلقائياً بحسب نوع التصدير المختار.
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
                  لا يوجد طلاب مسجلون في هذا الصف والشعبة حالياً.
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
                        {student.isGeneralExempt ? 'معفى عام' : 'مستحق للشهادة'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions: Dual Export Options */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {selectedStudents.length > 0 ? (
              <span>
                المحدد: <strong className="text-white font-bold">{selectedStudents.length}</strong> طالب.
              </span>
            ) : (
              <span className="text-rose-400 font-bold">لم يتم تحديد أي طالب.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isGenerating}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>

            {/* Option B: Export as Images (PNG) */}
            <button
              type="button"
              disabled={isGenerating || selectedStudents.length === 0}
              onClick={handleExportImages}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-50"
              title="تصدير شهادات الطلبة كملفات صور PNG عالية الدقة (في ملف ZIP إذا كانوا متعددين)"
            >
              {isGenerating && exportMode === 'images' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>جاري تصدير الصور...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  <span>تصدير كصور (PNG)</span>
                </>
              )}
            </button>

            {/* Option A: Export as PDF */}
            <button
              type="button"
              disabled={isGenerating || selectedStudents.length === 0}
              onClick={handleExportPdf}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              title="تصدير الشهادات في ملف PDF موحد بحجم A4 أفقي"
            >
              {isGenerating && exportMode === 'pdf' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تصدير كملف PDF ({selectedStudents.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Fixed Off-Screen Render Container for html2canvas (CRITICAL: opacity: 1, visibility: visible) */}
        <div
          ref={hiddenRenderContainerRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '1123px',
            height: '794px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: -99999,
            background: '#ffffff',
            opacity: 1,
            visibility: 'visible',
          }}
        >
          {renderStudent && (
            <CertificateCanvas
              config={db.getCertificateTemplate()}
              settings={settings}
              studentName={renderStudent.name}
              academicYear={academicYearName}
              directorName={settings.directorName || 'إدارة المدرسة'}
              classNameStr={classNameStr}
              sectionNameStr={sectionNameStr}
              registrationNumber={renderStudent.registrationNumber}
              seatNumber={renderStudent.seatNumber}
              gradesData={getStudentGradesData(renderStudent)}
              isForPrint={true}
              fixedScale={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
