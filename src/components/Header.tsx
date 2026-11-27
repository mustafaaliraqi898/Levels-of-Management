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
    <header className="no-print h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      {/* Right side: Mobile Menu Button & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 md:hidden hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          aria-label="القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            {settings.schoolName}
          </span>
          <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100">
            {tabTitles[activeTab]}
          </h2>
        </div>
      </div>

      {/* Left side: System status & quick actions */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Offline Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/25 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>محفوظ محلياً ومؤمن</span>
        </div>

        {/* Quick Backup Button */}
        <button
          type="button"
          onClick={handleQuickBackup}
          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          title="تنزيل نسخة احتياطية سريعة لملف JSON"
        >
          <Download className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
          <span className="hidden sm:inline">حفظ نسخة احتياطية</span>
        </button>

        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>{timeStr}</span>
        </div>

        {/* Theme Toggle Button (Far Left in RTL) */}
        <div className="relative group/theme flex items-center">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-emerald-400 hover:border-emerald-500/40 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
            title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح (Light Mode)' : 'التبديل إلى الوضع الداكن (Dark Mode)'}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 transition-transform duration-200 group-hover/theme:rotate-45 text-emerald-400" />
            ) : (
              <Moon className="w-4 h-4 transition-transform duration-200 group-hover/theme:-rotate-12 text-slate-700" />
            )}
          </button>

          {/* Tooltip on hover */}
          <div className="absolute top-full left-0 mt-2 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover/theme:opacity-100 transition-opacity duration-150">
            {theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            <div className="absolute -top-1 left-3.5 w-2 h-2 bg-white dark:bg-slate-900 border-t border-l border-slate-200 dark:border-slate-700 rotate-45" />
          </div>
        </div>

        {/* Current User & Account Settings */}
        {currentUser && (
          <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 pr-2 sm:pr-3 mr-0.5 sm:mr-1">
            <button
              type="button"
              onClick={onOpenAccountSettings}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-colors cursor-pointer text-xs font-bold"
              title="إعدادات الحساب وتغيير كلمة المرور"
            >
              <div className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.username}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold hidden md:inline border ${
                  currentUser.role === 'admin'
                    ? 'bg-teal-50 dark:bg-teal-400/15 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-400/30'
                    : 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/30'
                }`}
              >
                {currentUser.role === 'admin' ? 'مدير كامل' : 'معاينة فقط'}
              </span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/70 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
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
