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
      className="min-h-screen w-full flex flex-col justify-between items-center transition-colors duration-200 p-4 sm:p-6 bg-[#F4F6FA] dark:bg-[#111C2A] text-[#1E293B] dark:text-[#E2E8F0]"
      dir="rtl"
    >
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="w-full max-w-5xl flex justify-between items-center pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#3156C9] flex items-center justify-center text-white font-black shadow-sm shadow-[#3156C9]/25">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0]">
            النظام المدرسي المتكامل لإدارة الدرجات
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-9 h-9 rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] hover:border-[#2785F5] text-[#3156C9] dark:text-[#60A5FA] transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
          title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Setup Card */}
      <div className="w-full max-w-lg my-auto">
        <div className="rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] p-6 sm:p-8 shadow-xl shadow-slate-200/60 dark:shadow-black/40 transition-all duration-200">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3.5 rounded-2xl bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 border border-[#3156C9]/25 dark:border-[#60A5FA]/30 mb-3 text-[#3156C9] dark:text-[#60A5FA] shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="inline-block px-3 py-1 rounded-lg text-[11px] font-bold mb-2 bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 border border-[#3156C9]/25 dark:border-[#60A5FA]/30 text-[#3156C9] dark:text-[#60A5FA]">
              إعداد أولي يظهر لمرة واحدة فقط
            </div>

            <h1 className="text-xl sm:text-2xl font-black mb-1.5 text-[#1E293B] dark:text-[#E2E8F0]">
              إنشاء رمز الدخول للنظام
            </h1>
            <p className="text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto text-[#64748B] dark:text-[#A8B5C7]">
              تم التحقق من بيانات الدخول بنجاح بحساب ({username}). يرجى إنشاء رمز دخول أمان مخصص لحماية درجات وسجلات المدرسة.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-bold animate-in fade-in bg-[#E35D6A]/10 border-[#E35D6A]/35 text-[#C83D4B] dark:text-[#E35D6A]">
              <AlertCircle className="w-5 h-5 shrink-0 text-[#E35D6A]" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* New Access Code Input */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#1E293B] dark:text-[#E2E8F0]">
                رمز الدخول الجديد (PIN / رمز الأمان)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#64748B] dark:text-[#8493A8]">
                  <KeyRound className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                </div>
                <input
                  type={showCode ? 'text' : 'password'}
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="أدخل رمز الدخول (4 أرقام أو أحرف على الأقل)"
                  className="w-full h-11 pr-10 pl-10 text-sm font-mono rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] placeholder-[#64748B]/70 dark:placeholder-[#8493A8] font-bold tracking-widest transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer"
                  title={showCode ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  aria-label={showCode ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Access Code Input */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#1E293B] dark:text-[#E2E8F0]">
                تأكيد رمز الدخول
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#64748B] dark:text-[#8493A8]">
                  <KeyRound className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                </div>
                <input
                  type={showCode ? 'text' : 'password'}
                  required
                  value={confirmAccessCode}
                  onChange={(e) => setConfirmAccessCode(e.target.value)}
                  placeholder="أعد إدخال رمز الدخول للتأكيد"
                  className="w-full h-11 pr-10 pl-10 text-sm font-mono rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] placeholder-[#64748B]/70 dark:placeholder-[#8493A8] font-bold tracking-widest transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
                />
              </div>
            </div>

            {/* Optional change admin password */}
            <div className="p-3.5 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F4F6FA] dark:bg-[#202E40] transition-colors">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={changeAdminPassword}
                  onChange={(e) => setChangeAdminPassword(e.target.checked)}
                  className="rounded-md border-[#DCE3ED] dark:border-[#2D3B4D] accent-[#3156C9] h-4 w-4"
                />
                <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                  تحديث كلمة مرور حساب المشرف الآن (اختياري)
                </span>
              </label>

              {changeAdminPassword && (
                <div className="mt-3 flex flex-col gap-3 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                      كلمة المرور الجديدة (6 خانات على الأقل)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الجديدة"
                        className="w-full h-10 pr-3 pl-10 text-xs rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] font-medium focus:border-[#2785F5] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور للتأكيد"
                      className="w-full h-10 pr-3 pl-3 text-xs rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] font-medium focus:border-[#2785F5] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full h-11 rounded-[10px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ رمز الدخول ومتابعة إلى النظام</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-5 p-3 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F4F6FA] dark:bg-[#202E40] text-[11px] leading-relaxed text-[#64748B] dark:text-[#A8B5C7]">
            <div className="font-bold text-[#3156C9] dark:text-[#60A5FA] flex items-center gap-1 mb-1">
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
        <p className="text-xs text-[#64748B] dark:text-[#8493A8]">
          نظام محلي آمن يعمل بدون إنترنت (Offline-First) لحماية سرية درجات الطلاب
        </p>
      </footer>
    </div>
  );
};
