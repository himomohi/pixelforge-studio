export type ReferenceAssetRecord = {
  id: string;
  blob: Blob;
  createdAt: number;
};

export interface ReferenceAssetRepository {
  load(id: string): Promise<ReferenceAssetRecord | null>;
  save(record: ReferenceAssetRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

const DB_NAME = "pixelforge-reference-assets";
const STORE = "assets";
const memory = new Map<string, ReferenceAssetRecord>();

function cloneRecord(
  record: ReferenceAssetRecord | null | undefined,
): ReferenceAssetRecord | null {
  if (!record) return null;
  return {
    id: record.id,
    blob: record.blob.slice(0, record.blob.size, record.blob.type),
    createdAt: record.createdAt,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open reference storage"));
  });
}

async function request<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const pending = operation(transaction.objectStore(STORE));
    pending.onsuccess = () => resolve(pending.result as T);
    pending.onerror = () =>
      reject(pending.error ?? new Error("Reference storage request failed"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export function createReferenceAssetRepository(): ReferenceAssetRepository {
  return {
    async load(id) {
      try {
        const stored = await request<ReferenceAssetRecord | undefined>(
          "readonly",
          (store) => store.get(id),
        );
        const record = cloneRecord(stored);
        if (record) memory.set(id, record);
        return record;
      } catch {
        return cloneRecord(memory.get(id));
      }
    },
    async save(record) {
      const copy = cloneRecord(record);
      if (!copy) return;
      memory.set(copy.id, copy);
      try {
        await request("readwrite", (store) => store.put(copy));
      } catch {
        // The in-memory copy remains available for this browser session.
      }
    },
    async delete(id) {
      memory.delete(id);
      try {
        await request("readwrite", (store) => store.delete(id));
      } catch {
        // The asset is already unavailable in this browser session.
      }
    },
  };
}
