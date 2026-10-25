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
      className={`min-h-screen w-full flex flex-col justify-between items-center transition-colors duration-200 p-4 sm:p-6 ${
        theme === 'dark' ? 'bg-[#202631] text-[#E0E6ED]' : 'bg-[#F3F5F7] text-[#414957]'
      }`}
      dir="rtl"
    >
      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-5xl flex justify-between items-center pt-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20">
            <GraduationCap className="w-5 h-5 text-slate-950" />
          </div>
          <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-[#414957]'}`}>
            النظام المدرسي المتكامل لإدارة الدرجات
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className={`w-9 h-9 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs ${
            theme === 'dark'
              ? 'bg-[#262E3B] border-[#414C5D] text-[#E0B85C] hover:text-[#FDE68A]'
              : 'bg-[#FAFAF9] border-[#E0E4E8] text-[#414957] hover:text-[#202631]'
          }`}
          title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Card */}
      <div className="w-full max-w-md my-auto">
        <div
          className={`rounded-3xl border p-6 sm:p-8 shadow-2xl transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-[#181F2A] border-[#2E3748] shadow-black/40'
              : 'bg-[#FAFAF9] border-[#E0E4E8] shadow-slate-300/40'
          }`}
        >
          {/* Header */}
          <div className="text-center mb-7">
            <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 mb-3 text-emerald-500">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1
              className={`text-xl sm:text-2xl font-black mb-1.5 ${
                theme === 'dark' ? 'text-white' : 'text-[#202631]'
              }`}
            >
              نظام إدارة الدرجات المدرسية
            </h1>
            <p
              className={`text-xs sm:text-sm font-medium ${
                theme === 'dark' ? 'text-slate-400' : 'text-[#707987]'
              }`}
            >
              سجّل الدخول للوصول إلى لوحة التحكم ورصد درجات الطلاب
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className={`mb-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-bold animate-in fade-in ${
                theme === 'dark'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username Input */}
            <div>
              <label
                className={`block text-xs font-bold mb-1.5 ${
                  theme === 'dark' ? 'text-slate-200' : 'text-[#414957]'
                }`}
              >
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
                  className={`w-full h-11 pr-10 pl-3 text-sm rounded-xl border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 ${
                    theme === 'dark'
                      ? 'bg-[#212836] border-[#364153] text-white placeholder-slate-500 focus:border-emerald-500'
                      : 'bg-[#F0F2F5] border-[#D7DCE1] text-[#202631] placeholder-slate-400 focus:border-emerald-600'
                  }`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                className={`block text-xs font-bold mb-1.5 ${
                  theme === 'dark' ? 'text-slate-200' : 'text-[#414957]'
                }`}
              >
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
                  className={`w-full h-11 pr-10 pl-10 text-sm rounded-xl border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 ${
                    theme === 'dark'
                      ? 'bg-[#212836] border-[#364153] text-white placeholder-slate-500 focus:border-emerald-500'
                      : 'bg-[#F0F2F5] border-[#D7DCE1] text-[#202631] placeholder-slate-400 focus:border-emerald-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

          {/* Default Credentials Hint Notice */}
          <div
            className={`mt-6 p-3 rounded-xl border text-[11px] leading-relaxed ${
              theme === 'dark'
                ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>الحساب الإداري الافتراضي:</span>
            </div>
            <div>اسم المستخدم: <code className="font-mono font-bold text-slate-300">admin</code></div>
            <div>كلمة المرور: <code className="font-mono font-bold text-slate-300">Admin@12345</code></div>
            <div className="text-[10px] text-amber-500 mt-1 font-medium">
              * يُشترط تغيير كلمة المرور عند أول تسجيل دخول لتعزيز الأمان.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl text-center py-3">
        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-[#707987]'}`}>
          نظام محلي آمن يعمل بدون إنترنت (Offline-First) لحماية سرية درجات الطلاب
        </p>
      </footer>
    </div>
  );
};
