const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const db = require('./database.cjs');
const smtpService = require('./smtp-service.cjs');
const resetService = require('./reset-service.cjs');
const fs = require('fs');

let mainWindow = null;

async function handleInitDb() {
  try {
    await db.initDb();
    return { success: true };
  } catch (err) {
    console.error('Failed to initialize database:', err);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617', // Dark slate 950
    title: 'نظام إدارة الدرجات المدرسية',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
    },
  });

  // Load from local build or local dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove standard English menu for a clean custom dark native feel
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let currentActiveSession = null;

function requireAdminRole() {
  if (!currentActiveSession || !currentActiveSession.user || currentActiveSession.user.role !== 'admin') {
    throw new Error('عفواً، هذه العملية مرفوضة أمنياً: حساب المعاينة للقراءة فقط ولا يملك صلاحية تعديل قاعدة البيانات SQLite.');
  }
}

app.whenReady().then(async () => {
  await handleInitDb();

  ipcMain.handle('auth:setSession', (event, session) => {
    currentActiveSession = session;
    return { success: true };
  });

  ipcMain.handle('auth:clearSession', () => {
    currentActiveSession = null;
    return { success: true };
  });

  // Password Recovery & SMTP Services
  ipcMain.handle('auth:requestPasswordResetCode', (event, username) => resetService.requestPasswordResetCode(username));
  ipcMain.handle('auth:verifyResetCodeAndChangePassword', (event, username, code, newPassword) => resetService.verifyResetCodeAndChangePassword(username, code, newPassword));
  ipcMain.handle('smtp:getSmtpStatus', () => smtpService.getSmtpStatus());
  ipcMain.handle('smtp:saveConfig', (event, config) => { requireAdminRole(); return smtpService.saveSmtpConfig(config); });
  ipcMain.handle('smtp:testConnection', (event, config) => { requireAdminRole(); return smtpService.testSmtpConnection(config); });

  ipcMain.handle('db:init', handleInitDb);
  ipcMain.handle('db:loadAll', () => db.loadAll());
  ipcMain.handle('db:saveSettings', (event, key, value) => { requireAdminRole(); return db.saveSettings(key, value); });
  ipcMain.handle('db:upsertUser', (event, user) => { requireAdminRole(); return db.upsertUser(user); });
  ipcMain.handle('db:upsertYear', (event, year) => { requireAdminRole(); return db.upsertYear(year); });
  ipcMain.handle('db:upsertClass', (event, cls) => { requireAdminRole(); return db.upsertClass(cls); });
  ipcMain.handle('db:upsertSection', (event, sec) => { requireAdminRole(); return db.upsertSection(sec); });
  ipcMain.handle('db:upsertSubject', (event, sub) => { requireAdminRole(); return db.upsertSubject(sub); });
  ipcMain.handle('db:upsertStudent', (event, stu) => { requireAdminRole(); return db.upsertStudent(stu); });
  ipcMain.handle('db:upsertGrade', (event, grade) => { requireAdminRole(); return db.upsertGrade(grade); });
  ipcMain.handle('db:saveExemptionSettings', (event, settings) => { requireAdminRole(); return db.saveExemptionSettings(settings); });
  ipcMain.handle('db:saveDecisionSettings', (event, settings) => { requireAdminRole(); return db.saveDecisionSettings(settings); });
  ipcMain.handle('db:upsertDecisionGrant', (event, grant) => { requireAdminRole(); return db.upsertDecisionGrant(grant); });
  ipcMain.handle('db:saveCertificateTemplate', (event, config, imageData) => { requireAdminRole(); return db.saveCertificateTemplate(config, imageData); });
  ipcMain.handle('db:upsertPromotionLog', (event, log) => { requireAdminRole(); return db.upsertPromotionLog(log); });
  ipcMain.handle('db:executeStudentPromotionBatch', (event, students, promotionLog) => { requireAdminRole(); return db.executeStudentPromotionBatch(students, promotionLog); });
  ipcMain.handle('db:deleteEntity', (event, table, id) => { requireAdminRole(); return db.deleteEntity(table, id); });
  ipcMain.handle('db:deleteStudentCascade', (event, studentId) => { requireAdminRole(); return db.deleteStudentCascade(studentId); });
  ipcMain.handle('db:deleteClassCascade', (event, classId) => { requireAdminRole(); return db.deleteClassCascade(classId); });
  ipcMain.handle('db:createBackup', () => db.createBackup());
  ipcMain.handle('db:getBackupsInfo', () => db.getBackupsInfo());
  ipcMain.handle('db:exportSql', () => db.exportSql());
  ipcMain.handle('db:restoreDb', (event, path) => { requireAdminRole(); return db.restoreDb(path); });

  ipcMain.handle('dialog:openDirectory', async () => {
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
    try {
      if (typeof urlString !== 'string' || !urlString.trim()) {
        return { success: false, error: 'رابط غير صالح' };
      }
      const parsedUrl = new URL(urlString.trim());

      // 1. Strictly allow only 'https:' or 'http:' protocols
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { success: false, error: 'بروتوكول غير مسموح به' };
      }

      // 2. Reject URLs with embedded credentials (e.g. https://user:pass@evil.com)
      if (parsedUrl.username || parsedUrl.password) {
        return { success: false, error: 'الرابط يحتوي على بيانات اعتماد غير آمنة' };
      }

      // 3. Ensure hostname is present
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

  // Print & PDF Export Services
  ipcMain.handle('print:getPrinters', async () => {
    if (!mainWindow || !mainWindow.webContents) return [];
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        isDefault: Boolean(p.isDefault),
        status: p.status,
      }));
    } catch (err) {
      console.error('Failed to get printers:', err);
      return [];
    }
  });

  async function renderHtmlToPrintWindow(htmlContent, landscape) {
    const printWin = new BrowserWindow({
      show: false,
      width: landscape ? 1400 : 1000,
      height: landscape ? 1000 : 1400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false, // Allows reading local files and inlined data without cross-origin blocks
      },
    });

    // Write the self-contained HTML to a temporary file and load it via an RFC-compliant file URL.
    // This completely circumvents Windows path issues (spaces, backslashes, drive letters, and Arabic folder names).
    let tempHtmlFile = null;
    try {
      const tempDir = app.getPath('temp');
      const uniqueSuffix = crypto.randomBytes(16).toString('hex');
      tempHtmlFile = path.join(
        tempDir,
        `print_doc_${Date.now()}_${uniqueSuffix}.html`
      );
      await fs.promises.writeFile(tempHtmlFile, htmlContent, 'utf8');

      const fileUrl = url.pathToFileURL(tempHtmlFile).href;
      await printWin.loadURL(fileUrl);
    } catch (loadErr) {
      console.error('Failed to write or load isolated HTML in print window:', loadErr);
      if (tempHtmlFile) {
        fs.promises.unlink(tempHtmlFile).catch(() => {});
      }
      throw loadErr;
    }

    printWin._tempHtmlFile = tempHtmlFile;

    // Wait until document, fonts (Cairo, Tajawal, Amiri, system fallbacks), and images are decoded
    try {
      await printWin.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const waitForResources = () => {
            const fontPromise = document.fonts ? document.fonts.ready : Promise.resolve();
            const imgPromises = Array.from(document.images).map((img) => {
              if (img.complete && img.naturalWidth > 0) {
                if ('decode' in img && typeof img.decode === 'function') {
                  return img.decode().catch(() => {});
                }
                return Promise.resolve();
              }
              return new Promise((res) => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
                setTimeout(res, 2500); // 2.5s fallback per image
              });
            });

            Promise.all([fontPromise, Promise.all(imgPromises)]).then(() => {
              setTimeout(resolve, 180); // stabilization tick
            });
          };

          if (document.readyState === 'complete') {
            waitForResources();
          } else {
            window.addEventListener('load', waitForResources, { once: true });
          }
        });
      `);
    } catch (e) {
      console.warn('Wait for fonts/images in printWin warning:', e);
    }

    return printWin;
  }

  ipcMain.handle('print:printDocument', async (event, options = {}) => {
    if (!mainWindow || !mainWindow.webContents) {
      return { success: false, error: 'النافذة الرئيسية غير متاحة' };
    }

    const printOpts = {
      silent: Boolean(options.silent),
      printBackground: options.printBackground !== false,
      deviceName: options.deviceName || '',
      color: options.color !== false,
      landscape: Boolean(options.landscape),
      margins: options.margins || { marginType: 'printableArea' },
      copies: options.copies || 1,
      pageSize: options.pageSize || 'A4',
    };

    let targetWebContents = mainWindow.webContents;
    let tempWin = null;

    try {
      if (options.html) {
        tempWin = await renderHtmlToPrintWindow(options.html, Boolean(options.landscape));
        targetWebContents = tempWin.webContents;
      }

      return await new Promise((resolve) => {
        targetWebContents.print(printOpts, (success, failureReason) => {
          if (!success) {
            console.error('Print failed:', failureReason);
            resolve({
              success: false,
              error: failureReason || 'فشلت عملية إرسال أمر الطباعة إلى الطابعة المحددة أو ألغيت من المستخدم.',
            });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (err) {
      console.error('Print failed with error:', err);
      return { success: false, error: err.message || 'حدث خطأ غير متوقع أثناء الطباعة' };
    } finally {
      if (tempWin && !tempWin.isDestroyed()) {
        const tempFile = tempWin._tempHtmlFile;
        tempWin.destroy();
        if (tempFile) {
          fs.promises.unlink(tempFile).catch(() => {});
        }
      }
    }
  });

  ipcMain.handle('print:savePdf', async (event, options = {}) => {
    if (!mainWindow || !mainWindow.webContents) {
      return { success: false, error: 'النافذة الرئيسية غير متاحة' };
    }

    const defaultTitle = options.title || 'تقرير_مدرسي';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ التقرير كملف PDF',
      defaultPath: `${defaultTitle}.pdf`,
      filters: [{ name: 'مستندات PDF (*.pdf)', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    let targetWebContents = mainWindow.webContents;
    let tempWin = null;

    try {
      if (options.html) {
        tempWin = await renderHtmlToPrintWindow(options.html, Boolean(options.landscape));
        targetWebContents = tempWin.webContents;
      }

      const pdfBuffer = await targetWebContents.printToPDF({
        landscape: Boolean(options.landscape),
        printBackground: options.printBackground !== false,
        pageSize: options.pageSize || 'A4',
        preferCSSPageSize: true,
      });

      if (!pdfBuffer || pdfBuffer.length === 0) {
        return { success: false, error: 'تعذر توليد بيانات PDF من المستند المطبوع (ملف فارغ)' };
      }

      await fs.promises.writeFile(filePath, pdfBuffer);
      return { success: true, filePath };
    } catch (err) {
      console.error('Failed to generate or save PDF:', err);
      return { success: false, error: err.message || 'حدث خطأ أثناء تصدير وحفظ ملف PDF' };
    } finally {
      if (tempWin && !tempWin.isDestroyed()) {
        const tempFile = tempWin._tempHtmlFile;
        tempWin.destroy();
        if (tempFile) {
          fs.promises.unlink(tempFile).catch(() => {});
        }
      }
    }
  });

  createWindow();

  let isQuitting = false;

  app.on('before-quit', () => {
    isQuitting = true;
  });

  mainWindow.on('close', async (e) => {
    if (isQuitting) return;

    e.preventDefault();
    try {
      // Trigger backup on exit
      console.log('Starting automated backup before exit...');
      await db.createBackup();
      console.log('Automated backup completed.');
    } catch (err) {
      console.error('Automated backup failed on exit:', err);
    } finally {
      isQuitting = true;
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
