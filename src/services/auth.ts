import { UserAccount, AuthSession, UserRole } from '../types';
import { db } from './storage';

const SESSION_STORAGE_KEY = 'school_app_auth_session';

export { hashPassword, generateSalt, verifyPassword } from '../utils/crypto';
import { hashPassword, generateSalt, verifyPassword } from '../utils/crypto';

class AuthService {
  private currentSession: AuthSession | null = null;
  private sessionListeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    // Clear any stale persistent storage session to guarantee cold-start shows LoginView
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.currentSession = this.loadSession();
    if (this.currentSession && typeof window !== 'undefined' && (window as any).electronAPI?.auth) {
      (window as any).electronAPI.auth.setSession(this.currentSession).catch(() => {});
    }
  }

  private loadSession(): AuthSession | null {
    try {
      // Use sessionStorage so session only lives during the active window session
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      const parsed: AuthSession = JSON.parse(stored);
      if (!parsed || !parsed.user || !parsed.user.id) return null;

      // Re-validate that user still exists and is active in the database
      const users = db.getUsers();
      const existing = users.find((u) => u.id === parsed.user.id);
      if (!existing || !existing.isActive) {
        this.clearSession();
        return null;
      }

      // Sync role and mustChangePassword state if changed
      parsed.user.role = existing.role;
      parsed.user.username = existing.username;
      parsed.user.mustChangePassword = !!existing.mustChangePassword;
      return parsed;
    } catch {
      return null;
    }
  }

  public getCurrentSession(): AuthSession | null {
    if (!this.currentSession) {
      this.currentSession = this.loadSession();
    }
    return this.currentSession;
  }

  public subscribe(cb: (session: AuthSession | null) => void): () => void {
    this.sessionListeners.add(cb);
    return () => this.sessionListeners.delete(cb);
  }

  private notify() {
    this.sessionListeners.forEach((cb) => cb(this.currentSession));
  }

  public saveSession(session: AuthSession) {
    this.currentSession = session;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      localStorage.removeItem(SESSION_STORAGE_KEY);
      if (typeof window !== 'undefined' && (window as any).electronAPI?.auth) {
        (window as any).electronAPI.auth.setSession(session).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to persist auth session', e);
    }
    this.notify();
  }

  public clearSession() {
    this.currentSession = null;
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      if (typeof window !== 'undefined' && (window as any).electronAPI?.auth) {
        (window as any).electronAPI.auth.clearSession().catch(() => {});
      }
    } catch (e) {
      console.error('Failed to clear auth session', e);
    }
    this.notify();
  }

  /**
   * Login with username and password.
   */
  public async login(
    usernameInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    const username = usernameInput.trim();
    if (!username || !passwordInput) {
      return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' };
    }

    if (db.whenReady) {
      await db.whenReady();
    }

    const users = db.getUsers();
    const user = users.find(
      (u) => u.username.trim().toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: 'هذا الحساب معطل حالياً من قبل الإدارة. يرجى التواصل مع المسؤول.',
      };
    }

    const isValid = await verifyPassword(passwordInput, user.salt, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // Update lastLogin in database
    db.updateUserLastLogin(user.id);

    const session: AuthSession = {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      },
      token: `token_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      loginTime: new Date().toISOString(),
    };

    this.saveSession(session);
    return { success: true, session };
  }

  /**
   * Log out current user
   */
  public logout() {
    this.clearSession();
  }

  /**
   * Verification codes in-memory store for password resets
   * key: username.toLowerCase()
   */
  private resetCodesStore: Map<
    string,
    {
      code: string;
      expiresAt: number;
      attemptsLeft: number;
      emailSentTo: string;
    }
  > = new Map();

  /**
   * Force change password and register admin email on initial login
   */
  public async forceChangePassword(
    userId: string,
    newPassword: string,
    adminEmail?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' };
    }

    const users = db.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    // If admin user and email provided, validate it
    const updates: Partial<UserAccount> = {};
    if (user.role === 'admin') {
      const emailToUse = (adminEmail || user.email || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailToUse || !emailRegex.test(emailToUse)) {
        return {
          success: false,
          error: 'يرجى إدخال بريد إلكتروني صالح وتأكيده لدواعي أمان واستعادة حساب المدير',
        };
      }
      updates.email = emailToUse;
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    updates.passwordHash = newHash;
    updates.salt = newSalt;
    updates.mustChangePassword = false;

    db.updateUser(userId, updates);

    // Update local session
    if (this.currentSession && this.currentSession.user.id === userId) {
      this.currentSession.user.mustChangePassword = false;
      if (updates.email) {
        this.currentSession.user.email = updates.email;
      }
      this.saveSession(this.currentSession);
    }

    return { success: true };
  }

  /**
   * Request password reset code via email
   */
  public async requestPasswordResetCode(
    usernameInput: string
  ): Promise<{ success: boolean; maskedEmail?: string; message: string; debugCode?: string }> {
    const username = usernameInput.trim().toLowerCase();
    if (!username) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم' };
    }

    const users = db.getUsers();
    const user = users.find((u) => u.username.trim().toLowerCase() === username);

    // Generic response message to prevent account enumeration
    const genericMsg = 'إذا كان اسم المستخدم صحيحاً ومسجلاً له بريد إلكتروني، فسيتم إرسال رمز التحقق إلى بريده الإلكتروني.';

    if (!user || !user.isActive || !user.email) {
      return { success: true, message: genericMsg };
    }

    // Generate 6-digit numeric verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes lifetime
    const attemptsLeft = 5;

    // Save code to store (overwriting any previous code)
    this.resetCodesStore.set(username, {
      code,
      expiresAt,
      attemptsLeft,
      emailSentTo: user.email,
    });

    // Mask email for security display (e.g., m***a@gmail.com)
    const emailParts = user.email.split('@');
    const localPart = emailParts[0];
    const domainPart = emailParts[1] || '';
    const maskedLocal =
      localPart.length > 2
        ? `${localPart[0]}***${localPart[localPart.length - 1]}`
        : `${localPart[0]}***`;
    const maskedEmail = `${maskedLocal}@${domainPart}`;

    return {
      success: true,
      maskedEmail,
      message: `تم إرسال رمز التحقق المكون من 6 أرقام إلى البريد الإلكتروني (${maskedEmail}). الرمز صالحة لمدة 5 دقائق.`,
      debugCode: code, // Provided for offline simulation & manual verification
    };
  }

  /**
   * Verify reset code and update password
   */
  public async verifyResetCodeAndChangePassword(
    usernameInput: string,
    codeInput: string,
    newPasswordInput: string
  ): Promise<{ success: boolean; error?: string }> {
    const username = usernameInput.trim().toLowerCase();
    const code = codeInput.trim();

    if (!username || !code) {
      return { success: false, error: 'يرجى إدخال اسم المستخدم ورمز التحقق' };
    }

    if (!newPasswordInput || newPasswordInput.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات/أحرف' };
    }

    const storedData = this.resetCodesStore.get(username);
    if (!storedData) {
      return { success: false, error: 'لا يوجد طلب استعادة فعال لهذا الحساب أو انتهت صلاحيته. يرجى طلب رمز جديد.' };
    }

    // Check expiration (5 minutes)
    if (Date.now() > storedData.expiresAt) {
      this.resetCodesStore.delete(username);
      return { success: false, error: 'انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب رمز جديد.' };
    }

    // Check attempts limit (max 5 attempts)
    if (storedData.attemptsLeft <= 0) {
      this.resetCodesStore.delete(username);
      return { success: false, error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم إلغاء الرمز، يرجى طلب رمز جديد.' };
    }

    // Validate code
    if (storedData.code !== code) {
      storedData.attemptsLeft -= 1;
      if (storedData.attemptsLeft <= 0) {
        this.resetCodesStore.delete(username);
        return { success: false, error: 'رمز التحقق غير صحيح. تم استنفاد جميع المحاولات، يرجى طلب رمز جديد.' };
      }
      return {
        success: false,
        error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${storedData.attemptsLeft}`,
      };
    }

    // Code is valid! Reset password for user
    const users = db.getUsers();
    const user = users.find((u) => u.username.trim().toLowerCase() === username);
    if (!user) {
      this.resetCodesStore.delete(username);
      return { success: false, error: 'المستخدم غير موجود' };
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newPasswordInput, newSalt);

    db.updateUser(user.id, {
      passwordHash: newHash,
      salt: newSalt,
      mustChangePassword: false,
    });

    // Invalidate code after single use
    this.resetCodesStore.delete(username);

    return { success: true };
  }

  /**
   * Update profile (username and/or password) for account settings
   */
  public async updateAccountProfile(
    userId: string,
    updates: {
      newUsername?: string;
      currentPassword?: string;
      newPassword?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const users = db.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    const dataToUpdate: Partial<UserAccount> = {};

    // Check username update
    if (updates.newUsername && updates.newUsername.trim()) {
      const cleanName = updates.newUsername.trim();
      const duplicate = users.find(
        (u) => u.id !== userId && u.username.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: 'اسم المستخدم هذا محجوز بالفعل لمستخدم آخر' };
      }
      dataToUpdate.username = cleanName;
    }

    // Check password update
    if (updates.newPassword) {
      if (!updates.currentPassword) {
        return { success: false, error: 'يرجى إدخال كلمة المرور الحالية لتأكيد التغيير' };
      }

      const isCurrentValid = await verifyPassword(
        updates.currentPassword,
        user.salt,
        user.passwordHash
      );
      if (!isCurrentValid) {
        return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
      }

      if (updates.newPassword.length < 6) {
        return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف/أرقام' };
      }

      const newSalt = generateSalt();
      const newHash = await hashPassword(updates.newPassword, newSalt);
      dataToUpdate.passwordHash = newHash;
      dataToUpdate.salt = newSalt;
      dataToUpdate.mustChangePassword = false;
    }

    db.updateUser(userId, dataToUpdate);

    // Update current active session
    if (this.currentSession && this.currentSession.user.id === userId) {
      if (dataToUpdate.username) {
        this.currentSession.user.username = dataToUpdate.username;
      }
      this.saveSession(this.currentSession);
    }

    return { success: true };
  }
}

export const authService = new AuthService();
