import type { PixelProject } from "./types";

export type ProjectRecord = {
  key: string;
  project: PixelProject;
  updatedAt: number;
};

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>;
  load(key: string): Promise<ProjectRecord | null>;
  save(key: string, project: PixelProject): Promise<ProjectRecord>;
  delete(key: string): Promise<void>;
}

const DB_NAME = "pixelforge-projects";
const STORE = "projects";
const ACTIVE_KEY = "pixelforge-active-project";
const FALLBACK_PREFIX = "pixelforge-project:";
const memory = new Map<string, ProjectRecord>();
const isBrowser = () => typeof window !== "undefined";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isBrowser() || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open project database"));
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () =>
      reject(request.error ?? new Error("Project database operation failed"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

function fallbackKey(key: string): string {
  return FALLBACK_PREFIX + key;
}

function readFallback(key: string): ProjectRecord | null {
  const fromMemory = memory.get(key);
  if (fromMemory) return clone(fromMemory);
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(fallbackKey(key));
    if (!raw) return null;
    const record = JSON.parse(raw) as ProjectRecord;
    memory.set(key, record);
    return clone(record);
  } catch {
    return null;
  }
}

function fallbackRepository(): ProjectRepository {
  return {
    async list() {
      const records = new Map(memory);
      if (isBrowser()) {
        try {
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const storageKey = window.localStorage.key(index);
            if (!storageKey?.startsWith(FALLBACK_PREFIX)) continue;
            const key = storageKey.slice(FALLBACK_PREFIX.length);
            const record = readFallback(key);
            if (record) records.set(key, record);
          }
        } catch {
          // Storage enumeration can be blocked in private browser modes.
        }
      }
      return [...records.values()]
        .map(clone)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    },
    async load(key) {
      return readFallback(key);
    },
    async save(key, project) {
      const record: ProjectRecord = {
        key,
        project: clone(project),
        updatedAt: Date.now(),
      };
      memory.set(key, record);
      if (isBrowser()) {
        try {
          const serialized = JSON.stringify(record);
          if (serialized.length < 4_500_000) {
            window.localStorage.setItem(fallbackKey(key), serialized);
          }
        } catch {
          // In-memory persistence remains available for this session.
        }
      }
      return clone(record);
    },
    async delete(key) {
      memory.delete(key);
      if (isBrowser()) {
        try {
          window.localStorage.removeItem(fallbackKey(key));
        } catch {
          // Nothing else to clean up.
        }
      }
    },
  };
}

export function createProjectRepository(): ProjectRepository {
  const local = fallbackRepository();
  return {
    async list() {
      try {
        const records = await runRequest<ProjectRecord[]>("readonly", (store) =>
          store.getAll(),
        );
        return records.map(clone).sort((left, right) => right.updatedAt - left.updatedAt);
      } catch {
        return local.list();
      }
    },
    async load(key) {
      try {
        const record = await runRequest<ProjectRecord | undefined>(
          "readonly",
          (store) => store.get(key),
        );
        return clone(record ?? null);
      } catch {
        return local.load(key);
      }
    },
    async save(key, project) {
      const record: ProjectRecord = {
        key,
        project: clone(project),
        updatedAt: Date.now(),
      };
      try {
        await runRequest("readwrite", (store) => store.put(record));
        return clone(record);
      } catch (error) {
        try {
          return await local.save(key, project);
        } catch {
          const detail =
            error instanceof Error ? error.message : "storage quota exceeded";
          throw new Error("Could not save project: " + detail);
        }
      }
    },
    async delete(key) {
      try {
        await runRequest("readwrite", (store) => store.delete(key));
      } catch {
        await local.delete(key);
      }
    },
  };
}

export function getActiveProjectKey(): string | null {
  try {
    return isBrowser() ? window.localStorage.getItem(ACTIVE_KEY) : null;
  } catch {
    return null;
  }
}

export function setActiveProjectKey(key: string | null): void {
  try {
    if (!isBrowser()) return;
    if (key === null) window.localStorage.removeItem(ACTIVE_KEY);
    else window.localStorage.setItem(ACTIVE_KEY, key);
  } catch {
    // Active-project hints are optional in restricted browser modes.
  }
}
