const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const db = require('./database.cjs');
const smtpService = require('./smtp-service.cjs');
const resetService = require('./reset-service.cjs');
const fs = require('fs');
const sessionManager = require('./session-manager.cjs');

const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

let mainWindow = null;

const windowDom = new JSDOM('');
const DOMPurify = createDOMPurify(windowDom.window);

// Domain-specific DOMPurify configuration for school reports
const printPurifyConfig = {
  ALLOWED_TAGS: [
    'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'small',
    'img', 'style', 'link', 'canvas'
  ],
  ALLOWED_ATTR: [
    'style', 'class', 'id', 'dir', 'lang', 'width', 'height', 'src', 'alt', 'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan', 'rel', 'href', 'type'
  ],
  FORBID_TAGS: ['form', 'iframe', 'object', 'embed', 'script', 'applet', 'base'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  FORCE_BODY: true
};

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

  // Security: Prevent unauthorized navigation and handle external links
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      if (process.env.NODE_ENV === 'development') {
        if (parsed.protocol === 'http:' && parsed.hostname === 'localhost' && parsed.port === '3000') return;
      } else {
        if (parsed.protocol === 'file:') return;
      }
    } catch {}
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl.startsWith('http://') || openUrl.startsWith('https://')) {
      shell.openExternal(openUrl);
    }
    return { action: 'deny' };
  });

  // Remove standard English menu for a clean custom dark native feel
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    if (mainWindow && mainWindow.webContents) {
      sessionManager.handleWindowClosed(mainWindow.webContents.id);
    }
    mainWindow = null;
  });
}

// Session and Authorization logic moved to session-manager.cjs
const { validateSender, requireAuth, requireAdminRole } = sessionManager;

app.whenReady().then(async () => {
  await handleInitDb();

  const { registerIpcHandlers } = require('./ipc-handlers.cjs');
  registerIpcHandlers(ipcMain, { 
    app, mainWindow, db, smtpService, resetService, 
    sessionManager, validateSender, requireAuth, 
    requireAdminRole, handleInitDb 
  });


  // Print & PDF Export Services
  ipcMain.handle('print:getPrinters', async (event) => {
    requireAuth(event);
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
    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('محتوى المستند المراد طباعته غير متاح.');
    }

    if (htmlContent.length > 15 * 1024 * 1024) {
      throw new Error('حجم مستند الطباعة كبير جداً ويشكل خطراً على ذاكرة التطبيق.');
    }

    // Robust HTML sanitization using DOMPurify
    const sanitizedHtml = DOMPurify.sanitize(htmlContent, printPurifyConfig);

    const printWin = new BrowserWindow({
      show: false,
      width: landscape ? 1400 : 1000,
      height: landscape ? 1000 : 1400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    // Prevent navigation and opening popups in print window
    printWin.webContents.on('will-navigate', (e) => e.preventDefault());
    printWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    let tempHtmlFile = null;
    try {
      const tempDir = app.getPath('temp');
      const uniqueSuffix = crypto.randomBytes(16).toString('hex');
      tempHtmlFile = path.join(
        tempDir,
        `print_doc_${Date.now()}_${uniqueSuffix}.html`
      );
      await fs.promises.writeFile(tempHtmlFile, sanitizedHtml, 'utf8');

      const fileUrl = url.pathToFileURL(tempHtmlFile).href;
      await printWin.loadURL(fileUrl);
    } catch (loadErr) {
      console.error('Failed to write or load isolated HTML in print window:', loadErr);
      if (tempHtmlFile) {
        fs.promises.unlink(tempHtmlFile).catch(() => {});
      }
      if (!printWin.isDestroyed()) printWin.destroy();
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
    requireAuth(event);
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
    requireAuth(event);
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
