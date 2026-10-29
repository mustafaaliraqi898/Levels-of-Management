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

  const [isLoading, setIsLoading] = useState(false);

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
    </div>
  );
};
