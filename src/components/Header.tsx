import React, { useState, useEffect } from 'react';
import { ActiveTab, AppSettings } from '../types';
import { db } from '../services/storage';
import {
  Menu,
  HardDrive,
  Download,
  Calendar,
  Clock,
  ShieldCheck,
  Sun,
  Moon,
  User,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  settings: AppSettings;
  currentYearName?: string;
  onToggleMobileMenu: () => void;
  onNavigateToBackup: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentUser?: { id: string; username: string; role: 'admin' | 'user' };
  onOpenAccountSettings?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  settings,
  currentYearName,
  onToggleMobileMenu,
  onNavigateToBackup,
  theme,
  onToggleTheme,
  currentUser,
  onOpenAccountSettings,
  onLogout,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const tabTitles: Record<ActiveTab, string> = {
    dashboard: 'لوحة التحكم والإحصائيات العامة',
    years: 'إدارة الأعوام الدراسية',
    classes: 'إدارة الصفوف والشعب',
    students: 'سجل وإدارة الطلاب',
    subjects: 'إدارة المواد الدراسية',
    grade_entry: 'إدخال وتدقيق الدرجات (الرصد السريع)',
    decision_marks: 'إضافة درجات القرار ومساعدة المدير',
    results: 'عرض النتائج الشاملة ولوحة الأوائل',
    exemption: 'الإعفاء العام والفردي (ضوابط واستحقاق الطلبة)',
    reports: 'التقارير المدرسية والطباعة الرسمية',
    certificate_template: 'ضبط وتصميم قالب الشهادات التكريمية',
    student_promotion: 'ترحيل الطلبة وترقيتهم للأعوام الدراسية',
    backup: 'النسخ الاحتياطي واستعادة البيانات',
    settings: 'إعدادات النظام والتقريب الحسابي',
  };

  const handleQuickBackup = () => {
    const jsonStr = db.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date().toISOString().slice(0, 10);
    link.download = `نسخة_احتياطية_سريعة_${now}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <header className="no-print h-16 bg-white/95 dark:bg-[#1C2939]/95 backdrop-blur-md border-b border-[#DCE3ED] dark:border-[#2D3B4D] px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      {/* Right side: Mobile Menu Button & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 rounded-lg bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] md:hidden hover:text-[#1E293B] dark:hover:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] cursor-pointer"
          aria-label="القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <span className="text-xs text-[#64748B] dark:text-[#A8B5C7] hidden sm:block">
            {settings.schoolName}
          </span>
          <h2 className="text-sm md:text-base font-black text-[#1E293B] dark:text-[#E2E8F0]">
            {tabTitles[activeTab]}
          </h2>
        </div>
      </div>

      {/* Left side: System status & quick actions */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Offline Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 text-[11px] text-[#059669] dark:text-[#10B981] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
          <span>محفوظ محلياً ومؤمن</span>
        </div>

        {/* Quick Backup Button */}
        <button
          type="button"
          onClick={handleQuickBackup}
          className="px-3 py-1.5 rounded-[10px] bg-[#EDF1F7] dark:bg-[#26364B] hover:border-[#2785F5] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          title="تنزيل نسخة احتياطية سريعة لملف JSON"
        >
          <Download className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
          <span className="hidden sm:inline">حفظ نسخة احتياطية</span>
        </button>

        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-[#F4F6FA] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-xs font-mono tabular-nums text-[#64748B] dark:text-[#A8B5C7]">
          <Clock className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
          <span>{timeStr}</span>
        </div>

        {/* Theme Toggle Button (Far Left in RTL) */}
        <div className="relative group/theme flex items-center">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] hover:border-[#2785F5] text-[#1E293B] dark:text-[#60A5FA] transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
            title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح (Light Mode)' : 'التبديل إلى الوضع الداكن (Dark Mode)'}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 transition-transform duration-200 group-hover/theme:rotate-45 text-[#60A5FA]" />
            ) : (
              <Moon className="w-4 h-4 transition-transform duration-200 group-hover/theme:-rotate-12 text-[#3156C9]" />
            )}
          </button>

          {/* Tooltip on hover */}
          <div className="absolute top-full left-0 mt-2 px-2.5 py-1 bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover/theme:opacity-100 transition-opacity duration-150">
            {theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            <div className="absolute -top-1 left-3.5 w-2 h-2 bg-white dark:bg-[#1C2939] border-t border-l border-[#DCE3ED] dark:border-[#2D3B4D] rotate-45" />
          </div>
        </div>

        {/* Current User & Account Settings */}
        {currentUser && (
          <div className="flex items-center gap-1.5 border-r border-[#DCE3ED] dark:border-[#2D3B4D] pr-2 sm:pr-3 mr-0.5 sm:mr-1">
            <button
              type="button"
              onClick={onOpenAccountSettings}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] hover:border-[#2785F5] text-[#1E293B] dark:text-[#E2E8F0] transition-colors cursor-pointer text-xs font-bold"
              title="إعدادات الحساب وتغيير كلمة المرور"
            >
              <div className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] bg-[#3156C9]/12 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA]">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.username}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold hidden md:inline border ${
                  currentUser.role === 'admin'
                    ? 'bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA] border-[#3156C9]/25 dark:border-[#60A5FA]/30'
                    : 'bg-[#A78BFA]/15 text-[#7C3AED] dark:text-[#A78BFA] border-[#A78BFA]/30'
                }`}
              >
                {currentUser.role === 'admin' ? 'مدير كامل' : 'معاينة فقط'}
              </span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-[10px] bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#E35D6A]/15 text-[#64748B] dark:text-[#A8B5C7] hover:text-[#E35D6A] border border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#E35D6A]/40 transition-colors cursor-pointer"
              title="تسجيل الخروج من النظام"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
