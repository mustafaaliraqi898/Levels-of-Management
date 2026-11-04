import React from 'react';
import { StudentStatus } from '../../types';

interface StudentStatusBadgeProps {
  status?: StudentStatus;
  className?: string;
}

/**
 * شارة موحدة وبسيطة لتمييز الطالب المنتسب «انتساب»
 * لا تُعرض إطلاقاً للطلاب المنتظمين وتتوافق مع الوضعين الليلي والنهاري والطباعة
 */
export const StudentStatusBadge: React.FC<StudentStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  if (status !== 'affiliated') {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none select-none shrink-0 border transition-colors bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30 print:bg-purple-100 print:text-purple-900 print:border-purple-300 ${className}`}
      title="حالة الطالب: انتساب"
    >
      انتساب
    </span>
  );
};
