import React, { useState, useRef } from 'react';
import { db } from '../../services/storage';
import {
  Database,
  Download,
  Upload,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
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

  return (
    <div className="flex flex-col gap-6 pb-16">
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



    </div>
  );
};
