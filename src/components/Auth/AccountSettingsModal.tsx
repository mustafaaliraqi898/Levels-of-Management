import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { AuthSession } from '../../types';
import {
  User,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

interface AccountSettingsModalProps {
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (newUsername: string) => void;
  theme: 'dark' | 'light';
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  session,
  isOpen,
  onClose,
  onUserUpdated,
  theme,
}) => {
  const [username, setUsername] = useState(session.user.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const isUsernameChanged = username.trim() !== session.user.username;
    const isPasswordChangeRequested = Boolean(newPassword || currentPassword);

    if (!isUsernameChanged && !isPasswordChangeRequested) {
      setError('لم تقم بإجراء أي تعديل على البيانات');
      return;
    }

    if (isPasswordChangeRequested) {
      if (!currentPassword) {
        setError('يرجى إدخال كلمة المرور الحالية لتأكيد التغيير');
        return;
      }
      if (newPassword.length < 6) {
        setError('يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await authService.updateAccountProfile(session.user.id, {
        newUsername: isUsernameChanged ? username.trim() : undefined,
        currentPassword: isPasswordChangeRequested ? currentPassword : undefined,
        newPassword: isPasswordChangeRequested ? newPassword : undefined,
      });

      if (res.success) {
        setSuccess('تم تحديث بيانات الحساب بنجاح!');
        if (isUsernameChanged) {
          onUserUpdated(username.trim());
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'تعذر تحديث البيانات');
      }
    } catch {
      setError('حدث خطأ أثناء الاتصال بالخدمة');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 sm:p-7 shadow-2xl transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-400/15 border border-emerald-200 dark:border-emerald-400/30 text-emerald-600 dark:text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black">إعدادات الحساب الشخصي (حسابي)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تعديل اسم المستخدم وكلمة المرور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Info Card */}
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-400 flex items-center justify-center font-bold text-white dark:text-slate-950 text-sm">
              {session.user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold">{session.user.username}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {session.user.role === 'admin' ? 'مدير النظام الكامل' : 'مستخدم عادي'}
              </div>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
              session.user.role === 'admin'
                ? 'bg-teal-50 dark:bg-teal-400/15 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-400/30'
                : 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/30'
            }`}
          >
            {session.user.role === 'admin' ? 'مدير (Admin)' : 'مستخدم (User)'}
          </span>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 rounded-xl border mb-4 text-xs font-bold flex items-center gap-2 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl border mb-4 text-xs font-bold flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-200">اسم المستخدم</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>تغيير كلمة المرور (اختياري - اتركه فارغاً إذا كنت لا ترغب بتغييرها)</span>
            </h4>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">كلمة المرور الحالية</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="مطلوبة فقط عند تغيير كلمة المرور"
                    className="w-full h-10 pr-3 pl-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 خانات على الأقل"
                    className="w-full h-10 pr-3 pl-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">تأكيد كلمة المرور الجديدة</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-600/25 dark:focus:ring-emerald-400/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-400/15 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
