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
          className="no-print fixed inset-0 z-40 bg-[#111C2A]/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`no-print fixed top-0 right-0 z-50 h-screen bg-white dark:bg-[#202D3E] border-l border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col justify-between transition-all duration-200 ease-in-out md:translate-x-0 select-none ${
          isMobileOpen
            ? 'translate-x-0 shadow-2xl w-72'
            : isCollapsed
            ? 'w-20 translate-x-full md:translate-x-0'
            : 'w-72 translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col gap-2">
          {/* Header Row: School Brand & Collapse Toggle */}
          <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center gap-2.5' : 'justify-between gap-2'}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
              <div
                className="w-10 h-10 rounded-xl bg-[#3156C9] flex items-center justify-center text-white font-black shadow-sm shadow-[#3156C9]/25 shrink-0"
                title={settings.schoolName}
              >
                <School className="w-5 h-5" />
              </div>

              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <h2
                    className="font-black text-sm tracking-tight truncate max-w-[155px] text-[#1E293B] dark:text-[#E2E8F0]"
                    title={settings.schoolName}
                  >
                    {settings.schoolName}
                  </h2>
                  <span className="text-[11px] truncate text-[#64748B] dark:text-[#A8B5C7]">
                    نظام الدرجات المكتبي
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`p-2 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] hover:border-[#2785F5] text-[#64748B] dark:text-[#A8B5C7] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0 ${
                isCollapsed ? 'w-10 h-10' : ''
              }`}
              title={isCollapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية (أيقونات فقط)'}
              aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية'}
            >
              {isCollapsed ? (
                <PanelRightOpen className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
              ) : (
                <PanelRightClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Academic Year Badge */}
          {!isCollapsed && (
            <div className="mt-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F4F6FA] dark:bg-[#1C2939] text-[11px]">
              <span className="text-[#64748B] dark:text-[#A8B5C7]">العام الدراسي:</span>
              <span className="font-bold font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA]">
                {currentYearName || '2026–2027'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 overflow-x-hidden">
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
                  className={`relative w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-3 h-12'
                      : 'justify-between px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#3156C9]/10 dark:bg-[#3156C9]/22 text-[#3156C9] dark:text-white border border-[#3156C9]/30 dark:border-[#2785F5]/45 shadow-xs'
                      : 'text-[#64748B] dark:text-[#A8B5C7] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] border border-transparent'
                  }`}
                  aria-label={item.label}
                >
                  {isActive && !isCollapsed && (
                    <span className="absolute right-1 top-2 bottom-2 w-1 rounded-full bg-[#3156C9] dark:bg-[#2785F5]" />
                  )}

                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 pr-1'}`}>
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? 'text-[#3156C9] dark:text-[#60A5FA]'
                          : 'text-[#64748B] dark:text-[#8493A8] group-hover:text-[#1E293B] dark:group-hover:text-[#E2E8F0]'
                      }`}
                    />
                    {!isCollapsed && <span className="tracking-wide truncate">{item.label}</span>}
                  </div>

                  {/* Indicator Dot for Collapsed Active Item */}
                  {isCollapsed && isActive && (
                    <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full ring-2 bg-[#3156C9] dark:bg-[#2785F5] ring-white dark:ring-[#202D3E]" />
                  )}
                </button>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div className="hidden md:flex absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 items-center gap-2">
                    <span>{item.label}</span>
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 border-t border-r rotate-45 bg-white dark:bg-[#1C2939] border-[#DCE3ED] dark:border-[#2D3B4D]" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Current User Card */}
        {currentUser && (
          <div className="p-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F4F6FA] dark:bg-[#1C2939]/80">
            {!isCollapsed ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 bg-[#3156C9]/12 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA]">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate text-[#1E293B] dark:text-[#E2E8F0]">{currentUser.username}</span>
                      <span className="text-[10px] text-[#64748B] dark:text-[#A8B5C7]">
                        {currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                      currentUser.role === 'admin'
                        ? 'bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA] border-[#3156C9]/25 dark:border-[#60A5FA]/30'
                        : 'bg-[#A78BFA]/15 text-[#7C3AED] dark:text-[#A78BFA] border-[#A78BFA]/30'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'مدير كامل' : 'معاينة فقط'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={onOpenAccountSettings}
                    className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold text-center cursor-pointer transition-colors bg-[#EDF1F7] hover:bg-[#DCE3ED] text-[#1E293B] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D]"
                  >
                    حسابي
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors bg-[#E35D6A]/10 hover:bg-[#E35D6A]/20 text-[#C83D4B] dark:text-[#E35D6A] border border-[#E35D6A]/25"
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
                  className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors bg-[#EDF1F7] hover:bg-[#DCE3ED] text-[#3156C9] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] dark:text-[#60A5FA] border border-[#DCE3ED] dark:border-[#2D3B4D]"
                  title="حسابي"
                >
                  <User className="w-4 h-4" />
                </button>

                {/* Collapsed Tooltip */}
                <div className="hidden md:flex flex-col absolute right-full bottom-0 mr-3 p-2.5 border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] rounded-xl shadow-xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 gap-1.5 min-w-[130px]">
                  <span className="font-bold text-xs">{currentUser.username}</span>
                  <span className="text-[10px] text-[#64748B] dark:text-[#A8B5C7]">
                    {currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                  </span>
                  <div className="text-[10px] text-[#3156C9] dark:text-[#60A5FA]">انقر لفتح حسابي</div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 border-t border-r rotate-45 bg-white dark:bg-[#1C2939] border-[#DCE3ED] dark:border-[#2D3B4D]" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F4F6FA] dark:bg-[#1C2939]">
          {!isCollapsed ? (
            <div className="flex flex-col gap-1 text-center select-none" dir="rtl">
              <div className="flex items-center justify-center gap-1.5 text-xs">
                <span className="text-[#64748B] dark:text-[#A8B5C7]">فكرة وإشراف</span>
                <span className="text-[10px] leading-none select-none text-[#3156C9] dark:text-[#60A5FA]">◆</span>
                <span className="font-bold text-[#3156C9] dark:text-[#60A5FA]">الأستاذ مصطفى</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                <span className="font-medium text-[#1E293B] dark:text-[#E2E8F0]">مدرس الرياضيات</span>
                <span className="text-[10px] leading-none select-none text-[#3156C9] dark:text-[#60A5FA]">◆</span>
                <span className="text-[#64748B] dark:text-[#A8B5C7]">إعدادية داقوق للبنين</span>
              </div>

              <div className="border-t border-[#DCE3ED] dark:border-[#2D3B4D] my-1.5" />

              <div className="flex items-center justify-between text-[10px] px-0.5">
                <span className="text-[#64748B] dark:text-[#8493A8]">
                  جميع الحقوق محفوظة © 2026
                </span>
                <span className="font-mono font-medium text-[#64748B] dark:text-[#8493A8]">
                  v1.2.0
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-1 group relative">
              <span className="font-mono text-[10px] text-[#64748B] dark:text-[#8493A8] font-medium">v1.2.0</span>
              <div className="hidden md:flex flex-col absolute right-full bottom-0 mr-3 p-2.5 border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] rounded-xl shadow-xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 gap-1 min-w-[210px] text-center" dir="rtl">
                <div className="flex items-center justify-center gap-1.5 text-xs whitespace-nowrap">
                  <span className="text-[#64748B] dark:text-[#A8B5C7]">فكرة وإشراف</span>
                  <span className="text-[9px] leading-none select-none text-[#3156C9] dark:text-[#60A5FA]">◆</span>
                  <span className="font-bold text-[#3156C9] dark:text-[#60A5FA]">الأستاذ مصطفى</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] whitespace-nowrap">
                  <span className="font-medium text-[#1E293B] dark:text-[#E2E8F0]">مدرس الرياضيات</span>
                  <span className="text-[9px] leading-none select-none text-[#3156C9] dark:text-[#60A5FA]">◆</span>
                  <span className="text-[#64748B] dark:text-[#A8B5C7]">إعدادية داقوق للبنين</span>
                </div>
                <div className="border-t border-[#DCE3ED] dark:border-[#2D3B4D] my-1" />
                <div className="flex items-center justify-between text-[9px] text-[#64748B] dark:text-[#8493A8] gap-2">
                  <span>جميع الحقوق محفوظة © 2026</span>
                  <span className="font-mono">v1.2.0</span>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 border-t border-r rotate-45 bg-white dark:bg-[#1C2939] border-[#DCE3ED] dark:border-[#2D3B4D]" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
