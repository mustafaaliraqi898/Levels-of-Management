import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import {
  Student,
  AppSettings,
  CertificateTemplateConfig,
} from '../../types';
import { CertificateCanvas } from '../CertificateTemplate/CertificateCanvas';
import { db, buildGradeKey } from '../../services/storage';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Award,
  Loader2,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

interface ExportCertificatesPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleStudents: Student[];
  initialSelectedStudentIds: string[];
  settings: AppSettings;
  templateConfig: CertificateTemplateConfig;
  academicYearName: string;
  classNameStr: string;
  sectionNameStr: string;
}

export const ExportCertificatesPdfModal: React.FC<ExportCertificatesPdfModalProps> = ({
  isOpen,
  onClose,
  eligibleStudents,
  initialSelectedStudentIds,
  settings,
  academicYearName,
  classNameStr,
  sectionNameStr,
}) => {
  // Selected student IDs for export
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return initialSelectedStudentIds.length > 0
      ? initialSelectedStudentIds
      : eligibleStudents.map((s) => s.id);
  });

  // Target file name
  const defaultBaseName = `شهادات_الإعفاء_${classNameStr.replace(/\s+/g, '_')}_${sectionNameStr ? `شعبة_${sectionNameStr.replace(/\s+/g, '_')}` : 'بدون_شعبة'}`;
  const [baseFileName, setBaseFileName] = useState<string>(defaultBaseName);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'pdf' | 'images' | null>(null);
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [currentStudentName, setCurrentStudentName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dedicated off-screen render container ref for html2canvas
  const hiddenRenderContainerRef = useRef<HTMLDivElement>(null);
  const [renderStudent, setRenderStudent] = useState<Student | null>(null);

  if (!isOpen) return null;

  const selectedStudents = eligibleStudents.filter((s) =>
    selectedIds.includes(s.id)
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === eligibleStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleStudents.map((s) => s.id));
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  /** Computes the student's actual grades, total, and average to display on certificate */
  const getStudentGradesData = (student: Student) => {
    const state = db.getState();
    const classSubjects = state.subjects
      .filter((s) => s.classId === student.classId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let total = 0;
    let counted = 0;
    const subjectsList: { name: string; score: number | string; maxScore?: number }[] = [];

    classSubjects.forEach((sub) => {
      const key = buildGradeKey(
        student.academicYearId,
        student.classId,
        student.sectionId || '',
        sub.id,
        student.id
      );
      const rec = state.grades[key];
      const score = rec ? (rec.termYearlyScore ?? rec.finalScore) : null;
      if (score !== null && score !== undefined) {
        total += score;
        counted++;
        subjectsList.push({ name: sub.name, score, maxScore: sub.maxScore });
      } else {
        subjectsList.push({ name: sub.name, score: '—', maxScore: sub.maxScore });
      }
    });

    const avg = counted > 0 ? Math.round((total / counted) * 10) / 10 : null;

    return {
      subjects: subjectsList,
      total: counted > 0 ? total : '—',
      average: avg !== null ? `${avg}%` : '—',
      result: student.isGeneralExempt ? 'معفى عام' : 'ناجح بتفوق',
      status: 'متميز',
    };
  };

  /** Waits for DOM paint, web fonts, and container images to be completely ready */
  const waitForContainerReady = async (container: HTMLDivElement) => {
    // 1. Wait for React state change to reflect in DOM
    await new Promise((r) => setTimeout(r, 120));

    // 2. Wait for Arabic web fonts to be completely ready
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('Font loading wait warning:', e);
      }
    }

    // 3. Wait for all <img> elements in the container to load and decode
    const containerImgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      containerImgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          let resolved = false;
          const finish = () => {
            if (!resolved) {
              resolved = true;
              img.removeEventListener('load', finish);
              img.removeEventListener('error', finish);
              if (typeof img.decode === 'function') {
                img.decode().then(resolve).catch(resolve);
              } else {
                resolve();
              }
            }
          };
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
          setTimeout(finish, 1500); // 1.5s safety fallback
        });
      })
    );

    // 4. Final animation frame
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));
  };

  /** Generates high-resolution student certificate canvas matching original template dimensions */
  const renderStudentCanvas = async (student: Student): Promise<HTMLCanvasElement> => {
    setRenderStudent(student);
    const templateConfig = db.getCertificateTemplate();
    const gradesInfo = getStudentGradesData(student);

    // 1. Determine original dimensions from template image if available
    let imgWidth = 1123;
    let imgHeight = 794;
    let bgImg: HTMLImageElement | null = null;

    if (templateConfig.templateImage) {
      try {
        bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = templateConfig.templateImage!;
        });
        if (bgImg.naturalWidth > 0 && bgImg.naturalHeight > 0) {
          imgWidth = bgImg.naturalWidth;
          imgHeight = bgImg.naturalHeight;
        }
      } catch (e) {
        console.warn('Failed to load certificate template image for canvas export:', e);
      }
    }

    // 2. Create high-resolution canvas matching original template dimensions
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('تعذر إنشاء سياق الرسم للشهادة.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 3. Draw background & default classical header (only if no custom template image is uploaded)
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, imgWidth, imgHeight);
    } else {
      const grad = ctx.createLinearGradient(0, 0, imgWidth, imgHeight);
      grad.addColorStop(0, '#faf5eb');
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(1, '#f7f3e8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, imgWidth, imgHeight);

      // Default frame & border
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 18 * (imgWidth / 1123);
      ctx.strokeRect(18, 18, imgWidth - 36, imgHeight - 36);

      // Inner dashed border
      ctx.strokeStyle = 'rgba(197, 160, 89, 0.6)';
      ctx.lineWidth = 2 * (imgWidth / 1123);
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(32, 32, imgWidth - 64, imgHeight - 64);
      ctx.setLineDash([]);

      const scaleForDefault = imgWidth / 1123;

      // Default Classical Header Texts
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // School management sub-heading
      ctx.font = `bold ${14 * scaleForDefault}px Cairo, Tajawal, sans-serif`;
      ctx.fillStyle = '#8c6b2d';
      ctx.fillText(`إدارة ${settings.schoolName || 'المدرسة'}`, imgWidth / 2, 70 * scaleForDefault);

      // School name heading
      ctx.font = `900 ${28 * scaleForDefault}px Cairo, Tajawal, sans-serif`;
      ctx.fillStyle = '#5a421c';
      ctx.fillText(settings.schoolName || 'إعدادية داقوق للبنين', imgWidth / 2, 100 * scaleForDefault);

      // Certificate title badge banner
      ctx.save();
      ctx.fillStyle = 'rgba(197, 160, 89, 0.15)';
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 2 * scaleForDefault;
      const bannerW = 420 * scaleForDefault;
      const bannerH = 55 * scaleForDefault;
      const bannerX = (imgWidth - bannerW) / 2;
      const bannerY = 145 * scaleForDefault;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 4 * scaleForDefault);
      ctx.fill();
      ctx.stroke();

      ctx.font = `900 ${32 * scaleForDefault}px Cairo, Tajawal, sans-serif`;
      ctx.fillStyle = '#8c6b2d';
      ctx.textBaseline = 'middle';
      ctx.fillText('شـهـادة شـكـر وتـقـديـر', imgWidth / 2, bannerY + bannerH / 2);
      ctx.restore();

      // Encouragement subtitle text
      ctx.font = `${13 * scaleForDefault}px Cairo, Tajawal, sans-serif`;
      ctx.fillStyle = '#475569';
      ctx.textBaseline = 'top';
      ctx.fillText('يسر إدارة المدرسة أن تمنح هذه الشهادة تقديراً للجد والاجتهاد والتميز الأكاديمي، متمنين دوام التفوق والنجاح الباهر', imgWidth / 2, 215 * scaleForDefault);
    }

    const scale = imgWidth / 1123;

    // 4. Draw Official Logo
    if (templateConfig.elements.officialLogo.visible && settings.schoolLogo) {
      try {
        const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = settings.schoolLogo!;
        });
        const el = templateConfig.elements.officialLogo;
        const lw = (el.width || 10) * scale * 10;
        const lh = (logoImg.naturalHeight / logoImg.naturalWidth) * lw;
        const lx = (el.x / 100) * imgWidth - lw / 2;
        const ly = (el.y / 100) * imgHeight - lh / 2;
        ctx.drawImage(logoImg, lx, ly, lw, lh);
      } catch (e) {
        // ignore logo load error
      }
    }

    // 5. Draw Kufic Logo
    if (templateConfig.elements.kuficLogo.visible && settings.kuficLogo) {
      try {
        const kuficImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = settings.kuficLogo!;
        });
        const el = templateConfig.elements.kuficLogo;
        const kw = (el.width || 10) * scale * 10;
        const kh = (kuficImg.naturalHeight / kuficImg.naturalWidth) * kw;
        const kx = (el.x / 100) * imgWidth - kw / 2;
        const ky = (el.y / 100) * imgHeight - kh / 2;
        ctx.drawImage(kuficImg, kx, ky, kw, kh);
      } catch (e) {
        // ignore kufic logo load error
      }
    }

    // 6. Draw Student Name
    if (templateConfig.elements.studentName.visible) {
      const el = templateConfig.elements.studentName;
      const fontSize = (el.fontSize || 34) * scale;
      const fontWeight = el.fontWeight === 'black' ? '900' : el.fontWeight === 'bold' ? '700' : '500';
      ctx.font = `${fontWeight} ${fontSize}px Cairo, Tajawal, Amiri, sans-serif`;
      ctx.fillStyle = el.fontColor || '#0f172a';
      ctx.textAlign = el.textAlign || 'center';
      ctx.textBaseline = 'middle';

      const nx = (el.x / 100) * imgWidth;
      const ny = (el.y / 100) * imgHeight;
      ctx.fillText(student.name, nx, ny);
    }

    // 7. Draw Class, Section & Registration Number Badge (Only for default system template)
    if (!bgImg && (classNameStr || sectionNameStr || student.registrationNumber)) {
      const el = templateConfig.elements.studentName;
      const badgeY = Math.min(imgHeight * 0.9, (el.y / 100) * imgHeight + 55 * scale);
      const badgeX = (el.x / 100) * imgWidth;

      const badgeText = `الصف: ${classNameStr || '—'}  •  ${sectionNameStr ? `شعبة ${sectionNameStr}` : 'بدون شعبة'}${student.registrationNumber ? `  •  رقم القيد: ${student.registrationNumber}` : ''}`;
      
      ctx.font = `bold ${13 * scale}px Cairo, Tajawal, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const metrics = ctx.measureText(badgeText);
      const bw = metrics.width + 32 * scale;
      const bh = 28 * scale;

      ctx.save();
      ctx.fillStyle = 'rgba(197, 160, 89, 0.15)';
      ctx.strokeStyle = 'rgba(197, 160, 89, 0.4)';
      ctx.lineWidth = 1 * scale;
      
      const bx = badgeX - bw / 2;
      const by = badgeY - bh / 2;
      const radius = 14 * scale;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.fillText(badgeText, badgeX, badgeY);
      ctx.restore();
    }

    // 8. Draw Grades Banner (Only for default system template)
    if (!bgImg && gradesInfo && gradesInfo.subjects && gradesInfo.subjects.length > 0) {
      const el = templateConfig.elements.studentName;
      const bannerY = Math.min(imgHeight * 0.82, (el.y / 100) * imgHeight + 115 * scale);
      const bannerX = imgWidth / 2;
      const bannerW = imgWidth * 0.86;
      const bannerH = 75 * scale;
      const bx = bannerX - bannerW / 2;
      const by = bannerY - bannerH / 2;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = 'rgba(197, 160, 89, 0.5)';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(bx, by, bannerW, bannerH, 12 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.font = `bold ${11 * scale}px Cairo, Tajawal, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let currX = bx + 20 * scale;
      let currY = by + 22 * scale;
      gradesInfo.subjects.slice(0, 10).forEach((sub) => {
        const itemText = `${sub.name}: ${sub.score}`;
        const itemW = ctx.measureText(itemText).width + 16 * scale;
        if (currX + itemW > bx + bannerW - 20 * scale) {
          currX = bx + 20 * scale;
          currY += 26 * scale;
        }
        ctx.fillStyle = '#faf5eb';
        ctx.strokeStyle = 'rgba(197, 160, 89, 0.3)';
        ctx.beginPath();
        ctx.roundRect(currX, currY - 10 * scale, itemW, 20 * scale, 4 * scale);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.fillText(itemText, currX + itemW / 2, currY);
        currX += itemW + 8 * scale;
      });

      ctx.strokeStyle = 'rgba(197, 160, 89, 0.3)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(bx + 15 * scale, by + bannerH - 24 * scale);
      ctx.lineTo(bx + bannerW - 15 * scale, by + bannerH - 24 * scale);
      ctx.stroke();

      ctx.font = `bold ${12 * scale}px Cairo, Tajawal, sans-serif`;
      ctx.fillStyle = '#334155';
      const botY = by + bannerH - 12 * scale;
      ctx.textAlign = 'right';
      ctx.fillText(`المجموع: ${gradesInfo.total}`, bx + 40 * scale, botY);
      ctx.fillText(`المعدل: ${gradesInfo.average}`, bx + bannerW / 2, botY);
      ctx.textAlign = 'left';
      ctx.fillText(`النتيجة: ${gradesInfo.result}`, bx + bannerW - 40 * scale, botY);

      ctx.restore();
    }

    // 9. Draw Academic Year
    if (templateConfig.elements.academicYear.visible) {
      const el = templateConfig.elements.academicYear;
      const fontSize = (el.fontSize || 16) * scale;
      const fontWeight = el.fontWeight === 'black' ? '900' : el.fontWeight === 'bold' ? '700' : '500';
      ctx.font = `${fontWeight} ${fontSize}px Tajawal, Cairo, sans-serif`;
      ctx.fillStyle = el.fontColor || '#334155';
      ctx.textAlign = el.textAlign || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(academicYearName, (el.x / 100) * imgWidth, (el.y / 100) * imgHeight);
    }

    // 10. Draw Director Name
    if (templateConfig.elements.directorName.visible) {
      const el = templateConfig.elements.directorName;
      const fontSize = (el.fontSize || 18) * scale;
      const fontWeight = el.fontWeight === 'black' ? '900' : el.fontWeight === 'bold' ? '700' : '500';
      ctx.font = `${fontWeight} ${fontSize}px Tajawal, Cairo, sans-serif`;
      ctx.fillStyle = el.fontColor || '#1e293b';
      ctx.textAlign = el.textAlign || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(settings.directorName || 'إدارة المدرسة', (el.x / 100) * imgWidth, (el.y / 100) * imgHeight);
    }

    return canvas;
  };

  /** Execute multi-page PDF generation */
  const handleExportPdf = async () => {
    if (selectedStudents.length === 0) {
      setErrorMessage('يرجى تحديد طالب واحد على الأقل لتصدير شهاداته.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGenerating(true);
    setExportMode('pdf');
    setProgressIndex(0);

    try {
      // 1. Initialize A4 Landscape PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      // 2. Iterate through each selected student, rendering to canvas
      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        setProgressIndex(i + 1);
        setCurrentStudentName(student.name);

        const canvas = await renderStudentCanvas(student);
        const imgData = canvas.toDataURL('image/jpeg', 0.96);

        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
      }

      // 3. Save PDF file
      const cleanName = baseFileName.trim().replace(/\.pdf$/i, '');
      const finalFileName = `${cleanName || 'شهادات_الإعفاء'}.pdf`;
      pdf.save(finalFileName);

      setSuccessMessage(
        `تم بنجاح تصدير ملف PDF موحد بعدد (${selectedStudents.length}) شهادة باسم «${finalFileName}».`
      );
    } catch (err) {
      console.error('PDF Generation failed:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء إنشاء وتصدير ملف PDF.'
      );
    } finally {
      setIsGenerating(false);
      setExportMode(null);
      setRenderStudent(null);
    }
  };

  /** Execute Image export (High-Resolution PNG) */
  const handleExportImages = async () => {
    if (selectedStudents.length === 0) {
      setErrorMessage('يرجى تحديد طالب واحد على الأقل لتصدير شهاداته.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGenerating(true);
    setExportMode('images');
    setProgressIndex(0);

    try {
      if (selectedStudents.length === 1) {
        // Single student: download PNG directly
        const student = selectedStudents[0];
        setProgressIndex(1);
        setCurrentStudentName(student.name);

        const canvas = await renderStudentCanvas(student);
        const pngUrl = canvas.toDataURL('image/png');

        const cleanStudentName = student.name.replace(/[\\/:*?"<>|]/g, '_');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `شهادة_الطالب_${cleanStudentName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSuccessMessage(`تم بنجاح تحميل صورة شهادة الطالب «${student.name}» بدقة عالية (PNG).`);
      } else {
        // Multiple students: package into a ZIP file
        const zip = new JSZip();

        for (let i = 0; i < selectedStudents.length; i++) {
          const student = selectedStudents[i];
          setProgressIndex(i + 1);
          setCurrentStudentName(student.name);

          const canvas = await renderStudentCanvas(student);
          const pngUrl = canvas.toDataURL('image/png');
          const base64Data = pngUrl.replace(/^data:image\/png;base64,/, '');

          const cleanStudentName = `${String(i + 1).padStart(2, '0')}_${student.name.replace(/[\\/:*?"<>|]/g, '_')}`;
          zip.file(`شهادة_${cleanStudentName}.png`, base64Data, { base64: true });
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const cleanName = baseFileName.trim().replace(/\.zip$/i, '');
        const zipFileName = `${cleanName || 'شهادات_الطلبة'}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSuccessMessage(
          `تم بنجاح تصدير (${selectedStudents.length}) صورة شهادة عالية الدقة مضغوطة في ملف «${zipFileName}».`
        );
      }
    } catch (err) {
      console.error('Image Export failed:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء إنشاء وتصدير صور الشهادات.'
      );
    } finally {
      setIsGenerating(false);
      setExportMode(null);
      setRenderStudent(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm select-none"
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Award className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                تصدير شهادات التقدير والإعفاء المدرسي
              </h2>
              <p className="text-xs text-slate-400">
                إنشاء ملفات PDF أو صور عالية الدقة (PNG) متضمنة بيانات الطالب والدرجات والنتيجة
              </p>
            </div>
          </div>

          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-amber-300 font-bold block">
                بيانات التصدير الأكاديمية:
              </span>
              <span className="text-xs text-slate-300">
                {classNameStr} • {sectionNameStr ? `شعبة ${sectionNameStr}` : 'بدون شعبة'} • العام: {academicYearName}
              </span>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-slate-400 block">الشهادات المحددة</span>
              <span className="text-lg font-black font-mono text-amber-400">
                {selectedStudents.length} / {eligibleStudents.length}
              </span>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Notice */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Generation Progress Display */}
          {isGenerating && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>
                    جاري تجهيز وتصيير الشهادة ({progressIndex} من {selectedStudents.length}):
                  </span>
                </div>
                <span className="font-mono text-indigo-400 font-bold">
                  {Math.round((progressIndex / selectedStudents.length) * 100)}%
                </span>
              </div>

              <div className="text-xs text-white font-bold pr-6">
                «{currentStudentName}»
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-200 rounded-full"
                  style={{
                    width: `${(progressIndex / selectedStudents.length) * 100}%`,
                  }}
                />
              </div>

              <span className="text-[11px] text-slate-400 block text-center">
                {exportMode === 'pdf'
                  ? 'يتم دمج الشهادات في ملف PDF واحد عالي الدقة بحجم A4 أفقي...'
                  : 'يتم استخراج صور الشهادات بدقة فائقة وحفظها...'}
              </span>
            </div>
          )}

          {/* File Name Input Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              اسم الملف الأساسي المراد تصديره:
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={isGenerating}
                value={baseFileName}
                onChange={(e) => setBaseFileName(e.target.value)}
                className="w-full h-10 px-3 pr-9 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:border-amber-500 focus:outline-hidden font-mono"
                placeholder="اسم_الملف"
              />
              <FileText className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              سيُضاف الامتداد (.pdf أو .zip) تلقائياً بحسب نوع التصدير المختار.
            </span>
          </div>

          {/* Student Selector List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>اختر الطلاب المراد إنشاء شهادات لهم:</span>
              </label>

              <button
                type="button"
                disabled={isGenerating}
                onClick={toggleSelectAll}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer disabled:opacity-50"
              >
                {selectedIds.length === eligibleStudents.length
                  ? 'إلغاء تحديد الكل'
                  : 'تحديد جميع الطلاب'}
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 divide-y divide-slate-800/60">
              {eligibleStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  لا يوجد طلاب مسجلون في هذا الصف والشعبة حالياً.
                </div>
              ) : (
                eligibleStudents.map((student, idx) => {
                  const isChecked = selectedIds.includes(student.id);

                  return (
                    <label
                      key={student.id}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-slate-800/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={isGenerating}
                          checked={isChecked}
                          onChange={() => toggleStudent(student.id)}
                          className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {idx + 1}. {student.name}
                          </span>
                          {student.registrationNumber && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              رقم القيد: {student.registrationNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {student.isGeneralExempt ? 'معفى عام' : 'مستحق للشهادة'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions: Dual Export Options */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {selectedStudents.length > 0 ? (
              <span>
                المحدد: <strong className="text-white font-bold">{selectedStudents.length}</strong> طالب.
              </span>
            ) : (
              <span className="text-rose-400 font-bold">لم يتم تحديد أي طالب.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isGenerating}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>

            {/* Option B: Export as Images (PNG) */}
            <button
              type="button"
              disabled={isGenerating || selectedStudents.length === 0}
              onClick={handleExportImages}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-50"
              title="تصدير شهادات الطلبة كملفات صور PNG عالية الدقة (في ملف ZIP إذا كانوا متعددين)"
            >
              {isGenerating && exportMode === 'images' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>جاري تصدير الصور...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  <span>تصدير كصور (PNG)</span>
                </>
              )}
            </button>

            {/* Option A: Export as PDF */}
            <button
              type="button"
              disabled={isGenerating || selectedStudents.length === 0}
              onClick={handleExportPdf}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              title="تصدير الشهادات في ملف PDF موحد بحجم A4 أفقي"
            >
              {isGenerating && exportMode === 'pdf' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تصدير كملف PDF ({selectedStudents.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Fixed Off-Screen Render Container for html2canvas (CRITICAL: opacity: 1, visibility: visible) */}
        <div
          ref={hiddenRenderContainerRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '1123px',
            height: '794px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: -99999,
            background: '#ffffff',
            opacity: 1,
            visibility: 'visible',
          }}
        >
          {renderStudent && (
            <CertificateCanvas
              config={db.getCertificateTemplate()}
              settings={settings}
              studentName={renderStudent.name}
              academicYear={academicYearName}
              directorName={settings.directorName || 'إدارة المدرسة'}
              classNameStr={classNameStr}
              sectionNameStr={sectionNameStr}
              registrationNumber={renderStudent.registrationNumber}
              seatNumber={renderStudent.seatNumber}
              gradesData={getStudentGradesData(renderStudent)}
              isForPrint={true}
              fixedScale={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
