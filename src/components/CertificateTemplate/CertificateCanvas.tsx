import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  classNameStr?: string;
  sectionNameStr?: string;
  registrationNumber?: string;
  seatNumber?: number;
  gradesData?: {
    subjects?: { name: string; score: number | string; maxScore?: number }[];
    total?: number | string;
    average?: number | string;
    result?: string;
    status?: string;
  };
  isForPrint?: boolean;
  fixedScale?: boolean;
  activeElementKey?: CertificateElementKey | null;
  onElementMouseDown?: (e: React.MouseEvent, key: CertificateElementKey) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const CertificateCanvas = forwardRef<HTMLDivElement, CertificateCanvasProps>(({
  config,
  settings,
  studentName,
  academicYear,
  directorName,
  classNameStr,
  sectionNameStr,
  registrationNumber,
  seatNumber,
  gradesData,
  isForPrint = false,
  fixedScale = false,
  activeElementKey = null,
  onElementMouseDown,
  className = '',
  style = {},
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  
  useImperativeHandle(ref, () => baseRef.current as HTMLDivElement);

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
        ref={baseRef}
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

        {/* Student Class and Section line (Only for default system template) */}
        {!config.templateImage && (classNameStr || sectionNameStr || registrationNumber) && (
          <div
            className="absolute z-20 text-center whitespace-nowrap pointer-events-none"
            style={{
              left: `${config.elements.studentName.x}%`,
              top: `${Math.min(90, config.elements.studentName.y + 7.5)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span 
              className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-bold font-sans"
              style={{
                color: '#1e293b',
                backgroundColor: 'rgba(197, 160, 89, 0.15)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <span>الصف: {classNameStr || '—'}</span>
              <span>•</span>
              <span>{sectionNameStr ? `شعبة ${sectionNameStr}` : 'بدون شعبة'}</span>
              {registrationNumber && (
                <>
                  <span>•</span>
                  <span>رقم القيد: {registrationNumber}</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Student Grades and Results Banner (Only for default system template) */}
        {!config.templateImage && gradesData && (
          <div
            className="absolute z-20 pointer-events-none w-[86%] max-w-[960px]"
            style={{
              left: '50%',
              top: `${Math.min(76, config.elements.studentName.y + 17)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div 
              className="rounded-xl p-2.5 flex flex-col gap-1.5"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(197, 160, 89, 0.5)',
                color: '#0f172a',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              }}
            >
              {/* Subjects Row */}
              {gradesData.subjects && gradesData.subjects.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 overflow-hidden">
                  {gradesData.subjects.slice(0, 10).map((sub, sIdx) => (
                    <span
                      key={sIdx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#faf5eb] border border-[#c5a059]/30 text-[11px] font-bold"
                    >
                      <span className="text-slate-700">{sub.name}:</span>
                      <span className="font-mono text-emerald-800 font-black">{sub.score}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Total, Average, Result Bar */}
              <div className="flex items-center justify-around border-t border-[#c5a059]/30 pt-1 text-xs font-bold">
                {gradesData.total !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">المجموع:</span>
                    <span className="font-mono font-black text-slate-900">{gradesData.total}</span>
                  </div>
                )}
                {gradesData.average !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">المعدل:</span>
                    <span className="font-mono font-black text-amber-800">{gradesData.average}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">النتيجة:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-black">
                    {gradesData.result || 'معفى عام'}
                  </span>
                </div>
              </div>
            </div>
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
});
