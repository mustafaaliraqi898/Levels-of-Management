import React, { useState } from 'react';
import { UserAccount, UserRole } from '../../types';
import { db } from '../../services/storage';
import { hashPassword, generateSalt } from '../../services/auth';
import {
  Users,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Edit2,
  KeyRound,
  UserX,
  UserCheck,
  X,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Send,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface UserManagementSectionProps {
  currentUserId: string;
}

export const UserManagementSection: React.FC<UserManagementSectionProps> = ({
  currentUserId,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(() => db.getUsers());
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Selected User for actions
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Add Form State
  const [addUsername, setAddUsername] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('user');
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit Form State
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');

  // Reset Password State
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // SMTP Settings State
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpIsConfigured, setSmtpIsConfigured] = useState(false);
  const [smtpMaskedEmail, setSmtpMaskedEmail] = useState('');
  const [isEditingSmtpUser, setIsEditingSmtpUser] = useState(false);
  const [isEditingSmtpPass, setIsEditingSmtpPass] = useState(false);
  const [smtpNotice, setSmtpNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSmtpTesting, setIsSmtpTesting] = useState(false);
  const [isSmtpSaving, setIsSmtpSaving] = useState(false);
  const [isSmtpHelpOpen, setIsSmtpHelpOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.smtp) {
      window.electronAPI.smtp.getSmtpStatus().then((status) => {
        setSmtpIsConfigured(status.isConfigured);
        setSmtpHost(status.host || 'smtp.gmail.com');
        setSmtpPort(String(status.port || 587));
        setSmtpMaskedEmail(status.userEmail || '');
        // Clear editing states on load
        setIsEditingSmtpUser(false);
        setIsEditingSmtpPass(false);
        setSmtpUser('');
        setSmtpPass('');
      }).catch(() => {});
    }
  }, []);

  const handleTestSmtp = async () => {
    const finalUser = isEditingSmtpUser ? smtpUser.trim() : undefined;
    const finalPass = isEditingSmtpPass ? smtpPass.trim() : undefined;

    if (isEditingSmtpUser && !smtpUser.trim()) {
      setSmtpNotice({ type: 'error', message: 'يرجى إدخال عنوان Gmail للاختبار' });
      return;
    }
    if (isEditingSmtpPass && !smtpPass.trim()) {
      setSmtpNotice({ type: 'error', message: 'يرجى إدخال كلمة مرور التطبيق للاختبار' });
      return;
    }

    setIsSmtpTesting(true);
    setSmtpNotice(null);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.smtp) {
        const res = await window.electronAPI.smtp.testConnection({
          host: smtpHost.trim(),
          port: smtpPort.trim(),
          user: finalUser,
          pass: finalPass,
        });
        if (res.success) {
          setSmtpNotice({ type: 'success', message: res.message || 'تم الاتصال بخدمة Gmail SMTP بنجاح!' });
        } else {
          setSmtpNotice({ type: 'error', message: res.error || 'فشل الاتصال بخدمة SMTP' });
        }
      } else {
        setSmtpNotice({ type: 'error', message: 'اختبار SMTP غير متاح في بيئة المتصفح.' });
      }
    } catch {
      setSmtpNotice({ type: 'error', message: 'حدث خطأ أثناء الاتصال بالخادم' });
    } finally {
      setIsSmtpTesting(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only validate fields if we are changing them or if it's the first setup
    if (!smtpIsConfigured) {
      if (!smtpUser.trim() || !smtpPass.trim()) {
        setSmtpNotice({ type: 'error', message: 'عنوان Gmail وكلمة مرور التطبيق مطلوبان للإعداد الأول' });
        return;
      }
    } else {
      if (isEditingSmtpUser && !smtpUser.trim()) {
        setSmtpNotice({ type: 'error', message: 'يرجى إدخال البريد الإلكتروني الجديد أو إلغاء التعديل' });
        return;
      }
      if (isEditingSmtpPass && !smtpPass.trim()) {
        setSmtpNotice({ type: 'error', message: 'يرجى إدخال كلمة المرور الجديدة أو إلغاء التعديل' });
        return;
      }
    }

    setIsSmtpSaving(true);
    setSmtpNotice(null);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.smtp) {
        const res = await window.electronAPI.smtp.saveConfig({
          host: smtpHost.trim(),
          port: smtpPort.trim(),
          user: isEditingSmtpUser || !smtpIsConfigured ? smtpUser.trim() : undefined,
          pass: isEditingSmtpPass || !smtpIsConfigured ? smtpPass.trim() : undefined,
        });
        if (res.success) {
          setSmtpNotice({ type: 'success', message: 'تم حفظ إعدادات Gmail SMTP بنجاح!' });
          setSmtpIsConfigured(true);
          const status = await window.electronAPI.smtp.getSmtpStatus();
          setSmtpMaskedEmail(status.userEmail);
          setIsEditingSmtpUser(false);
          setIsEditingSmtpPass(false);
          setSmtpUser('');
          setSmtpPass('');
        } else {
          setSmtpNotice({ type: 'error', message: res.error || 'تعذر حفظ الإعدادات' });
        }
      } else {
        setSmtpNotice({ type: 'error', message: 'حفظ الإعدادات متاح فقط داخل التطبيق.' });
      }
    } catch {
      setSmtpNotice({ type: 'error', message: 'حدث خطأ أثناء حفظ الإعدادات' });
    } finally {
      setIsSmtpSaving(false);
    }
  };

  const handleOpenGoogleLink = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.shell) {
      window.electronAPI.shell.openExternal('https://myaccount.google.com/apppasswords');
    }
  };

  const refreshUsers = () => {
    setUsers([...db.getUsers()]);
  };

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim() || !addPassword) {
      showNotice('error', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (addPassword.length < 6) {
      showNotice('error', 'يجب أن تتكون كلمة المرور من 6 خانات على الأقل');
      return;
    }

    if (addRole === 'admin') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!addEmail.trim() || !emailRegex.test(addEmail.trim())) {
        showNotice('error', 'البريد الإلكتروني إلزامي وبنسق صحيح لحسابات المدير الرئيسي (Admin)');
        return;
      }
    }

    setIsLoading(true);
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(addPassword, salt);
      const res = db.addUser({
        username: addUsername.trim(),
        email: addRole === 'admin' ? addEmail.trim() : (addEmail.trim() || undefined),
        passwordHash,
        salt,
        role: addRole,
        isActive: true,
        mustChangePassword: false,
      });

      if (res.success) {
        showNotice('success', `تمت إضافة المستخدم "${addUsername.trim()}" بنجاح!`);
        setIsAddModalOpen(false);
        setAddUsername('');
        setAddEmail('');
        setAddPassword('');
        setAddRole('user');
        refreshUsers();
      } else {
        showNotice('error', res.error || 'تعذر إضافة المستخدم');
      }
    } catch {
      showNotice('error', 'حدث خطأ أثناء تشفير كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Edit User
  const handleOpenEdit = (user: UserAccount) => {
    setSelectedUser(user);
    setEditUsername(user.username);
    setEditEmail(user.email || '');
    setEditRole(user.role);
    setIsEditModalOpen(true);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (editRole === 'admin') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!editEmail.trim() || !emailRegex.test(editEmail.trim())) {
        showNotice('error', 'البريد الإلكتروني إلزامي وبنسق صحيح لحسابات المدير الرئيسي (Admin)');
        return;
      }
    }

    const res = db.updateUser(selectedUser.id, {
      username: editUsername.trim(),
      email: editRole === 'admin' ? editEmail.trim() : (editEmail.trim() || undefined),
      role: editRole,
    });

    if (res.success) {
      showNotice('success', 'تم تعديل بيانات المستخدم بنجاح');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      refreshUsers();
    } else {
      showNotice('error', res.error || 'تعذر تحديث بيانات المستخدم');
    }
  };

  // 3. Reset Password
  const handleOpenResetPassword = (user: UserAccount) => {
    setSelectedUser(user);
    setResetPassword('');
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPassword.length < 6) {
      showNotice('error', 'يجب أن تتكون كلمة المرور من 6 خانات على الأقل');
      return;
    }

    setIsLoading(true);
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(resetPassword, salt);
      const res = db.updateUser(selectedUser.id, {
        passwordHash,
        salt,
        mustChangePassword: false,
      });

      if (res.success) {
        showNotice('success', `تمت إعادة تعيين كلمة مرور المستخدم "${selectedUser.username}" بنجاح!`);
        setIsResetPasswordModalOpen(false);
        setSelectedUser(null);
        refreshUsers();
      } else {
        showNotice('error', res.error || 'تعذر إعادة تعيين كلمة المرور');
      }
    } catch {
      showNotice('error', 'حدث خطأ أثناء معالجة كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Toggle Status (Active / Disabled)
  const handleToggleStatus = (user: UserAccount) => {
    const res = db.toggleUserStatus(user.id);
    if (res.success) {
      showNotice(
        'success',
        res.newStatus
          ? `تم تفعيل حساب "${user.username}" بنجاح`
          : `تم تعطيل حساب "${user.username}" بنجاح`
      );
      refreshUsers();
    } else {
      showNotice('error', res.error || 'تعذر تغيير حالة الحساب');
    }
  };

  // 5. Delete User
  const handleOpenDelete = (user: UserAccount) => {
    const check = db.canDeleteUser(user.id);
    if (!check.allowed) {
      showNotice('error', check.reason || 'لا يمكن حذف هذا المستخدم');
      return;
    }
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    const res = db.deleteUser(selectedUser.id);
    if (res.success) {
      showNotice('success', `تم حذف المستخدم "${selectedUser.username}" نهائياً`);
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      refreshUsers();
    } else {
      showNotice('error', res.error || 'تعذر حذف المستخدم');
    }
  };

  const activeAdminsCount = db.getActiveAdminsCount();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            إدارة المستخدمين وصلاحيات النظام
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            إدارة حسابات المسؤولين والمعلمين، تعيين كلمات المرور، والتحكم بالحسابات النشطة والمعطلة
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAddUsername('');
            setAddPassword('');
            setAddRole('user');
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Floating Notice */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border mb-5 flex items-center gap-2.5 text-xs font-bold animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
              <th className="py-3 px-4">اسم المستخدم</th>
              <th className="py-3 px-4">الدور والصلاحية</th>
              <th className="py-3 px-4">الحالة</th>
              <th className="py-3 px-4">تاريخ الإنشاء / آخر دخول</th>
              <th className="py-3 px-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {users.map((u) => {
              const isCurrentUser = u.id === currentUserId;
              const isLastActiveAdmin = u.role === 'admin' && u.isActive && activeAdminsCount <= 1;

              return (
                <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                  {/* Username */}
                  <td className="py-3.5 px-4 font-bold text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-emerald-400 font-bold text-xs">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          {u.username}
                          {isCurrentUser && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              حسابك
                            </span>
                          )}
                        </span>
                        {u.mustChangePassword && (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            بانتظار تغيير كلمة المرور الافتراضية
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3.5 px-4">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        مدير النظام (Admin)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-[11px]">
                        <Users className="w-3.5 h-3.5" />
                        مستخدم عادي (User)
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        نشط
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        معطل
                      </span>
                    )}
                  </td>

                  {/* Dates */}
                  <td className="py-3.5 px-4 text-slate-400">
                    <div className="flex flex-col text-[11px]">
                      <span>إنشاء: {new Date(u.createdAt).toLocaleDateString('ar-EG')}</span>
                      <span className="text-slate-500 text-[10px]">
                        آخر دخول: {u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'لم يسجل بعد'}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="تعديل اسم المستخدم أو الصلاحية"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Reset Password */}
                      <button
                        type="button"
                        onClick={() => handleOpenResetPassword(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                        title="إعادة تعيين كلمة المرور"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle Status */}
                      <button
                        type="button"
                        disabled={isLastActiveAdmin}
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          u.isActive
                            ? 'bg-slate-800 hover:bg-rose-950/80 text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-emerald-950/80 text-emerald-400'
                        }`}
                        title={
                          isLastActiveAdmin
                            ? 'لا يمكن تعطيل آخر مدير نشط'
                            : u.isActive
                            ? 'تعطيل الحساب'
                            : 'تفعيل الحساب'
                        }
                      >
                        {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        disabled={isLastActiveAdmin}
                        onClick={() => handleOpenDelete(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title={isLastActiveAdmin ? 'لا يمكن حذف آخر مدير نشط' : 'حذف المستخدم'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Safety Notice for Admin Protections */}
      <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          حماية أمان النظام: يمنع النظام تلقائياً حذف أو تعطيل آخر مدير نشط لضمان عدم فقدان الوصول الإداري لقاعدة البيانات.
        </span>
      </div>

      {/* Gmail SMTP Settings Card */}
      <div className="mt-8 pt-6 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                إعدادات خادم البريد الإلكتروني (Gmail SMTP)
              </h4>
              <button
                type="button"
                onClick={() => setIsSmtpHelpOpen(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                طريقة الإعداد
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              إرسال رموز استعادة كلمة المرور لبريد المدير الرئيسي (يتطلب Gmail App Password)
            </p>
          </div>

          <div>
            {smtpIsConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>مفعل لـ ({smtpMaskedEmail})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>غير مجهز بعد</span>
              </span>
            )}
          </div>
        </div>

        {smtpNotice && (
          <div
            className={`p-3 rounded-xl border mb-4 flex items-center gap-2 text-xs font-bold ${
              smtpNotice.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            {smtpNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{smtpNotice.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveSmtp} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              عنوان Gmail الإداري للإرسال
            </label>
            <div className="relative">
              <input
                type={(isEditingSmtpUser || !smtpIsConfigured) ? "password" : "text"}
                readOnly={smtpIsConfigured && !isEditingSmtpUser}
                required={(isEditingSmtpUser || !smtpIsConfigured)}
                value={(smtpIsConfigured && !isEditingSmtpUser) ? smtpMaskedEmail : smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder={(!smtpIsConfigured || isEditingSmtpUser) ? "أدخل البريد الإلكتروني الجديد" : "school.admin@gmail.com"}
                className={`w-full h-10 px-3 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden dir-ltr font-mono ${(smtpIsConfigured && !isEditingSmtpUser) ? 'opacity-70 grayscale cursor-default' : ''}`}
              />
              {smtpIsConfigured && !isEditingSmtpUser && (
                <button
                  type="button"
                  onClick={() => setIsEditingSmtpUser(true)}
                  className="absolute inset-y-0 left-0 px-3 flex items-center text-[10px] font-bold text-emerald-500 hover:text-emerald-400 cursor-pointer"
                >
                  تغيير العنوان
                </button>
              )}
              {isEditingSmtpUser && (
                <button
                  type="button"
                  onClick={() => { setIsEditingSmtpUser(false); setSmtpUser(''); }}
                  className="absolute inset-y-0 left-0 px-3 flex items-center text-[10px] font-bold text-rose-500 hover:text-rose-400 cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              كلمة مرور التطبيقات (Gmail App Password - 16 خانة)
            </label>
            <div className="relative">
              <input
                type="password"
                readOnly={smtpIsConfigured && !isEditingSmtpPass}
                required={(isEditingSmtpPass || !smtpIsConfigured)}
                value={(smtpIsConfigured && !isEditingSmtpPass) ? "••••••••••••••••" : smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={(!smtpIsConfigured || isEditingSmtpPass) ? "أدخل الرمز المكون من 16 حرفاً" : ""}
                className={`w-full h-10 px-3 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden dir-ltr font-mono ${(smtpIsConfigured && !isEditingSmtpPass) ? 'opacity-70 grayscale cursor-default' : ''}`}
              />
              {smtpIsConfigured && !isEditingSmtpPass && (
                <button
                  type="button"
                  onClick={() => setIsEditingSmtpPass(true)}
                  className="absolute inset-y-0 left-0 px-3 flex items-center text-[10px] font-bold text-emerald-500 hover:text-emerald-400 cursor-pointer"
                >
                  تغيير الرمز
                </button>
              )}
              {isEditingSmtpPass && (
                <button
                  type="button"
                  onClick={() => { setIsEditingSmtpPass(false); setSmtpPass(''); }}
                  className="absolute inset-y-0 left-0 px-3 flex items-center text-[10px] font-bold text-rose-500 hover:text-rose-400 cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              خادم SMTP
            </label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-400 focus:border-emerald-500 focus:outline-hidden dir-ltr font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              منفذ الاتصال (Port)
            </label>
            <input
              type="text"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-400 focus:border-emerald-500 focus:outline-hidden dir-ltr font-mono"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400">
              * يُحفظ السر آمنياً في مسار بيانات التطبيق المحمي ببيئة Windows Electron ولن يُرفع للإنترنت.
            </span>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isSmtpTesting}
                onClick={handleTestSmtp}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSmtpTesting ? 'جاري الاختبار...' : 'اختبار الاتصال'}</span>
              </button>

              <button
                type="submit"
                disabled={isSmtpSaving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <span>{isSmtpSaving ? 'جاري الحفظ...' : 'حفظ إعدادات SMTP'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* MODAL 1: Add User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h4 className="text-base font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                إضافة مستخدم جديد
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="مثال: teacher1 أو ahmed"
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الأولية (6 أحرف/أرقام على الأقل)</label>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="w-full h-10 pr-3 pl-10 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الدور والصلاحية</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden font-bold"
                >
                  <option value="user">مستخدم عادي (معاينة فقط - Read Only)</option>
                  <option value="admin">مدير رئيسي كامل (Admin - إدارة ومستخدمون ونسخ احتياطي)</option>
                </select>
              </div>

              {addRole === 'admin' && (
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1">
                    البريد الإلكتروني للمدير (إلزامي لاستعادة كلمة المرور)
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="admin@school.edu.iq"
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-emerald-500/50 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden dir-ltr font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-750"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black"
                >
                  {isLoading ? 'جاري الإضافة...' : 'حفظ المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit User */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h4 className="text-base font-bold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                تعديل بيانات المستخدم
              </h4>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الدور والصلاحية</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden font-bold"
                >
                  <option value="user">مستخدم عادي (معاينة فقط - Read Only)</option>
                  <option value="admin">مدير كامل (Admin)</option>
                </select>
              </div>

              {editRole === 'admin' && (
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1">
                    البريد الإلكتروني للمدير (إلزامي لاستعادة كلمة المرور)
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="admin@school.edu.iq"
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-emerald-500/50 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden dir-ltr font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Password */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h4 className="text-base font-bold flex items-center gap-2 text-amber-400">
                <KeyRound className="w-5 h-5" />
                إعادة تعيين كلمة المرور
              </h4>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              سيتم تعيين كلمة مرور جديدة للمستخدم <strong className="text-emerald-400 font-bold">{selectedUser.username}</strong>:
            </p>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الجديدة (6 خانات على الأقل)</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full h-10 pr-3 pl-10 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
                >
                  {isLoading ? 'جاري الحفظ...' : 'تأكيد التعيين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete User Confirmation */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold">تأكيد حذف المستخدم</h4>
                <p className="text-xs text-slate-400">هذا الإجراء نهائي ولا يمكن التراجع عنه</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حساب المستخدم <strong className="text-white font-bold font-mono">"{selectedUser.username}"</strong>؟
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-750"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black"
              >
                نعم، احذف المستخدم
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 5: Gmail SMTP Setup Instructions */}
      {isSmtpHelpOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" 
          dir="rtl"
          onClick={() => setIsSmtpHelpOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsSmtpHelpOpen(false); }}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={() => setIsSmtpHelpOpen(false)}
              className="absolute top-6 left-6 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <HelpCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black">طريقة إعداد بريد Gmail</h3>
                <p className="text-xs text-slate-400">خطوات تفعيل إرسال رموز استعادة كلمة المرور</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">١</div>
                <p className="text-sm text-slate-200 leading-relaxed">سجّل الدخول إلى حساب <strong>Gmail</strong> المخصص لإرسال بريد النظام.</p>
              </div>
              
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">٢</div>
                <p className="text-sm text-slate-200 leading-relaxed">تأكد من تفعيل خاصية <strong>التحقق بخطوتين (2-Step Verification)</strong> في إعدادات الأمان بالحساب.</p>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">٣</div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-200 leading-relaxed">افتح صفحة <strong>كلمات مرور التطبيقات</strong> الرسمية من جوجل:</p>
                  <button
                    type="button"
                    onClick={handleOpenGoogleLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold self-start transition-all cursor-pointer border border-emerald-500/10"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    فتح صفحة إنشاء كلمة مرور التطبيقات
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">٤</div>
                <p className="text-sm text-slate-200 leading-relaxed">أنشئ كلمة مرور تطبيقات جديدة باسم <strong>"School Grades App"</strong>.</p>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">٥</div>
                <p className="text-sm text-slate-200 leading-relaxed">انسخ الرمز المكون من <strong>١٦ حرفاً</strong> الملحق به والصقه في حقل «كلمة مرور التطبيقات» في هذه الشاشة.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/80 leading-relaxed mb-8 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              <span>
                <strong>تنبيه أمني:</strong> كلمة مرور التطبيقات تختلف عن كلمة مرور حسابك العادية. لا تشارك هذا الرمز مع أحد، ولا تقم برفعه إلى مستودعات الكود العامة (مثل GitHub).
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsSmtpHelpOpen(false)}
              className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              فهمت، العودة للإعدادات
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
