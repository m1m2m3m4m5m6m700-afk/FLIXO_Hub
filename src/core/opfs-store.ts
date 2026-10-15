export type HubStoredBinary =
  | Readonly<{ mode: 'opfs'; name: string }>
  | Readonly<{ mode: 'memory'; blob: Blob }>;

export interface HubBinaryStore {
  write(name: string, data: Blob): Promise<HubStoredBinary>;
  read(name: string): Promise<Blob | null>;
  remove(name: string): Promise<void>;
}

const memoryFiles = new Map<string, Blob>();
let rootPromise: Promise<FileSystemDirectoryHandle | null> | null = null;

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (rootPromise) return rootPromise;
  rootPromise = (async () => {
    if (typeof navigator === 'undefined') return null;
    const storage = navigator.storage as StorageManager & {
      getDirectory?: () => Promise<FileSystemDirectoryHandle>;
    };
    if (typeof storage.getDirectory !== 'function') return null;
    try {
      return await storage.getDirectory();
    } catch {
      return null;
    }
  })();
  return rootPromise;
}

function assertSafeName(name: string): string {
  const normalized = name.trim();
  if (!normalized || normalized === '.' || normalized === '..' || /[\\/]/u.test(normalized)) {
    throw new Error('Invalid local storage file name.');
  }
  return normalized;
}

class DefaultHubBinaryStore implements HubBinaryStore {
  async write(name: string, data: Blob): Promise<HubStoredBinary> {
    const safeName = assertSafeName(name);
    const root = await getOpfsRoot();
    if (!root) {
      memoryFiles.set(safeName, data);
      return { mode: 'memory', blob: data };
    }

    const handle = await root.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(data);
    } finally {
      await writable.close();
    }
    return { mode: 'opfs', name: safeName };
  }

  async read(name: string): Promise<Blob | null> {
    const safeName = assertSafeName(name);
    const root = await getOpfsRoot();
    if (!root) return memoryFiles.get(safeName) ?? null;
    try {
      const handle = await root.getFileHandle(safeName);
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  async remove(name: string): Promise<void> {
    const safeName = assertSafeName(name);
    const root = await getOpfsRoot();
    if (!root) {
      memoryFiles.delete(safeName);
      return;
    }
    try {
      await root.removeEntry(safeName);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return;
      throw error;
    }
  }
}

export const hubBinaryStore: HubBinaryStore = new DefaultHubBinaryStore();
