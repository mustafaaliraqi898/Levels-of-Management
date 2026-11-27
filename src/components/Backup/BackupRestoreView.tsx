import React, { useState, useEffect } from 'react';
import { db, DatabaseState } from '../../services/storage';
import {
  Database,
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

  useEffect(() => {
    const unsub = db.subscribe(() => setDbState(db.getState()));
    return () => { unsub(); };
  }, []);

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
      <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs flex items-center justify-between app-card-surface">
        <div>
          <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2.5">
            <span className="p-2 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/20 dark:border-[#2785F5]/30">
              <Database className="w-5 h-5" />
            </span>
            <span>النسخ الاحتياطي واستعادة قاعدة البيانات</span>
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1.5">
            إدارة النسخ الاحتياطية المحلية واستعادة قاعدة البيانات.
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
        <div className="border-[#BFD5FF] dark:border-[#365681] bg-gradient-to-br from-[#F1F6FF] via-white to-[#E5EFFF] dark:from-[#1B2D46] dark:via-[#1C2939] dark:to-[#203657] p-6 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden app-card-surface">
          <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#3976DB]/[0.07] dark:bg-[#60A5FA]/[0.08]" />
          {!isElectron && (
            <div className="mb-4 relative z-10 inline-block">
              <div className="bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3 h-3" />
                <span>ميزة حصرية لنسخة الكمبيوتر</span>
              </div>
            </div>
          )}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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

        <div className="border-[#BFE8D7] dark:border-[#326B58] bg-gradient-to-br from-[#EDFBF5] via-white to-[#E1F7EC] dark:from-[#193B34] dark:via-[#1C2939] dark:to-[#1B4038] p-6 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden app-card-surface">
          <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#15966B]/[0.07] dark:bg-[#54D6A6]/[0.08]" />
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

      {/* Restore database */}
      <div className="border-[#F4D9AD] dark:border-[#76552D] bg-gradient-to-br from-[#FFF8EC] via-white to-[#FFF0D8] dark:from-[#3A2D1B] dark:via-[#1C2939] dark:to-[#332817] p-6 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5 app-card-surface">
        <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#D69B42]/[0.07] dark:bg-[#E8B968]/[0.08]" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-[12px] bg-[#D69B42]/12 dark:bg-[#D69B42]/15 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] flex items-center justify-center shrink-0">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#1E293B] dark:text-[#E2E8F0]">استعادة نسخة احتياطية</h3>
            <p className="text-sm text-[#64748B] dark:text-[#8493A8] mt-1 leading-relaxed">
              استعادة قاعدة البيانات من ملف SQLite محفوظ مسبقاً بصيغة .db
            </p>
            <p className="text-xs text-[#B45309] dark:text-[#D69B42] mt-2">
              سيتم استبدال البيانات الحالية بالبيانات الموجودة في النسخة المختارة.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRestoreDB}
          disabled={!isElectron}
          className={`relative z-10 h-11 px-6 rounded-[8px] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
            !isElectron
              ? 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#8493A8] border border-[#DCE3ED] dark:border-[#2D3B4D] cursor-not-allowed opacity-70'
              : 'bg-[#D69B42] hover:bg-[#B45309] text-white active:scale-95 cursor-pointer'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>اختيار نسخة للاستعادة</span>
        </button>
      </div>
    </div>
  );
};
