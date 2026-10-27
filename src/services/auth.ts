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
   * Force change password (required for initial admin login)
   */
  public async forceChangePassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' };
    }

    const users = db.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    db.updateUser(userId, {
      passwordHash: newHash,
      salt: newSalt,
      mustChangePassword: false,
    });

    // Update local session
    if (this.currentSession && this.currentSession.user.id === userId) {
      this.currentSession.user.mustChangePassword = false;
      this.saveSession(this.currentSession);
    }

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
