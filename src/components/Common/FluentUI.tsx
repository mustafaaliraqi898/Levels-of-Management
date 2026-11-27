import React from 'react';

/**
 * Shared Windows 11 Fluent Design UI Primitives
 * Dark Navy & Soft Blue + Clean Neutral Light Mode
 */

interface FluentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'inner';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const FluentCard: React.FC<FluentCardProps> = ({
  variant = 'primary',
  padding = 'md',
  className = '',
  children,
  ...rest
}) => {
  const surfaceClass =
    variant === 'inner'
      ? 'bg-[#EDF1F7] dark:bg-[#26364B] border-[#DCE3ED] dark:border-[#2D3B4D]'
      : variant === 'secondary'
      ? 'bg-[#F8FAFC] dark:bg-[#202E40] border-[#DCE3ED] dark:border-[#2D3B4D]'
      : 'bg-white dark:bg-[#1C2939] border-[#DCE3ED] dark:border-[#2D3B4D] shadow-xs dark:shadow-[0_2px_10px_rgba(0,0,0,0.18)]';

  const padClass =
    padding === 'none'
      ? ''
      : padding === 'sm'
      ? 'p-3.5'
      : padding === 'lg'
      ? 'p-6 sm:p-7'
      : 'p-5';

  return (
    <div
      className={`rounded-[14px] border transition-colors ${surfaceClass} ${padClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

interface FluentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const FluentButton: React.FC<FluentButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const variantClass =
    variant === 'primary'
      ? 'bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white border border-transparent shadow-xs'
      : variant === 'secondary'
      ? 'bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5]/60 dark:hover:border-[#2785F5]/60'
      : variant === 'danger'
      ? 'bg-[#E35D6A]/10 hover:bg-[#E35D6A]/20 text-[#C83D4B] dark:text-[#E35D6A] border border-[#E35D6A]/30'
      : variant === 'success'
      ? 'bg-[#10B981] hover:bg-[#059669] text-white border border-transparent shadow-xs'
      : 'bg-transparent hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] border border-transparent';

  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs rounded-lg gap-1.5'
      : size === 'lg'
      ? 'px-5 py-3 text-sm rounded-xl gap-2'
      : 'px-4 py-2 text-xs sm:text-sm rounded-[10px] gap-2';

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

interface FluentBadgeProps {
  tone?: 'blue' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';
  className?: string;
  children: React.ReactNode;
}

export const FluentBadge: React.FC<FluentBadgeProps> = ({
  tone = 'blue',
  className = '',
  children,
}) => {
  const toneClass =
    tone === 'success'
      ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#10B981] border-[#10B981]/30'
      : tone === 'warning'
      ? 'bg-[#D69B42]/12 text-[#B47A20] dark:text-[#D69B42] border-[#D69B42]/30'
      : tone === 'danger'
      ? 'bg-[#E35D6A]/12 text-[#C83D4B] dark:text-[#E35D6A] border-[#E35D6A]/30'
      : tone === 'purple'
      ? 'bg-[#A78BFA]/15 text-[#7C3AED] dark:text-[#A78BFA] border-[#A78BFA]/30'
      : tone === 'neutral'
      ? 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] border-[#DCE3ED] dark:border-[#2D3B4D]'
      : 'bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA] border-[#3156C9]/25 dark:border-[#60A5FA]/30';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
};

interface FluentAlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const FluentAlert: React.FC<FluentAlertProps> = ({
  tone = 'info',
  icon,
  title,
  children,
  className = '',
}) => {
  const toneClass =
    tone === 'success'
      ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#047857] dark:text-[#10B981]'
      : tone === 'warning'
      ? 'bg-[#D69B42]/10 border-[#D69B42]/30 text-[#9A6715] dark:text-[#D69B42]'
      : tone === 'danger'
      ? 'bg-[#E35D6A]/10 border-[#E35D6A]/30 text-[#BE3240] dark:text-[#E35D6A]'
      : 'bg-[#3156C9]/8 dark:bg-[#60A5FA]/10 border-[#3156C9]/25 dark:border-[#60A5FA]/25 text-[#1E293B] dark:text-[#E2E8F0]';

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-xs sm:text-sm flex items-start gap-3 ${toneClass} ${className}`}
    >
      {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
      <div className="flex-1 min-w-0">
        {title && <div className="font-bold mb-0.5">{title}</div>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

export const FluentSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const dim =
    size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-10 h-10 border-4' : 'w-6 h-6 border-2';
  return (
    <div
      className={`${dim} border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
};
