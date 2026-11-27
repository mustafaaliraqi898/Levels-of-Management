import React, { useState } from 'react';
import { db } from '../../services/storage';
import {
  GraduationCap,
  ShieldCheck,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  Moon,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

interface CreateAccessCodeViewProps {
  onComplete: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  username?: string;
}

export const CreateAccessCodeView: React.FC<CreateAccessCodeViewProps> = ({
  onComplete,
  theme,
  onToggleTheme,
  username = 'admin',
}) => {
  const [accessCode, setAccessCode] = useState('');
  const [confirmAccessCode, setConfirmAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  // Optional new admin password
  const [changeAdminPassword, setChangeAdminPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = accessCode.trim();
    if (!cleanCode) {
      setError('يرجى إدخال رمز الدخول الجديد.');
      return;
    }

    if (cleanCode.length < 4) {
      setError('يجب ألا يقل رمز الدخول عن 4 خانات (أرقام أو أحرف).');
      return;
    }

    if (cleanCode !== confirmAccessCode.trim()) {
      setError('رمز الدخول وتأكيد الرمز غير متطابقين، يرجى إعادة التأكد.');
      return;
    }

    if (changeAdminPassword) {
      if (newPassword.length < 6) {
        setError('يجب ألا تقل كلمة مرور المشرف الجديدة عن 6 أحرف أو أرقام.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError('كلمتا المرور الجديدة غير متطابقتين.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await db.saveAccessCode(
        cleanCode,
        changeAdminPassword && newPassword ? newPassword : undefined
      );

      if (res.success) {
        onComplete();
      } else {
        setError(res.error || 'تعذر حفظ رمز الدخول، يرجى إعادة المحاولة.');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع أثناء حفظ رمز الدخول.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between items-center transition-colors duration-200 p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      dir="rtl"
    >
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="w-full max-w-5xl flex justify-between items-center pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-400 flex items-center justify-center text-white dark:text-slate-950 font-black shadow-md shadow-emerald-600/20 dark:shadow-emerald-400/15">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            النظام المدرسي المتكامل لإدارة الدرجات
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-emerald-400 hover:border-emerald-500/40 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
          title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Setup Card */}
      <div className="w-full max-w-lg my-auto">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl shadow-slate-200/60 dark:shadow-black/50 transition-all duration-200">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-400/15 border border-emerald-200 dark:border-emerald-400/30 mb-3 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold mb-2 bg-teal-50 dark:bg-teal-400/15 border border-teal-200 dark:border-teal-400/30 text-teal-700 dark:text-teal-400">
              إعداد أولي يظهر لمرة واحدة فقط
            </div>

            <h1 className="text-xl sm:text-2xl font-black mb-1.5 text-slate-900 dark:text-slate-100">
              إنشاء رمز الدخول للنظام
            </h1>
            <p className="text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto text-slate-500 dark:text-slate-400">
              تم التحقق من بيانات الدخول بنجاح بحساب ({username}). يرجى إنشاء رمز دخول أمان مخصص لحماية درجات وسجلات المدرسة.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-bold animate-in fade-in bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* New Access Code Input */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                رمز الدخول الجديد (PIN / رمز الأمان)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <input
                  type={showCode ? 'text' : 'password'}
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="أدخل رمز الدخول (4 أرقام أو أحرف على الأقل)"
                  className="w-full h-11 pr-10 pl-10 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-bold tracking-widest transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title={showCode ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  aria-label={showCode ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Access Code Input */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                تأكيد رمز الدخول
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <input
                  type={showCode ? 'text' : 'password'}
                  required
                  value={confirmAccessCode}
                  onChange={(e) => setConfirmAccessCode(e.target.value)}
                  placeholder="أعد إدخال رمز الدخول للتأكيد"
                  className="w-full h-11 pr-10 pl-10 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-bold tracking-widest transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Optional change admin password */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 transition-colors">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={changeAdminPassword}
                  onChange={(e) => setChangeAdminPassword(e.target.checked)}
                  className="rounded-md border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 accent-emerald-600 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  تحديث كلمة مرور حساب المشرف الآن (اختياري)
                </span>
              </label>

              {changeAdminPassword && (
                <div className="mt-3 flex flex-col gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      كلمة المرور الجديدة (6 خانات على الأقل)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الجديدة"
                        className="w-full h-10 pr-3 pl-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور للتأكيد"
                      className="w-full h-10 pr-3 pl-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-400/15 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ رمز الدخول ومتابعة إلى النظام</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
            <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>حفظ دائم في قاعدة SQLite المحلية:</span>
            </div>
            <div>
              يتم حفظ الرمز مشفراً في قاعدة البيانات المحلية لجهاز الكمبيوتر، ولن يُطلب منك إعداده مرة أخرى عند تشغيل البرنامج في المرات القادمة.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl text-center py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          نظام محلي آمن يعمل بدون إنترنت (Offline-First) لحماية سرية درجات الطلاب
        </p>
      </footer>
    </div>
  );
};
