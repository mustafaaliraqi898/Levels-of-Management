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
      <div className="no-print bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-5 rounded-[14px] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 app-card-surface">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[10px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 flex items-center justify-center text-[#3156C9] dark:text-[#60A5FA] font-bold shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                ضبط قالب الشهادات
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-[#3156C9]/10 dark:bg-[#2785F5]/15 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/25 dark:border-[#2785F5]/30 font-bold">
                  A4 أفقي
                </span>
              </h1>
              <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] mt-0.5">
                إدارة صورة قالب شهادة التقدير وضبط مواضع وأحجام الشعارات والنصوص بدقة متطابقة مع الطباعة
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetPositions}
            className="px-3.5 py-2.5 rounded-[10px] bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-[#DCE3ED] dark:border-[#2D3B4D]"
            title="استعادة المواضع والأحجام الافتراضية"
          >
            <RotateCcw className="w-4 h-4 text-[#64748B] dark:text-[#A8B5C7]" />
            <span>المواضع الافتراضية</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2.5 rounded-[10px] bg-[#3156C9]/10 hover:bg-[#3156C9]/18 dark:bg-[#2785F5]/15 dark:hover:bg-[#2785F5]/25 text-[#3156C9] dark:text-[#60A5FA] border border-[#3156C9]/30 dark:border-[#2785F5]/35 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 rounded-[10px] bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>معاينة وطباعة الشهادة</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="no-print p-4 rounded-[12px] bg-[#10B981]/10 border border-[#10B981]/30 text-[#047857] dark:text-[#10B981] text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>تم حفظ مواضع وتنسيقات قالب الشهادة بنجاح دائم!</span>
        </div>
      )}

      {actionNotice && (
        <div className="no-print p-3.5 rounded-[12px] bg-[#3156C9]/10 dark:bg-[#2785F5]/15 border border-[#3156C9]/25 dark:border-[#2785F5]/30 text-[#3156C9] dark:text-[#60A5FA] text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <Info className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {uploadError && (
        <div className="no-print p-3.5 rounded-[12px] bg-[#E35D6A]/10 border border-[#E35D6A]/30 text-[#BE3240] dark:text-[#E35D6A] text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 2. Main Work Area: Control Panels + Live Canvas */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Control Tools & Settings (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Tabs for Sidebar Panel */}
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] p-1.5 rounded-[14px] flex items-center gap-1 shadow-xs app-card-surface">
            <button
              type="button"
              onClick={() => setActiveTab('elements')}
              className={`flex-1 py-2 px-3 rounded-[10px] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'elements'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'text-[#475569] dark:text-[#A8B5C7] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] hover:text-[#1E293B] dark:hover:text-[#E2E8F0]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>مواضع العناصر</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('template')}
              className={`flex-1 py-2 px-3 rounded-[10px] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'template'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'text-[#475569] dark:text-[#A8B5C7] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] hover:text-[#1E293B] dark:hover:text-[#E2E8F0]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>صورة القالب</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recipient')}
              className={`flex-1 py-2 px-3 rounded-[10px] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'recipient'
                  ? 'bg-[#3156C9] text-white shadow-xs'
                  : 'text-[#475569] dark:text-[#A8B5C7] hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] hover:text-[#1E293B] dark:hover:text-[#E2E8F0]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>الطالب والمستند</span>
            </button>
          </div>

          {/* TAB 1: Elements & Positioning Tools */}
          {activeTab === 'elements' && (
            <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-5 shadow-xs flex flex-col gap-5 app-card-surface">
              {/* Element Selector Dropdown / Chips */}
              <div>
                <label className="block text-xs font-bold text-[#475569] dark:text-[#A8B5C7] mb-2">
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
                        className={`p-2.5 rounded-[10px] border text-right transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#3156C9]/8 dark:bg-[#2785F5]/15 border-[#3156C9] dark:border-[#2785F5] text-[#1E293B] dark:text-[#E2E8F0] shadow-xs'
                            : 'bg-[#F8FAFC] dark:bg-[#202E40] border-[#DCE3ED] dark:border-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] hover:border-[#2785F5]/50 hover:text-[#1E293B] dark:hover:text-[#E2E8F0]'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#3156C9] dark:bg-[#2785F5] text-white'
                              : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-bold truncate">
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] block">
                            {isVisible ? 'مفعل' : 'مخفي'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Element Properties Editor */}
              <div className="border-t border-[#DCE3ED] dark:border-[#2D3B4D] pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0]">
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
                        ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30'
                        : 'bg-[#EDF1F7] dark:bg-[#26364B] text-[#64748B] dark:text-[#A8B5C7] border border-[#DCE3ED] dark:border-[#2D3B4D]'
                    }`}
                  >
                    {activeElement.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>ظاهر في الشهادة</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>مخفي</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-[#64748B] dark:text-[#A8B5C7] leading-relaxed">
                  {elementMetadata[activeElementKey].description}
                </p>

                {/* X Coordinate */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#475569] dark:text-[#A8B5C7] font-bold">
                      الموقع الأفقي (X):
                    </span>
                    <span className="font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] font-bold">
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
                    className="w-full accent-[#3156C9] dark:accent-[#2785F5] cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] dark:text-[#8493A8] mt-1">
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 15 })}
                      className="hover:text-[#1E293B] dark:hover:text-[#E2E8F0] underline cursor-pointer"
                    >
                      أقصى اليمين (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 50 })}
                      className="hover:text-[#2749B0] dark:hover:text-[#60A5FA] underline font-bold text-[#3156C9] dark:text-[#60A5FA] cursor-pointer"
                    >
                      الوسط تماماً (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { x: 85 })}
                      className="hover:text-[#1E293B] dark:hover:text-[#E2E8F0] underline cursor-pointer"
                    >
                      أقصى اليسار (85%)
                    </button>
                  </div>
                </div>

                {/* Y Coordinate */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#475569] dark:text-[#A8B5C7] font-bold">
                      الموقع العمودي (Y):
                    </span>
                    <span className="font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] font-bold">
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
                    className="w-full accent-[#3156C9] dark:accent-[#2785F5] cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] dark:text-[#8493A8] mt-1">
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 15 })}
                      className="hover:text-[#1E293B] dark:hover:text-[#E2E8F0] underline cursor-pointer"
                    >
                      أعلى الشهادة (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 52 })}
                      className="hover:text-[#2749B0] dark:hover:text-[#60A5FA] underline font-bold text-[#3156C9] dark:text-[#60A5FA] cursor-pointer"
                    >
                      الوسط (52%)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElement(activeElementKey, { y: 85 })}
                      className="hover:text-[#1E293B] dark:hover:text-[#E2E8F0] underline cursor-pointer"
                    >
                      أسفل الشهادة (85%)
                    </button>
                  </div>
                </div>

                {/* Specific controls for Logos (Width & Size) */}
                {elementMetadata[activeElementKey].isImage && (
                  <div className="border-t border-[#DCE3ED] dark:border-[#2D3B4D] pt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#475569] dark:text-[#A8B5C7] font-bold">
                        عرض الشعار (% من عرض الشهادة):
                      </span>
                      <span className="font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] font-bold">
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
                      className="w-full accent-[#3156C9] dark:accent-[#2785F5] cursor-pointer"
                    />

                    {/* Logo Source notice */}
                    <div className="mt-3 p-2.5 rounded-[10px] bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] text-[11px] text-[#475569] dark:text-[#A8B5C7]">
                      {activeElementKey === 'officialLogo' ? (
                        settings.schoolLogo ? (
                          <div className="flex items-center gap-2 text-[#059669] dark:text-[#10B981] font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>شعار المدرسة الرسمي متوفر ومحمّل من الإعدادات العامة.</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[#B45309] dark:text-[#D69B42] font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>لم يتم رفع شعار المدرسة الرسمي في الإعدادات العامة بعد.</span>
                          </div>
                        )
                      ) : settings.kuficLogo ? (
                        <div className="flex items-center gap-2 text-[#059669] dark:text-[#10B981] font-bold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>شعار المدرسة بالخط الكوفي متوفر ومحمّل من الإعدادات العامة.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#B45309] dark:text-[#D69B42] font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>لم يتم رفع الشعار الكوفي في الإعدادات العامة بعد.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Specific controls for Texts (Font size, Weight, Color, Family, Align) */}
                {!elementMetadata[activeElementKey].isImage && (
                  <div className="border-t border-[#DCE3ED] dark:border-[#2D3B4D] pt-3 flex flex-col gap-3.5">
                    {/* Font Size */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#475569] dark:text-[#A8B5C7] font-bold">
                          حجم الخط (Font Size):
                        </span>
                        <span className="font-mono tabular-nums text-[#3156C9] dark:text-[#60A5FA] font-bold">
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
                        className="w-full accent-[#3156C9] dark:accent-[#2785F5] cursor-pointer"
                      />
                    </div>

                    {/* Font Weight & Alignment */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                          وزن الخط:
                        </label>
                        <select
                          value={activeElement.fontWeight || 'bold'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontWeight: e.target.value as 'normal' | 'bold' | 'black',
                            })
                          }
                          className="w-full h-8 px-2 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:outline-hidden focus:border-[#2785F5]"
                        >
                          <option value="normal">عادي (Normal)</option>
                          <option value="bold">عريض (Bold)</option>
                          <option value="black">أسود داكن (Black)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                          نوع الخط:
                        </label>
                        <select
                          value={activeElement.fontFamily || 'Cairo'}
                          onChange={(e) =>
                            updateElement(activeElementKey, {
                              fontFamily: e.target.value,
                            })
                          }
                          className="w-full h-8 px-2 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:outline-hidden focus:border-[#2785F5]"
                        >
                          <option value="Cairo">خط القاهرة (Cairo)</option>
                          <option value="Tajawal">خط تجوال (Tajawal)</option>
                          <option value="Amiri">خط أميري (Amiri)</option>
                        </select>
                      </div>
                    </div>

                    {/* Color selection */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1.5">
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
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-[#DCE3ED] dark:border-[#2D3B4D]"
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
                                    ? 'border-[#2785F5] scale-110 ring-2 ring-[#2785F5]/30'
                                    : 'border-[#DCE3ED] dark:border-[#2D3B4D]'
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
            <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-5 shadow-xs flex flex-col gap-4 app-card-surface">
              <h3 className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#D69B42]" />
                <span>إدارة صورة قالب الشهادة (خلفية A4)</span>
              </h3>

              <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] leading-relaxed">
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
                <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E293B] dark:text-[#E2E8F0]">
                      تم رفع قالب مخصص للشهادة
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[#10B981]/12 text-[#059669] dark:text-[#10B981] border border-[#10B981]/30 font-bold">
                      محفوظ بنجاح
                    </span>
                  </div>

                  <div className="w-full aspect-[297/210] rounded-lg overflow-hidden border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white">
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
                      className="flex-1 py-2 px-3 rounded-[10px] bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#1E293B] dark:text-[#E2E8F0] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-[#DCE3ED] dark:border-[#2D3B4D] disabled:opacity-50"
                    >
                      {isProcessingUpload ? (
                        <div className="w-3.5 h-3.5 border-2 border-[#3156C9] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-[#3156C9] dark:text-[#60A5FA]" />
                      )}
                      <span>استبدال صورة القالب</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveTemplate}
                      className="py-2 px-3 rounded-[10px] bg-[#E35D6A]/10 hover:bg-[#E35D6A]/20 text-[#C83D4B] dark:text-[#E35D6A] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-[#E35D6A]/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5] rounded-[14px] p-6 flex flex-col items-center justify-center text-center transition-colors bg-[#F8FAFC] dark:bg-[#202E40]">
                  <div className="w-12 h-12 rounded-xl bg-[#D69B42]/12 border border-[#D69B42]/30 text-[#B45309] dark:text-[#D69B42] flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#1E293B] dark:text-[#E2E8F0] mb-1">
                    رفع صورة قالب الشهادة من الجهاز
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] leading-relaxed mb-4 max-w-xs">
                    يدعم PNG وJPG وWebP بحجم A4 أفقي. يتم الحفاظ على دقة القالب وجودة الطباعة دون تشويه.
                  </p>
                  <button
                    type="button"
                    disabled={isProcessingUpload}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-[10px] bg-[#3156C9] hover:bg-[#2749B0] dark:bg-[#3156C9] dark:hover:bg-[#3979E6] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
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
            <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-5 shadow-xs flex flex-col gap-4 app-card-surface">
              <h3 className="text-sm font-bold text-[#1E293B] dark:text-[#E2E8F0] flex items-center gap-2">
                <User className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
                <span>اختيار الطالب المستحق للشهادة</span>
              </h3>

              <p className="text-xs text-[#64748B] dark:text-[#A8B5C7] leading-relaxed">
                اختر طالباً من سجل الطلاب الفعلي لعرض اسمه على الشهادة قبل الطباعة:
              </p>

              {/* Class & Section Filter */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                    الصف الدراسي:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full h-8 px-2 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:outline-hidden focus:border-[#2785F5]"
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
                  <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                    الشعبة:
                  </label>
                  <select
                    value={selectedSectionId}
                    disabled={availableSections.length === 0}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className={`w-full h-8 px-2 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] focus:outline-hidden focus:border-[#2785F5] ${
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
                <label className="block text-[11px] font-bold text-[#64748B] dark:text-[#A8B5C7] mb-1">
                  اسم الطالب ({availableStudents.length} طالباً):
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-[#F8FAFC] dark:bg-[#26364B] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-lg text-[#1E293B] dark:text-[#E2E8F0] font-bold focus:outline-hidden focus:border-[#2785F5]"
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
              <div className="p-3.5 rounded-[12px] bg-[#F8FAFC] dark:bg-[#202E40] border border-[#DCE3ED] dark:border-[#2D3B4D] flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] dark:text-[#A8B5C7]">العام الدراسي:</span>
                  <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0] font-mono tabular-nums">{displayYearName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] dark:text-[#A8B5C7]">مدير المدرسة:</span>
                  <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0]">{displayDirectorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] dark:text-[#A8B5C7]">اسم المدرسة:</span>
                  <span className="font-bold text-[#1E293B] dark:text-[#E2E8F0]">{settings.schoolName}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Live A4 Canvas (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Canvas Controls Header Bar (Zoom, Grid, Reset View) */}
          <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] px-4 py-2.5 rounded-[14px] flex items-center justify-between text-xs shadow-xs app-card-surface">
            <div className="flex items-center gap-2 text-[#1E293B] dark:text-[#E2E8F0] font-bold">
              <Move className="w-4 h-4 text-[#3156C9] dark:text-[#60A5FA]" />
              <span>المعاينة التفاعلية المباشرة (A4 أفقي)</span>
              <span className="text-[10px] text-[#64748B] dark:text-[#8493A8] font-normal">
                (اسحب أي عنصر بالماوس لتغيير موضعه)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.1))}
                className="p-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] cursor-pointer"
                title="تصغير المعاينة"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 py-0.5 rounded bg-[#EDF1F7] dark:bg-[#26364B] font-mono tabular-nums text-[11px] font-bold text-[#3156C9] dark:text-[#60A5FA]">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                className="p-1.5 rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[#475569] dark:text-[#A8B5C7] cursor-pointer"
                title="تكبير المعاينة"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoomLevel(0.85)}
                className="px-2 py-1 rounded-lg bg-[#EDF1F7] hover:bg-[#E2E8F0] dark:bg-[#26364B] dark:hover:bg-[#2D3B4D] text-[11px] text-[#1E293B] dark:text-[#E2E8F0] font-bold cursor-pointer"
                title="إعادة ضبط حجم العرض"
              >
                100%
              </button>
            </div>
          </div>

          {/* Canvas Scaled Wrapper */}
          <div className="w-full overflow-auto bg-[#EDF1F7] dark:bg-[#111C2A] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-[14px] p-4 sm:p-6 flex justify-center items-center shadow-inner min-h-[450px]">
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
                className="w-full aspect-[1123/794] rounded-xl shadow-xl relative overflow-hidden border border-[#DCE3ED] dark:border-[#2D3B4D] bg-white"
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

          <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#A8B5C7] px-2">
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
