import React, { useState, useEffect } from 'react';
import { AcademicYear, AcademicYearDecisionSettings } from '../../types';
import { db } from '../../services/storage';
import { Award, CheckCircle2, AlertCircle, Info, Calendar } from 'lucide-react';

interface AdminDecisionSettingsSectionProps {
  currentAcademicYearId?: string;
}

export const AdminDecisionSettingsSection: React.FC<AdminDecisionSettingsSectionProps> = ({
  currentAcademicYearId,
}) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [decisionSettings, setDecisionSettings] = useState<AcademicYearDecisionSettings | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = () => {
    const state = db.getState();
    setAcademicYears(state.academicYears);
    const initialYearId =
      selectedYearId ||
      currentAcademicYearId ||
      state.academicYears.find((y) => y.isCurrent)?.id ||
      state.academicYears[0]?.id ||
      '';
    setSelectedYearId(initialYearId);
    if (initialYearId) {
      setDecisionSettings(db.getDecisionSettings(initialYearId));
    }
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      const state = db.getState();
      setAcademicYears(state.academicYears);
    });
    return () => { unsub(); };
  }, []);

  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    setDecisionSettings(db.getDecisionSettings(yearId));
    setSaveSuccess(null);
    setErrorMessage(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId || !decisionSettings) return;

    if (decisionSettings.maxFailedSubjectsAllowed < 1) {
      setErrorMessage('حد دروس الرسوب يجب أن يكون 1 على الأقل.');
      return;
    }
    if (decisionSettings.primaryAssistanceMarks < 0) {
      setErrorMessage('درجات المساعدة الوزارية الرئيسية لا يمكن أن تكون سالبة.');
      return;
    }
    if (decisionSettings.secondRoundAdditionalAssistanceMarks < 0) {
      setErrorMessage('درجات المساعدة الإضافية للدور الثاني لا يمكن أن تكون سالبة.');
      return;
    }

    setErrorMessage(null);
    db.saveDecisionSettings({
      ...decisionSettings,
      academicYearId: selectedYearId,
    });

    const yearObj = academicYears.find((y) => y.id === selectedYearId);
    setSaveSuccess(`تم حفظ إعدادات القرار الوزاري للعام الدراسي «${yearObj?.name || ''}» بنجاح.`);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  if (!decisionSettings || academicYears.length === 0) {
    return null;
  }

  const selectedYear = academicYears.find((y) => y.id === selectedYearId);

  return (
    <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              إعدادات الإدارة — المساعدة الوزارية وضوابط الرسوب والإكمال
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-0.5">
              تحديد حد الرسوب ودرجات المساعدة المعتمدة لكل عام دراسي بشكل مستقل لحماية السجلات التاريخية
            </p>
          </div>
        </div>

        {/* Academic Year Selector */}
        <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#26364B] px-3 py-1.5 rounded-[8px] border border-[#DCE3ED] dark:border-[#2D3B4D] shrink-0">
          <Calendar className="w-4 h-4 text-[#64748B] dark:text-[#8493A8]" />
          <span className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7]">العام الدراسي:</span>
          <select
            value={selectedYearId}
            onChange={(e) => handleYearChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-[#3156C9] dark:text-[#60A5FA] focus:outline-hidden cursor-pointer"
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id} className="bg-white dark:bg-[#1C2939] text-[#1E293B] dark:text-[#E2E8F0]">
                {year.name} {year.isCurrent ? '(الحالي)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {saveSuccess && (
        <div className="mb-5 p-3 rounded-[10px] bg-[#10B981]/12 dark:bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-5 p-3 rounded-[10px] bg-[#E35D6A]/10 dark:bg-[#E35D6A]/15 border border-[#E35D6A]/30 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Max Failed Subjects */}
          <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-[12px] border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] mb-1">
                عدد دروس الرسوب المسموح بها (حد الرسوب)
              </label>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mb-3 leading-relaxed">
                إذا رسب الطالب في عدد مواد يساوي هذه القيمة أو يتجاوزها تكون حالته <strong>راسباً</strong>. وإذا رسب في أقل منها (1 إلى {decisionSettings.maxFailedSubjectsAllowed - 1}) يكون <strong>مكمّلاً</strong>، وإذا 0 يكون <strong>ناجحاً</strong>.
              </p>
            </div>
            <div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={decisionSettings.maxFailedSubjectsAllowed}
                  onChange={(e) =>
                    setDecisionSettings({
                      ...decisionSettings,
                      maxFailedSubjectsAllowed: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full h-11 px-3 text-sm font-bold font-mono tabular-nums bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#1E293B] dark:text-[#E2E8F0] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
                <span className="absolute left-3 top-3 text-xs text-[#64748B] dark:text-[#8493A8] pointer-events-none">
                  مواد / دروس
                </span>
              </div>
              <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] block mt-1.5">
                القيمة الافتراضية المعتمدة: 4 مواد
              </span>
            </div>
          </div>

          {/* 2. Primary Ministerial Assistance */}
          <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-[12px] border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] mb-1">
                درجات المساعدة الوزارية الرئيسية (الدور الأول)
              </label>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mb-3 leading-relaxed">
                رصيد درجات المساعدة المتاح للعام الدراسي. تُمنح فقط للمواد الراسبة (&lt; 50) بشرط إيصال الدرجة إلى 50 تماماً، مع أولوية المادة الأقل عجزاً.
              </p>
            </div>
            <div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={decisionSettings.primaryAssistanceMarks}
                  onChange={(e) =>
                    setDecisionSettings({
                      ...decisionSettings,
                      primaryAssistanceMarks: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full h-11 px-3 text-sm font-bold font-mono tabular-nums bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#3156C9] dark:text-[#60A5FA] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
                <span className="absolute left-3 top-3 text-xs text-[#64748B] dark:text-[#8493A8] pointer-events-none">
                  درجات
                </span>
              </div>
              <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] block mt-1.5">
                القيمة الافتراضية الوزارية: 10 درجات
              </span>
            </div>
          </div>

          {/* 3. Additional Ministerial Assistance After 2nd Round */}
          <div className="bg-[#F8FAFC] dark:bg-[#202E40] p-4 rounded-[12px] border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0] mb-1">
                درجات المساعدة الإضافية بعد الدور الثاني
              </label>
              <p className="text-[11px] text-[#64748B] dark:text-[#8493A8] mb-3 leading-relaxed">
                حقل اختياري يضاف إلى رصيد المتبقي من المساعدة الرئيسية، ويُطبق فقط على طلاب الإكمال الذين خاضوا الدور الثاني ولم ينجحوا في جميع المواد.
              </p>
            </div>
            <div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={decisionSettings.secondRoundAdditionalAssistanceMarks}
                  onChange={(e) =>
                    setDecisionSettings({
                      ...decisionSettings,
                      secondRoundAdditionalAssistanceMarks: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full h-11 px-3 text-sm font-bold font-mono tabular-nums bg-white dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[8px] text-[#3156C9] dark:text-[#60A5FA] focus:border-[#2785F5] focus:outline-hidden"
                  required
                />
                <span className="absolute left-3 top-3 text-xs text-[#64748B] dark:text-[#8493A8] pointer-events-none">
                  درجات إضافية
                </span>
              </div>
              <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] block mt-1.5">
                القيمة الافتراضية: 0 (تُعدل عند صدور كتاب وزاري)
              </span>
            </div>
          </div>
        </div>

        {/* Informative Guidance Callout */}
        <div className="p-4 rounded-[12px] bg-[#3156C9]/8 dark:bg-[#2785F5]/10 border border-[#3156C9]/25 dark:border-[#2785F5]/25 text-xs text-[#475569] dark:text-[#A8B5C7] flex items-start gap-3">
          <Info className="w-5 h-5 text-[#3156C9] dark:text-[#60A5FA] shrink-0 mt-0.5" />
          <div className="space-y-1.5 leading-relaxed">
            <div className="font-bold text-[#1E293B] dark:text-[#E2E8F0]">
              قواعد الاحتساب الآلي المعتمدة لعام {selectedYear?.name}:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[#475569] dark:text-[#A8B5C7] text-[11px]">
              <li>
                <strong className="text-[#1E293B] dark:text-[#E2E8F0]">الدور الأول:</strong> تُوزع درجات المساعدة على المواد الراسبة التي تحتاج إلى عجز أقل للوصول إلى 50 درجة. إذا كان الرصيد المتبقي أقل من العجز المطلوب لأي مادة، لا تُمنح المادة أي درجة وتبقى راسبة.
              </li>
              <li>
                <strong className="text-[#1E293B] dark:text-[#E2E8F0]">تحديد الإكمال والرسوب:</strong> إذا بقي الطالب راسباً في عدد مواد &lt; {decisionSettings.maxFailedSubjectsAllowed}، يعد «مكمّلاً» ويحق له أداء الدور الثاني في تلك المواد فقط. إذا رسب في {decisionSettings.maxFailedSubjectsAllowed} مواد أو أكثر، يُعد «راسباً» في صفه.
              </li>
              <li>
                <strong className="text-[#1E293B] dark:text-[#E2E8F0]">الدور الثاني والإكمال:</strong> تُحسب الدرجة النهائية بعد الإكمال = (السعي السنوي + درجة الإكمال) ÷ 2. وإذا كان الرصيد المتاح (المتبقي + الإضافي) يكفي لإيصال الطالب إلى 50 يُمنح درجات النجاح، وإلا تظل درجته دون زيادة.
              </li>
              <li>
                <strong className="text-[#1E293B] dark:text-[#E2E8F0]">الإعفاء العام والفردي:</strong> طالب الإعفاء العام يُعتبر ناجحاً في جميع المواد بدرجة سعيه السنوي، وتظهر ملاحظته «ناجح — إعفاء عام». وفي الإعفاء الفردي، تُعتمد درجة السعي للمادة المعفى منها.
              </li>
            </ul>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-[8px] bg-[#3156C9] hover:bg-[#2749B0] dark:hover:bg-[#3979E6] text-white font-black text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all"
          >
            <span>حفظ إعدادات القرار لعام {selectedYear?.name}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
