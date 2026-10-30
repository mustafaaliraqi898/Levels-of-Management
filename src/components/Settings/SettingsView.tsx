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
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-300" />
            إعدادات النظام والتقريب ومعادلات الدرجات
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            تخصيص قواعد التقريب الحسابي لدرجة السعي والنهائي، بيانات المدرسة الرسمية، وضوابط الأمان
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>تم حفظ الإعدادات وإعادة احتساب درجات السعي والدرجات النهائية تلقائياً لجميع الطلاب!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. School Official Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <School className="w-5 h-5 text-blue-400" />
            بيانات المدرسة والترويسة الرسمية للتقارير
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المدرسة الرسمي</label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">المدينة والمديرية العامة</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم مدير المدرسة</label>
              <input
                type="text"
                value={formData.directorName}
                onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-hidden"
                required
              />
            </div>
          </div>
        </div>

        {/* 2. School Logo Section - Positioned directly below School Info & before Rounding Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">شعار المدرسة</h3>
            </div>
            <span className="text-xs text-slate-400">
              يُعتمد الشعار تلقائياً في جميع التقارير، كشوف الدرجات، والشهادات الرسمية القابلة للطباعة
            </span>
          </div>

          {/* Hidden File Input supporting standard image types */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Status feedback messages */}
          {logoSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{logoSuccess}</span>
            </div>
          )}

          {logoError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{logoError}</span>
            </div>
          )}

          {formData.schoolLogo ? (
            /* Active Logo Preview Card with Change and Remove Actions */
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-xl bg-slate-950/70 border border-slate-800">
              {/* Crisp preview canvas frame */}
              <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl p-2.5 bg-white border-2 border-slate-700 shadow-md flex items-center justify-center overflow-hidden">
                  <SchoolLogo
                    logoUrl={formData.schoolLogo}
                    schoolName={formData.schoolName}
                    size="custom"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-black shadow-xs">
                  معتمد
                </div>
              </div>

              {/* Logo Details & Action Buttons */}
              <div className="flex-1 flex flex-col gap-2 text-center md:text-right">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="font-bold text-sm text-white">
                    تم ضبط وتثبيت شعار المدرسة بنجاح
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    دقة طباعة عالية A4
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هذا الشعار يظهر في ترويسة التقارير الرسمية، كشوف النتائج، وشيتات الإعفاء. يتم الحفاظ على أبعاده الهندسية ونقاء الألوان والشفافية بدون أي تشويه.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-700 disabled:opacity-50"
                  >
                    {logoProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>تغيير الشعار</span>
                  </button>

                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={handleRemoveLogo}
                    className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-900 text-rose-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-rose-800/50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف الشعار</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Action Prompt when No Logo Exists */
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors bg-slate-950/30">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
                {logoProcessing ? (
                  <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <h4 className="font-bold text-sm text-white mb-1">
                رفع شعار المدرسة للمطبوعات والتقارير الرسمية
              </h4>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
                يدعم صيغ PNG (مع شفافية)، JPG، JPEG، وWebP. يقوم النظام بتحسين أبعاد الشعار وضغطه تلقائياً لضمان أعلى جودة طباعة على ورق A4 بدون إبطاء التطبيق.
              </p>

              <button
                type="button"
                disabled={logoProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
              >
                {logoProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>اختيار صورة من الجهاز</span>
              </button>

              <span className="text-[11px] text-slate-500 mt-3">
                ملاحظة: في حال عدم رفع أي شعار، تظهر جميع التقارير والمطبوعات بشكل طبيعي وأنيق بدون مساحات فارغة.
              </span>
            </div>
          )}
        </div>

        {/* 3. Kufic Geometric School Logo Section - Independent from general school logo */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#60CDFF]" />
              <h3 className="text-base font-bold text-white">شعار المدرسة بالخط الكوفي</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              شعار هندسي بالخط الكوفي مخصص للشهادات، وثائق التقدير، والمناسبات المدرسية الخاصة
            </span>
          </div>

          {/* Hidden File Input for Kufic Logo */}
          <input
            ref={kuficFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleKuficFileSelect}
            className="hidden"
          />

          {/* Status feedback messages */}
          {kuficSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{kuficSuccess}</span>
            </div>
          )}

          {kuficError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{kuficError}</span>
            </div>
          )}

          {formData.kuficLogo ? (
            /* Active Kufic Logo Preview Card with Change and Remove Actions */
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-xl bg-slate-950/70 border border-slate-800">
              {/* Crisp preview canvas frame */}
              <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl p-2.5 bg-white border-2 border-slate-700 shadow-md flex items-center justify-center overflow-hidden">
                  <img
                    src={formData.kuficLogo}
                    alt="شعار المدرسة بالخط الكوفي"
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                </div>
                <div className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-[#60CDFF] text-slate-950 text-[10px] font-black shadow-xs">
                  كوفي معتمد
                </div>
              </div>

              {/* Logo Details & Action Buttons */}
              <div className="flex-1 flex flex-col gap-2 text-center md:text-right">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="font-bold text-sm text-white">
                    تم ضبط وتثبيت شعار المدرسة بالخط الكوفي بنجاح
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#60CDFF]/15 text-[#60CDFF] border border-[#60CDFF]/30 font-medium">
                    مستقل عن الشعار الرسمي العام
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هذا الشعار مخصص للشهادات والنماذج التكريمية التي تتطلب مظهراً هندسياً بالخط الكوفي. يبقى محفوظاً بشكل دائم ومستقل تماماً، ويمكن تغييره أو حذفه في أي وقت دون التأثير على الشعار الرسمي للمدرسة.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <button
                    type="button"
                    disabled={kuficProcessing}
                    onClick={() => kuficFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-700 disabled:opacity-50"
                  >
                    {kuficProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-[#60CDFF]" />
                    )}
                    <span>تغيير الشعار الكوفي</span>
                  </button>

                  <button
                    type="button"
                    disabled={kuficProcessing}
                    onClick={handleRemoveKuficLogo}
                    className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-900 text-rose-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-rose-800/50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف الشعار الكوفي</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Action Prompt when No Kufic Logo Exists */
            <div className="border-2 border-dashed border-slate-700 hover:border-[#60CDFF]/60 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors bg-slate-950/30">
              <div className="w-14 h-14 rounded-2xl bg-[#60CDFF]/10 border border-[#60CDFF]/20 text-[#60CDFF] flex items-center justify-center mb-3 shadow-inner">
                {kuficProcessing ? (
                  <div className="w-6 h-6 border-2 border-[#60CDFF] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <h4 className="font-bold text-sm text-white mb-1">
                رفع شعار المدرسة بالخط الكوفي
              </h4>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
                يدعم صيغ PNG (مع شفافية)، JPG، JPEG، وWebP. يُعالج الشعار تلقائياً ليناسب النماذج والشهادات التكريمية بدقة هندسية عالية دون إثقال التطبيق.
              </p>

              <button
                type="button"
                disabled={kuficProcessing}
                onClick={() => kuficFileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-[#60CDFF] hover:bg-[#60CDFF]/90 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#60CDFF]/20 disabled:opacity-50"
              >
                {kuficProcessing ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-950" />
                )}
                <span>اختيار صورة الشعار الكوفي من الجهاز</span>
              </button>

              <span className="text-[11px] text-slate-500 mt-3">
                ملاحظة: هذا الحقل مستقل تماماً عن شعار المدرسة الرسمي؛ يمكنك استخدام الشعارين معاً أو كلاً على حدة.
              </span>
            </div>
          )}
        </div>

        {/* 4. Rounding Rules - Crucial requirement from prompt */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              قاعدة تقريب الكسور وحساب المعدلات
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
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
                      ? 'bg-slate-950 border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="roundingRule"
                    value={rule}
                    checked={isSelected}
                    onChange={() => setFormData({ ...formData, roundingRule: rule })}
                    className="mt-1 w-4 h-4 text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {info.title}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {info.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 3. Security & Confirmation Preferences */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-[#60CDFF]" />
            <h3 className="text-base font-bold text-white">
              ضوابط الأمان وحماية الدرجات السابقة
            </h3>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div>
              <h4 className="font-bold text-sm text-slate-200">
                طلب تأكيد صريح قبل تعديل أي درجة سابقة
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                عند النقر لتعديل درجات الفصول السابقة، تظهر نافذة تأكيد تحذر من تأثير التعديل على السعي والنهائي.
              </p>
            </div>

            <input
              type="checkbox"
              checked={formData.confirmPreviousTermEdits}
              onChange={(e) => setFormData({ ...formData, confirmPreviousTermEdits: e.target.checked })}
              className="w-5 h-5 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>حفظ جميع الإعدادات وتطبيقها فوراً</span>
          </button>
        </div>
      </form>

      {/* Administrative Decision Settings (Assistance & Failing Rules per Academic Year) */}
      <AdminDecisionSettingsSection currentAcademicYearId={currentAcademicYearId} />

      {/* 4. System Access Code & Security Section */}
      {userRole === 'admin' && (
        <div className="bg-[#181F2A] border border-[#2E3748] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>رمز الدخول والأمان للنظام</span>
                  {db.isAccessCodeConfigured() ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      مفعّل ومحفوظ في قاعدة SQLite
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                      بانتظار الإعداد
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
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
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>تحديث رمز الدخول</span>
            </button>
          </div>
        </div>
      )}

      {/* Access Code Update Modal */}
      {isAccessCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-[#181F2A] border border-[#2E3748] rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">تحديث رمز الدخول للنظام</h4>
                  <p className="text-[11px] text-slate-400">يُحفظ مشفراً في قاعدة SQLite بشكل دائم</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {accessCodeSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{accessCodeSuccess}</span>
              </div>
            )}

            {accessCodeError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{accessCodeError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAccessCode} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رمز الدخول الجديد (4 خانات على الأقل)
                </label>
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  required
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  placeholder="أدخل رمز الدخول الجديد"
                  className="w-full h-10 px-3 text-xs font-mono font-bold tracking-widest rounded-xl bg-[#212836] border border-[#364153] text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  تأكيد رمز الدخول الجديد
                </label>
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  required
                  value={confirmNewAccessCode}
                  onChange={(e) => setConfirmNewAccessCode(e.target.value)}
                  placeholder="أعد إدخال الرمز للتأكيد"
                  className="w-full h-10 px-3 text-xs font-mono font-bold tracking-widest rounded-xl bg-[#212836] border border-[#364153] text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="showCodeCheck"
                  checked={showAccessCode}
                  onChange={(e) => setShowAccessCode(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showCodeCheck" className="text-xs text-slate-400 select-none cursor-pointer">
                  إظهار الرمز أثناء الكتابة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsAccessCodeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAccessCodeLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  {isAccessCodeLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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

      {/* 5. User Accounts & Access Control (Admin-Only Section) */}
      {userRole === 'admin' && (
        <UserManagementSection currentUserId={currentUserId || ''} />
      )}
    </div>
  );
};
