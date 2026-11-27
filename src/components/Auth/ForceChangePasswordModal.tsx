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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111C2A]/75 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] p-6 sm:p-8 shadow-2xl transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-[#D69B42]/15 border border-[#D69B42]/35 text-[#B47A20] dark:text-[#D69B42]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">
              إعداد حساب المدير الرئيسي وبيناته الإلزامية
            </h2>
            <p className="text-xs mt-0.5 text-[#64748B] dark:text-[#A8B5C7]">
              المستخدم: <strong className="font-mono text-[#3156C9] dark:text-[#60A5FA]">{username}</strong>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border mb-6 text-xs sm:text-sm leading-relaxed bg-[#D69B42]/10 border-[#D69B42]/30 text-[#9A6715] dark:text-[#E2C285]">
          هذا هو أول تسجيل دخول للحساب الإداري. لدواعي أمان المدرسة واستعادة الحساب عند نسيان كلمة المرور، يتوجب تسجيل البريد الإلكتروني للمدير وتأكيده وتغيير كلمة المرور الافتراضية.
        </div>

        {error && (
          <div className="p-3 rounded-xl border mb-5 text-xs sm:text-sm font-bold flex items-center gap-2 bg-[#E35D6A]/10 border-[#E35D6A]/35 text-[#C83D4B] dark:text-[#E35D6A]">
            <ShieldAlert className="w-4 h-4 text-[#E35D6A] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1 text-[#3156C9] dark:text-[#60A5FA]">
              البريد الإلكتروني للمدير الرئيسي (إلزامي لاستعادة كلمة المرور)
            </label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@school.edu.iq"
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5] dir-ltr font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-[#3156C9] dark:text-[#60A5FA]">
              تأكيد البريد الإلكتروني للمدير
            </label>
            <input
              type="email"
              required
              value={confirmAdminEmail}
              onChange={(e) => setConfirmAdminEmail(e.target.value)}
              placeholder="أعد إدخال البريد الإلكتروني ذاته"
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5] dir-ltr font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#1E293B] dark:text-[#E2E8F0]">
              كلمة المرور الجديدة (6 أحرف أو أرقام على الأقل)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#64748B] dark:text-[#8493A8]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                className="w-full h-10 pr-10 pl-10 text-xs sm:text-sm rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#1E293B] dark:text-[#E2E8F0]">
              تأكيد كلمة المرور الجديدة
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#64748B] dark:text-[#8493A8]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور الجديدة"
                className="w-full h-10 pr-10 pl-3 text-xs sm:text-sm rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 w-full h-11 rounded-[10px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
