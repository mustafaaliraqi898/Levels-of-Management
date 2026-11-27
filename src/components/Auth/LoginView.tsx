import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { AuthSession } from '../../types';
import {
  GraduationCap,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recovery Modal State
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify' | 'success'>('request');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await authService.login(username, password);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setError(res.error || 'حدث خطأ أثناء محاولة تسجيل الدخول');
      }
    } catch {
      setError('تعذر الاتصال بخدمة التحقق من الهوية، يرجى المحاولة ثانية');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between items-center transition-colors duration-200 p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      dir="rtl"
    >
      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-5xl flex justify-between items-center pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-400 flex items-center justify-center text-white dark:text-slate-950 font-black shadow-md shadow-emerald-600/20 dark:shadow-emerald-400/15">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            النظام المدرسي المتكامل لإدارة الدرجات
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-emerald-400 hover:border-emerald-500/40 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
          title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Card */}
      <div className="w-full max-w-md my-auto">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl shadow-slate-200/60 dark:shadow-black/50 transition-all duration-200">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="inline-flex p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-400/15 border border-emerald-200 dark:border-emerald-400/30 mb-3 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black mb-1.5 text-slate-900 dark:text-slate-100">
              نظام إدارة الدرجات المدرسية
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              سجّل الدخول للوصول إلى لوحة التحكم ورصد درجات الطلاب
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-bold animate-in fade-in bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  className="w-full h-11 pr-10 pl-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  className="w-full h-11 pr-10 pl-10 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link & Submit Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRecoveryUsername(username || '');
                  setRecoveryStep('request');
                  setRecoveryError(null);
                  setRecoveryMsg(null);
                  setIsRecoveryOpen(true);
                }}
                className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-400/15 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              في حال نسيان كلمة المرور، يرجى التواصل مع مسؤول النظام أو استخدام خيار الاستعادة.
            </p>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {isRecoveryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-900 dark:text-slate-100 relative">
            <button
              type="button"
              onClick={() => setIsRecoveryOpen(false)}
              className="absolute top-5 left-5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-400/15 border border-emerald-200 dark:border-emerald-400/30 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black">استعادة كلمة المرور عبر البريد</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">إعادة تعيين آمنة لرمز الدخول بحساب المدير</p>
              </div>
            </div>

            {recoveryError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{recoveryError}</span>
              </div>
            )}

            {recoveryStep === 'request' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setRecoveryError(null);
                  setIsRecoveryLoading(true);
                  try {
                    const res = await authService.requestPasswordResetCode(recoveryUsername);
                    if (res.success) {
                      setRecoveryMsg(res.message);
                      setRecoveryStep('verify');
                    } else {
                      setRecoveryError(res.message);
                    }
                  } catch {
                    setRecoveryError('تعذر معالجة طلب الاستعادة');
                  } finally {
                    setIsRecoveryLoading(false);
                  }
                }}
                className="flex flex-col gap-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">اسم المستخدم</label>
                  <input
                    type="text"
                    required
                    value={recoveryUsername}
                    onChange={(e) => setRecoveryUsername(e.target.value)}
                    placeholder="مثال: admin"
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden font-bold"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  سيتم إرسال رمز أمان مكون من 6 أرقام إلى البريد الإلكتروني الخاص بحساب المدير المسجل مسبقاً عبر خدمة Gmail SMTP. صلاحية الرمز 5 دقائق وبحد أقصى 5 محاولات.
                </div>

                <button
                  type="submit"
                  disabled={isRecoveryLoading}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isRecoveryLoading ? 'جاري الإرسال عبر Gmail...' : 'إرسال رمز التحقق'}
                </button>
              </form>
            )}

            {recoveryStep === 'verify' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setRecoveryError(null);

                  if (recoveryNewPassword !== recoveryConfirmPassword) {
                    setRecoveryError('كلمتا المرور غير متطابقتين');
                    return;
                  }

                  setIsRecoveryLoading(true);
                  try {
                    const res = await authService.verifyResetCodeAndChangePassword(
                      recoveryUsername,
                      recoveryCode,
                      recoveryNewPassword
                    );
                    if (res.success) {
                      setRecoveryStep('success');
                    } else {
                      setRecoveryError(res.error || 'رمز التحقق غير صحيح');
                    }
                  } catch {
                    setRecoveryError('تعذر التحقق من الرمز وتغيير كلمة المرور');
                  } finally {
                    setIsRecoveryLoading(false);
                  }
                }}
                className="flex flex-col gap-4"
              >
                {recoveryMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed">
                    {recoveryMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رمز التحقق المكون من 6 أرقام</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="123456"
                    className="w-full h-11 px-3 text-center tracking-widest text-lg font-mono font-black bg-slate-50 dark:bg-slate-800 border border-emerald-500/50 rounded-xl text-emerald-700 dark:text-emerald-400 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الجديدة (6 خانات على الأقل)</label>
                  <input
                    type="password"
                    required
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تأكيد كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    placeholder="تأكيد كلمة المرور الجديدة"
                    className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:focus:border-emerald-400 focus:outline-hidden"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryStep('request');
                      setRecoveryCode('');
                      setRecoveryError(null);
                    }}
                    className="w-1/3 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    طلب رمز جديد
                  </button>
                  <button
                    type="submit"
                    disabled={isRecoveryLoading}
                    className="w-2/3 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isRecoveryLoading ? 'جاري التحقق...' : 'تأكيد وحفظ كلمة المرور'}
                  </button>
                </div>
              </form>
            )}

            {recoveryStep === 'success' && (
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-400/20 border border-emerald-200 dark:border-emerald-400/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold">
                  ✓
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">تم تغيير كلمة المرور بنجاح!</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs">
                  تم تعيين كلمة المرور الجديدة وتشفيرها بنجاح. يمكنك الآن تسجيل الدخول بالحساب.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveryOpen(false);
                    setUsername(recoveryUsername);
                  }}
                  className="mt-2 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-xs cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-5xl text-center py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          نظام محلي آمن يعمل بدون إنترنت (Offline-First) لحماية سرية درجات الطلاب
        </p>
      </footer>
    </div>
  );
};
