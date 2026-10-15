export type HubFeatureSnapshot = Readonly<{
  opfs: boolean;
  sharedArrayBuffer: boolean;
  simd: boolean;
  webgpu: boolean;
}>;

const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0,
  1, 4, 1, 96, 0, 0, 3, 2, 1, 0,
  10, 9, 1, 7, 0, 65, 0, 253, 15, 26, 11,
]);

export function detectHubFeatures(): HubFeatureSnapshot {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const storage = nav?.storage as (StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  }) | undefined;

  const simd = (() => {
    try {
      return typeof WebAssembly !== 'undefined' && WebAssembly.validate(SIMD_PROBE);
    } catch {
      return false;
    }
  })();

  return Object.freeze({
    opfs: typeof storage?.getDirectory === 'function',
    sharedArrayBuffer:
      typeof SharedArrayBuffer !== 'undefined'
      && typeof crossOriginIsolated !== 'undefined'
      && crossOriginIsolated === true,
    simd,
    webgpu: typeof (nav as (Navigator & { gpu?: unknown }) | undefined)?.gpu === 'object'
      && (nav as (Navigator & { gpu?: unknown }) | undefined)?.gpu !== null,
  });
}
