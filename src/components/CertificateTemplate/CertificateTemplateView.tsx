import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  AppSettings,
  AcademicYear,
  SchoolClass,
  Section,
  Student,
  CertificateTemplateConfig,
  CertificateElementKey,
  CertificateElementConfig,
} from '../../types';
import { db } from '../../services/storage';
import { filterClassesByAcademicYear } from '../../utils/academicYearUtils';
import { processTemplateImage } from '../../utils/imageUtils';
import { CertificateCanvas } from './CertificateCanvas';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import {
  Award,
  Upload,
  RefreshCw,
  Trash2,
  Save,
  RotateCcw,
  Printer,
  Sliders,
  Type,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  Sparkles,
  School,
  User,
  Calendar,
  Layers,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Info,
  X,
} from 'lucide-react';

interface CertificateTemplateViewProps {
  settings: AppSettings;
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  students: Student[];
}

export const CertificateTemplateView: React.FC<CertificateTemplateViewProps> = ({
  settings,
  academicYears,
  classes,
  sections,
  students,
}) => {
  // 1. Initial State from Storage
  const [config, setConfig] = useState<CertificateTemplateConfig>(() =>
    db.getCertificateTemplate()
  );

  const [activeElementKey, setActiveElementKey] =
    useState<CertificateElementKey>('studentName');
  const [activeTab, setActiveTab] = useState<'template' | 'elements' | 'recipient'>('elements');

  // Zoom & Preview state
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Status feedback
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Student recipient selection (strictly scoped to active academic year)
  const currentYear =
    academicYears.find((y) => y.isCurrent) || academicYears[0];

  const availableClasses = useMemo(() => {
    return filterClassesByAcademicYear(classes, currentYear?.id, currentYear?.id);
  }, [classes, currentYear?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    availableClasses[0]?.id || ''
  );

  useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  const availableSections = useMemo(
    () => sections.filter((s) => s.classId === selectedClassId),
    [sections, selectedClassId]
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    availableSections[0]?.id || ''
  );

  useEffect(() => {
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

  const availableStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.academicYearId === currentYear?.id &&
        (!selectedClassId || s.classId === selectedClassId) &&
        (availableSections.length === 0 || !selectedSectionId || s.sectionId === selectedSectionId)
    );
  }, [students, currentYear?.id, selectedClassId, selectedSectionId, availableSections]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    availableStudents[0]?.id || ''
  );

  useEffect(() => {
    if (availableStudents.length > 0 && !availableStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(availableStudents[0].id);
    }
  }, [availableStudents, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const studentClass = useMemo(
    () => classes.find((c) => c.id === (selectedStudent?.classId || selectedClassId)),
    [classes, selectedStudent, selectedClassId]
  );

  const studentSection = useMemo(
    () => sections.find((s) => s.id === (selectedStudent?.sectionId || selectedSectionId)),
    [sections, selectedStudent, selectedSectionId]
  );

  // Resolved display values based on project settings & selection
  const displayStudentName =
    selectedStudent?.name || 'أحمد مصطفى عبد الله السعدي (اسم تجريبي للمعاينة)';
  const displayDirectorName = settings.directorName || 'أ. د. علي حسين الموسوي';
  const displayYearName = currentYear?.name || '2026–2027';

  // Dragging state on canvas
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragElementKeyRef = useRef<CertificateElementKey | null>(null);

  // Handle template file upload
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingUpload(true);
    setUploadError(null);

    try {
      const result = await processTemplateImage(file);
      const newConfig: CertificateTemplateConfig = {
        ...config,
        templateImage: result.dataUrl,
      };
      setConfig(newConfig);
      db.saveCertificateTemplate(newConfig);
      const imgRatio = result.width / result.height;
      const targetRatio = 297 / 210;
      if (Math.abs(imgRatio - targetRatio) > 0.08) {
        setActionNotice(
          `تنبيه: أبعاد صورة القالب المرفوعة (${result.width}×${result.height} بكسل) تختلف عن نسبة A4 الأفقي القياسية (1.41). تظهر الصورة كاملة من الحافة إلى الحافة ضمن مساحة A4 الأفقية.`
        );
      } else {
        setActionNotice(
          `تم رفع قالب الشهادة بنجاح بدقة A4 أفقية قياسية (${result.width}×${result.height} بكسل، الحجم: ${result.sizeKb} ك.ب).`
        );
      }
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل ملف القالب، يرجى التأكد من اختيار صورة صالحة.'
      );
    } finally {
      setIsProcessingUpload(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove template background and reset to default frame
  const handleRemoveTemplate = () => {
    if (window.confirm('هل أنت متأكد من حذف صورة القالب المرفوعة والعودة للقالب الافتراضي؟')) {
      const newConfig: CertificateTemplateConfig = {
        ...config,
        templateImage: undefined,
      };
      setConfig(newConfig);
      db.saveCertificateTemplate(newConfig);
      setActionNotice('تم حذف صورة القالب المرفوعة والعودة للقالب الهندسي الافتراضي.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Update a single element configuration in real-time and persist to DB
  const updateElement = (
    key: CertificateElementKey,
    updates: Partial<CertificateElementConfig>
  ) => {
    setConfig((prev) => {
      const updated: CertificateTemplateConfig = {
        ...prev,
        elements: {
          ...prev.elements,
          [key]: {
            ...prev.elements[key],
            ...updates,
          },
        },
      };
      db.saveCertificateTemplate(updated);
      return updated;
    });
  };

  // Save changes to database permanently
  const handleSave = () => {
    db.saveCertificateTemplate(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Reset element positions to default
  const handleResetPositions = () => {
    if (
      window.confirm(
        'هل تريد استعادة المواضع والأحجام الافتراضية للعناصر؟ (لن يتم حذف صورة القالب المرفوعة)'
      )
    ) {
      const reset = db.resetCertificateTemplate();
      setConfig(reset);
      setActionNotice('تمت استعادة المواضع والأحجام الافتراضية للعناصر بنجاح.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Canvas Drag & Drop handlers
  const handleMouseDown = (
    e: React.MouseEvent,
    key: CertificateElementKey
  ) => {
    e.stopPropagation();
    setActiveElementKey(key);
    setIsDragging(true);
    dragElementKeyRef.current = key;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragElementKeyRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      let newX = ((clientX - rect.left) / rect.width) * 100;
      let newY = ((clientY - rect.top) / rect.height) * 100;

      // Clamping inside canvas bounds
      newX = Math.max(2, Math.min(98, newX));
      newY = Math.max(2, Math.min(98, newY));

      // Snap to exact horizontal center if close to 50%
      if (Math.abs(newX - 50) < 1.2) {
        newX = 50;
      }

      updateElement(dragElementKeyRef.current, {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragElementKeyRef.current = null;
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle direct print
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error('Print failed:', err);
      } finally {
        setIsPrinting(false);
      }
    }, 200);
  };

  const activeElement = config.elements[activeElementKey];

  const elementMetadata: Record<
    CertificateElementKey,
    { label: string; icon: React.ComponentType<{ className?: string }>; isImage: boolean; description: string }
  > = {
    officialLogo: {
      label: 'شعار المدرسة الرسمي',
      icon: School,
      isImage: true,
      description: 'يُقرأ تلقائياً من حقل شعار المدرسة في الإعدادات العامة',
    },
    kuficLogo: {
      label: 'شعار المدرسة بالخط الكوفي',
      icon: Sparkles,
      isImage: true,
      description: 'يُقرأ تلقائياً من حقل الشعار الكوفي في الإعدادات العامة',
    },
    studentName: {
      label: 'اسم الطالب المكرم',
      icon: User,
      isImage: false,
      description: 'اسم الطالب المستحق للشهادة بحجم خط بارز ومحاذاة مناسبة',
    },
    academicYear: {
      label: 'العام الدراسي',
      icon: Calendar,
      isImage: false,
      description: 'يُقرأ من العام الدراسي المعتمد حالياً في النظام',
    },
    directorName: {
      label: 'اسم مدير المدرسة',
      icon: Award,
      isImage: false,
      description: 'يُقرأ من حقل مدير المدرسة في الإعدادات العامة',
    },
  };



  return (
    <div className="flex flex-col gap-6 pb-20 select-none" dir="rtl">
      {/* 1. Header Toolbar */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-400/15 border border-emerald-200 dark:border-emerald-400/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                ضبط قالب الشهادات
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-400/15 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-400/30 font-bold">
                  A4 أفقي
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                إدارة صورة قالب شهادة التقدير وضبط مواضع وأحجام الشعارات والنصوص بدقة متطابقة مع الطباعة
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetPositions}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
            title="استعادة المواضع والأحجام الافتراضية"
          >
            <RotateCcw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>المواضع الافتراضية</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/15 dark:hover:bg-teal-500/25 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>معاينة وطباعة الشهادة</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="no-print p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>تم حفظ مواضع وتنسيقات قالب الشهادة بنجاح دائم!</span>
        </div>
      )}

      {actionNotice && (
        <div className="no-print p-3.5 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {uploadError && (
        <div className="no-print p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 2. Main Work Area: Control Panels + Live Canvas */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Control Tools & Settings (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Tabs for Sidebar Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl flex items-center gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('elements')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'elements'
                  ? 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>مواضع العناصر</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('template')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'template'
                  ? 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>صورة القالب</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recipient')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'recipient'
                  ? 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>الطالب والمستند</span>
            </button>
          </div>

          {/* TAB 1: Elements & Positioning Tools */}
          {activeTab === 'elements' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-5">
              {/* Element Selector Dropdown / Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  اختر العنصر المراد ضبطه وتحريكه:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(elementMetadata) as CertificateElementKey[]).map((key) => {
                    const meta = elementMetadata[key];
                    const Icon = meta.icon;
                    const isSelected = activeElementKey === key;
                    const isVisible = config.elements[key].visible;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveElementKey(key)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/70 dark:bg-slate-800 border-emerald-500 dark:border-emerald-400 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-bold truncate">
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {isVisible ? 'مفعل' : 'مخفي'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Element Properties Editor */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      خصائص {elementMetadata[activeElementKey].label}
                    </span>
                  </div>

                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      updateElement(activeElementKey, {
                        visible: !activeElement.visible,
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      activeElement.visible
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {activeElement.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>ظاهر في الشهادة</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>مخفي</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {elementMetadata[activeElementKey].description}
                </p>

                {/* X Coordinate */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      الموقع الأفقي (X):
                    </span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {activeElement.x}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="98"
                    step="0.5"
                    value={activeElement.x}
                    onChange={(e) =>
                      updateElement(activeElementKey, {
                        x: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-600 dark:accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 15 })}
                      className="hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      أقصى اليمين (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 50 })}
                      className="hover:text-emerald-800 dark:hover:text-emerald-300 underline font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      الوسط تماماً (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 85 })}
                      className="hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      أقصى اليسار (85%)
                    </button>
                  </div>
                </div>

                {/* Y Coordinate */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      الموقع العمودي (Y):
                    </span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {activeElement.y}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="98"
                    step="0.5"
                    value={activeElement.y}
                    onChange={(e) =>
                      updateElement(activeElementKey, {
                        y: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-600 dark:accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 15 })}
                      className="hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      أعلى الشهادة (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 52 })}
                      className="hover:text-emerald-800 dark:hover:text-emerald-300 underline font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      الوسط (52%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 85 })}
                      className="hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      أسفل الشهادة (85%)
                    </button>
                  </div>
                </div>

                {/* Specific controls for Logos (Width & Size) */}
                {elementMetadata[activeElementKey].isImage && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300 font-bold">
                        عرض الشعار (% من عرض الشهادة):
                      </span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                        {activeElement.width || 10}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="30"
                      step="0.5"
                      value={activeElement.width || 10}
                      onChange={(e) =>
                        updateElement(activeElementKey, {
                          width: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-emerald-600 dark:accent-emerald-400 cursor-pointer"
                    />

                    {/* Logo Source notice */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                      {activeElementKey === 'officialLogo' ? (
                        settings.schoolLogo ? (
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>شعار المدرسة الرسمي متوفر ومحمّل من الإعدادات العامة.</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>لم يتم رفع شعار المدرسة الرسمي في الإعدادات العامة بعد.</span>
                          </div>
                        )
                      ) : settings.kuficLogo ? (
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>شعار المدرسة بالخط الكوفي متوفر ومحمّل من الإعدادات العامة.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>لم يتم رفع الشعار الكوفي في الإعدادات العامة بعد.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Specific controls for Texts (Font size, Weight, Color, Family, Align) */}
                {!elementMetadata[activeElementKey].isImage && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-col gap-3.5">
                    {/* Font Size */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-700 dark:text-slate-300 font-bold">
                          حجم الخط (Font Size):
                        </span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          {activeElement.fontSize || 24}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="64"
                        step="1"
                        value={activeElement.fontSize || 24}
                        onChange={(e) =>
                          updateElement(activeElementKey, {
                            fontSize: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-emerald-600 dark:accent-emerald-400 cursor-pointer"
                      />
                    </div>

                    {/* Font Weight & Alignment */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          وزن الخط:
                        </label>
                        <select
                          value={activeElement.fontWeight || 'bold'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontWeight: e.target.value as 'normal' | 'bold' | 'black',
                            })
                          }
                          className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value="normal">عادي (Normal)</option>
                          <option value="bold">عريض (Bold)</option>
                          <option value="black">أسود داكن (Black)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          نوع الخط:
                        </label>
                        <select
                          value={activeElement.fontFamily || 'Cairo'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontFamily: e.target.value,
                            })
                          }
                          className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value="Cairo">خط القاهرة (Cairo)</option>
                          <option value="Tajawal">خط تجوال (Tajawal)</option>
                          <option value="Amiri">خط أميري (Amiri)</option>
                        </select>
                      </div>
                    </div>

                    {/* Color selection */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                        لون النص:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeElement.fontColor || '#0f172a'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontColor: e.target.value,
                            })
                          }
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['#0f172a', '#1e293b', '#8c6b2d', '#5a421c', '#065f46', '#1e3a8a'].map(
                            (c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  updateElement(activeElementKey, { fontColor: c })
                                }
                                className={`w-6 h-6 rounded-md border cursor-pointer ${
                                  activeElement.fontColor === c
                                    ? 'border-emerald-500 scale-110 ring-2 ring-emerald-500/30'
                                    : 'border-slate-300 dark:border-slate-700'
                                }`}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Template Image Management */}
          {activeTab === 'template' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>إدارة صورة قالب الشهادة (خلفية A4)</span>
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                يمكنك رفع صورة قالب الشهادة الرسمي الخاص بالمدرسة (بأبعاد A4 أفقي). يتم استخدام القالب كخلفية ثابتة وتوضع الشعارات والنصوص فوقه بدقة متناهية.
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleTemplateUpload}
                className="hidden"
              />

              {config.templateImage ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      تم رفع قالب مخصص للشهادة
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-bold">
                      محفوظ بنجاح
                    </span>
                  </div>

                  <div className="w-full aspect-[297/210] rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-white">
                    <img
                      src={config.templateImage}
                      alt="معاينة مصغرة للقالب"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      disabled={isProcessingUpload}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                    >
                      {isProcessingUpload ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      )}
                      <span>استبدال صورة القالب</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveTemplate}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-500/30"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/70 dark:bg-slate-800/30">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                    رفع صورة قالب الشهادة من الجهاز
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 max-w-xs">
                    يدعم PNG وJPG وWebP بحجم A4 أفقي. يتم الحفاظ على دقة القالب وجودة الطباعة دون تشويه.
                  </p>
                  <button
                    type="button"
                    disabled={isProcessingUpload}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isProcessingUpload ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>اختيار صورة القالب من الجهاز</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Student Selection & Live Print Binding */}
          {activeTab === 'recipient' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>اختيار الطالب المستحق للشهادة</span>
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                اختر طالباً من سجل الطلاب الفعلي لعرض اسمه على الشهادة قبل الطباعة:
              </p>

              {/* Class & Section Filter */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    الصف الدراسي:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {availableClasses.length === 0 ? (
                      <option value="">(لا توجد صفوف مسجلة لهذا العام)</option>
                    ) : (
                      availableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    الشعبة:
                  </label>
                  <select
                    value={selectedSectionId}
                    disabled={availableSections.length === 0}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className={`w-full h-8 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 ${
                      availableSections.length === 0 ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {availableSections.length === 0 ? (
                      <option value="">(الصف لا يحتوي على شُعب)</option>
                    ) : (
                      availableSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          شعبة {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Student Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  اسم الطالب ({availableStudents.length} طالباً):
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                >
                  {availableStudents.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name} {stu.registrationNumber ? `(قيد: ${stu.registrationNumber})` : ''}
                    </option>
                  ))}
                  {availableStudents.length === 0 && (
                    <option value="">لا يوجد طلاب في هذه الشعبة</option>
                  )}
                </select>
              </div>

              {/* Details Readout */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">العام الدراسي:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{displayYearName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">مدير المدرسة:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{displayDirectorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">اسم المدرسة:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{settings.schoolName}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Live A4 Canvas (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Canvas Controls Header Bar (Zoom, Grid, Reset View) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
              <Move className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>المعاينة التفاعلية المباشرة (A4 أفقي)</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                (اسحب أي عنصر بالماوس لتغيير موضعه)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="تصغير المعاينة"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="تكبير المعاينة"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoomLevel(0.85)}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                title="إعادة ضبط حجم العرض"
              >
                100%
              </button>
            </div>
          </div>

          {/* Canvas Scaled Wrapper */}
          <div className="w-full overflow-auto bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 flex justify-center items-center shadow-inner min-h-[450px]">
            <div
              style={{
                width: `${900 * zoomLevel}px`,
                maxWidth: '100%',
                transition: 'width 0.15s ease-out',
              }}
            >
              {/* Actual A4 Aspect Ratio Container (297 / 210 = ~1.414) */}
              <div
                ref={canvasRef}
                className="w-full aspect-[1123/794] rounded-xl shadow-xl relative overflow-hidden border border-slate-300 dark:border-slate-700 bg-white"
              >
                <CertificateCanvas
                  config={config}
                  settings={settings}
                  studentName={displayStudentName}
                  classNameStr={studentClass?.name}
                  sectionNameStr={studentSection?.name}
                  registrationNumber={selectedStudent?.registrationNumber}
                  seatNumber={selectedStudent?.seatNumber}
                  academicYear={displayYearName}
                  directorName={displayDirectorName}
                  isForPrint={false}
                  activeElementKey={activeElementKey}
                  onElementMouseDown={handleMouseDown}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-2">
            <span>
              نصيحة: يمكنك النقر فوق أي شعار أو اسم داخل المعاينة لسحبه مباشرة وضبط موضعه بدقة.
            </span>
            <span>نسبة أبعاد الورقة: A4 أفقي (297 × 210 ملم)</span>
          </div>
        </div>
      </div>

      {/* Unified Interactive Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={`شهادة تقديرية — ${displayStudentName}`}
        subtitle={`الصف: ${studentClass?.name || '—'} • العام الدراسي: ${displayYearName}`}
        defaultOrientation="landscape"
        suggestedFileName={`شهادة_${displayStudentName}`}
      >
        <div className="w-full aspect-[1123/794] shadow-2xl rounded-lg overflow-hidden border border-slate-400 bg-white">
          <CertificateCanvas
            config={config}
            settings={settings}
            studentName={displayStudentName}
            classNameStr={studentClass?.name}
            sectionNameStr={studentSection?.name}
            registrationNumber={selectedStudent?.registrationNumber}
            seatNumber={selectedStudent?.seatNumber}
            academicYear={displayYearName}
            directorName={displayDirectorName}
            isForPrint={true}
          />
        </div>
      </PrintPreviewModal>
    </div>
  );
};
