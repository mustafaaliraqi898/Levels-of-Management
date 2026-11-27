import React, { useState } from 'react';
import { ShieldCheck, User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../../services/auth';

export const SetupWizard: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password || !confirmPassword) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (password.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 خانات على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.setupFirstAdmin({ username, password });
      if (!res.success) {
        setError(res.error || 'فشل إعداد حساب المدير');
      }
      // Success will automatically update auth state via saveSession
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء الإعداد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#111C2A] text-[#1E293B] dark:text-[#E2E8F0] flex items-center justify-center p-4 transition-colors duration-200" dir="rtl">
      <div className="max-w-md w-full bg-white dark:bg-[#1C2939] rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 p-4 rounded-2xl border border-[#3156C9]/25 dark:border-[#60A5FA]/30">
              <ShieldCheck className="w-12 h-12 text-[#3156C9] dark:text-[#60A5FA]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-[#E2E8F0] text-center mb-2">إعداد النظام لأول مرة</h1>
          <p className="text-[#64748B] dark:text-[#A8B5C7] text-center mb-8">يرجى إنشاء حساب المدير الرئيسي للبدء في استخدام التطبيق.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] dark:text-[#E2E8F0] mb-2">اسم المستخدم للمدير</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B] dark:text-[#8493A8]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] py-3 pr-11 pl-4 text-[#1E293B] dark:text-[#E2E8F0] focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5] outline-none transition-all"
                  placeholder="مثال: admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] dark:text-[#E2E8F0] mb-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B] dark:text-[#8493A8]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] py-3 pr-11 pl-4 text-[#1E293B] dark:text-[#E2E8F0] focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5] outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] dark:text-[#E2E8F0] mb-2">تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B] dark:text-[#8493A8]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#EDF1F7] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[10px] py-3 pr-11 pl-4 text-[#1E293B] dark:text-[#E2E8F0] focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5] outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-[#E35D6A]/10 border border-[#E35D6A]/35 rounded-xl p-4 flex items-start gap-3 text-[#C83D4B] dark:text-[#E35D6A] text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white disabled:opacity-50 font-bold py-3.5 rounded-[10px] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'إنشاء الحساب والبدء'
              )}
            </button>
          </form>
        </div>

        <div className="bg-[#F4F6FA] dark:bg-[#202E40] p-6 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
          <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] leading-relaxed text-center">
            ملاحظة: هذا الحساب يمتلك كامل الصلاحيات لإدارة النظام، يرجى حفظ بيانات الدخول في مكان آمن.
          </p>
        </div>
      </div>
    </div>
  );
};
