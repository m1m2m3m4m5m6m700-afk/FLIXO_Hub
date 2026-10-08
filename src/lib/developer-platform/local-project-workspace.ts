import JSZip from 'jszip';

export type LocalProjectFile = Readonly<{
  path: string;
  file: File | null;
  text: string | null;
  size: number;
  editable: boolean;
  dirty: boolean;
}>;

const MAX_EDITABLE_BYTES = 2 * 1024 * 1024;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._~!$&'()*+,;=@\-\/ ]+$/;

export function normalizeProjectPath(input: string): string {
  const normalized = input.replaceAll('\\', '/').replace(/^\.\//, '').trim();
  if (!normalized || normalized.length > 512 || !SAFE_PATH.test(normalized)) {
    throw new Error('INVALID_PROJECT_PATH');
  }
  return normalized;
}

export function isEditableTextFile(file: File): boolean {
  if (file.size > MAX_EDITABLE_BYTES) return false;
  return !/\.(png|jpe?g|gif|webp|avif|bmp|ico|pdf|zip|gz|7z|rar|mp[34]|mov|avi|mkv|wav|flac|woff2?|ttf|otf|wasm|bin)$/i.test(file.name);
}

export async function readLocalProjectFiles(files: readonly File[]): Promise<LocalProjectFile[]> {
  const entries = await Promise.all(
    files.map(async (file) => {
      const rawPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const path = normalizeProjectPath(rawPath);
      const editable = isEditableTextFile(file);
      return {
        path,
        file,
        text: editable ? await file.text() : null,
        size: file.size,
        editable,
        dirty: false,
      } satisfies LocalProjectFile;
    }),
  );

  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      if (seen.has(entry.path)) return false;
      seen.add(entry.path);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function createLocalProjectFile(path: string, text = ''): LocalProjectFile {
  return {
    path: normalizeProjectPath(path),
    file: null,
    text,
    size: new Blob([text]).size,
    editable: true,
    dirty: true,
  };
}

export async function exportLocalProjectZip(files: readonly LocalProjectFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const entry of files) {
    if (!entry.editable) {
      if (entry.file) zip.file(entry.path, await entry.file.arrayBuffer());
      continue;
    }
    zip.file(entry.path, entry.text ?? '');
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const LOCAL_PROJECT_LIMITS = Object.freeze({
  maxEditableBytes: MAX_EDITABLE_BYTES,
  persistence: 'MEMORY_ONLY',
  network: 'NONE',
} as const);
