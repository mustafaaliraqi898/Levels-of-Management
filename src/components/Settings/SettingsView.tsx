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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            إعدادات النظام والتقريب ومعادلات الدرجات
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تخصيص قواعد التقريب الحسابي لدرجة السعي والنهائي، بيانات المدرسة الرسمية، وضوابط الأمان
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>تم حفظ الإعدادات وإعادة احتساب درجات السعي والدرجات النهائية تلقائياً لجميع الطلاب!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. School Official Information */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <School className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            بيانات المدرسة والترويسة الرسمية للتقارير
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">اسم المدرسة الرسمي</label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">المدينة والمديرية العامة</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">اسم مدير المدرسة</label>
              <input
                type="text"
                value={formData.directorName}
                onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                required
              />
            </div>
          </div>
        </div>

        {/* 2. School Logo Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">شعار المدرسة</h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
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
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{logoSuccess}</span>
            </div>
          )}

          {logoError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{logoError}</span>
            </div>
          )}

          {formData.schoolLogo ? (
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl p-2.5 bg-white border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden">
                  <SchoolLogo
                    logoUrl={formData.schoolLogo}
                    schoolName={formData.schoolName}
                    size="custom"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-emerald-600 dark:bg-emerald-400 text-white dark:text-slate-950 text-[10px] font-black shadow-xs">
                  معتمد
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 text-center md:text-right">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    تم ضبط وتثبيت شعار المدرسة بنجاح
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    دقة طباعة عالية A4
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  هذا الشعار يظهر في ترويسة التقارير الرسمية، كشوف النتائج، وشيتات الإعفاء. يتم الحفاظ على أبعاده الهندسية ونقاء الألوان والشفافية بدون أي تشويه.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                  >
                    {logoProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span>تغيير الشعار</span>
                  </button>

                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={handleRemoveLogo}
                    className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-rose-200 dark:border-rose-500/30 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>حذف الشعار</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/70 dark:bg-slate-800/40">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-xs">
                {logoProcessing ? (
                  <div className="w-6 h-6 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                رفع شعار المدرسة للمطبوعات والتقارير الرسمية
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-4">
                يدعم صيغ PNG (مع شفافية)، JPG، JPEG، وWebP. يقوم النظام بتحسين أبعاد الشعار وضغطه تلقائياً لضمان أعلى جودة طباعة على ورق A4 بدون إبطاء التطبيق.
              </p>

              <button
                type="button"
                disabled={logoProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
              >
                {logoProcessing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>اختيار صورة من الجهاز</span>
              </button>

              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                ملاحظة: في حال عدم رفع أي شعار، تظهر جميع التقارير والمطبوعات بشكل طبيعي وأنيق بدون مساحات فارغة.
              </span>
            </div>
          )}
        </div>

        {/* 3. Kufic Geometric School Logo Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">شعار المدرسة بالخط الكوفي</h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{kuficSuccess}</span>
            </div>
          )}

          {kuficError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{kuficError}</span>
            </div>
          )}

          {formData.kuficLogo ? (
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl p-2.5 bg-white border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={formData.kuficLogo}
                    alt="شعار المدرسة بالخط الكوفي"
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                </div>
                <div className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-teal-700 dark:bg-teal-400 text-white dark:text-slate-950 text-[10px] font-black shadow-xs">
                  كوفي معتمد
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 text-center md:text-right">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    تم ضبط وتثبيت شعار المدرسة بالخط الكوفي بنجاح
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 font-medium">
                    مستقل عن الشعار الرسمي العام
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  هذا الشعار مخصص للشهادات والنماذج التكريمية التي تتطلب مظهراً هندسياً بالخط الكوفي. يبقى محفوظاً بشكل دائم ومستقل تماماً، ويمكن تغييره أو حذفه في أي وقت دون التأثير على الشعار الرسمي للمدرسة.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <button
                    type="button"
                    disabled={kuficProcessing}
                    onClick={() => kuficFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                  >
                    {kuficProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-teal-700 dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    )}
                    <span>تغيير الشعار الكوفي</span>
                  </button>

                  <button
                    type="button"
                    disabled={kuficProcessing}
                    onClick={handleRemoveKuficLogo}
                    className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-rose-200 dark:border-rose-500/30 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>حذف الشعار الكوفي</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-400 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/70 dark:bg-slate-800/40">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400 flex items-center justify-center mb-3 shadow-xs">
                {kuficProcessing ? (
                  <div className="w-6 h-6 border-2 border-teal-700 dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                رفع شعار المدرسة بالخط الكوفي
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-4">
                يدعم صيغ PNG (مع شفافية)، JPG، JPEG، وWebP. يُعالج الشعار تلقائياً ليناسب النماذج والشهادات التكريمية بدقة هندسية عالية دون إثقال التطبيق.
              </p>

              <button
                type="button"
                disabled={kuficProcessing}
                onClick={() => kuficFileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-400 dark:hover:bg-teal-300 dark:text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
              >
                {kuficProcessing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>اختيار صورة الشعار الكوفي من الجهاز</span>
              </button>

              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                ملاحظة: هذا الحقل مستقل تماماً عن شعار المدرسة الرسمي؛ يمكنك استخدام الشعارين معاً أو كلاً على حدة.
              </span>
            </div>
          )}
        </div>

        {/* 4. Rounding Rules */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              قاعدة تقريب الكسور وحساب المعدلات
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
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
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-600 dark:border-emerald-400 shadow-xs ring-1 ring-emerald-600/30 dark:ring-emerald-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="roundingRule"
                    value={rule}
                    checked={isSelected}
                    onChange={() => setFormData({ ...formData, roundingRule: rule })}
                    className="mt-1 w-4 h-4 accent-emerald-600 dark:accent-emerald-400"
                  />
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {info.title}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {info.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 5. Security & Confirmation Preferences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              ضوابط الأمان وحماية الدرجات السابقة
            </h3>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                طلب تأكيد صريح قبل تعديل أي درجة سابقة
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                عند النقر لتعديل درجات الفصول السابقة، تظهر نافذة تأكيد تحذر من تأثير التعديل على السعي والنهائي.
              </p>
            </div>

            <input
              type="checkbox"
              checked={formData.confirmPreviousTermEdits}
              onChange={(e) => setFormData({ ...formData, confirmPreviousTermEdits: e.target.checked })}
              className="w-5 h-5 rounded accent-emerald-600 dark:accent-emerald-400 cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>حفظ جميع الإعدادات وتطبيقها فوراً</span>
          </button>
        </div>
      </form>

      {/* Administrative Decision Settings */}
      <AdminDecisionSettingsSection currentAcademicYearId={currentAcademicYearId} />

      {/* 6. System Access Code & Security Section */}
      {userRole === 'admin' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                  <span>رمز الدخول والأمان للنظام</span>
                  {db.isAccessCodeConfigured() ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      مفعّل ومحفوظ في قاعدة SQLite
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
                      بانتظار الإعداد
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>تحديث رمز الدخول</span>
            </button>
          </div>
        </div>
      )}

      {/* Access Code Update Modal */}
      {isAccessCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">تحديث رمز الدخول للنظام</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">يُحفظ مشفراً في قاعدة SQLite بشكل دائم</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {accessCodeSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{accessCodeSuccess}</span>
              </div>
            )}

            {accessCodeError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{accessCodeError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAccessCode} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رمز الدخول الجديد (4 خانات على الأقل)
                </label>
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  required
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  placeholder="أدخل رمز الدخول الجديد"
                  className="w-full h-10 px-3 text-xs font-mono font-bold tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-600 dark:focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد رمز الدخول الجديد
                </label>
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  required
                  value={confirmNewAccessCode}
                  onChange={(e) => setConfirmNewAccessCode(e.target.value)}
                  placeholder="أعد إدخال الرمز للتأكيد"
                  className="w-full h-10 px-3 text-xs font-mono font-bold tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-600 dark:focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="showCodeCheck"
                  checked={showAccessCode}
                  onChange={(e) => setShowAccessCode(e.target.checked)}
                  className="rounded accent-emerald-600 dark:accent-emerald-400"
                />
                <label htmlFor="showCodeCheck" className="text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                  إظهار الرمز أثناء الكتابة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAccessCodeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAccessCodeLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
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
      {userRole === 'admin' && (
        <UserManagementSection currentUserId={currentUserId || ''} />
      )}
    </div>
  );
};
