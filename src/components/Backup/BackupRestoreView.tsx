import React, { useState, useRef } from 'react';
import { db } from '../../services/storage';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  HardDrive,
  Copy,
  Terminal,
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const handleDownloadSQL = () => {
    const sqlStr = db.exportSQLiteScript();
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
  };

  // 3. Restore from JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      const res = db.importJSON(content);
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' });
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. Reset to Default Sample
  const handleReset = () => {
    if (window.confirm('تحذير: هل أنت متأكد من رغبتك في إعادة تعيين قاعدة البيانات للبيانات الافتراضية؟ سيتم مسح أي تعديلات غير محفوظة خارج النسخة الاحتياطية.')) {
      db.resetToDefault();
      setStatusMessage({ text: 'تمت إعادة تعيين قاعدة البيانات إلى الحالة الافتراضية.', type: 'success' });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-400" />
            النسخ الاحتياطي واستعادة قاعدة البيانات
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة الحفظ المحلي الآمن، تصدير سكربت SQLite، وتغليف التطبيق ليعمل كبرنامج Windows مستقل
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

      {/* 3 Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* JSON Backup */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">تصدير نسخة احتياطية (JSON)</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              تنزيل ملف كامل يحتوي على جميع الأعوام الدراسية والصفوف والشعب والطلاب والدرجات المدخلة بنقرة واحدة.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadJSON}
            className="mt-6 w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل النسخة الاحتياطية</span>
          </button>
        </div>

        {/* Restore Backup */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">استعادة نسخة سابقة (JSON)</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              استيراد وتحديث قاعدة البيانات المدرسية من ملف نسخة احتياطية محفوظ مسبقاً على جهازك.
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
              className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>اختيار ملف والاستعادة</span>
            </button>
          </div>
        </div>

        {/* SQLite Database Export */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">سكربت SQLite SQL المكتبي</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              تصدير ملف SQL قياسي متوافق 100% مع SQLite3، ينشئ جميع الجداول والمفاتيح والعلاقات والدرجات.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSQL}
            className="mt-6 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <FileCode className="w-4 h-4" />
            <span>تصدير ملف SQLite (.sql)</span>
          </button>
        </div>
      </div>

      {/* Windows Standalone EXE Guide (Desktop packaging) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <Monitor className="w-6 h-6 text-teal-400" />
          <div>
            <h3 className="text-base font-bold text-white">
              تشغيل وتثبيت التطبيق على Windows كبرنامج مكتبي مستقل (.EXE)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              التطبيق مُجهّز بملفات Electron ومسارات سطح المكتب لإنشاء ملف تثبيت Windows EXE بدون إنترنت
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-3">
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            لإنشاء ملف التثبيت المكتبي <strong>Setup.exe</strong> واختصار سطح المكتب على نظام Windows، تم تضمين ملفات الإعداد في مجلد <code className="text-emerald-400 font-mono">/electron/main.cjs</code>. يمكنك تشغيل الأوامر التالية في سطر الأوامر (CMD/PowerShell) لبناء التطبيق:
          </p>

          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 flex items-center justify-between overflow-x-auto">
            <span>npm install --save-dev electron electron-builder && npx electron-builder --win</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('npm install --save-dev electron electron-builder && npx electron-builder --win');
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer mr-2 shrink-0"
              title="نسخ الأمر"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copiedSql && <p className="text-[11px] text-emerald-400 mt-1">تم نسخ أمر البناء إلى الحافظة!</p>}

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
            <div className="bg-slate-900/40 p-2.5 rounded border border-slate-800/80">
              <span className="text-white font-bold block mb-1">1. تثبيت EXE مباشر</span>
              ينشئ ملف تثبيت Windows قياسي يضيف البرنامج لقائمة ابدأ.
            </div>
            <div className="bg-slate-900/40 p-2.5 rounded border border-slate-800/80">
              <span className="text-white font-bold block mb-1">2. اختصار سطح المكتب</span>
              يُنشئ أيقونة تشغيل مباشرة بنقرة مزدوجة على Desktop.
            </div>
            <div className="bg-slate-900/40 p-2.5 rounded border border-slate-800/80">
              <span className="text-white font-bold block mb-1">3. قاعدة بيانات محلية</span>
              البيانات تُحفظ في ملف محلي مشفر ومحمي من الفقدان تماماً.
            </div>
          </div>
        </div>
      </div>

      {/* Safe Seed Data Completion */}
      <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-teal-300 flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-400" />
            استكمال بيانات الاختبار التجريبية بأمان (دون حذف أي بيانات)
          </h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            يفحص جميع الصفوف والمواد والطلاب ويضيف أية سجلات درجات ناقصة لإجراء اختبارات الإعفاء والنتائج بدقة، مع حماية تامة لبياناتك وعدم تكرار السجلات.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const res = db.completeSeedData();
            if (res.newGradesCount > 0 || res.newStudentsCount > 0 || res.newSubjectsCount > 0) {
              setStatusMessage({
                text: `تم استكمال البيانات التجريبية بنجاح: إضافة ${res.newGradesCount} سجل درجات جديد، و ${res.newStudentsCount} طالب، و ${res.newSubjectsCount} مواد.`,
                type: 'success',
              });
            } else {
              setStatusMessage({
                text: 'جميع البيانات التجريبية مكتملة مسبقاً بنسبة 100% دون أي نواقص أو تكرار.',
                type: 'success',
              });
            }
          }}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 shadow-md shadow-teal-500/20"
        >
          <Database className="w-4 h-4" />
          <span>استكمال بيانات الاختبار</span>
        </button>
      </div>

      {/* Danger Zone: Reset Database */}
      <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-red-400">إعادة تعيين قاعدة البيانات للبيانات الافتراضية</h4>
          <p className="text-xs text-red-300/80 mt-1">
            سيتم استعادة البيانات النموذجية الأولية لمدرسة المتميزين وحذف أية بيانات إضافية تم إدخالها.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 rounded-xl bg-red-900/80 hover:bg-red-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة تعيين قاعدة البيانات</span>
        </button>
      </div>
    </div>
  );
};
