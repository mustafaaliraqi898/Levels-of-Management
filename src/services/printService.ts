import { PrinterDevice, PrintDocumentOptions, SavePdfOptions } from '../types';

export interface PrintExecutionOptions {
  landscape?: boolean;
  silent?: boolean;
  deviceName?: string;
  element?: HTMLElement | null;
  pageSize?: 'A4' | 'Letter';
  copies?: number;
}

export interface PdfExportOptions {
  title: string;
  landscape?: boolean;
  element?: HTMLElement | null;
  pageSize?: 'A4' | 'Letter';
}

/**
 * Checks if running inside the Electron desktop application
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.print);
}

/**
 * Ensures all Arabic web fonts (Cairo, Tajawal, Amiri) and all image assets
 * (school logos, stamps) are fully loaded and rasterized in the DOM before printing.
 */
export async function waitForFontsAndImages(containerEl?: HTMLElement | null): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Wait for web fonts readiness
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Waiting for document.fonts.ready encountered an error:', e);
    }
  }

  // 2. Wait for all target images to complete and decode
  const root = containerEl || document.body;
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));

  if (images.length > 0) {
    const imgPromises = images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        if ('decode' in img && typeof img.decode === 'function') {
          return img.decode().catch(() => {});
        }
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const cleanUp = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
          resolve();
        };
        const onLoad = () => cleanUp();
        const onError = () => cleanUp();

        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onError, { once: true });

        // Fallback timeout in case image fails to trigger events
        setTimeout(cleanUp, 1500);
      });
    });

    await Promise.all(imgPromises);
  }

  // 3. Stabilization tick for CSS layout reflow
  await new Promise((resolve) => setTimeout(resolve, 80));
}

/**
 * Dynamically updates the @page CSS rule and body class to match target orientation
 */
export function applyPrintPageOrientation(landscape: boolean): void {
  if (typeof document === 'undefined') return;

  const styleId = 'dynamic-print-page-orientation-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const orientation = landscape ? 'landscape' : 'portrait';
  styleEl.textContent = `
    @media print {
      @page {
        size: A4 ${orientation} !important;
        margin: 8mm !important;
      }
    }
  `;

  if (landscape) {
    document.body.classList.add('print-landscape');
    document.body.classList.remove('print-portrait');
  } else {
    document.body.classList.add('print-portrait');
    document.body.classList.remove('print-landscape');
  }
}

/**
 * Retrieves the real list of printers installed on the system
 */
export async function getInstalledPrinters(): Promise<PrinterDevice[]> {
  if (isElectron()) {
    try {
      const printers = await window.electronAPI!.print.getPrinters();
      return printers || [];
    } catch (err) {
      console.error('Failed to get system printers from Electron:', err);
      return [];
    }
  }

  // Fallback for browser testing
  return [];
}

/**
 * Serializes an isolated HTMLElement into a standalone, full-fledged HTML document
 * containing all stylesheets, Google fonts, exact print CSS, and RTL attributes.
 */
export function buildIsolatedReportHtml(element: HTMLElement, landscape: boolean): string {
  if (typeof document === 'undefined') return '';

  // 1. Gather all existing <style> and <link rel="stylesheet"> elements
  const headElements: string[] = [];

  // Explicitly ensure Arabic typography links are included
  headElements.push(`
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  `);

  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    headElements.push(node.outerHTML);
  });

  const orientation = landscape ? 'landscape' : 'portrait';

  // 2. Clone the report element and strip preview-specific scaling & shadows
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.webkitTransform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.margin = '0 auto';
  clone.classList.remove('shadow-[0_20px_50px_rgba(0,0,0,0.6)]', 'border', 'border-slate-300');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير مدرسي</title>
  ${headElements.join('\n')}
  <style>
    @page {
      size: A4 ${orientation} !important;
      margin: 8mm !important;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      direction: rtl !important;
      font-family: 'Cairo', 'Tajawal', 'Amiri', system-ui, -apple-system, sans-serif !important;
      width: 100% !important;
      min-height: 100% !important;
      overflow: visible !important;
    }
    .print-isolated-sheet {
      width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      box-shadow: none !important;
      border: none !important;
      transform: none !important;
    }
    .print-isolated-sheet * {
      transform: none !important;
    }
    .no-print, .no-print * {
      display: none !important;
    }
  </style>
</head>
<body class="print-${orientation}">
  <div class="print-isolated-sheet">
    ${clone.outerHTML}
  </div>
</body>
</html>`;
}

/**
 * Prints HTML content via a hidden iframe (used as browser fallback outside Electron)
 */
export async function printViaHiddenIframe(html: string): Promise<{ success: boolean; error?: string }> {
  if (typeof document === 'undefined') return { success: false, error: 'Document not available' };

  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      iframe.setAttribute('aria-hidden', 'true');

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!iframeDoc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        window.print();
        resolve({ success: true });
        return;
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve({ success: true });
        } catch (e: any) {
          console.error('Hidden iframe print error:', e);
          resolve({ success: false, error: e.message || 'فشلت الطباعة عبر الإطار المخفي' });
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      };

      if (iframe.contentWindow?.document.readyState === 'complete') {
        setTimeout(triggerPrint, 250);
      } else {
        iframe.onload = () => setTimeout(triggerPrint, 250);
      }
    } catch (err: any) {
      console.error('Failed to create hidden print iframe:', err);
      window.print();
      resolve({ success: true });
    }
  });
}

/**
 * Unified printing pipeline:
 * Handles font pre-loading, orientation injection, exact color preservation,
 * and delegates to Electron IPC or Browser fallback with isolated report content.
 */
export async function executePrint(
  options: PrintExecutionOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const landscape = options.landscape !== false;

  // 1. Ensure fonts & images are ready
  await waitForFontsAndImages(options.element);

  // 2. Set dynamic orientation
  applyPrintPageOrientation(landscape);

  // 3. Build isolated HTML representation if element is provided
  const isolatedHtml = options.element ? buildIsolatedReportHtml(options.element, landscape) : undefined;

  // 4. Electron IPC Printing
  if (isElectron()) {
    try {
      const result = await window.electronAPI!.print.printDocument({
        silent: options.silent || false,
        deviceName: options.deviceName || '',
        landscape,
        printBackground: true,
        pageSize: options.pageSize || 'A4',
        copies: options.copies || 1,
        margins: {
          marginType: 'printableArea',
        },
        html: isolatedHtml,
      });

      return result;
    } catch (err: any) {
      console.error('Electron printDocument failed:', err);
      return { success: false, error: err.message || 'فشلت عملية الطباعة' };
    }
  }

  // 5. Browser fallback: print isolated content in hidden iframe
  if (isolatedHtml) {
    return await printViaHiddenIframe(isolatedHtml);
  }

  try {
    window.focus();
    window.print();
    return { success: true };
  } catch (err: any) {
    console.error('Browser window.print failed:', err);
    return { success: false, error: err.message || 'فشلت عملية الطباعة في المتصفح' };
  }
}

/**
 * Unified PDF generation and saving pipeline:
 * In Electron, generates a crisp PDF with exact backgrounds and prompts native save dialog.
 */
export async function exportToPdf(
  options: PdfExportOptions
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
  const landscape = options.landscape !== false;

  // 1. Ensure fonts & images are ready
  await waitForFontsAndImages(options.element);

  // 2. Apply page orientation
  applyPrintPageOrientation(landscape);

  // 3. Build isolated HTML representation if element is provided
  const isolatedHtml = options.element ? buildIsolatedReportHtml(options.element, landscape) : undefined;

  // 4. Electron IPC PDF Save
  if (isElectron()) {
    try {
      const safeTitle = options.title.replace(/[\\/:*?"<>|]/g, '_').trim();
      const result = await window.electronAPI!.print.savePdf({
        title: safeTitle,
        landscape,
        printBackground: true,
        pageSize: options.pageSize || 'A4',
        html: isolatedHtml,
      });

      return result;
    } catch (err: any) {
      console.error('Electron savePdf failed:', err);
      return { success: false, error: err.message || 'فشل تصدير ملف PDF' };
    }
  }

  // 5. Browser fallback: if isolated HTML is present, trigger print via hidden iframe
  if (isolatedHtml) {
    await printViaHiddenIframe(isolatedHtml);
    return {
      success: true,
      error: 'يرجى اختيار «حفظ كملف PDF» أو «Save as PDF» من وجهة الطباعة في المتصفح.',
    };
  }

  try {
    window.focus();
    window.print();
    return {
      success: true,
      error: 'يرجى اختيار «حفظ كملف PDF» أو «Save as PDF» من وجهة الطباعة في المتصفح.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر تشغيل أمر الطباعة في المتصفح' };
  }
}
