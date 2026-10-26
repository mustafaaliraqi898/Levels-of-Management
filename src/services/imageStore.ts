/**
 * Image storage utility.
 * In Electron, it coordinates with SQLite to store large image assets.
 * In Web, it acts as a no-op or uses a memory cache (legacy support).
 */

let memoryCache: string | undefined = undefined;

export async function saveTemplateImageToDB(dataUrl: string | undefined): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    // In Electron, we don't save separately here anymore.
    // The main storage engine handles saving config + image together in SQLite.
    memoryCache = dataUrl;
    return;
  }
  
  // Fallback for web (if ever used)
  memoryCache = dataUrl;
}

export async function loadTemplateImageFromDB(): Promise<string | undefined> {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    // This is primarily handled during initial load in storage.ts
    return memoryCache;
  }
  return memoryCache;
}

export function setMemoryCache(dataUrl: string | undefined) {
  memoryCache = dataUrl;
}
