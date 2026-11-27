import React, { useState, useRef } from 'react';
import { AppSettings, RoundingRule, UserRole } from '../../types';
import { db } from '../../services/storage';
import { ROUNDING_RULE_LABELS } from '../../services/calculations';
import {
  Settings,
  Save,
  CheckCircle2,
  Calculator,
  School,
  ShieldAlert,
  Monitor,
  Image as ImageIcon,
  Upload,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  KeyRound,
  Lock,
  Users,
  Mail,
  Award,
  ArrowRight,
} from 'lucide-react';
import { UserManagementSection } from './UserManagementSection';
import { AdminDecisionSettingsSection } from './AdminDecisionSettingsSection';
import { processLogoFile } from '../../utils/imageUtils';
import { SchoolLogo } from '../Common/SchoolLogo';

interface SettingsViewProps {
  settings: AppSettings;
  currentUserId?: string;
  userRole?: UserRole;
  currentAcademicYearId?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  currentUserId,
  userRole = 'admin',
  currentAcademicYearId,
}) => {
  const [activeSection, setActiveSection] = useState<'home' | 'school' | 'grades' | 'ministerial' | 'users' | 'security' | 'email'>('home');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Independent state & ref for Kufic Logo
  const [kuficProcessing, setKuficProcessing] = useState(false);
  const [kuficError, setKuficError] = useState<string | null>(null);
  const [kuficSuccess, setKuficSuccess] = useState<string | null>(null);
  const kuficFileInputRef = useRef<HTMLInputElement>(null);

  // Access Code State
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState('');
  const [confirmNewAccessCode, setConfirmNewAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);
  const [accessCodeSuccess, setAccessCodeSuccess] = useState<string | null>(null);
  const [isAccessCodeLoading, setIsAccessCodeLoading] = useState(false);

  const handleUpdateAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessCodeError(null);
    const clean = newAccessCode.trim();
    if (clean.length < 4) {
      setAccessCodeError('يجب ألا يقل رمز الدخول عن 4 خانات أو أرقام.');
      return;
    }
    if (clean !== confirmNewAccessCode.trim()) {
      setAccessCodeError('رمز الدخول وتأكيد الرمز غير متطابقين.');
      return;
    }
    setIsAccessCodeLoading(true);
    try {
      const res = await db.saveAccessCode(clean);
      if (res.success) {
        setAccessCodeSuccess('تم تحديث وحفظ رمز الدخول بنجاح في قاعدة SQLite.');
        setFormData((prev) => ({ ...prev, isAccessCodeConfigured: true }));
        setTimeout(() => {
          setIsAccessCodeModalOpen(false);
          setAccessCodeSuccess(null);
          setNewAccessCode('');
          setConfirmNewAccessCode('');
        }, 1500);
      } else {
        setAccessCodeError(res.error || 'تعذر حفظ رمز الدخول');
      }
    } catch (err: any) {
      setAccessCodeError(err.message || 'حدث خطأ أثناء حفظ الرمز');
    } finally {
      setIsAccessCodeLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoProcessing(true);
    setLogoError(null);
    setLogoSuccess(null);

    try {
      const result = await processLogoFile(file);
      const updatedSettings: AppSettings = {
        ...formData,
        schoolLogo: result.dataUrl,
      };
      setFormData(updatedSettings);
      // Persist permanently immediately to system settings
      db.updateSettings({ schoolLogo: result.dataUrl });
      setLogoSuccess(
        `تم حفظ شعار المدرسة بنجاح بصيغة ${result.format} وبحجم محسن (${result.sizeKb} ك.ب).`
      );
      setTimeout(() => setLogoSuccess(null), 3500);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'تعذر معالجة ملف الصورة، يرجى المحاولة بصيغة أخرى.';
      setLogoError(message);
    } finally {
      setLogoProcessing(false);
      // Reset input value so selecting the same file again triggers change event
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoError(null);
    const updatedSettings: AppSettings = {
      ...formData,
      schoolLogo: undefined,
    };
    setFormData(updatedSettings);
    // Persist permanently immediately
    db.updateSettings({ schoolLogo: undefined });
    setLogoSuccess('تم حذف شعار المدرسة من النظام بنجاح.');
    setTimeout(() => setLogoSuccess(null), 3000);
  };

  const handleKuficFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setKuficProcessing(true);
    setKuficError(null);
    setKuficSuccess(null);

    try {
      const result = await processLogoFile(file);
      const updatedSettings: AppSettings = {
        ...formData,
        kuficLogo: result.dataUrl,
      };
      setFormData(updatedSettings);
      // Persist permanently immediately to system settings
      db.updateSettings({ kuficLogo: result.dataUrl });
      setKuficSuccess(
        `تم حفظ شعار المدرسة بالخط الكوفي بنجاح بصيغة ${result.format} وبحجم محسن (${result.sizeKb} ك.ب).`
      );
      setTimeout(() => setKuficSuccess(null), 3500);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'تعذر معالجة ملف الصورة، يرجى المحاولة بصيغة أخرى.';
      setKuficError(message);
    } finally {
      setKuficProcessing(false);
      // Reset input value so selecting the same file again triggers change event
      if (kuficFileInputRef.current) {
        kuficFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveKuficLogo = () => {
    setKuficError(null);
    const updatedSettings: AppSettings = {
      ...formData,
      kuficLogo: undefined,
    };
    setFormData(updatedSettings);
    // Persist permanently immediately
    db.updateSettings({ kuficLogo: undefined });
    setKuficSuccess('تم حذف الشعار الكوفي من النظام بنجاح.');
    setTimeout(() => setKuficSuccess(null), 3000);
  };

  const roundingRules: RoundingRule[] = [
    'standard',
    'ceil',
    'floor',
    'one_decimal',
    'two_decimals',
  ];

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-2xl shadow-sm dark:shadow-xl flex items-center justify-between app-card-surface">
        <div>
          <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#3156C9] dark:text-[#60A5FA]" />
            {activeSection === 'home' ? 'إعدادات النظام' : ({ school: 'بيانات المدرسة والهوية', grades: 'إعدادات الدرجات والتقريب', ministerial: 'الضوابط الوزارية والإكمال', users: 'إدارة المستخدمين والصلاحيات', security: 'الأمان ورمز الدخول', email: 'البريد الإلكتروني والاستعادة' } as const)[activeSection]}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">
            {activeSection === 'home' ? 'اختر القسم الذي تريد ضبط إعداداته' : 'إدارة إعدادات هذا القسم وحفظ التغييرات'}
          </p>
          {activeSection !== 'home' && (
            <button type="button" onClick={() => setActiveSection('home')} className="px-4 py-2 rounded-xl bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#3156C9] dark:text-[#60A5FA] text-xs font-bold flex items-center gap-2 shrink-0">
              <ArrowRight className="w-4 h-4" /> العودة إلى الإعدادات
            </button>
          )}
        </div>
      </div>

      {activeSection === 'home' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            { id: 'school' as const, title: 'بيانات المدرسة والهوية', description: 'اسم المدرسة والشعارات والترويسة الرسمية', Icon: School, tone: 'text-[#3156C9] dark:text-[#60A5FA]', bg: 'bg-[#3156C9]/10 dark:bg-[#2785F5]/15' },
            { id: 'grades' as const, title: 'إعدادات الدرجات', description: 'قواعد التقريب وحماية الدرجات السابقة', Icon: Calculator, tone: 'text-[#059669] dark:text-[#10B981]', bg: 'bg-[#10B981]/10 dark:bg-[#10B981]/15' },
            { id: 'ministerial' as const, title: 'الضوابط الوزارية والإكمال', description: 'درجات المساعدة وحدود الرسوب لكل عام', Icon: Award, tone: 'text-[#8B5CF6] dark:text-[#A78BFA]', bg: 'bg-[#8B5CF6]/10 dark:bg-[#8B5CF6]/15' },
            { id: 'users' as const, title: 'المستخدمون والصلاحيات', description: 'إدارة الحسابات والأدوار وحالة المستخدم', Icon: Users, tone: 'text-[#D69B42] dark:text-[#D69B42]', bg: 'bg-[#D69B42]/10 dark:bg-[#D69B42]/15', adminOnly: true },
            { id: 'security' as const, title: 'الأمان ورمز الدخول', description: 'تحديث رمز الدخول وحماية النظام', Icon: Lock, tone: 'text-[#0D9488] dark:text-[#2DD4BF]', bg: 'bg-[#0D9488]/10 dark:bg-[#0D9488]/15', adminOnly: true },
            { id: 'email' as const, title: 'البريد الإلكتروني والاستعادة', description: 'إعداد Gmail لإرسال رموز استعادة كلمة المرور', Icon: Mail, tone: 'text-[#DB2777] dark:text-[#F472B6]', bg: 'bg-[#DB2777]/10 dark:bg-[#DB2777]/15', adminOnly: true },
          ].filter((item) => !item.adminOnly || userRole === 'admin').map(({ id, title, description, Icon, tone, bg }) => (
            <button key={id} type="button" onClick={() => setActiveSection(id)} className="group text-right bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#3156C9]/50 dark:hover:border-[#60A5FA]/50 transition-all app-card-surface">
              <div className="flex items-center gap-3">
                <span className={`w-12 h-12 rounded-xl ${bg} ${tone} flex items-center justify-center shrink-0`}><Icon className="w-6 h-6" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-[#1E293B] dark:text-[#E2E8F0]">{title}</span>
                  <span className="block text-xs text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">{description}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#3156C9] dark:group-hover:text-[#60A5FA] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#059669] dark:text-[#10B981]" />
          <span>تم حفظ الإعدادات وإعادة احتساب درجات السعي والدرجات النهائية تلقائياً لجميع الطلاب!</span>
        </div>
      )}

      {(activeSection === 'school' || activeSection === 'grades') && (
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {activeSection === 'school' && <>
        {/* 1. School Official Information */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm dark:shadow-lg app-card-surface">
          <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0] mb-4 flex items-center gap-2">
            <School className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
            بيانات المدرسة والترويسة الرسمية للتقارير
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">اسم المدرسة الرسمي</label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">المدينة والمديرية العامة</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1.5">اسم مدير المدرسة</label>
              <input
                type="text"
                value={formData.directorName}
                onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                required
              />
            </div>
          </div>
        </div>

        {/* 2. School Logo Section */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm dark:shadow-lg app-card-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
              <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">شعار المدرسة</h3>
            </div>
            <span className="text-xs text-[#64748B] dark:text-[#8493A8]">
              يُعتمد الشعار تلقائياً في جميع التقارير، كشوف الدرجات، والشهادات الرسمية القابلة للطباعة
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {logoSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{logoSuccess}</span>
            </div>
          )}

          {logoError && (
            <div className="mb-4 p-3 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{logoError}</span>
            </div>
          )}

          {formData.schoolLogo ? (
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl p-2.5 bg-white border-2 border-[#DCE3ED] dark:border-[#2D3B4D] shadow-sm flex items-center justify-center overflow-hidden">
                  <SchoolLogo
                    logoUrl={formData.schoolLogo}
                    schoolName={formData.schoolName}
                    size="custom"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-[#059669] dark:bg-[#10B981] text-white dark:text-[#0B1420] text-[10px] font-black shadow-xs">
                  معتمد
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 text-center md:text-right">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0]">
                    تم ضبط وتثبيت شعار المدرسة بنجاح
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#10B981]/12 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30">
                    دقة طباعة عالية A4
                  </span>
                </div>
                <p className="text-xs text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                  هذا الشعار يظهر في ترويسة التقارير الرسمية، كشوف النتائج، وشيتات الإعفاء. يتم الحفاظ على أبعاده الهندسية ونقاء الألوان والشفافية بدون أي تشويه.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#26364B] hover:bg-[#EDF1F7] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-[#DCE3ED] dark:border-[#2D3B4D] disabled:opacity-50"
                  >
                    {logoProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                    )}
                    <span>تغيير الشعار</span>
                  </button>

                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={handleRemoveLogo}
                    className="px-4 py-2 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 hover:bg-[#E35D6A]/20 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-[#E35D6A]/30 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الشعار</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#CBD5E1] dark:border-[#2D3B4D] hover:border-[#3156C9] dark:hover:border-[#2785F5] rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors bg-[#F8FAFC] dark:bg-[#202E40]">
              <div className="w-14 h-14 rounded-2xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center mb-3 shadow-xs">
                {logoProcessing ? (
                  <div className="w-6 h-6 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0] mb-1">
                رفع شعار المدرسة للمطبوعات والتقارير الرسمية
              </h4>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] max-w-md leading-relaxed mb-4">
                يدعم صيغ PNG (مع شفافية)، JPG، JPEG، وWebP. يقوم النظام بتحسين أبعاد الشعار وضغطه تلقائياً لضمان أعلى جودة طباعة على ورق A4 بدون إبطاء التطبيق.
              </p>

              <button
                type="button"
                disabled={logoProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
              >
                {logoProcessing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>اختيار صورة من الجهاز</span>
              </button>

              <span className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-3">
                ملاحظة: في حال عدم رفع أي شعار، تظهر جميع التقارير والمطبوعات بشكل طبيعي وأنيق بدون مساحات فارغة.
              </span>
            </div>
          )}
        </div>

        {/* 3. Kufic Geometric School Logo Section */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm dark:shadow-lg app-card-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
              <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">شعار المدرسة بالخط الكوفي</h3>
            </div>
            <span className="text-xs text-[#64748B] dark:text-[#8493A8] font-medium">
              شعار هندسي بالخط الكوفي مخصص للشهادات، وثائق التقدير، والمناسبات المدرسية الخاصة
            </span>
          </div>

          <input
            ref={kuficFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleKuficFileSelect}
            className="hidden"
          />

          {kuficSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{kuficSuccess}</span>
            </div>
          )}

          {kuficError && (
            <div className="mb-4 p-3 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{kuficError}</span>
            </div>
          )}

          {formData.kuficLogo ? (
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-xl bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl p-2.5 bg-white border-2 border-[#DCE3ED] dark:border-[#2D3B4D] shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={formData.kuficLogo}
                    alt="شعار المدرسة بالخط الكوفي"
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                </div>
                <div className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-[#059669] dark:bg-[#10B981] text-white dark:text-[#0B1420] text-[10px] font-black shadow-xs">
                  كوفي معتمد
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 text-center md:text-right">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0]">
                    تم ضبط وتثبيت شعار المدرسة بالخط الكوفي بنجاح
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#3156C9]/8 dark:bg-[#2785F5]/12 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/25 font-medium">
                    مستقل عن الشعار الرسمي العام
                  </span>
                </div>
                <p className="text-xs text-[#475569] dark:text-[#A8B5C7] leading-relaxed">
                  هذا الشعار مخصص للشهادات والنماذج التكريمية التي تتطلب مظهراً هندسياً بالخط الكوفي. يبقى محفوظاً بشكل دائم ومستقل تماماً، ويمكن تغييره أو حذفه في أي وقت دون التأثير على الشعار الرسمي للمدرسة.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <button
                    type="button"
                    disabled={kuficProcessing}
                    onClick={() => kuficFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#26364B] hover:bg-[#EDF1F7] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-[#DCE3ED] dark:border-[#2D3B4D] disabled:opacity-50"
                  >
                    {kuficProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                    )}
                    <span>تغيير الشعار الكوفي</span>
                  </button>

                  <button
                    type="button"
                    disabled={kuficProcessing}
                    onClick={handleRemoveKuficLogo}
                    className="px-4 py-2 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 hover:bg-[#E35D6A]/20 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-[#E35D6A]/30 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الشعار الكوفي</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#CBD5E1] dark:border-[#2D3B4D] hover:border-[#3156C9] dark:hover:border-[#2785F5] rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors bg-[#F8FAFC] dark:bg-[#202E40]">
              <div className="w-14 h-14 rounded-2xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center mb-3 shadow-xs">
                {kuficProcessing ? (
                  <div className="w-6 h-6 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0] mb-1">
                رفع شعار المدرسة بالخط الكوفي
              </h4>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] max-w-md leading-relaxed mb-4">
                يدعم صيغ PNG (مع شفافية)، JPG، JPEG، وWebP. يُعالج الشعار تلقائياً ليناسب النماذج والشهادات التكريمية بدقة هندسية عالية دون إثقال التطبيق.
              </p>

              <button
                type="button"
                disabled={kuficProcessing}
                onClick={() => kuficFileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
              >
                {kuficProcessing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>اختيار صورة الشعار الكوفي من الجهاز</span>
              </button>

              <span className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-3">
                ملاحظة: هذا الحقل مستقل تماماً عن شعار المدرسة الرسمي؛ يمكنك استخدام الشعارين معاً أو كلاً على حدة.
              </span>
            </div>
          )}
        </div>

        </>}
        {activeSection === 'grades' && <>
        {/* 4. Rounding Rules */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm dark:shadow-lg app-card-surface">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
            <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              قاعدة تقريب الكسور وحساب المعدلات
            </h3>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#8493A8] mb-5 leading-relaxed">
            يتم تطبيق هذه القاعدة مباشرة على حساب <strong>درجة السعي السنوي</strong> (مجموع الفصول الثلاثة ÷ 3) وحساب <strong>الدرجة النهائية</strong> (السعي + الامتحان النهائي ÷ 2).
          </p>

          <div className="flex flex-col gap-3">
            {roundingRules.map((rule) => {
              const info = ROUNDING_RULE_LABELS[rule];
              const isSelected = formData.roundingRule === rule;

              return (
                <label
                  key={rule}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border-[#3156C9] dark:border-[#2785F5] shadow-xs ring-1 ring-[#2785F5]/30'
                      : 'bg-[#F8FAFC] dark:bg-[#202E40] border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#CBD5E1] dark:hover:border-[#3A4D63]'
                  }`}
                >
                  <input
                    type="radio"
                    name="roundingRule"
                    value={rule}
                    checked={isSelected}
                    onChange={() => setFormData({ ...formData, roundingRule: rule })}
                    className="mt-1 w-4 h-4 accent-[#3156C9] dark:accent-[#2785F5]"
                  />
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${isSelected ? 'text-[#3156C9] dark:text-[#60A5FA]' : 'text-[#1E293B] dark:text-[#E2E8F0]'}`}>
                      {info.title}
                    </span>
                    <span className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">
                      {info.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 5. Security & Confirmation Preferences */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm dark:shadow-lg app-card-surface">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA]" />
            <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              ضوابط الأمان وحماية الدرجات السابقة
            </h3>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl">
            <div>
              <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0]">
                طلب تأكيد صريح قبل تعديل أي درجة سابقة
              </h4>
              <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">
                عند النقر لتعديل درجات الفصول السابقة، تظهر نافذة تأكيد تحذر من تأثير التعديل على السعي والنهائي.
              </p>
            </div>

            <input
              type="checkbox"
              checked={formData.confirmPreviousTermEdits}
              onChange={(e) => setFormData({ ...formData, confirmPreviousTermEdits: e.target.checked })}
              className="w-5 h-5 rounded accent-[#3156C9] dark:accent-[#2785F5] cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white font-black text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>حفظ جميع الإعدادات وتطبيقها فوراً</span>
          </button>
        </div>
        </>}
      </form>
      )}

      {/* Administrative Decision Settings */}
      {activeSection === 'ministerial' && <AdminDecisionSettingsSection currentAcademicYearId={currentAcademicYearId} />}

      {/* 6. System Access Code & Security Section */}
      {activeSection === 'security' && userRole === 'admin' && (
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-2xl p-6 shadow-sm app-card-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA]">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0] flex flex-wrap items-center gap-2">
                  <span>رمز الدخول والأمان للنظام</span>
                  {db.isAccessCodeConfigured() ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981]">
                      مفعّل ومحفوظ في قاعدة SQLite
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D69B42]/10 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42]">
                      بانتظار الإعداد
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1">
                  رمز أمان خاص بالنظام لحماية سرية البيانات والسجلات المدرسية ومصادقة العمليات الحساسة.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAccessCodeError(null);
                setAccessCodeSuccess(null);
                setNewAccessCode('');
                setConfirmNewAccessCode('');
                setIsAccessCodeModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <KeyRound className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>تحديث رمز الدخول</span>
            </button>
          </div>
        </div>
      )}

      {/* Access Code Update Modal */}
      {isAccessCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[16px] p-6 shadow-2xl text-[#1E293B] dark:text-[#E2E8F0]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#DCE3ED] dark:border-[#2D3B4D]">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0]">تحديث رمز الدخول للنظام</h4>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8493A8]">يُحفظ مشفراً في قاعدة SQLite بشكل دائم</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {accessCodeSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{accessCodeSuccess}</span>
              </div>
            )}

            {accessCodeError && (
              <div className="mb-4 p-3 rounded-xl bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{accessCodeError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAccessCode} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1">
                  رمز الدخول الجديد (4 خانات على الأقل)
                </label>
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  required
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  placeholder="أدخل رمز الدخول الجديد"
                  className="w-full h-10 px-3 text-xs font-mono font-bold tracking-widest rounded-xl bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] focus:outline-hidden focus:border-[#2785F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-1">
                  تأكيد رمز الدخول الجديد
                </label>
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  required
                  value={confirmNewAccessCode}
                  onChange={(e) => setConfirmNewAccessCode(e.target.value)}
                  placeholder="أعد إدخال الرمز للتأكيد"
                  className="w-full h-10 px-3 text-xs font-mono font-bold tracking-widest rounded-xl bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] focus:outline-hidden focus:border-[#2785F5]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="showCodeCheck"
                  checked={showAccessCode}
                  onChange={(e) => setShowAccessCode(e.target.checked)}
                  className="rounded accent-[#3156C9] dark:accent-[#2785F5]"
                />
                <label htmlFor="showCodeCheck" className="text-xs text-[#475569] dark:text-[#A8B5C7] select-none cursor-pointer">
                  إظهار الرمز أثناء الكتابة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                <button
                  type="button"
                  onClick={() => setIsAccessCodeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3B4D] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAccessCodeLoading}
                  className="px-5 py-2 rounded-xl bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isAccessCodeLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>حفظ الرمز في SQLite</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. User Accounts & Access Control (Admin-Only Section) */}
      {activeSection === 'users' && userRole === 'admin' && (
        <UserManagementSection currentUserId={currentUserId || ''} section="users" />
      )}
      {activeSection === 'email' && userRole === 'admin' && (
        <UserManagementSection currentUserId={currentUserId || ''} section="email" />
      )}
    </div>
  );
};
