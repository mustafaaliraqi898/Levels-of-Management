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
import { processTemplateImage } from '../../utils/imageUtils';
import { CertificateCanvas } from './CertificateCanvas';
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

  // Student recipient selection
  const currentYear =
    academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
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
        (!selectedClassId || s.classId === selectedClassId) &&
        (availableSections.length === 0 || !selectedSectionId || s.sectionId === selectedSectionId)
    );
  }, [students, selectedClassId, selectedSectionId, availableSections]);

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
      <div className="no-print bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
              <Award className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                ضبط قالب الشهادات
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  A4 أفقي
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة صورة قالب شهادة التقدير وضبط مواضع وأحجام الشعارات والنصوص بدقة متطابقة مع الطباعة
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetPositions}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-700"
            title="استعادة المواضع والأحجام الافتراضية"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>المواضع الافتراضية</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-indigo-600/25"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/25"
          >
            <Printer className="w-4 h-4" />
            <span>معاينة وطباعة الشهادة</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="no-print p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>تم حفظ مواضع وتنسيقات قالب الشهادة بنجاح دائم!</span>
        </div>
      )}

      {actionNotice && (
        <div className="no-print p-3.5 rounded-xl bg-indigo-950/70 border border-indigo-500/50 text-indigo-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {uploadError && (
        <div className="no-print p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 2. Main Work Area: Control Panels + Live Canvas */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Control Tools & Settings (4 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Tabs for Sidebar Panel */}
          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('elements')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'elements'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>مواضع العناصر</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('template')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'template'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>صورة القالب</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recipient')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'recipient'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>الطالب والمستند</span>
            </button>
          </div>

          {/* TAB 1: Elements & Positioning Tools */}
          {activeTab === 'elements' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5">
              {/* Element Selector Dropdown / Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
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
                            ? 'bg-slate-800 border-indigo-500 text-white shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-bold truncate">
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {isVisible ? 'مفعل' : 'مخفي'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Element Properties Editor */}
              <div className="border-t border-slate-800 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
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
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {activeElement.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
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

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {elementMetadata[activeElementKey].description}
                </p>

                {/* X Coordinate */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-bold">
                      الموقع الأفقي (X):
                    </span>
                    <span className="font-mono text-indigo-400 font-bold">
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
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 15 })}
                      className="hover:text-slate-300 underline cursor-pointer"
                    >
                      أقصى اليمين (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 50 })}
                      className="hover:text-slate-300 underline font-bold text-indigo-400 cursor-pointer"
                    >
                      الوسط تماماً (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 85 })}
                      className="hover:text-slate-300 underline cursor-pointer"
                    >
                      أقصى اليسار (85%)
                    </button>
                  </div>
                </div>

                {/* Y Coordinate */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-bold">
                      الموقع العمودي (Y):
                    </span>
                    <span className="font-mono text-indigo-400 font-bold">
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
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 15 })}
                      className="hover:text-slate-300 underline cursor-pointer"
                    >
                      أعلى الشهادة (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 52 })}
                      className="hover:text-slate-300 underline font-bold text-indigo-400 cursor-pointer"
                    >
                      الوسط (52%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 85 })}
                      className="hover:text-slate-300 underline cursor-pointer"
                    >
                      أسفل الشهادة (85%)
                    </button>
                  </div>
                </div>

                {/* Specific controls for Logos (Width & Size) */}
                {elementMetadata[activeElementKey].isImage && (
                  <div className="border-t border-slate-800 pt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-300 font-bold">
                        عرض الشعار (% من عرض الشهادة):
                      </span>
                      <span className="font-mono text-indigo-400 font-bold">
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
                      className="w-full accent-indigo-500 cursor-pointer"
                    />

                    {/* Logo Source notice */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
                      {activeElementKey === 'officialLogo' ? (
                        settings.schoolLogo ? (
                          <div className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>شعار المدرسة الرسمي متوفر ومحمّل من الإعدادات العامة.</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-400">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>لم يتم رفع شعار المدرسة الرسمي في الإعدادات العامة بعد.</span>
                          </div>
                        )
                      ) : settings.kuficLogo ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>شعار المدرسة بالخط الكوفي متوفر ومحمّل من الإعدادات العامة.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-400">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>لم يتم رفع الشعار الكوفي في الإعدادات العامة بعد.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Specific controls for Texts (Font size, Weight, Color, Family, Align) */}
                {!elementMetadata[activeElementKey].isImage && (
                  <div className="border-t border-slate-800 pt-3 flex flex-col gap-3.5">
                    {/* Font Size */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300 font-bold">
                          حجم الخط (Font Size):
                        </span>
                        <span className="font-mono text-indigo-400 font-bold">
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
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {/* Font Weight & Alignment */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          وزن الخط:
                        </label>
                        <select
                          value={activeElement.fontWeight || 'bold'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontWeight: e.target.value as 'normal' | 'bold' | 'black',
                            })
                          }
                          className="w-full h-8 px-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                        >
                          <option value="normal">عادي (Normal)</option>
                          <option value="bold">عريض (Bold)</option>
                          <option value="black">أسود داكن (Black)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          نوع الخط:
                        </label>
                        <select
                          value={activeElement.fontFamily || 'Cairo'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontFamily: e.target.value,
                            })
                          }
                          className="w-full h-8 px-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                        >
                          <option value="Cairo">خط القاهرة (Cairo)</option>
                          <option value="Tajawal">خط تجوال (Tajawal)</option>
                          <option value="Amiri">خط أميري (Amiri)</option>
                        </select>
                      </div>
                    </div>

                    {/* Color selection */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
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
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-700"
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
                                    ? 'border-white scale-110 shadow-xs'
                                    : 'border-slate-700'
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>إدارة صورة قالب الشهادة (خلفية A4)</span>
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
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
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      تم رفع قالب مخصص للشهادة
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      محفوظ بنجاح
                    </span>
                  </div>

                  <div className="w-full aspect-[297/210] rounded-lg overflow-hidden border border-slate-700 bg-white">
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
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-slate-700 disabled:opacity-50"
                    >
                      {isProcessingUpload ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span>استبدال صورة القالب</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveTemplate}
                      className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-rose-800/40"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-slate-950/40">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-white mb-1">
                    رفع صورة قالب الشهادة من الجهاز
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-xs">
                    يدعم PNG وJPG وWebP بحجم A4 أفقي. يتم الحفاظ على دقة القالب وجودة الطباعة دون تشويه.
                  </p>
                  <button
                    type="button"
                    disabled={isProcessingUpload}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-amber-600/20 disabled:opacity-50"
                  >
                    {isProcessingUpload ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-slate-950" />
                    )}
                    <span>اختيار صورة القالب من الجهاز</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Student Selection & Live Print Binding */}
          {activeTab === 'recipient' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span>اختيار الطالب المستحق للشهادة</span>
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                اختر طالباً من سجل الطلاب الفعلي لعرض اسمه على الشهادة قبل الطباعة:
              </p>

              {/* Class & Section Filter */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    الصف الدراسي:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full h-8 px-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    الشعبة:
                  </label>
                  <select
                    value={selectedSectionId}
                    disabled={availableSections.length === 0}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className={`w-full h-8 px-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 ${
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
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  اسم الطالب ({availableStudents.length} طالباً):
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-bold"
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
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">العام الدراسي:</span>
                  <span className="font-bold text-slate-200">{displayYearName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">مدير المدرسة:</span>
                  <span className="font-bold text-slate-200">{displayDirectorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">اسم المدرسة:</span>
                  <span className="font-bold text-slate-200">{settings.schoolName}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Live A4 Canvas (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Canvas Controls Header Bar (Zoom, Grid, Reset View) */}
          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <Move className="w-4 h-4 text-indigo-400" />
              <span>المعاينة التفاعلية المباشرة (A4 أفقي)</span>
              <span className="text-[10px] text-slate-500 font-normal">
                (اسحب أي عنصر بالماوس لتغيير موضعه)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 cursor-pointer"
                title="تصغير المعاينة"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-[11px] text-indigo-400">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 cursor-pointer"
                title="تكبير المعاينة"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoomLevel(0.85)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-[11px] text-slate-300 font-bold cursor-pointer"
                title="إعادة ضبط حجم العرض"
              >
                100%
              </button>
            </div>
          </div>

          {/* Canvas Scaled Wrapper */}
          <div className="w-full overflow-auto bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-6 flex justify-center items-center shadow-inner min-h-[450px]">
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
                className="w-full aspect-[1123/794] rounded-xl shadow-2xl relative overflow-hidden border border-slate-600 bg-white"
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

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-2">
            <span>
              نصيحة: يمكنك النقر فوق أي شعار أو اسم داخل المعاينة لسحبه مباشرة وضبط موضعه بدقة.
            </span>
            <span>نسبة أبعاد الورقة: A4 أفقي (297 × 210 ملم)</span>
          </div>
        </div>
      </div>

      {/* 3. Dedicated Print Preview Modal */}
      {showPrintModal && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-full max-w-6xl max-h-[94vh] flex flex-col bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    معاينة طباعة الشهادة على ورق A4 أفقي
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    الطالب: <strong className="text-white">{displayStudentName}</strong> • العام الدراسي: {displayYearName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isPrinting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>طباعة الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Certificate Canvas Preview */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950/70 flex justify-center items-center">
              <div className="w-full max-w-4xl aspect-[1123/794] shadow-2xl rounded-lg overflow-hidden border border-slate-400 bg-white">
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
            </div>
          </div>
        </div>
      )}

      {/* 4. Dedicated Print Container (Visible ONLY during window.print) */}
      <div className="hidden print:block fixed inset-0 w-[297mm] h-[210mm] m-0 p-0 overflow-hidden bg-white z-[99999]">
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
    </div>
  );
};
