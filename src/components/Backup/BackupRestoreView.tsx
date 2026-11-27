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
        setStatusMessage({ text: res.message || 'تمت استعادة قاعدة البيانات بنجاح.', type: 'success' });
      } else {
        const errorMsg = res.message || res.error || 'حدث خطأ أثناء استعادة قاعدة البيانات';
        if (errorMsg !== 'تم إلغاء العملية' && !errorMsg.includes('تم إلغاء')) {
          setStatusMessage({ text: errorMsg, type: 'error' });
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
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2.5">
            <span className="p-2 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/20 dark:border-[#2785F5]/30">
              <Database className="w-5 h-5" />
            </span>
            <span>النسخ الاحتياطي واستعادة قاعدة البيانات</span>
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1.5">
            إدارة الحفظ المحلي الآمن وتصدير سكربت SQLite.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-[12px] border flex items-center gap-3 text-sm font-bold animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-[#10B981]/12 dark:bg-[#10B981]/15 border-[#10B981]/30 text-[#059669] dark:text-[#10B981]'
              : 'bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Automated Backup Status & Location Settings */}
      <div className="flex flex-col gap-5">
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-6 rounded-[14px] shadow-xs relative overflow-hidden">
          {!isElectron && (
            <div className="mb-3 md:mb-0 md:absolute md:top-3 md:left-4 z-10 inline-block">
              <div className="bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3 h-3" />
                <span>ميزة حصرية لنسخة الكمبيوتر</span>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E293B] dark:text-[#E2E8F0] text-lg">النسخ الاحتياطي التلقائي (SQLite)</h3>
                <p className="text-sm text-[#64748B] dark:text-[#8493A8]">يتم حفظ نسخة احتياطية تلقائياً عند كل إغلاق للبرنامج.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3 rounded-[10px] min-w-[140px]">
                <div className="flex items-center gap-2 text-[#64748B] dark:text-[#8493A8] text-xs mb-1">
                  <History className="w-3 h-3" />
                  آخر نسخة تلقائية:
                </div>
                <div className="text-[#059669] dark:text-[#10B981] font-mono tabular-nums text-sm font-bold">
                  {dbState.lastAutoBackupDate 
                    ? new Date(dbState.lastAutoBackupDate).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'لا يوجد بعد'}
                </div>
              </div>

              <div className="bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] p-3 rounded-[10px] min-w-[140px]">
                <div className="flex items-center gap-2 text-[#64748B] dark:text-[#8493A8] text-xs mb-1">
                  <ShieldCheck className="w-3 h-3" />
                  النسخ المحفوظة:
                </div>
                <div className="text-[#3156C9] dark:text-[#60A5FA] font-mono tabular-nums text-sm font-bold">
                  {dbState.backupsCount || 0} / 30
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualBackup}
                disabled={isBackingUp || !isElectron}
                className={`h-11 px-5 rounded-[8px] font-bold text-xs flex items-center gap-2 transition-all shadow-xs ${
                  isBackingUp || !isElectron
                    ? 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border border-[#DCE3ED] dark:border-[#2D3B4D] cursor-not-allowed opacity-70'
                    : 'bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white active:scale-95 cursor-pointer'
                }`}
              >
                {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>نسخ احتياطي الآن</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-6 rounded-[14px] shadow-xs relative overflow-hidden">
          {!isElectron && (
            <div className="mb-3 md:mb-0 md:absolute md:top-3 md:left-4 z-10 inline-block">
              <div className="bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <Folder className="w-3 h-3" />
                <span>متاح فقط في نسخة ويندوز</span>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                <Folder className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#1E293B] dark:text-[#E2E8F0] text-lg">موقع حفظ النسخ الاحتياطية</h3>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-[#64748B] dark:text-[#8493A8]">حدد المجلد الذي سيتم تخزين ملفات النسخ الاحتياطي التلقائي فيه.</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] bg-[#EDF1F7] dark:bg-[#26364B] px-2 py-1 rounded-[6px]">المسار الحالي:</span>
                    <code className="text-[10px] md:text-xs font-mono text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/8 dark:bg-[#2785F5]/12 border border-[#3156C9]/25 dark:border-[#2785F5]/25 px-2.5 py-1 rounded-[6px] break-all" dir="ltr">
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
                  className="h-11 px-5 rounded-[8px] border border-[#DCE3ED] dark:border-[#2D3B4D] bg-[#EDF1F7] dark:bg-[#26364B] hover:bg-[#DCE3ED]/70 dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  العودة للافتراضي
                </button>
              )}
              <button
                type="button"
                onClick={handleSetBackupPath}
                disabled={!isElectron}
                className={`h-11 px-5 rounded-[8px] font-bold text-xs flex items-center gap-2 transition-all shadow-xs ${
                  !isElectron
                    ? 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border border-[#DCE3ED] dark:border-[#2D3B4D] cursor-not-allowed opacity-70'
                    : 'bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white active:scale-95 cursor-pointer'
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
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-6 rounded-[14px] shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0]">تصدير (JSON)</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">
              تنزيل ملف كامل يحتوي على جميع البيانات المدرسية والدرجات بنقرة واحدة.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadJSON}
            className="mt-6 w-full h-10 rounded-[8px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل JSON</span>
          </button>
        </div>

        {/* JSON Import */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-6 rounded-[14px] shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-[10px] bg-[#2785F5]/10 dark:bg-[#2785F5]/15 border border-[#2785F5]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0]">استعادة (JSON)</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">
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
              className="w-full h-10 rounded-[8px] bg-[#EDF1F7] hover:bg-[#DCE3ED]/70 dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] border border-[#DCE3ED] dark:border-[#2D3B4D] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>استيراد JSON</span>
            </button>
          </div>
        </div>

        {/* SQL Export */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-6 rounded-[14px] shadow-xs flex flex-col justify-between relative overflow-hidden">
          {!isElectron && (
            <div className="absolute inset-0 bg-[#F4F6FA]/70 dark:bg-[#111C2A]/75 backdrop-blur-[1px] flex items-center justify-center z-20">
               <span className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] px-3 py-1 rounded-[8px] text-[10px] font-bold text-[#475569] dark:text-[#A8B5C7] shadow-xs">حصري للكمبيوتر</span>
            </div>
          )}
          <div>
            <div className="w-10 h-10 rounded-[10px] bg-[#10B981]/10 dark:bg-[#10B981]/15 border border-[#10B981]/25 dark:border-[#10B981]/30 text-[#059669] dark:text-[#10B981] flex items-center justify-center mb-3">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0]">تصدير (SQL)</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">
              تصدير ملف SQL قياسي متوافق مع SQLite3 لإنشاء الجداول والبيانات.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSQL}
            disabled={!isElectron}
            className="mt-6 w-full h-10 rounded-[8px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <FileCode className="w-4 h-4" />
            <span>تصدير SQL</span>
          </button>
        </div>

        {/* DB Restore */}
        <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-6 rounded-[14px] shadow-xs flex flex-col justify-between relative overflow-hidden">
          {!isElectron && (
            <div className="absolute inset-0 bg-[#F4F6FA]/70 dark:bg-[#111C2A]/75 backdrop-blur-[1px] flex items-center justify-center z-20">
               <span className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] px-3 py-1 rounded-[8px] text-[10px] font-bold text-[#475569] dark:text-[#A8B5C7] shadow-xs">حصري للكمبيوتر</span>
            </div>
          )}
          <div>
            <div className="w-10 h-10 rounded-[10px] bg-[#D69B42]/12 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1E293B] dark:text-[#E2E8F0]">استعادة (.db)</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">
              استبدال قاعدة البيانات الحالية بملف SQLite .db محفوظ مسبقاً.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRestoreDB}
            disabled={!isElectron}
            className="mt-6 w-full h-10 rounded-[8px] bg-[#D69B42] hover:bg-[#B45309] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>استعادة ملف .db</span>
          </button>
        </div>
      </div>
    </div>
  );
};
