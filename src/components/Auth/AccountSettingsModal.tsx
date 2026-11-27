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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111C2A]/75 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0] p-6 sm:p-7 shadow-2xl transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DCE3ED] dark:border-[#2D3B4D] mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 border border-[#3156C9]/25 dark:border-[#60A5FA]/30 text-[#3156C9] dark:text-[#60A5FA]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black">إعدادات الحساب الشخصي (حسابي)</h3>
              <p className="text-xs text-[#64748B] dark:text-[#A8B5C7]">
                تعديل اسم المستخدم وكلمة المرور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl transition-colors cursor-pointer hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Info Card */}
        <div className="p-3 rounded-xl border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#F4F6FA] dark:bg-[#202E40] mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3156C9] flex items-center justify-center font-bold text-white text-sm">
              {session.user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold">{session.user.username}</div>
              <div className="text-[11px] text-[#64748B] dark:text-[#A8B5C7]">
                {session.user.role === 'admin' ? 'مدير النظام الكامل' : 'مستخدم عادي'}
              </div>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
              session.user.role === 'admin'
                ? 'bg-[#3156C9]/10 dark:bg-[#60A5FA]/15 text-[#3156C9] dark:text-[#60A5FA] border-[#3156C9]/25 dark:border-[#60A5FA]/30'
                : 'bg-[#A78BFA]/15 text-[#7C3AED] dark:text-[#A78BFA] border-[#A78BFA]/30'
            }`}
          >
            {session.user.role === 'admin' ? 'مدير (Admin)' : 'مستخدم (User)'}
          </span>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 rounded-xl border mb-4 text-xs font-bold flex items-center gap-2 bg-[#E35D6A]/10 border-[#E35D6A]/35 text-[#C83D4B] dark:text-[#E35D6A]">
            <AlertCircle className="w-4 h-4 text-[#E35D6A] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl border mb-4 text-xs font-bold flex items-center gap-2 bg-[#10B981]/10 border-[#10B981]/35 text-[#059669] dark:text-[#10B981]">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#1E293B] dark:text-[#E2E8F0]">اسم المستخدم</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-bold transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
            />
          </div>

          <div className="pt-2 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
            <h4 className="text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] mb-3 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>تغيير كلمة المرور (اختياري - اتركه فارغاً إذا كنت لا ترغب بتغييرها)</span>
            </h4>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-[#1E293B] dark:text-[#E2E8F0]">كلمة المرور الحالية</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="مطلوبة فقط عند تغيير كلمة المرور"
                    className="w-full h-10 pr-3 pl-10 text-xs rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#1E293B] dark:text-[#E2E8F0]">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 خانات على الأقل"
                    className="w-full h-10 pr-3 pl-10 text-xs rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] dark:text-[#8493A8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#1E293B] dark:text-[#E2E8F0]">تأكيد كلمة المرور الجديدة</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  className="w-full h-10 px-3 text-xs rounded-[10px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] text-[#1E293B] dark:text-[#E2E8F0] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#2785F5]/25 focus:border-[#2785F5]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-[#DCE3ED] dark:border-[#2D3B4D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] text-xs font-bold cursor-pointer transition-colors bg-[#EDF1F7] hover:border-[#2785F5] text-[#1E293B] dark:bg-[#26364B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-[10px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
