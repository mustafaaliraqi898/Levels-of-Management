import React from 'react';
import { AppSettings } from '../../types';
import { SchoolLogo } from './SchoolLogo';

interface ReportHeaderProps {
  settings: AppSettings;
  title: string;
  subTitle?: string;
  academicYearName?: string;
  classNameStr?: string;
  sectionNameStr?: string;
  dateStr?: string;
  extraMeta?: React.ReactNode;
  borderBottom?: boolean;
  className?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  settings,
  title,
  subTitle,
  academicYearName,
  classNameStr,
  sectionNameStr,
  dateStr = new Date().toLocaleDateString('ar-EG'),
  extraMeta,
  borderBottom = true,
  className = '',
}) => {
  const hasLogo = Boolean(settings.schoolLogo);

  return (
    <div
      className={`w-full text-black bg-white select-text font-sans ${
        borderBottom ? 'border-b-2 border-black pb-3 mb-3' : ''
      } ${className}`}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Right side: Ministry Official Info */}
        <div className="text-right text-xs leading-relaxed shrink-0">
          <div className="font-bold text-slate-900">جمهورية العراق</div>
          <div className="font-bold text-slate-900">وزارة التربية والتعليم</div>
          <div className="text-slate-700">{settings.city || 'المديرية العامة للتربية'}</div>
        </div>

        {/* Center: School Logo + Name + Report Title */}
        <div className="flex flex-col items-center text-center flex-1 px-2">
          {hasLogo && (
            <div className="mb-1.5 flex items-center justify-center">
              <SchoolLogo
                logoUrl={settings.schoolLogo}
                schoolName={settings.schoolName}
                size="lg"
                className="max-h-16 max-w-[120px]"
              />
            </div>
          )}

          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
            {settings.schoolName || 'الإدارة المدرسية'}
          </h2>

          <h1 className="text-sm sm:text-base font-black text-slate-900 mt-1 px-4 py-0.5 border border-black/40 rounded-lg bg-slate-100 shadow-2xs">
            {title}
          </h1>

          {subTitle && (
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              {subTitle}
            </div>
          )}
        </div>

        {/* Left side: Meta details */}
        <div className="text-left text-xs leading-relaxed font-mono shrink-0">
          {academicYearName && (
            <div>
              <strong className="font-sans">العام: </strong>
              {academicYearName}
            </div>
          )}
          {classNameStr && (
            <div>
              <strong className="font-sans">الصف: </strong>
              {classNameStr}
            </div>
          )}
          {sectionNameStr && (
            <div>
              <strong className="font-sans">الشعبة: </strong>
              {sectionNameStr}
            </div>
          )}
          <div>
            <strong className="font-sans">التاريخ: </strong>
            {dateStr}
          </div>
          {extraMeta}
        </div>
      </div>
    </div>
  );
};
