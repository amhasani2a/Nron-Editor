const DB_NAME = "NronDB";
const DB_VERSION = 3;
window.db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject(e);
    request.onsuccess = (e) => {
      window.db = e.target.result;
      window.db.onversionchange = () => window.db.close();
      resolve();
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("fonts"))
        db.createObjectStore("fonts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("tabs"))
        db.createObjectStore("tabs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("articles"))
        db.createObjectStore("articles", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings"))
        db.createObjectStore("settings", { keyPath: "key" });
    };
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!window.db) return reject(new Error("پایگاه داده آماده نیست"));
    const tx = window.db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    if (storeName === "tabs" && data._lazy) {
      const request = store.get(data.id);
      request.onsuccess = () => {
        if (!request.result) {
          tx.abort();
          return;
        }
        const { _lazy, ...metadata } = data;
        store.put({ ...request.result, ...metadata });
      };
    } else store.put(data);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("ذخیره لغو شد"));
    tx.onerror = (e) => reject(e);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    if (!window.db) return reject(new Error("پایگاه داده آماده نیست"));
    const tx = window.db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    if (!window.db) return reject(new Error("پایگاه داده آماده نیست"));
    const tx = window.db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!window.db) return reject(new Error("پایگاه داده آماده نیست"));
    const tx = window.db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("ذخیره لغو شد"));
    tx.onerror = () => reject(tx.error);
  });
}

window.dbReady = initDB();

// All-or-nothing restore. Existing records are merged only after validation.
function dbImport(data) {
  return new Promise((resolve, reject) => {
    if (!window.db) return reject(new Error("پایگاه داده آماده نیست"));
    const tx = window.db.transaction(
      ["tabs", "articles", "settings", "fonts"],
      "readwrite",
    );
    for (const name of ["tabs", "articles", "settings", "fonts"])
      for (const row of data[name] || []) tx.objectStore(name).put(row);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("بازیابی لغو شد"));
  });
}

// Cursor projection avoids holding every document body and history in JavaScript.
function dbTabHeaders() {
  return new Promise((resolve, reject) => {
    const result = [];
    const tx = window.db.transaction("tabs", "readonly");
    const request = tx.objectStore("tabs").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const { content, history, ...header } = cursor.value;
      result.push({ ...header, _lazy: true });
      cursor.continue();
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}
