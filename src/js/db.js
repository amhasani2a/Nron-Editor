const DB_NAME = 'NronDB';
const DB_VERSION = 2;
window.db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject(e);
    request.onsuccess = (e) => { window.db = e.target.result; resolve(); };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tabs')) db.createObjectStore('tabs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('articles')) db.createObjectStore('articles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!window.db) return resolve();
    const tx = window.db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve) => {
    if (!window.db) return resolve([]);
    const tx = window.db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve) => {
    if (!window.db) return resolve(null);
    const tx = window.db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve) => {
    if (!window.db) return resolve();
    const tx = window.db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

window.dbReady = initDB();
