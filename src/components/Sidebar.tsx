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
}) => {
  const menuItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isHighlight?: boolean;
  }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'years', label: 'إدارة الأعوام الدراسية', icon: Calendar },
    { id: 'classes', label: 'إدارة الصفوف والشعب', icon: Layers },
    { id: 'students', label: 'إدارة الطلاب', icon: Users },
    { id: 'subjects', label: 'إدارة المواد الدراسية', icon: BookOpen },
    {
      id: 'grade_entry',
      label: 'إدخال الدرجات',
      icon: FileSpreadsheet,
      isHighlight: true,
    },
    {
      id: 'decision_marks',
      label: 'إضافة درجات القرار',
      icon: ShieldCheck,
      isHighlight: false,
    },
    { id: 'results', label: 'عرض النتائج', icon: GraduationCap },
    { id: 'exemption', label: 'الإعفاء العام والفردي', icon: Award, isHighlight: false },
    { id: 'reports', label: 'التقارير والطباعة', icon: Printer },
    {
      id: 'student_promotion',
      label: 'ترحيل الطلبة',
      icon: GraduationCap,
      isHighlight: false,
    },
    {
      id: 'certificate_template',
      label: 'ضبط قالب الشهادات',
      icon: Sparkles,
    },
    { id: 'backup', label: 'النسخ الاحتياطي واستعادة البيانات', icon: Database },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`no-print fixed top-0 right-0 z-50 h-screen bg-slate-900 border-l border-slate-800 flex flex-col justify-between transition-all duration-200 ease-in-out md:translate-x-0 select-none ${
          isMobileOpen
            ? 'translate-x-0 shadow-2xl w-72'
            : isCollapsed
            ? 'w-20 translate-x-full md:translate-x-0'
            : 'w-72 translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
          {/* Header Row: School Brand & Collapse Toggle */}
          <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center gap-2.5' : 'justify-between gap-2'}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
              <div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0"
                title={settings.schoolName}
              >
                <School className="w-5 h-5 text-slate-950" />
              </div>

              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <h2
                    className="font-black text-sm text-white tracking-tight truncate max-w-[155px]"
                    title={settings.schoolName}
                  >
                    {settings.schoolName}
                  </h2>
                  <span className="text-[11px] text-slate-400 truncate">
                    نظام الدرجات المكتبي
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0 ${
                isCollapsed ? 'w-10 h-10' : ''
              }`}
              title={isCollapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية (أيقونات فقط)'}
              aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية'}
            >
              {isCollapsed ? (
                <PanelRightOpen className="w-5 h-5 text-emerald-400" />
              ) : (
                <PanelRightClose className="w-4 h-4 text-slate-400 hover:text-white" />
              )}
            </button>
          </div>

          {/* Academic Year Badge */}
          {!isCollapsed && (
            <div className="mt-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]">
              <span className="text-slate-400">العام الدراسي:</span>
              <span className="font-bold text-emerald-400 font-mono">
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
                      ? item.isHighlight
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                        : 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                      : item.isHighlight
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-950/60'
                      : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                  }`}
                  aria-label={item.label}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? item.isHighlight
                            ? 'text-white'
                            : 'text-emerald-400'
                          : item.isHighlight
                          ? 'text-emerald-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!isCollapsed && <span className="tracking-wide truncate">{item.label}</span>}
                  </div>

                  {/* Indicator Dot for Collapsed Highlight */}
                  {isCollapsed && item.isHighlight && (
                    <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                  )}
                </button>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div className="hidden md:flex absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-slate-900/95 border border-slate-700 text-white text-xs font-bold rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 items-center gap-2">
                    <span>{item.label}</span>
                    {/* Arrow pointer */}
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-slate-900 border-t border-r border-slate-700 rotate-45" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Current User Card */}
        {currentUser && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/70">
            {!isCollapsed ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-200 truncate">{currentUser.username}</span>
                      <span className="text-[10px] text-slate-400">
                        {currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      currentUser.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={onOpenAccountSettings}
                    className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold text-center cursor-pointer transition-colors"
                  >
                    حسابي
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-rose-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center cursor-pointer transition-colors"
                  title="حسابي"
                >
                  <User className="w-4 h-4" />
                </button>

                {/* Collapsed Tooltip */}
                <div className="hidden md:flex flex-col absolute right-full bottom-0 mr-3 p-2.5 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 gap-1.5 min-w-[130px]">
                  <span className="font-bold text-xs text-white">{currentUser.username}</span>
                  <span className="text-[10px] text-slate-400">
                    {currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                  </span>
                  <div className="text-[10px] text-emerald-400">انقر لفتح حسابي</div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-slate-900 border-t border-r border-slate-700 rotate-45" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Offline System Status */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>نظام محلي (Offline)</span>
                </span>
                <span className="font-mono text-slate-500">v1.2.0</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                يعمل بدون إنترنت تماماً مع تخزين SQLite/IndexedDB محلي آمن لحماية الدرجات.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-1 group relative">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {/* Tooltip for offline status in collapsed mode */}
              <div className="hidden md:flex absolute right-full bottom-0 mr-3 px-3 py-1.5 bg-slate-900/95 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>يعمل بدون إنترنت محلياً (Offline)</span>
                <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-slate-900 border-t border-r border-slate-700 rotate-45" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
