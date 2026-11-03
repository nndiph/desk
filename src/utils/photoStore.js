// The viewer's own photos, kept in this browser's IndexedDB (localStorage is far
// too small for images). Records: { slot, blob | null, caption }. Every call
// resolves even when IndexedDB is unavailable — the wall then just won't remember.

const DB_NAME = 'cozy-desk';
const STORE = 'photos';

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'slot' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(mode, action) {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, mode);
          const request = action(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(request?.result ?? null);
          tx.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

export const loadPhotos = () => run('readonly', (store) => store.getAll()).then((rows) => rows ?? []);
export const savePhoto = (record) => run('readwrite', (store) => store.put(record));

/** Shrink a picked image file to a sensible size; returns { blob, canvas }. */
export async function importImage(file, maxSide = 1400) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  return { blob, canvas };
}
