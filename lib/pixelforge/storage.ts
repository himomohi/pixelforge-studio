import type { Project } from "./types";

export type ProjectRecord = { key: string; project: Project; updatedAt: number };
export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>;
  load(key: string): Promise<ProjectRecord | null>;
  save(key: string, project: Project): Promise<ProjectRecord>;
  delete(key: string): Promise<void>;
}

const DB_NAME = "pixelforge-projects";
const STORE = "projects";
const ACTIVE_KEY = "pixelforge-active-project";
const memory = new Map<string, ProjectRecord>();
const isBrowser = () => typeof window !== "undefined";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function db(): Promise<IDBDatabase> {
  if (!isBrowser() || !window.indexedDB) return Promise.reject(new Error("IndexedDB unavailable"));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open project database"));
  });
}
async function idb<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = operation(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error("Project database operation failed"));
  });
}
function fallback(): ProjectRepository {
  return { list: async () => [...memory.values()].map(clone), load: async k => clone(memory.get(k) ?? null),
    save: async (key, project) => { const record = { key, project: clone(project), updatedAt: Date.now() }; memory.set(key, record); return clone(record); },
    delete: async key => { memory.delete(key); } };
}
export function createProjectRepository(): ProjectRepository {
  const local = fallback();
  return {
    async list() { try { return (await idb<ProjectRecord[]>("readonly", s => s.getAll())).map(clone); } catch { return local.list(); } },
    async load(key) { try { return clone((await idb<ProjectRecord | undefined>("readonly", s => s.get(key))) ?? null); } catch { return local.load(key); } },
    async save(key, project) { const record = { key, project: clone(project), updatedAt: Date.now() }; try { await idb("readwrite", s => s.put(record)); return clone(record); } catch (error) { try { return await local.save(key, project); } catch { throw new Error(`Could not save project: ${error instanceof Error ? error.message : "storage quota exceeded"}`); } } },
    async delete(key) { try { await idb("readwrite", s => s.delete(key)); } catch { await local.delete(key); } },
  };
}
export function getActiveProjectKey(): string | null { try { return isBrowser() ? window.localStorage.getItem(ACTIVE_KEY) : null; } catch { return null; } }
export function setActiveProjectKey(key: string | null): void { try { if (!isBrowser()) return; if (key === null) window.localStorage.removeItem(ACTIVE_KEY); else window.localStorage.setItem(ACTIVE_KEY, key); } catch { /* private mode */ } }
