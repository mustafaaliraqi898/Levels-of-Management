const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  auth: {
    setSession: (session) => ipcRenderer.invoke('auth:setSession', session),
    clearSession: () => ipcRenderer.invoke('auth:clearSession'),
    requestPasswordResetCode: (username) => ipcRenderer.invoke('auth:requestPasswordResetCode', username),
    verifyResetCodeAndChangePassword: (username, code, newPassword) => ipcRenderer.invoke('auth:verifyResetCodeAndChangePassword', username, code, newPassword),
  },
  smtp: {
    getSmtpStatus: () => ipcRenderer.invoke('smtp:getSmtpStatus'),
    saveConfig: (config) => ipcRenderer.invoke('smtp:saveConfig', config),
    testConnection: (config) => ipcRenderer.invoke('smtp:testConnection', config),
  },
  db: {
    init: () => ipcRenderer.invoke('db:init'),
    loadAll: () => ipcRenderer.invoke('db:loadAll'),
    saveSettings: (key, value) => ipcRenderer.invoke('db:saveSettings', key, value),
    upsertUser: (user) => ipcRenderer.invoke('db:upsertUser', user),
    upsertYear: (year) => ipcRenderer.invoke('db:upsertYear', year),
    upsertClass: (cls) => ipcRenderer.invoke('db:upsertClass', cls),
    upsertSection: (sec) => ipcRenderer.invoke('db:upsertSection', sec),
    upsertSubject: (sub) => ipcRenderer.invoke('db:upsertSubject', sub),
    upsertStudent: (stu) => ipcRenderer.invoke('db:upsertStudent', stu),
    upsertGrade: (grade) => ipcRenderer.invoke('db:upsertGrade', grade),
    saveExemptionSettings: (settings) => ipcRenderer.invoke('db:saveExemptionSettings', settings),
    saveDecisionSettings: (settings) => ipcRenderer.invoke('db:saveDecisionSettings', settings),
    upsertDecisionGrant: (grant) => ipcRenderer.invoke('db:upsertDecisionGrant', grant),
    saveCertificateTemplate: (config, imageData) => ipcRenderer.invoke('db:saveCertificateTemplate', config, imageData),
    upsertPromotionLog: (log) => ipcRenderer.invoke('db:upsertPromotionLog', log),
    executeStudentPromotionBatch: (students, promotionLog) => ipcRenderer.invoke('db:executeStudentPromotionBatch', students, promotionLog),
    deleteEntity: (table, id) => ipcRenderer.invoke('db:deleteEntity', table, id),
    deleteStudentCascade: (studentId) => ipcRenderer.invoke('db:deleteStudentCascade', studentId),
    deleteClassCascade: (classId) => ipcRenderer.invoke('db:deleteClassCascade', classId),
    createBackup: () => ipcRenderer.invoke('db:createBackup'),
    getBackupsInfo: () => ipcRenderer.invoke('db:getBackupsInfo'),
    exportSql: () => ipcRenderer.invoke('db:exportSql'),
    restoreDb: (path) => ipcRenderer.invoke('db:restoreDb', path),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  }
});
