import React, { useRef, useState, useEffect } from 'react';
import {
  AppSettings,
  CertificateTemplateConfig,
  CertificateElementKey,
} from '../../types';
import { School, Sparkles } from 'lucide-react';

export interface CertificateCanvasProps {
  config: CertificateTemplateConfig;
  settings: AppSettings;
  studentName: string;
  academicYear: string;
  directorName: string;
  isForPrint?: boolean;
  fixedScale?: boolean;
  activeElementKey?: CertificateElementKey | null;
  onElementMouseDown?: (e: React.MouseEvent, key: CertificateElementKey) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const CertificateCanvas: React.FC<CertificateCanvasProps> = ({
  config,
  settings,
  studentName,
  academicYear,
  directorName,
  isForPrint = false,
  fixedScale = false,
  activeElementKey = null,
  onElementMouseDown,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  useEffect(() => {
    if (fixedScale) {
      setScaleFactor(1);
      return;
    }

    const updateScale = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) {
          setScaleFactor(w / 1123);
        }
      }
    };

    updateScale();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateScale();
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [fixedScale]);

  return (
    <div
      ref={containerRef}
      className={`certificate-canvas-wrapper relative select-none w-full h-full overflow-hidden ${className}`}
      style={{
        aspectRatio: '1123 / 794',
        direction: 'ltr', // Standard LTR coordinate system for CSS absolute positioning & scaling
        ...style,
      }}
    >
      <div
        className="certificate-canvas-base absolute top-0 left-0 overflow-hidden select-none pointer-events-auto"
        style={{
          width: '1123px',
          height: '794px',
          transform: fixedScale ? undefined : `scale(${scaleFactor})`,
          transformOrigin: 'top left',
          fontFamily: 'Cairo, Tajawal, Amiri, sans-serif',
          direction: 'rtl', // Content (text, Arabic alignment) rendered in RTL
          background: config.templateImage
            ? '#ffffff'
            : 'linear-gradient(135deg, #faf5eb 0%, #ffffff 50%, #f7f3e8 100%)',
        }}
      >
        {/* Background Layer: Custom Uploaded Template OR Default Ornamental Frame */}
        {config.templateImage ? (
          <img
            src={config.templateImage}
            alt="قالب شهادة التقدير"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            style={{ imageRendering: 'auto' }}
          />
        ) : (
          /* Default Classical Islamic / Academic Certificate Template Frame */
          <div className="absolute inset-0 w-full h-full pointer-events-none p-8 flex flex-col justify-between border-[18px] border-[#c5a059] outline outline-2 outline-[#8c6b2d] bg-[#fbf9f4]">
            {/* Corner Arabesque Geometric Ornaments */}
            <div className="absolute top-3 right-3 w-20 h-20 border-t-4 border-r-4 border-[#8c6b2d]" />
            <div className="absolute top-3 left-3 w-20 h-20 border-t-4 border-l-4 border-[#8c6b2d]" />
            <div className="absolute bottom-3 right-3 w-20 h-20 border-b-4 border-r-4 border-[#8c6b2d]" />
            <div className="absolute bottom-3 left-3 w-20 h-20 border-b-4 border-l-4 border-[#8c6b2d]" />

            {/* Inner Border */}
            <div className="absolute inset-4 border-2 border-dashed border-[#c5a059]/60" />

            {/* Default Classical Text Content if no template image is supplied */}
            <div className="relative z-0 flex flex-col items-center text-center mt-8">
              <span className="text-sm tracking-widest text-[#8c6b2d] font-bold uppercase mb-2">
                إدارة {settings.schoolName || 'المدرسة'}
              </span>
              <h2 className="text-3xl font-black text-[#5a421c] tracking-tight">
                {settings.schoolName || 'إعدادية داقوق للبنين'}
              </h2>
              <div className="mt-4 px-8 py-2 bg-[#c5a059]/15 border-y-2 border-[#c5a059] rounded-sm">
                <h1 className="text-4xl font-black text-[#8c6b2d] tracking-wide">
                  شـهـادة شـكـر وتـقـديـر
                </h1>
              </div>
              <p className="text-sm text-slate-600 mt-4 max-w-xl leading-relaxed">
                يسر إدارة المدرسة أن تمنح هذه الشهادة تقديراً للجد والاجتهاد والتميز الأكاديمي، متمنين دوام التفوق والنجاح الباهر
              </p>
            </div>

            <div className="relative z-0 flex items-center justify-between px-16 mb-6 text-sm font-bold text-[#5a421c]">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">العام الدراسي</span>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 rounded-full border-2 border-[#c5a059] flex items-center justify-center text-xs text-[#8c6b2d] font-bold">
                  ختم المدرسة
                </div>
              </div>
              <div className="text-left">
                <span className="text-xs text-slate-500 block">مدير المدرسة</span>
              </div>
            </div>
          </div>
        )}

        {/* 1. Official School Logo */}
        {config.elements.officialLogo.visible && (
          <div
            onClick={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'officialLogo')}
            onMouseDown={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'officialLogo')}
            className={`absolute transition-shadow ${
              !isForPrint && activeElementKey === 'officialLogo'
                ? 'ring-2 ring-emerald-500 ring-offset-2 z-30 cursor-move'
                : !isForPrint
                ? 'hover:ring-1 hover:ring-emerald-400/60 z-20 cursor-pointer'
                : 'z-20'
            }`}
            style={{
              left: `${config.elements.officialLogo.x}%`,
              top: `${config.elements.officialLogo.y}%`,
              width: `${config.elements.officialLogo.width || 10}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {settings.schoolLogo ? (
              <img
                src={settings.schoolLogo}
                alt="شعار المدرسة الرسمي"
                className="w-full h-auto object-contain pointer-events-none drop-shadow-sm"
              />
            ) : !isForPrint ? (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-emerald-500/70 bg-emerald-500/10 flex flex-col items-center justify-center p-1 text-center">
                <School className="w-6 h-6 text-emerald-600 mb-0.5" />
                <span className="text-[10px] font-bold text-emerald-700 leading-tight">
                  شعار المدرسة
                </span>
                <span className="text-[8px] text-emerald-600">(من الإعدادات)</span>
              </div>
            ) : null}
          </div>
        )}

        {/* 2. Kufic Geometric School Logo */}
        {config.elements.kuficLogo.visible && (
          <div
            onClick={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'kuficLogo')}
            onMouseDown={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'kuficLogo')}
            className={`absolute transition-shadow ${
              !isForPrint && activeElementKey === 'kuficLogo'
                ? 'ring-2 ring-amber-500 ring-offset-2 z-30 cursor-move'
                : !isForPrint
                ? 'hover:ring-1 hover:ring-amber-400/60 z-20 cursor-pointer'
                : 'z-20'
            }`}
            style={{
              left: `${config.elements.kuficLogo.x}%`,
              top: `${config.elements.kuficLogo.y}%`,
              width: `${config.elements.kuficLogo.width || 10}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {settings.kuficLogo ? (
              <img
                src={settings.kuficLogo}
                alt="شعار المدرسة بالخط الكوفي"
                className="w-full h-auto object-contain pointer-events-none drop-shadow-sm"
              />
            ) : !isForPrint ? (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-amber-500/70 bg-amber-500/10 flex flex-col items-center justify-center p-1 text-center">
                <Sparkles className="w-6 h-6 text-amber-600 mb-0.5" />
                <span className="text-[10px] font-bold text-amber-700 leading-tight">
                  الشعار الكوفي
                </span>
                <span className="text-[8px] text-amber-600">(من الإعدادات)</span>
              </div>
            ) : null}
          </div>
        )}

        {/* 3. Student Name */}
        {config.elements.studentName.visible && (
          <div
            onClick={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'studentName')}
            onMouseDown={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'studentName')}
            className={`absolute whitespace-nowrap px-3 py-1 rounded ${
              !isForPrint && activeElementKey === 'studentName'
                ? 'ring-2 ring-blue-500 ring-offset-2 z-30 cursor-move bg-blue-500/10'
                : !isForPrint
                ? 'hover:ring-1 hover:ring-blue-400/60 z-20 cursor-pointer'
                : 'z-20'
            }`}
            style={{
              left: `${config.elements.studentName.x}%`,
              top: `${config.elements.studentName.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${config.elements.studentName.fontSize || 34}px`,
              fontWeight:
                config.elements.studentName.fontWeight === 'black'
                  ? 900
                  : config.elements.studentName.fontWeight === 'bold'
                  ? 700
                  : 500,
              color: config.elements.studentName.fontColor || '#0f172a',
              fontFamily: config.elements.studentName.fontFamily || 'Cairo',
              textAlign: config.elements.studentName.textAlign || 'center',
              lineHeight: 1.25,
            }}
          >
            {studentName}
          </div>
        )}

        {/* 4. Academic Year */}
        {config.elements.academicYear.visible && (
          <div
            onClick={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'academicYear')}
            onMouseDown={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'academicYear')}
            className={`absolute whitespace-nowrap px-3 py-1 rounded ${
              !isForPrint && activeElementKey === 'academicYear'
                ? 'ring-2 ring-purple-500 ring-offset-2 z-30 cursor-move bg-purple-500/10'
                : !isForPrint
                ? 'hover:ring-1 hover:ring-purple-400/60 z-20 cursor-pointer'
                : 'z-20'
            }`}
            style={{
              left: `${config.elements.academicYear.x}%`,
              top: `${config.elements.academicYear.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${config.elements.academicYear.fontSize || 16}px`,
              fontWeight:
                config.elements.academicYear.fontWeight === 'black'
                  ? 900
                  : config.elements.academicYear.fontWeight === 'bold'
                  ? 700
                  : 500,
              color: config.elements.academicYear.fontColor || '#334155',
              fontFamily: config.elements.academicYear.fontFamily || 'Tajawal',
              textAlign: config.elements.academicYear.textAlign || 'center',
              lineHeight: 1.25,
            }}
          >
            {academicYear}
          </div>
        )}

        {/* 5. Principal / Director Name */}
        {config.elements.directorName.visible && (
          <div
            onClick={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'directorName')}
            onMouseDown={(e) => !isForPrint && onElementMouseDown && onElementMouseDown(e, 'directorName')}
            className={`absolute whitespace-nowrap px-3 py-1 rounded ${
              !isForPrint && activeElementKey === 'directorName'
                ? 'ring-2 ring-rose-500 ring-offset-2 z-30 cursor-move bg-rose-500/10'
                : !isForPrint
                ? 'hover:ring-1 hover:ring-rose-400/60 z-20 cursor-pointer'
                : 'z-20'
            }`}
            style={{
              left: `${config.elements.directorName.x}%`,
              top: `${config.elements.directorName.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${config.elements.directorName.fontSize || 18}px`,
              fontWeight:
                config.elements.directorName.fontWeight === 'black'
                  ? 900
                  : config.elements.directorName.fontWeight === 'bold'
                  ? 700
                  : 500,
              color: config.elements.directorName.fontColor || '#1e293b',
              fontFamily: config.elements.directorName.fontFamily || 'Tajawal',
              textAlign: config.elements.directorName.textAlign || 'center',
              lineHeight: 1.25,
            }}
          >
            {directorName}
          </div>
        )}
      </div>
    </div>
  );
};
