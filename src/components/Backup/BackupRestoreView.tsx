import React, { useState, useRef, useEffect } from 'react';
import { db, DatabaseState } from '../../services/storage';
import {
  Database,
  Download,
  Upload,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  History,
  RefreshCw,
  Folder,
  Settings as SettingsIcon,
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const [dbState, setDbState] = useState<DatabaseState>(() => db.getState());
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setDbState(db.getState()));
    return () => { unsub(); };
  }, []);

  // 1. Download JSON Backup
  const handleDownloadJSON = () => {
    const jsonStr = db.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date().toISOString().slice(0, 10);
    link.download = `نسخة_احتياطية_درجات_${now}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ text: 'تم تنزيل النسخة الاحتياطية بنجاح.', type: 'success' });
  };

  // 2. Download SQLite .sql Script
  const handleDownloadSQL = async () => {
    try {
      const sqlStr = await db.exportSQLiteScript();
      const blob = new Blob([sqlStr], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date().toISOString().slice(0, 10);
      link.download = `school_grades_sqlite_${now}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMessage({ text: 'تم تصدير سكربت قاعدة بيانات SQLite بنجاح.', type: 'success' });
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: 'حدث خطأ أثناء تصدير ملف SQL.', type: 'error' });
    }
  };
 
  // 3. Restore from JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
 
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      const res = await db.importJSON(content);
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' });
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. Restore from .db file
  const handleRestoreDB = async () => {
    if (!window.confirm('تحذير: استعادة ملف قاعدة البيانات سيؤدي لاستبدال كافة البيانات الحالية. هل تريد الاستمرار؟')) return;
    
    try {
      const res = await db.restoreDbFromFile();
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' });
      } else {
        if (res.message !== 'تم إلغاء العملية') {
          setStatusMessage({ text: res.message, type: 'error' });
        }
      }
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: 'حدث خطأ أثناء استعادة قاعدة البيانات.', type: 'error' });
    }
  };
 
  // 5. Create Manual SQLite Backup
  const handleManualBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const res = await db.createManualBackup();
      if (res.success) {
        setStatusMessage({ text: 'تم إنشاء نسخة احتياطية محلية ناجحة لقاعدة البيانات.', type: 'success' });
      } else {
        setStatusMessage({ text: 'فشل إنشاء النسخة الاحتياطية المحلية.', type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: 'حدث خطأ أثناء الاتصال بالنظام للنسخ الاحتياطي.', type: 'error' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSetBackupPath = async () => {
    if (!window.electronAPI) return;
    try {
      const path = await window.electronAPI.dialog.openDirectory();
      if (path) {
        db.updateSettings({ backupPath: path });
        setStatusMessage({ text: 'تم تحديث موقع حفظ النسخ الاحتياطية بنجاح.', type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: 'حدث خطأ أثناء اختيار المجلد.', type: 'error' });
    }
  };

  const handleResetBackupPath = () => {
    db.updateSettings({ backupPath: undefined });
    setStatusMessage({ text: 'تمت العودة إلى موقع الحفظ الافتراضي.', type: 'success' });
  };

  const isElectron = !!(window as any).electronAPI;

  return (
    <div className="flex flex-col gap-6 pb-16 text-right" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-400" />
            النسخ الاحتياطي واستعادة قاعدة البيانات
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة الحفظ المحلي الآمن وتصدير سكربت SQLite.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-bold animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-red-950/60 border-red-500/50 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Automated Backup Status & Location Settings */}
      <div className="flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg border-r-4 border-r-emerald-500 relative overflow-hidden">
          {!isElectron && (
            <div className="absolute top-3 left-auto right-3 z-10">
              <div className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm shadow-lg">
                <ShieldCheck className="w-3 h-3" />
                <span>ميزة حصرية لنسخة الكمبيوتر</span>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">النسخ الاحتياطي التلقائي (SQLite)</h3>
                <p className="text-sm text-slate-400">يتم حفظ نسخة احتياطية تلقائياً عند كل إغلاق للبرنامج.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl min-w-[140px]">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <History className="w-3 h-3" />
                  آخر نسخة تلقائية:
                </div>
                <div className="text-emerald-300 font-mono text-sm font-bold">
                  {dbState.lastAutoBackupDate 
                    ? new Date(dbState.lastAutoBackupDate).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'لا يوجد بعد'}
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl min-w-[140px]">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <ShieldCheck className="w-3 h-3" />
                  النسخ المحفوظة:
                </div>
                <div className="text-emerald-300 font-mono text-sm font-bold">
                  {dbState.backupsCount || 0} / 30
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualBackup}
                disabled={isBackingUp || !isElectron}
                className={`h-12 px-6 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
                  isBackingUp || !isElectron
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'
                }`}
              >
                {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>نسخ احتياطي الآن</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg border-r-4 border-r-blue-500 relative overflow-hidden">
          {!isElectron && (
            <div className="absolute top-3 left-auto right-3 z-10">
              <div className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm shadow-lg">
                <Folder className="w-3 h-3" />
                <span>متاح فقط في نسخة ويندوز</span>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Folder className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">موقع حفظ النسخ الاحتياطية</h3>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-slate-400">حدد المجلد الذي سيتم تخزين ملفات النسخ الاحتياطي التلقائي فيه.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-slate-500 bg-slate-950 px-2 py-1 rounded">المسار الحالي:</span>
                    <code className="text-[10px] md:text-xs font-mono text-blue-300 bg-blue-500/5 border border-blue-500/20 px-2 py-1 rounded break-all" dir="ltr">
                      {dbState.settings.backupPath || 'الموقع الافتراضي (AppData/Local/backups)'}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {dbState.settings.backupPath && isElectron && (
                <button
                  type="button"
                  onClick={handleResetBackupPath}
                  className="h-11 px-5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all active:scale-95"
                >
                  العودة للافتراضي
                </button>
              )}
              <button
                type="button"
                onClick={handleSetBackupPath}
                disabled={!isElectron}
                className={`h-11 px-6 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
                  !isElectron
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 active:scale-95'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                <span>تحديد مجلد النسخ الاحتياطي</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* JSON Export */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">تصدير (JSON)</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              تنزيل ملف كامل يحتوي على جميع البيانات المدرسية والدرجات بنقرة واحدة.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadJSON}
            className="mt-6 w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل JSON</span>
          </button>
        </div>

        {/* JSON Import */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">استعادة (JSON)</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              استيراد وتحديث قاعدة البيانات من ملف نسخة احتياطية JSON.
            </p>
          </div>

          <div className="mt-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>استيراد JSON</span>
            </button>
          </div>
        </div>

        {/* SQL Export */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden">
          {!isElectron && (
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-20">
               <span className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-400">حصري للكمبيوتر</span>
            </div>
          )}
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">تصدير (SQL)</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              تصدير ملف SQL قياسي متوافق مع SQLite3 لإنشاء الجداول والبيانات.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSQL}
            disabled={!isElectron}
            className="mt-6 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <FileCode className="w-4 h-4" />
            <span>تصدير SQL</span>
          </button>
        </div>

        {/* DB Restore */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden">
          {!isElectron && (
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-20">
               <span className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-400">حصري للكمبيوتر</span>
            </div>
          )}
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">استعادة (.db)</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              استبدال قاعدة البيانات الحالية بملف SQLite .db محفوظ مسبقاً.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRestoreDB}
            disabled={!isElectron}
            className="mt-6 w-full h-11 rounded-xl bg-[#D99A55] hover:bg-[#D99A55]/90 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-[#D99A55]/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>استعادة ملف .db</span>
          </button>
        </div>
      </div>
    </div>
  );
};
