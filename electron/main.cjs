// Electron main process for Windows Desktop Standalone App
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const db = require('./database.cjs');

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

app.whenReady().then(async () => {
  await handleInitDb();

  ipcMain.handle('db:init', handleInitDb);
  ipcMain.handle('db:loadAll', () => db.loadAll());
  ipcMain.handle('db:saveSettings', (event, key, value) => db.saveSettings(key, value));
  ipcMain.handle('db:upsertUser', (event, user) => db.upsertUser(user));
  ipcMain.handle('db:upsertYear', (event, year) => db.upsertYear(year));
  ipcMain.handle('db:upsertClass', (event, cls) => db.upsertClass(cls));
  ipcMain.handle('db:upsertSection', (event, sec) => db.upsertSection(sec));
  ipcMain.handle('db:upsertSubject', (event, sub) => db.upsertSubject(sub));
  ipcMain.handle('db:upsertStudent', (event, stu) => db.upsertStudent(stu));
  ipcMain.handle('db:upsertGrade', (event, grade) => db.upsertGrade(grade));
  ipcMain.handle('db:saveExemptionSettings', (event, settings) => db.saveExemptionSettings(settings));
  ipcMain.handle('db:saveDecisionSettings', (event, settings) => db.saveDecisionSettings(settings));
  ipcMain.handle('db:upsertDecisionGrant', (event, grant) => db.upsertDecisionGrant(grant));
  ipcMain.handle('db:saveCertificateTemplate', (event, config) => db.saveCertificateTemplate(config));
  ipcMain.handle('db:upsertPromotionLog', (event, log) => db.upsertPromotionLog(log));
  ipcMain.handle('db:deleteEntity', (event, table, id) => db.deleteEntity(table, id));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
