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
      className="print-preview-modal-root fixed inset-0 z-[9999] flex flex-col bg-[#111C2A]/80 backdrop-blur-md text-[#1E293B] dark:text-[#E2E8F0] select-none animate-in fade-in duration-200 print:static print:bg-white print:text-black print:p-0 print:m-0 print:overflow-visible print:block"
      dir="rtl"
    >
      {/* Top Application Bar */}
      <div className="no-print bg-white dark:bg-[#1C2939] border-b border-[#DCE3ED] dark:border-[#2D3B4D] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm shrink-0">
        {/* Title & Document Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 border border-[#3156C9]/25 dark:border-[#60A5FA]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[#1E293B] dark:text-[#E2E8F0]">{title}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#60A5FA]/30">
                معاينة الطباعة الرسمية
              </span>
            </div>
            {subtitle && <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Orientation Toggle */}
          <div className="flex items-center bg-[#EDF1F7] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-[#3156C9] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0]'
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
                  ? 'bg-[#3156C9] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0]'
              }`}
              title="تنسيق ورقة A4 بالطول (Portrait)"
            >
              <span>عمودي (طولي)</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center bg-[#EDF1F7] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-1 text-xs text-[#1E293B] dark:text-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 rounded-md hover:bg-[#DCE3ED] dark:hover:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono tabular-nums text-[11px] font-bold min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 rounded-md hover:bg-[#DCE3ED] dark:hover:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.85)}
              className="p-1.5 rounded-md hover:bg-[#DCE3ED] dark:hover:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer ml-0.5"
              title="إعادة تعيين الحجم الطبيعي"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Printer Selector (Electron Desktop) */}
          {isDesktop && printers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl px-2 py-1">
              <span className="text-[11px] text-[#64748B] dark:text-[#A8B5C7] font-bold hidden md:inline">الطابعة:</span>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="bg-transparent text-xs text-[#1E293B] dark:text-[#E2E8F0] font-bold outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              >
                {printers.map((p) => (
                  <option key={p.name} value={p.name} className="bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0]">
                    {p.name} {p.isDefault ? '(الافتراضية)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadPrinters}
                disabled={isLoadingPrinters}
                className="p-1 text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer"
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
            className="px-3.5 py-2 rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
            title="تصدير المستند كملف PDF عالي الدقة"
          >
            {isExportingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
            )}
            <span>حفظ كملف PDF</span>
          </button>

          {/* Action: Direct Print / Print Now */}
          <button
            type="button"
            disabled={isPrinting || isExportingPdf}
            onClick={() => handleDirectPrint(true)}
            className="px-4 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all disabled:opacity-50"
            title="إرسال أمر الطباعة مباشرة إلى الطابعة المحددة"
          >
            {isPrinting ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
              className="p-2 rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors cursor-pointer"
              title="طباعة عبر نافذة إعدادات Windows المتقدمة"
            >
              <Monitor className="w-4 h-4" />
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#EDF1F7] hover:bg-[#DCE3ED] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] transition-colors cursor-pointer ml-1"
            title="إغلاق المعاينة (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Status / Feedback Alert */}
      {statusMessage && (
        <div className="no-print px-4 py-2.5 bg-[#F4F6FA] dark:bg-[#202E40] border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex items-center justify-center gap-2 text-xs font-bold animate-in slide-in-from-top-2 duration-150">
          {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-[#E35D6A]" />}
          {statusMessage.type === 'info' && (
            <div className="w-3.5 h-3.5 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
          )}
          <span
            className={
              statusMessage.type === 'success'
                ? 'text-[#059669] dark:text-[#10B981]'
                : statusMessage.type === 'error'
                ? 'text-[#C83D4B] dark:text-[#E35D6A]'
                : 'text-[#3156C9] dark:text-[#60A5FA]'
            }
          >
            {statusMessage.text}
          </span>
        </div>
      )}

      {/* Interactive Paper Canvas Viewport */}
      <div className="print-preview-viewport flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-[#E2E8F0] dark:bg-[#111C2A] print:bg-transparent print:p-0 print:m-0 print:overflow-visible print:block">
        <div
          ref={paperRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out, width 0.2s ease-in-out',
          }}
          className={`printable-paper-sheet bg-white text-slate-950 rounded-xs shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] font-sans select-text border border-slate-300 transition-all print:transform-none print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:rounded-none ${
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
      <div className="no-print bg-white dark:bg-[#1C2939] border-t border-[#DCE3ED] dark:border-[#2D3B4D] px-4 py-2 flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#A8B5C7] shrink-0">
        <div className="flex items-center gap-4">
          <span>
            ورق الطباعة: <strong className="text-[#1E293B] dark:text-[#E2E8F0]">A4 ({orientation === 'landscape' ? '297 × 210 مم أفقي' : '210 × 297 مم عمودي'})</strong>
          </span>
          <span className="hidden md:inline">
            الألوان والخلفيات: <strong className="text-[#059669] dark:text-[#10B981]">محفوظة بالكامل (Exact Colors)</strong>
          </span>
          {isDesktop && (
            <span className="hidden sm:inline">
              البيئة: <strong className="text-[#1E293B] dark:text-[#E2E8F0]">تطبيق Electron المكتبي</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>اضغط <kbd className="px-1.5 py-0.5 rounded bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] font-mono text-[10px] text-[#1E293B] dark:text-[#E2E8F0]">Esc</kbd> للخروج</span>
        </div>
      </div>
    </div>
  );
};
