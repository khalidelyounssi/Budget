const DB_NAME = "BudgetManagerDB";
const DB_VERSION = 2;
const PROJECT_STORE = "projects";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "app-settings";

let databasePromise = null;

// Open the browser database and create stores the first time.
export function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }

      if (database.objectStoreNames.contains("notes")) {
        database.deleteObjectStore("notes");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed."));
  });

  return databasePromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
  });
}

export async function getAllProjects() {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STORE, "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore(PROJECT_STORE).getAll();
  const projects = await requestToPromise(request);
  await done;
  return Array.isArray(projects) ? projects : [];
}

export async function getProjectById(id) {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STORE, "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore(PROJECT_STORE).get(id);
  const project = await requestToPromise(request);
  await done;
  return project || null;
}

export async function saveProject(project) {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(PROJECT_STORE).put(project);
  await done;
}

export async function updateProject(project) {
  await saveProject(project);
}

export async function deleteProject(id) {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(PROJECT_STORE).delete(id);
  await done;
}

export async function clearAllProjects() {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(PROJECT_STORE).clear();
  await done;
}

export async function getSettings() {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
  const settings = await requestToPromise(request);
  await done;
  return settings || null;
}

export async function saveSettings(settings) {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(SETTINGS_STORE).put({ ...settings, id: SETTINGS_KEY });
  await done;
}
