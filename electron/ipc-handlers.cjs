const { dialog, shell } = require('electron');

function registerIpcHandlers(ipcMain, dependencies) {
  const { 
    app, mainWindow, db, smtpService, resetService, 
    sessionManager, validateSender, requireAuth, 
    requireAdminRole, handleInitDb 
  } = dependencies;

  ipcMain.handle('auth:login', async (event, username, password) => {
    if (!validateSender(event)) return { success: false, error: 'Unauthorized origin' };
    
    const result = await db.verifyCredentials(username, password);
    if (result.success) {
      const session = sessionManager.createSession(event.sender.id, result.user);
      await db.updateUserLastLogin(result.user.id);
      return { success: true, session };
    }
    return result;
  });

  ipcMain.handle('auth:setupFirstAdmin', async (event, { username, password }) => {
    if (!validateSender(event)) return { success: false, error: 'Unauthorized origin' };
    
    const result = await db.setupFirstAdmin(username, password);
    if (result.success) {
      const session = sessionManager.createSession(event.sender.id, result.user);
      try {
        const credsFile = require('path').join(app.getPath('userData'), 'INITIAL_ADMIN_CREDENTIALS.txt');
        if (require('fs').existsSync(credsFile)) {
          require('fs').unlinkSync(credsFile);
        }
      } catch (e) {
        console.warn('Failed to cleanup legacy credentials file:', e.message);
      }
      return { success: true, session };
    }
    return result;
  });

  ipcMain.handle('auth:getSetupStatus', async (event) => {
    if (!validateSender(event)) return { setupRequired: false };
    return await db.getSetupStatus();
  });

  ipcMain.handle('auth:getCurrentUser', (event) => {
    if (!validateSender(event)) return null;
    const session = sessionManager.getSession(event.sender.id);
    return session ? session.user : null;
  });

  ipcMain.handle('auth:clearSession', (event) => {
    if (!validateSender(event)) return { success: false };
    sessionManager.clearSession(event.sender.id);
    return { success: true };
  });

  // Password Recovery & SMTP Services
  ipcMain.handle('auth:requestPasswordResetCode', (event, username) => {
    if (!validateSender(event)) return { success: false, error: 'Unauthorized' };
    return resetService.requestPasswordResetCode(username);
  });
  
  ipcMain.handle('auth:verifyResetCodeAndChangePassword', async (event, username, code, newPassword) => {
    if (!validateSender(event)) return { success: false, error: 'Unauthorized' };
    const res = await resetService.verifyResetCodeAndChangePassword(username, code, newPassword);
    if (res.success && res.userId) {
      sessionManager.clearSessionsByUserId(res.userId);
    } else if (res.success) {
      sessionManager.clearSession(event.sender.id);
    }
    return res;
  });

  ipcMain.handle('auth:changePassword', async (event, currentPassword, newPassword) => {
    const session = requireAuth(event);
    const verifyRes = await db.verifyCredentials(session.user.username, currentPassword);
    if (!verifyRes.success) {
      return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات/أحرف.' };
    }
    await db.updateUserPassword(session.user.id, newPassword);
    sessionManager.clearSessionsByUserId(session.user.id);
    return { success: true };
  });

  ipcMain.handle('auth:forceChangePassword', async (event, newPassword, adminEmail) => {
    const session = requireAuth(event);
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات/أحرف.' };
    }
    if (session.user.role === 'admin' && adminEmail) {
      await db.updateUser(session.user.id, { email: adminEmail });
    }
    await db.updateUserPassword(session.user.id, newPassword);
    sessionManager.clearSessionsByUserId(session.user.id);
    return { success: true };
  });

  ipcMain.handle('auth:adminResetUserPassword', async (event, userId, newPassword) => {
    requireAdminRole(event);
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات/أحرف.' };
    }
    await db.updateUserPassword(userId, newPassword);
    sessionManager.clearSessionsByUserId(userId);
    return { success: true };
  });

  ipcMain.handle('db:updateUserPassword', async (event, id, newPassword) => {
    const session = requireAuth(event);
    if (session.user.role !== 'admin' && session.user.id !== id) {
      throw new Error('Unauthorized');
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات/أحرف.' };
    }
    await db.updateUserPassword(id, newPassword);
    sessionManager.clearSessionsByUserId(id);
    return { success: true };
  });

  ipcMain.handle('smtp:getSmtpStatus', (event) => {
    if (!validateSender(event)) return { configured: false };
    return smtpService.getSmtpStatus();
  });
  
  ipcMain.handle('smtp:saveConfig', (event, config) => { 
    requireAdminRole(event); 
    return smtpService.saveSmtpConfig(config); 
  });
  
  ipcMain.handle('smtp:testConnection', (event, config) => { 
    requireAdminRole(event); 
    return smtpService.testSmtpConnection(config); 
  });

  ipcMain.handle('db:init', (event) => {
    if (!validateSender(event)) return { success: false };
    return handleInitDb();
  });
  
  ipcMain.handle('db:loadAll', (event) => {
    requireAuth(event);
    return db.loadAll();
  });
  ipcMain.handle('db:saveSettings', (event, key, value) => { requireAdminRole(event); return db.saveSettings(key, value); });
  ipcMain.handle('db:upsertUser', (event, user) => { requireAdminRole(event); return db.upsertUser(user); });
  ipcMain.handle('db:upsertYear', (event, year) => { requireAdminRole(event); return db.upsertYear(year); });
  ipcMain.handle('db:upsertClass', (event, cls) => { requireAdminRole(event); return db.upsertClass(cls); });
  ipcMain.handle('db:upsertSection', (event, sec) => { requireAdminRole(event); return db.upsertSection(sec); });
  ipcMain.handle('db:upsertSubject', (event, sub) => { requireAdminRole(event); return db.upsertSubject(sub); });
  ipcMain.handle('db:upsertStudent', (event, stu) => { requireAdminRole(event); return db.upsertStudent(stu); });
  ipcMain.handle('db:upsertGrade', (event, grade) => { requireAdminRole(event); return db.upsertGrade(grade); });
  ipcMain.handle('db:saveExemptionSettings', (event, settings) => { requireAdminRole(event); return db.saveExemptionSettings(settings); });
  ipcMain.handle('db:saveDecisionSettings', (event, settings) => { requireAdminRole(event); return db.saveDecisionSettings(settings); });
  ipcMain.handle('db:upsertDecisionGrant', (event, grant) => { requireAdminRole(event); return db.upsertDecisionGrant(grant); });
  ipcMain.handle('db:saveCertificateTemplate', (event, config, imageData) => { requireAdminRole(event); return db.saveCertificateTemplate(config, imageData); });
  ipcMain.handle('db:upsertPromotionLog', (event, log) => { requireAdminRole(event); return db.upsertPromotionLog(log); });
  ipcMain.handle('db:executeStudentPromotionBatch', (event, students, promotionLog) => { requireAdminRole(event); return db.executeStudentPromotionBatch(students, promotionLog); });
  ipcMain.handle('db:deleteEntity', (event, table, id) => { requireAdminRole(event); return db.deleteEntity(table, id); });
  ipcMain.handle('db:deleteStudentCascade', (event, studentId) => { requireAdminRole(event); return db.deleteStudentCascade(studentId); });
  ipcMain.handle('db:deleteClassCascade', (event, classId) => { requireAdminRole(event); return db.deleteClassCascade(classId); });
  
  ipcMain.handle('db:createBackup', (event) => {
    requireAdminRole(event);
    return db.createBackup();
  });
  
  ipcMain.handle('auth:setAccessCode', async (event, code, newAdminPassword) => {
    if (!validateSender(event)) return { success: false, error: 'Unauthorized origin' };
    requireAdminRole(event);
    return await db.setAccessCode(code, newAdminPassword);
  });

  ipcMain.handle('auth:verifyAccessCode', async (event, code) => {
    if (!validateSender(event)) return false;
    return await db.verifyAccessCode(code);
  });

  ipcMain.handle('auth:isAccessCodeConfigured', async (event) => {
    if (!validateSender(event)) return { isConfigured: false };
    return await db.isAccessCodeConfigured();
  });

  ipcMain.handle('db:getBackupsInfo', (event) => {
    requireAdminRole(event);
    return db.getBackupsInfo();
  });
  
  ipcMain.handle('db:exportSql', (event) => {
    requireAdminRole(event);
    return db.exportSql();
  });
  
  ipcMain.handle('db:restoreDb', async (event) => { 
    requireAdminRole(event); 

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف قاعدة البيانات للاستعادة (.db)',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
      properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: 'تم إلغاء عملية اختيار ملف الاستعادة.' };
    }

    const selectedPath = filePaths[0];
    return await db.restoreDb(selectedPath); 
  });

  ipcMain.handle('dialog:openDirectory', async (event) => {
    if (!validateSender(event)) return null;
    requireAdminRole(event);

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'اختر مجلد حفظ النسخ الاحتياطية',
      buttonLabel: 'تحديد المجلد',
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle('dialog:openFile', async (event, filters) => {
    if (!validateSender(event)) return null;
    requireAdminRole(event);

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters,
      title: 'اختر ملف قاعدة البيانات لاستعادته',
      buttonLabel: 'استعادة',
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle('shell:openExternal', async (event, urlString) => {
    if (!validateSender(event)) return { success: false, error: 'Unauthorized' };
    try {
      if (typeof urlString !== 'string' || !urlString.trim()) {
        return { success: false, error: 'رابط غير صالح' };
      }
      const parsedUrl = new URL(urlString.trim());
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { success: false, error: 'بروتوكول غير مسموح به' };
      }
      if (parsedUrl.username || parsedUrl.password) {
        return { success: false, error: 'الرابط يحتوي على بيانات اعتماد غير آمنة' };
      }
      if (!parsedUrl.hostname) {
        return { success: false, error: 'وجهة الرابط غير صالحة' };
      }
      await shell.openExternal(parsedUrl.href);
      return { success: true };
    } catch (err) {
      console.error('shell.openExternal error:', err);
      return { success: false, error: 'رابط غير صالح أو تعذر فتحه' };
    }
  });
}

module.exports = { registerIpcHandlers };
