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
 * Unified printing pipeline:
 * Handles font pre-loading, orientation injection, exact color preservation,
 * and delegates to Electron IPC or Browser fallback.
 */
export async function executePrint(
  options: PrintExecutionOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const landscape = options.landscape !== false;

  // 1. Ensure fonts & images are ready
  await waitForFontsAndImages(options.element);

  // 2. Set dynamic orientation
  applyPrintPageOrientation(landscape);

  // 3. Electron IPC Printing
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
      });

      return result;
    } catch (err: any) {
      console.error('Electron printDocument failed:', err);
      return { success: false, error: err.message || 'فشلت عملية الطباعة' };
    }
  }

  // 4. Browser fallback
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

  // 3. Electron IPC PDF Save
  if (isElectron()) {
    try {
      const safeTitle = options.title.replace(/[\\/:*?"<>|]/g, '_').trim();
      const result = await window.electronAPI!.print.savePdf({
        title: safeTitle,
        landscape,
        printBackground: true,
        pageSize: options.pageSize || 'A4',
      });

      return result;
    } catch (err: any) {
      console.error('Electron savePdf failed:', err);
      return { success: false, error: err.message || 'فشل تصدير ملف PDF' };
    }
  }

  // 4. Browser fallback: trigger print dialog where user selects "Save as PDF"
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
