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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors duration-200" dir="rtl">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-400/15 p-4 rounded-full border border-emerald-200 dark:border-emerald-400/30">
              <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-center mb-2">إعداد النظام لأول مرة</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8">يرجى إنشاء حساب المدير الرئيسي للبدء في استخدام التطبيق.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">اسم المستخدم للمدير</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-11 pl-4 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400 outline-none transition-all"
                  placeholder="مثال: admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-11 pl-4 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-11 pl-4 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-700 dark:text-rose-400 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 disabled:opacity-50 font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 dark:shadow-emerald-400/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'إنشاء الحساب والبدء'
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/60 p-6 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-center">
            ملاحظة: هذا الحساب يمتلك كامل الصلاحيات لإدارة النظام، يرجى حفظ بيانات الدخول في مكان آمن.
          </p>
        </div>
      </div>
    </div>
  );
};
