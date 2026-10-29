import React, { useState, useMemo } from 'react';
import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  GradeStage,
} from '../../types';
import { buildGradeKey, db } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import { evaluateStudentAcademicYearDecisions } from '../../services/calculations';
import { getStudentReportFinalStatus, getSubjectReportDisplay } from '../../utils/exemptionUtils';
import {
  Printer,
  FileText,
  UserCheck,
  Award,
  ChevronDown,
  School,
} from 'lucide-react';
import { SchoolLogo } from '../Common/SchoolLogo';

interface ReportsViewProps {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  grades: Record<string, GradeRecord>;
  settings: AppSettings;
}

type ReportType = 'master_sheet' | 'student_card' | 'honor_roll' | 'missing_audit';

export const ReportsView: React.FC<ReportsViewProps> = ({
  academicYears,
  classes,
  sections,
  subjects,
  students,
  grades,
  settings,
}) => {
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id || '');

  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, selectedYearId, currentYear?.id);
  }, [classes, selectedYearId, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');

  React.useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  const [masterGradeType, setMasterGradeType] = useState<'termYearlyScore' | 'finalScore'>('finalScore');

  const availableSections = useMemo(
    () => sections.filter((s) => s.classId === selectedClassId),
    [sections, selectedClassId]
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    availableSections[0]?.id || ''
  );

  React.useEffect(() => {
    if (availableSections.length === 0) {
      if (selectedSectionId !== '') setSelectedSectionId('');
    } else if (availableSections.length === 1) {
      setSelectedSectionId(availableSections[0].id);
    } else {
      if (!availableSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(availableSections[0].id);
      }
    }
  }, [availableSections, selectedSectionId]);

  const classSubjects = useMemo(
    () =>
      subjects
        .filter((sub) => sub.classId === selectedClassId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [subjects, selectedClassId]
  );

  const sectionStudents = useMemo(() => {
    return students
      .filter(
        (s) =>
          s.classId === selectedClassId &&
          s.sectionId === selectedSectionId &&
          s.academicYearId === selectedYearId
      )
      .sort((a, b) => a.seatNumber - b.seatNumber);
  }, [students, selectedClassId, selectedSectionId, selectedYearId]);

  const [activeReport, setActiveReport] = useState<ReportType>('master_sheet');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    sectionStudents[0]?.id || ''
  );

  React.useEffect(() => {
    if (sectionStudents.length > 0 && !sectionStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(sectionStudents[0].id);
    }
  }, [sectionStudents, selectedStudentId]);

  const activeClass = classes.find((c) => c.id === selectedClassId);
  const activeSection = sections.find((s) => s.id === selectedSectionId);
  const activeYear = academicYears.find((y) => y.id === selectedYearId);
  const targetStudent = sectionStudents.find((s) => s.id === selectedStudentId);

  const decisionSettings = useMemo(() => {
    return db.getDecisionSettings(selectedYearId);
  }, [selectedYearId]);

  const exemptionSettings = useMemo(() => {
    return db.getExemptionSettings(selectedYearId);
  }, [selectedYearId]);

  const handlePrint = () => {
    // Delay print call slightly to ensure UI stability in Electron environment
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Configuration & Actions Bar (Hidden during print) */}
      <div className="no-print bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Printer className="w-6 h-6 text-emerald-400" />
              التقارير المدرسية والطباعة الرسمية
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              إعداد وطباعة سجلات الدرجات، الشهادات الفردية، وقوائم الشرف بجودة عالية متوافقة مع A4 أفقية
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير الحالي</span>
          </button>
        </div>

        {/* Report Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveReport('master_sheet')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeReport === 'master_sheet'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>شيت الدرجات الرسمي العام</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('student_card')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeReport === 'student_card'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>بطاقة درجات الطالب الفردية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('honor_roll')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeReport === 'honor_roll'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>لوحة المتفوقين (الأوائل)</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">العام الدراسي</label>
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">الصف</label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
              >
                {availableClasses.length === 0 ? (
                  <option value="">(لا توجد صفوف مسجلة لهذا العام)</option>
                ) : (
                  availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">الشعبة</label>
            <div className="relative">
              <select
                value={selectedSectionId}
                disabled={availableSections.length === 0}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={`w-full h-9 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer ${
                  availableSections.length === 0 ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {availableSections.length === 0 ? (
                  <option value="">(الصف لا يحتوي على شُعب)</option>
                ) : (
                  availableSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      الشعبة {s.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {activeReport === 'student_card' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">اختر الطالب</label>
              <div className="relative">
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold focus:outline-hidden appearance-none cursor-pointer"
                >
                  {sectionStudents.map((s) => (
                    <option key={s.id} value={s.id}>#{s.seatNumber} - {s.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {activeReport === 'master_sheet' && (
            <div>
              <label className="block text-[11px] font-bold text-emerald-400 mb-1">نوع الدرجة للشيت العام</label>
              <div className="relative">
                <select
                  value={masterGradeType}
                  onChange={(e) => setMasterGradeType(e.target.value as 'termYearlyScore' | 'finalScore')}
                  className="w-full h-9 px-3 text-xs bg-slate-950 border border-emerald-500/50 rounded-lg text-emerald-300 font-bold focus:outline-hidden appearance-none cursor-pointer"
                >
                  <option value="finalScore">الدرجة النهائية</option>
                  <option value="termYearlyScore">السعي السنوي فقط</option>
                </select>
                <ChevronDown className="w-4 h-4 text-emerald-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable Paper Canvas Area (A4 Landscape Styled) */}
      <div className="bg-white text-slate-950 p-8 md:p-12 rounded-xl shadow-2xl max-w-6xl mx-auto w-full printable-card font-sans" dir="rtl">
        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center justify-between text-center">
            {/* Right: Management & School Name (Exact 2 lines) */}
            <div className="text-right text-xs">
              <p className="font-bold text-slate-900 text-sm">إدارة</p>
              <p className="font-bold text-slate-900 text-sm">{settings.schoolName}</p>
            </div>

            {/* Center: School Logo */}
            <div className="flex flex-col items-center">
              {settings.schoolLogo ? (
                <div className="mb-1.5 flex items-center justify-center">
                  <SchoolLogo
                    logoUrl={settings.schoolLogo}
                    schoolName={settings.schoolName}
                    size="lg"
                    className="max-h-16 max-w-[120px]"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full border-2 border-slate-900 flex items-center justify-center font-black text-lg mb-1">
                  <School className="w-6 h-6 text-slate-900" />
                </div>
              )}
              <h2 className="font-black text-base text-slate-900">
                {settings.schoolName}
              </h2>
            </div>

            {/* Left: Student Data / Class Data */}
            <div className="text-left font-mono text-xs text-slate-800">
              {activeReport === 'student_card' && targetStudent ? (
                <div className="flex flex-col gap-0.5 text-right font-sans font-bold">
                  <p>اسم الطالب: {targetStudent.name}</p>
                  <p>الصف والشعبة: {activeClass?.name} - {activeSection?.name}</p>
                  <p>رقم القيد: {targetStudent.registrationNumber || `#${targetStudent.seatNumber}`}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 text-right font-sans font-bold">
                  <p>الصف: {activeClass?.name}</p>
                  <p>الشعبة: {activeSection?.name ? `شعبة ${activeSection.name}` : '—'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-3 pt-2 border-t border-slate-300">
            <h1 className="text-lg font-black text-slate-900">
              {activeReport === 'master_sheet' && 'شيت الدرجات الرسمي العام'}
              {activeReport === 'student_card' && `بطاقة الدرجات للعام الدراسي ${activeYear?.name || ''}`}
              {activeReport === 'honor_roll' && `لوحة الشرف والتفوق الدراسي — الصف: ${activeClass?.name}`}
            </h1>
            {activeReport === 'master_sheet' && (
              <p className="text-xs font-bold text-slate-700 mt-1">
                الصف: {activeClass?.name} | الشعبة: ({activeSection?.name}) | العام الدراسي: {activeYear?.name}
              </p>
            )}
          </div>
        </div>

        {/* Master Sheet Report Content */}
        {activeReport === 'master_sheet' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-slate-200 border-b border-slate-800 font-bold">
                  <th className="border border-slate-800 p-2 text-center w-8">ت</th>
                  <th className="border border-slate-800 p-2 text-right">اسم الطالب الثلاثي واللقب</th>
                  {classSubjects.map((sub) => (
                    <th key={sub.id} className="border border-slate-800 p-1.5 text-center">
                      <div className="font-black">{sub.name}</div>
                      <div className="text-[10px] font-normal text-slate-600">
                        {masterGradeType === 'termYearlyScore' ? 'السعي السنوي' : 'النهائية'} ({sub.maxScore})
                      </div>
                    </th>
                  ))}
                  <th className="border border-slate-800 p-2 text-center w-14">المجموع</th>
                  <th className="border border-slate-800 p-2 text-center w-14">المعدل</th>
                  <th className="border border-slate-800 p-2 text-center w-20">النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {sectionStudents.map((stu, sIdx) => {
                  const studentGradesBySubject: Record<string, GradeRecord | undefined> = {};
                  classSubjects.forEach((sub) => {
                    const key = buildGradeKey(
                      selectedYearId,
                      selectedClassId,
                      selectedSectionId,
                      sub.id,
                      stu.id
                    );
                    studentGradesBySubject[sub.id] = grades[key];
                  });

                  const evaluation = evaluateStudentAcademicYearDecisions(
                    stu,
                    classSubjects,
                    studentGradesBySubject,
                    decisionSettings,
                    settings.roundingRule,
                    db.getDecisionGrants(),
                    exemptionSettings
                  );

                  const finalStatusSummary = getStudentReportFinalStatus(stu, evaluation);
                  const isGeneralExempt = finalStatusSummary.isGeneralExempt;

                  let totalScore = 0;
                  let counted = 0;

                  return (
                    <tr
                      key={stu.id}
                      className={`border-b border-slate-400 ${isGeneralExempt ? 'bg-emerald-50' : ''}`}
                      style={isGeneralExempt ? { backgroundColor: '#ecfdf5' } : undefined}
                    >
                      <td className="border border-slate-700 p-1.5 text-center font-mono">
                        {sIdx + 1}
                      </td>
                      <td className="border border-slate-700 p-1.5 font-bold">
                        <div className="flex items-center justify-between">
                          <span>{stu.name}</span>
                          {isGeneralExempt && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              إعفاء عام
                            </span>
                          )}
                        </div>
                      </td>

                      {classSubjects.map((sub) => {
                        const rec = studentGradesBySubject[sub.id];
                        const subEval = evaluation.subjects[sub.id];
                        const subDisplay = getSubjectReportDisplay(stu, sub, rec, subEval, masterGradeType);

                        let cellVal: number | null = null;
                        let rawVal: number | null = null;
                        let primaryAssistance = 0;

                        if (masterGradeType === 'termYearlyScore') {
                          cellVal = rec?.termYearlyScore ?? null;
                          rawVal = cellVal;
                          if (cellVal !== null && cellVal !== undefined && !isNaN(cellVal)) {
                            totalScore += Number(cellVal);
                            counted++;
                          }
                        } else {
                          // masterGradeType === 'finalScore'
                          if (subDisplay.isExempt) {
                            cellVal = null;
                            rawVal = null;
                          } else {
                            cellVal = subEval ? subEval.effectiveFinalScore : (rec?.finalScore ?? null);
                            primaryAssistance = subEval?.primaryAssistanceApplied || 0;
                            rawVal = primaryAssistance > 0 ? subEval?.rawFinalScore : null;
                            if (cellVal !== null && cellVal !== undefined && !isNaN(cellVal)) {
                              totalScore += Number(cellVal);
                              counted++;
                            }
                          }
                        }

                        return (
                          <td
                            key={sub.id}
                            style={{
                              position: 'relative',
                              ...(subDisplay.isIndividualExempt ? { backgroundColor: '#eff6ff' } : subDisplay.isGeneralExempt ? { backgroundColor: '#ecfdf5' } : {}),
                            }}
                            className={`relative border border-slate-700 p-1 text-center font-mono text-[11px] h-10 ${
                              subDisplay.isIndividualExempt ? 'bg-blue-50 text-blue-900 font-bold' : subDisplay.isGeneralExempt ? 'bg-emerald-50 text-emerald-900 font-bold' : ''
                            }`}
                          >
                            <div
                              className="relative w-full h-full flex items-center justify-center min-h-[32px]"
                              style={{ position: 'relative' }}
                            >
                              {masterGradeType === 'finalScore' && subDisplay.isExempt ? (
                                <span className="font-bold text-emerald-800 text-xs">
                                  {subDisplay.gradeDisplayText}
                                </span>
                              ) : primaryAssistance > 0 && rawVal !== null && rawVal !== cellVal ? (
                                <>
                                  <span className="font-extrabold text-slate-900">{cellVal}</span>
                                  <span
                                    className="absolute text-[9px] text-red-600 font-mono font-bold leading-none select-none bg-white px-0.5 rounded"
                                    style={{ position: 'absolute', right: '5px', bottom: '3px' }}
                                    title={`الدرجة الأصلية قبل القرار: ${rawVal}`}
                                  >
                                    {rawVal}
                                  </span>
                                </>
                              ) : (
                                <span className="font-bold">{subDisplay.gradeDisplayText}</span>
                              )}
                            </div>
                            {masterGradeType === 'termYearlyScore' && (
                              subEval.isGeneralExempt ? (
                                <span className="text-[8px] text-emerald-700 font-sans block leading-none text-center">إعفاء عام</span>
                              ) : subEval.isIndividualExempt ? (
                                <span className="text-[8px] text-blue-700 font-sans block leading-none text-center">معفى</span>
                              ) : null
                            )}
                          </td>
                        );
                      })}

                      <td className="border border-slate-700 p-1.5 text-center font-mono font-bold">
                        {isGeneralExempt && masterGradeType === 'finalScore'
                          ? 'إعفاء عام'
                          : counted > 0
                          ? totalScore
                          : '—'}
                      </td>
                      <td className="border border-slate-700 p-1.5 text-center font-mono font-black">
                        {isGeneralExempt && masterGradeType === 'finalScore'
                          ? 'إعفاء عام'
                          : counted === classSubjects.length && classSubjects.length > 0
                          ? `${Math.round((totalScore / counted) * 10) / 10}%`
                          : counted > 0
                          ? `${Math.round((totalScore / counted) * 10) / 10}%*`
                          : '—'}
                      </td>
                      <td className="border border-slate-700 p-1.5 text-center font-bold text-[11px]">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${finalStatusSummary.finalStatusBadgeClass}`}>
                          {isGeneralExempt ? 'معفى عام' : finalStatusSummary.finalStatusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Student Individual Grade Card */}
        {activeReport === 'student_card' && targetStudent && (() => {
          const targetStudentGradesBySubject: Record<string, GradeRecord | undefined> = {};
          classSubjects.forEach((s) => {
            const k = buildGradeKey(selectedYearId, selectedClassId, selectedSectionId, s.id, targetStudent.id);
            targetStudentGradesBySubject[s.id] = grades[k];
          });
          const targetEvaluation = evaluateStudentAcademicYearDecisions(
            targetStudent,
            classSubjects,
            targetStudentGradesBySubject,
            decisionSettings,
            settings.roundingRule,
            db.getDecisionGrants(),
            exemptionSettings
          );
          const targetStatusSummary = getStudentReportFinalStatus(targetStudent, targetEvaluation);

          return (
            <div className="flex flex-col gap-6">
              <table className="w-full border-collapse border border-slate-800 text-xs">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-800 font-bold">
                    <th className="border border-slate-800 p-2 text-right">الدروس</th>
                    <th className="border border-slate-800 p-2 text-center">معدل الفصل الأول</th>
                    <th className="border border-slate-800 p-2 text-center">درجة نصف السنة</th>
                    <th className="border border-slate-800 p-2 text-center">معدل النصف الثاني</th>
                    <th className="border border-slate-800 p-2 text-center bg-amber-50">معدل السعي السنوي</th>
                    <th className="border border-slate-800 p-2 text-center bg-emerald-50">الدرجة النهائية</th>
                    <th className="border border-slate-800 p-2 text-center">الملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {classSubjects.map((sub) => {
                    const key = buildGradeKey(
                      selectedYearId,
                      selectedClassId,
                      selectedSectionId,
                      sub.id,
                      targetStudent.id
                    );
                    const rec = grades[key];
                    const subEval = targetEvaluation.subjects[sub.id];
                    const subDisplay = getSubjectReportDisplay(targetStudent, sub, rec, subEval, 'finalScore');

                    const primaryAssistance = subEval?.primaryAssistanceApplied || 0;
                    const rawFinal = primaryAssistance > 0 ? subEval?.rawFinalScore : null;

                    return (
                      <tr key={sub.id} className="border-b border-slate-400">
                        <td className="border border-slate-700 p-2 font-bold">{sub.name}</td>
                        <td className="border border-slate-700 p-2 text-center font-mono">{rec?.term1Score ?? '—'}</td>
                        <td className="border border-slate-700 p-2 text-center font-mono">{rec?.midtermScore ?? '—'}</td>
                        <td className="border border-slate-700 p-2 text-center font-mono">{rec?.term2Score ?? '—'}</td>
                        <td className="border border-slate-700 p-2 text-center font-mono font-bold bg-amber-50">{rec?.termYearlyScore ?? '—'}</td>
                        <td
                          style={{ position: 'relative' }}
                          className={`relative border border-slate-700 p-2 text-center font-mono font-black bg-emerald-50 text-sm h-10 ${
                            subDisplay.isExempt ? 'text-emerald-900' : ''
                          }`}
                        >
                          <div
                            className="relative w-full h-full flex items-center justify-center min-h-[32px]"
                            style={{ position: 'relative' }}
                          >
                            {subDisplay.isExempt ? (
                              <span className="font-bold text-emerald-800 text-xs">
                                {subDisplay.gradeDisplayText}
                              </span>
                            ) : primaryAssistance > 0 && rawFinal !== null && String(rawFinal) !== subDisplay.gradeDisplayText ? (
                              <>
                                <span className="font-extrabold text-slate-900">{subDisplay.gradeDisplayText}</span>
                                <span
                                  className="absolute text-[9px] text-red-600 font-mono font-bold leading-none select-none bg-white px-0.5 rounded"
                                  style={{ position: 'absolute', right: '5px', bottom: '3px' }}
                                  title={`الدرجة الأصلية قبل القرار: ${rawFinal}`}
                                >
                                  {rawFinal}
                                </span>
                              </>
                            ) : (
                              <span>{subDisplay.gradeDisplayText}</span>
                            )}
                          </div>
                        </td>
                        <td className="border border-slate-700 p-2 text-center text-xs font-bold">
                          {subEval.isGeneralExempt ? (
                            <span className="text-emerald-700 font-black">إعفاء عام</span>
                          ) : subEval.isIndividualExempt ? (
                            <span className="text-blue-700 font-black">معفى</span>
                          ) : subEval.passed1stRound ? (
                            <span className="text-emerald-700">ناجح</span>
                          ) : (
                            <span className="text-rose-700">راسب</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="bg-slate-50 p-3 rounded border border-slate-300 text-xs font-bold text-slate-800 flex justify-between items-center">
                <span>الحالة النهائية للطالب:</span>
                <span className="px-3 py-1 rounded bg-slate-900 text-white font-black">
                  {targetStatusSummary.finalStatusText}
                  {targetStatusSummary.finalStatusText === 'مكمّل' && ` (المواد: ${Object.values(targetEvaluation.subjects).filter(s => !s.passedFinal && !s.isExempt).map(s => s.subject.name).join(', ')})`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Honor Roll Content */}
        {activeReport === 'honor_roll' && (
          <div className="py-4">
            <p className="text-center text-sm font-semibold text-slate-700 mb-6">
              تعلن إدارة {settings.schoolName} عن أسماء الطلبة المتفوقين تقديراً لجهودهم ومثابرتهم العلمية المتميزة
            </p>

            <div className="grid grid-cols-2 gap-4">
              {sectionStudents.slice(0, 10).map((stu, idx) => (
                <div key={stu.id} className="border-2 border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{stu.name}</h4>
                      <span className="text-xs text-slate-500">#{stu.seatNumber}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-amber-100 border border-amber-300 rounded text-amber-900">
                    طالب متفوق
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Official Signature Section (Left Side Only) */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex justify-end text-right text-xs font-bold text-slate-800">
          <div className="flex flex-col items-center text-center">
            <p className="text-slate-900 font-black">مدير المدرسة والختم الرسمي</p>
            <p className="font-black text-sm text-slate-950 mt-2">{settings.directorName || ''}</p>
            <div className="mt-8 border-b border-dotted border-black w-36" />
          </div>
        </div>
      </div>
    </div>
  );
};
