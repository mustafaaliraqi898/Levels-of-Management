import React from 'react';
import { ActiveTab, AppSettings } from '../types';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  Users,
  BookOpen,
  FileSpreadsheet,
  GraduationCap,
  Printer,
  Database,
  Settings,
  School,
  ChevronRight,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Award,
  Sparkles,
  User,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  settings: AppSettings;
  currentYearName?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUser?: { id: string; username: string; role: 'admin' | 'user' };
  onOpenAccountSettings?: () => void;
  onLogout?: () => void;
  theme?: 'dark' | 'light';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  settings,
  currentYearName,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  onOpenAccountSettings,
  onLogout,
  theme,
}) => {
  // Detect current theme using prop, settings, or documentElement class
  const isLight =
    theme === 'light' ||
    (!theme && settings.theme === 'light') ||
    (!theme && typeof document !== 'undefined' && document.documentElement.classList.contains('light'));
  const menuItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'years', label: 'إدارة الأعوام الدراسية', icon: Calendar },
    { id: 'classes', label: 'إدارة الصفوف والشعب', icon: Layers },
    { id: 'students', label: 'إدارة الطلاب', icon: Users },
    { id: 'subjects', label: 'إدارة المواد الدراسية', icon: BookOpen },
    { id: 'grade_entry', label: 'إدخال الدرجات', icon: FileSpreadsheet },
    { id: 'decision_marks', label: 'إضافة درجات القرار', icon: ShieldCheck },
    { id: 'results', label: 'عرض النتائج', icon: GraduationCap },
    { id: 'exemption', label: 'الإعفاء العام والفردي', icon: Award },
    { id: 'reports', label: 'التقارير والطباعة', icon: Printer },
    { id: 'student_promotion', label: 'ترحيل الطلاب', icon: GraduationCap },
    { id: 'certificate_template', label: 'ضبط قالب الشهادات', icon: Sparkles },
    { id: 'backup', label: 'النسخ الاحتياطي واستعادة البيانات', icon: Database },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`no-print fixed top-0 right-0 z-50 h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-200 ease-in-out md:translate-x-0 select-none ${
          isMobileOpen
            ? 'translate-x-0 shadow-2xl w-72'
            : isCollapsed
            ? 'w-20 translate-x-full md:translate-x-0'
            : 'w-72 translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
          {/* Header Row: School Brand & Collapse Toggle */}
          <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center gap-2.5' : 'justify-between gap-2'}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
              <div
                className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-400 flex items-center justify-center text-white dark:text-slate-950 font-black shadow-md shadow-emerald-600/20 dark:shadow-emerald-400/15 shrink-0"
                title={settings.schoolName}
              >
                <School className="w-5 h-5" />
              </div>

              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <h2
                    className="font-black text-sm tracking-tight truncate max-w-[155px] text-slate-900 dark:text-slate-100"
                    title={settings.schoolName}
                  >
                    {settings.schoolName}
                  </h2>
                  <span className="text-[11px] truncate text-slate-500 dark:text-slate-400">
                    نظام الدرجات المكتبي
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0 ${
                isCollapsed ? 'w-10 h-10' : ''
              }`}
              title={isCollapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية (أيقونات فقط)'}
              aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية'}
            >
              {isCollapsed ? (
                <PanelRightOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <PanelRightClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Academic Year Badge */}
          {!isCollapsed && (
            <div className="mt-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">العام الدراسي:</span>
              <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {currentYearName || '2026–2027'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5 overflow-x-hidden">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-3 h-12'
                      : 'justify-between px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-400/30 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
                  }`}
                  aria-label={item.label}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                      }`}
                    />
                    {!isCollapsed && <span className="tracking-wide truncate">{item.label}</span>}
                  </div>

                  {/* Indicator Dot for Collapsed Active Item */}
                  {isCollapsed && isActive && (
                    <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full ring-2 bg-emerald-600 dark:bg-emerald-400 ring-white dark:ring-slate-900" />
                  )}
                </button>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div className="hidden md:flex absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 items-center gap-2">
                    <span>{item.label}</span>
                    {/* Arrow pointer */}
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 border-t border-r rotate-45 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Current User Card */}
        {currentUser && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            {!isCollapsed ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">{currentUser.username}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                      currentUser.role === 'admin'
                        ? 'bg-teal-50 dark:bg-teal-400/15 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-400/30'
                        : 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/30'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'مدير كامل' : 'معاينة فقط'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={onOpenAccountSettings}
                    className="flex-1 py-1 px-2 rounded-lg text-[11px] font-bold text-center cursor-pointer transition-colors bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
                  >
                    حسابي
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="py-1 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/70 dark:text-rose-400"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-1 group relative">
                <button
                  type="button"
                  onClick={onOpenAccountSettings}
                  className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors bg-slate-200 hover:bg-slate-300 text-emerald-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-emerald-400"
                  title="حسابي"
                >
                  <User className="w-4 h-4" />
                </button>

                {/* Collapsed Tooltip */}
                <div className="hidden md:flex flex-col absolute right-full bottom-0 mr-3 p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl shadow-xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 gap-1.5 min-w-[130px]">
                  <span className="font-bold text-xs">{currentUser.username}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                  </span>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400">انقر لفتح حسابي</div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 border-t border-r rotate-45 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          {!isCollapsed ? (
            <div className="flex flex-col gap-1 text-center select-none" dir="rtl">
              {/* Line 1: Concept & Supervision + Teacher Name */}
              <div className="flex items-center justify-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">فكرة وإشراف</span>
                <span className="text-[10px] leading-none select-none text-teal-700 dark:text-teal-400">◆</span>
                <span className="font-bold text-teal-700 dark:text-teal-400">الأستاذ مصطفى</span>
              </div>

              {/* Line 2: Subject Role + School Name */}
              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                <span className="font-medium text-slate-900 dark:text-slate-100">مدرس الرياضيات</span>
                <span className="text-[10px] leading-none select-none text-teal-700 dark:text-teal-400">◆</span>
                <span className="text-slate-500 dark:text-slate-400">إعدادية داقوق للبنين</span>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 my-1.5" />

              {/* Version & Copyright */}
              <div className="flex items-center justify-between text-[10px] px-0.5">
                <span className="text-slate-500 dark:text-slate-400">
                  جميع الحقوق محفوظة © 2026
                </span>
                <span className="font-mono font-medium text-slate-500 dark:text-slate-400">
                  v1.2.0
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-1 group relative">
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-medium">v1.2.0</span>
              {/* Tooltip for collapsed mode */}
              <div className="hidden md:flex flex-col absolute right-full bottom-0 mr-3 p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl shadow-xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 gap-1 min-w-[210px] text-center" dir="rtl">
                <div className="flex items-center justify-center gap-1.5 text-xs whitespace-nowrap">
                  <span className="text-slate-500 dark:text-slate-400">فكرة وإشراف</span>
                  <span className="text-[9px] leading-none select-none text-teal-700 dark:text-teal-400">◆</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400">الأستاذ مصطفى</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] whitespace-nowrap">
                  <span className="font-medium text-slate-900 dark:text-slate-100">مدرس الرياضيات</span>
                  <span className="text-[9px] leading-none select-none text-teal-700 dark:text-teal-400">◆</span>
                  <span className="text-slate-500 dark:text-slate-400">إعدادية داقوق للبنين</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 my-1" />
                <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 gap-2">
                  <span>جميع الحقوق محفوظة © 2026</span>
                  <span className="font-mono">v1.2.0</span>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 border-t border-r rotate-45 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
