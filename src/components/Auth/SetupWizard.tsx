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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-500/10 p-4 rounded-full border border-blue-500/20">
              <ShieldCheck className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">إعداد النظام لأول مرة</h1>
          <p className="text-slate-400 text-center mb-8">يرجى إنشاء حساب المدير الرئيسي للبدء في استخدام التطبيق.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">اسم المستخدم للمدير</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pr-11 pl-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="مثال: admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pr-11 pl-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pr-11 pl-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-400 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'إنشاء الحساب والبدء'
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-950/50 p-6 border-t border-slate-800">
          <p className="text-xs text-slate-500 leading-relaxed text-center">
            ملاحظة: هذا الحساب يمتلك كامل الصلاحيات لإدارة النظام، يرجى حفظ بيانات الدخول في مكان آمن.
          </p>
        </div>
      </div>
    </div>
  );
};
