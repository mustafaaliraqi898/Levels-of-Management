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

    if (newPassword === 'Admin@12345') {
      setError('لا يمكن استخدام كلمة المرور الافتراضية ذاتها، يرجى اختيار كلمة مرور جديدة.');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div
        className={`w-full max-w-lg rounded-3xl border p-6 sm:p-8 shadow-2xl transition-all duration-200 ${
          theme === 'dark'
            ? 'bg-[#181F2A] border-[#2E3748] text-white shadow-black/60'
            : 'bg-[#FAFAF9] border-[#E0E4E8] text-[#202631] shadow-slate-400/40'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">
              إعداد حساب المدير الرئيسي وبيناته الإلزامية
            </h2>
            <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              المستخدم: <strong className="font-mono text-emerald-500">{username}</strong>
            </p>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border mb-6 text-xs sm:text-sm leading-relaxed ${
            theme === 'dark'
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          هذا هو أول تسجيل دخول للحساب الإداري. لدواعي أمان المدرسة واستعادة الحساب عند نسيان كلمة المرور، يتوجب تسجيل البريد الإلكتروني للمدير وتأكيده وتغيير كلمة المرور الافتراضية.
        </div>

        {error && (
          <div
            className={`p-3 rounded-xl border mb-5 text-xs sm:text-sm font-bold flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1 text-emerald-400">
              البريد الإلكتروني للمدير الرئيسي (إلزامي لاستعادة كلمة المرور)
            </label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@school.edu.iq"
              className={`w-full h-10 px-3 text-xs sm:text-sm rounded-xl border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 dir-ltr font-mono ${
                theme === 'dark'
                  ? 'bg-[#212836] border-[#364153] text-white focus:border-emerald-500'
                  : 'bg-[#F0F2F5] border-[#D7DCE1] text-[#202631] focus:border-emerald-600'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-emerald-400">
              تأكيد البريد الإلكتروني للمدير
            </label>
            <input
              type="email"
              required
              value={confirmAdminEmail}
              onChange={(e) => setConfirmAdminEmail(e.target.value)}
              placeholder="أعد إدخال البريد الإلكتروني ذاته"
              className={`w-full h-10 px-3 text-xs sm:text-sm rounded-xl border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 dir-ltr font-mono ${
                theme === 'dark'
                  ? 'bg-[#212836] border-[#364153] text-white focus:border-emerald-500'
                  : 'bg-[#F0F2F5] border-[#D7DCE1] text-[#202631] focus:border-emerald-600'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">
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
                className={`w-full h-10 pr-10 pl-10 text-xs sm:text-sm rounded-xl border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 ${
                  theme === 'dark'
                    ? 'bg-[#212836] border-[#364153] text-white focus:border-emerald-500'
                    : 'bg-[#F0F2F5] border-[#D7DCE1] text-[#202631] focus:border-emerald-600'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">
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
                className={`w-full h-10 pr-10 pl-3 text-xs sm:text-sm rounded-xl border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 ${
                  theme === 'dark'
                    ? 'bg-[#212836] border-[#364153] text-white focus:border-emerald-500'
                    : 'bg-[#F0F2F5] border-[#D7DCE1] text-[#202631] focus:border-emerald-600'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
