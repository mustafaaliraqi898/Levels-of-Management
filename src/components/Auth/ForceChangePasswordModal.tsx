import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { KeyRound, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ForceChangePasswordModalProps {
  userId: string;
  username: string;
  onPasswordChanged: () => void;
  theme: 'dark' | 'light';
}

export const ForceChangePasswordModal: React.FC<ForceChangePasswordModalProps> = ({
  userId,
  username,
  onPasswordChanged,
  theme,
}) => {
  const [adminEmail, setAdminEmail] = useState('');
  const [confirmAdminEmail, setConfirmAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminEmail.trim() || !emailRegex.test(adminEmail.trim())) {
      setError('يرجى إدخال بريد إلكتروني صالح للمدير الرئيسي (مطلوب لاستعادة كلمة المرور).');
      return;
    }

    if (adminEmail.trim().toLowerCase() !== confirmAdminEmail.trim().toLowerCase()) {
      setError('عنوان البريد الإلكتروني وتأكيده غير متطابقين، يرجى إعادة التأكد.');
      return;
    }

    if (newPassword.length < 6) {
      setError('يجب أن تتكون كلمة المرور الجديدة من 6 خانات/أحرف على الأقل.');
      return;
    }


    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين، يرجى إعادة التأكد.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.forceChangePassword(userId, newPassword, adminEmail.trim());
      if (res.success) {
        onPasswordChanged();
      } else {
        setError(res.error || 'تعذر تغيير كلمة المرور وإعداد البريد، يرجى المحاولة ثانية');
      }
    } catch {
      setError('حدث خطأ غير متوقع أثناء معالجة البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 sm:p-8 shadow-2xl transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">
              إعداد حساب المدير الرئيسي وبيناته الإلزامية
            </h2>
            <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
              المستخدم: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{username}</strong>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border mb-6 text-xs sm:text-sm leading-relaxed bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200">
          هذا هو أول تسجيل دخول للحساب الإداري. لدواعي أمان المدرسة واستعادة الحساب عند نسيان كلمة المرور، يتوجب تسجيل البريد الإلكتروني للمدير وتأكيده وتغيير كلمة المرور الافتراضية.
        </div>

        {error && (
          <div className="p-3 rounded-xl border mb-5 text-xs sm:text-sm font-bold flex items-center gap-2 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1 text-emerald-700 dark:text-emerald-400">
              البريد الإلكتروني للمدير الرئيسي (إلزامي لاستعادة كلمة المرور)
            </label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@school.edu.iq"
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400 dir-ltr font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-emerald-700 dark:text-emerald-400">
              تأكيد البريد الإلكتروني للمدير
            </label>
            <input
              type="email"
              required
              value={confirmAdminEmail}
              onChange={(e) => setConfirmAdminEmail(e.target.value)}
              placeholder="أعد إدخال البريد الإلكتروني ذاته"
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400 dir-ltr font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">
              كلمة المرور الجديدة (6 أحرف أو أرقام على الأقل)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                className="w-full h-10 pr-10 pl-10 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">
              تأكيد كلمة المرور الجديدة
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور الجديدة"
                className="w-full h-10 pr-10 pl-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-400/15 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ البيانات وتفعيل حساب المدير</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
