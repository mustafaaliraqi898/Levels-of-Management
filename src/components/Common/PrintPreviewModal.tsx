import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  FileDown,
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Monitor
} from 'lucide-react';
import { PrinterDevice } from '../../types';
import {
  getInstalledPrinters,
  executePrint,
  exportToPdf,
  isElectron
} from '../../services/printService';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  defaultOrientation?: 'landscape' | 'portrait';
  suggestedFileName?: string;
  children: React.ReactNode;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  defaultOrientation = 'landscape',
  suggestedFileName,
  children,
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(defaultOrientation);
  const [zoom, setZoom] = useState<number>(0.85); // 85% default comfortable scale
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const paperRef = useRef<HTMLDivElement>(null);
  const isDesktop = isElectron();

  // Load printers on open
  useEffect(() => {
    if (isOpen) {
      setOrientation(defaultOrientation);
      loadPrinters();
    }
  }, [isOpen, defaultOrientation]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadPrinters = async () => {
    if (!isDesktop) return;
    setIsLoadingPrinters(true);
    try {
      const list = await getInstalledPrinters();
      setPrinters(list);
      if (list.length > 0) {
        const defaultP = list.find((p) => p.isDefault) || list[0];
        setSelectedPrinter(defaultP.name);
      }
    } catch (err) {
      console.warn('Could not load printers list', err);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  if (!isOpen) return null;

  const handleDirectPrint = async (silent: boolean = true) => {
    setIsPrinting(true);
    setStatusMessage({ type: 'info', text: 'جاري تجهيز المستند والتأكد من اكتمال تحميل الخطوط والصور...' });

    try {
      const res = await executePrint({
        landscape: orientation === 'landscape',
        silent: isDesktop ? silent : false,
        deviceName: selectedPrinter || undefined,
        element: paperRef.current,
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: isDesktop
            ? 'تم إرسال المستند إلى الطابعة بنجاح وبأعلى جودة.'
            : 'تم فتح نافذة الطباعة بنجاح.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'تعذر إتمام عملية الطباعة. يرجى التحقق من اتصال الطابعة.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ غير متوقع أثناء الطباعة.',
      });
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setStatusMessage({ type: 'info', text: 'جاري توليد ملف PDF عالي الدقة...' });

    const safeTitle = suggestedFileName || title || 'تقرير_مدرسي';

    try {
      const res = await exportToPdf({
        title: safeTitle,
        landscape: orientation === 'landscape',
        element: paperRef.current,
      });

      if (res.canceled) {
        setStatusMessage(null);
      } else if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.filePath
            ? `تم حفظ ملف PDF بنجاح في: ${res.filePath}`
            : 'تم إنشاء المستند بنجاح. يرجى اختيار مكان الحفظ.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'فشل تصدير ملف PDF.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء تصدير ملف PDF.',
      });
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => {
        setStatusMessage(null);
      }, 6000);
    }
  };

  return (
    <div
      className="print-preview-modal-root fixed inset-0 z-[9999] flex flex-col bg-black/85 backdrop-blur-md text-slate-100 select-none animate-in fade-in duration-200 print:static print:bg-white print:text-black print:p-0 print:m-0 print:overflow-visible print:block"
      dir="rtl"
    >
      {/* Top Application Bar */}
      <div className="no-print bg-[#292929] border-b border-[#383838] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl shrink-0">
        {/* Title & Document Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#60CDFF]/15 border border-[#60CDFF]/30 text-[#60CDFF] flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5 text-[#60CDFF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">{title}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#60CDFF]/15 text-[#60CDFF] border border-[#60CDFF]/30">
                معاينة الطباعة الرسمية
              </span>
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Orientation Toggle */}
          <div className="flex items-center bg-[#202020] border border-[#383838] rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-[#60CDFF] text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="تنسيق ورقة A4 بالعرض (Landscape)"
            >
              <span>أفقي (عرضي)</span>
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-[#60CDFF] text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="تنسيق ورقة A4 بالطول (Portrait)"
            >
              <span>عمودي (طولي)</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center bg-[#202020] border border-[#383838] rounded-xl p-1 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 rounded-md hover:bg-[#353535] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-bold min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 rounded-md hover:bg-[#353535] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.85)}
              className="p-1.5 rounded-md hover:bg-[#353535] text-slate-400 hover:text-white transition-colors cursor-pointer ml-0.5"
              title="إعادة تعيين الحجم الطبيعي"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Printer Selector (Electron Desktop) */}
          {isDesktop && printers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#202020] border border-[#383838] rounded-xl px-2 py-1">
              <span className="text-[11px] text-slate-400 font-bold hidden md:inline">الطابعة:</span>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              >
                {printers.map((p) => (
                  <option key={p.name} value={p.name} className="bg-[#292929] text-white">
                    {p.name} {p.isDefault ? '(الافتراضية)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadPrinters}
                disabled={isLoadingPrinters}
                className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="تحديث قائمة الطابعات"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Action: Export to PDF */}
          <button
            type="button"
            disabled={isExportingPdf || isPrinting}
            onClick={handleExportPdf}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
            title="تصدير المستند كملف PDF عالي الدقة"
          >
            {isExportingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>حفظ كملف PDF</span>
          </button>

          {/* Action: Direct Print / Print Now */}
          <button
            type="button"
            disabled={isPrinting || isExportingPdf}
            onClick={() => handleDirectPrint(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
            title="إرسال أمر الطباعة مباشرة إلى الطابعة المحددة"
          >
            {isPrinting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>طباعة المستند</span>
          </button>

          {/* Action: System Dialog Print option */}
          {isDesktop && (
            <button
              type="button"
              disabled={isPrinting || isExportingPdf}
              onClick={() => handleDirectPrint(false)}
              className="p-2 rounded-xl bg-[#202020] hover:bg-[#353535] text-slate-300 hover:text-white border border-[#383838] transition-colors cursor-pointer"
              title="طباعة عبر نافذة إعدادات Windows المتقدمة"
            >
              <Monitor className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#202020] hover:bg-[#353535] text-slate-400 hover:text-white border border-[#383838] transition-colors cursor-pointer ml-1"
            title="إغلاق المعاينة (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Status / Feedback Alert */}
      {statusMessage && (
        <div className="no-print px-4 py-2.5 bg-[#202020] border-b border-[#383838] flex items-center justify-center gap-2 text-xs font-bold animate-in slide-in-from-top-2 duration-150">
          {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {statusMessage.type === 'info' && (
            <div className="w-3.5 h-3.5 border-2 border-[#60CDFF] border-t-transparent rounded-full animate-spin" />
          )}
          <span
            className={
              statusMessage.type === 'success'
                ? 'text-emerald-300'
                : statusMessage.type === 'error'
                ? 'text-rose-300'
                : 'text-[#60CDFF]'
            }
          >
            {statusMessage.text}
          </span>
        </div>
      )}

      {/* Interactive Paper Canvas Viewport */}
      <div className="print-preview-viewport flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-[#1a1a1a] print:bg-transparent print:p-0 print:m-0 print:overflow-visible print:block">
        <div
          ref={paperRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out, width 0.2s ease-in-out',
          }}
          className={`printable-paper-sheet bg-white text-slate-950 rounded-xs shadow-[0_20px_50px_rgba(0,0,0,0.6)] font-sans select-text border border-slate-300 transition-all print:transform-none print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:rounded-none ${
            orientation === 'landscape'
              ? 'w-[297mm] min-h-[210mm] p-[10mm]'
              : 'w-[210mm] min-h-[297mm] p-[12mm]'
          }`}
          dir="rtl"
        >
          {children}
        </div>
      </div>

      {/* Footer Info & Keyboard Hints */}
      <div className="no-print bg-[#202020] border-t border-[#383838] px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>
            ورق الطباعة: <strong>A4 ({orientation === 'landscape' ? '297 × 210 مم أفقي' : '210 × 297 مم عمودي'})</strong>
          </span>
          <span className="hidden md:inline">
            الألوان والخلفيات: <strong className="text-emerald-400">محفوظة بالكامل (Exact Colors)</strong>
          </span>
          {isDesktop && (
            <span className="text-slate-400 hidden sm:inline">
              البيئة: <strong>تطبيق Electron المكتبي</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>اضغط <kbd className="px-1.5 py-0.5 rounded bg-[#2B2B2B] border border-[#383838] font-mono text-[10px] text-white">Esc</kbd> للخروج</span>
        </div>
      </div>
    </div>
  );
};
