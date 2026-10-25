/**
 * IndexedDB storage utility for large, high-resolution certificate template background images.
 * Prevents localStorage QuotaExceededError while retaining 100% lossless image data.
 */

const DB_NAME = 'school_grades_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'certificate_images';
const TEMPLATE_KEY = 'current_template_image';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveTemplateImageToDB(dataUrl: string | undefined): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    if (dataUrl) {
      store.put(dataUrl, TEMPLATE_KEY);
    } else {
      store.delete(TEMPLATE_KEY);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveTemplateImage failed:', err);
  }
}

export async function loadTemplateImageFromDB(): Promise<string | undefined> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(TEMPLATE_KEY);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        resolve(request.result as string | undefined);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB loadTemplateImage failed:', err);
    return undefined;
  }
}
