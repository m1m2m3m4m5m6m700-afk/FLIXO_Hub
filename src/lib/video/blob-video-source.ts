export type VideoSourceCleanup = () => void;

export async function getBoundedVideoDuration(
  video: HTMLVideoElement,
  maxDurationSeconds: number,
  signal?: AbortSignal,
): Promise<number> {
  const finiteBounded = (): number | undefined => {
    const metadataDuration = video.duration;
    if (Number.isFinite(metadataDuration) && metadataDuration > 0 && metadataDuration <= maxDurationSeconds) {
      return metadataDuration;
    }
    const ranges = video.buffered.length > 0 ? video.buffered : video.seekable;
    if (ranges.length > 0) {
      const end = ranges.end(ranges.length - 1);
      if (Number.isFinite(end) && end > 0 && end <= maxDurationSeconds) return end;
    }
    return undefined;
  };

  const direct = finiteBounded();
  if (direct !== undefined) return direct;
  if (signal?.aborted) throw cancelled();

  const previousTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    video.removeEventListener('durationchange', onSignal);
    video.removeEventListener('timeupdate', onSignal);
    video.removeEventListener('progress', onSignal);
    signal?.removeEventListener('abort', onAbort);
  };
  let wake: (() => void) | null = null;
  const onSignal = () => wake?.();
  const onAbort = () => wake?.();
  const waitForProbe = new Promise<void>((resolve) => { wake = resolve; });

  video.addEventListener('durationchange', onSignal);
  video.addEventListener('timeupdate', onSignal);
  video.addEventListener('progress', onSignal);
  signal?.addEventListener('abort', onAbort, { once: true });
  timer = setTimeout(() => wake?.(), 2_000);

  try {
    try {
      video.currentTime = 1e9;
    } catch {
      // The browser can reject an out-of-range seek before exposing final WebM duration.
    }
    await waitForProbe;
    if (signal?.aborted) throw cancelled();
    const refined = finiteBounded();
    if (refined !== undefined) return refined;
  } finally {
    cleanup();
    try {
      video.currentTime = previousTime;
    } catch {
      // Ignore restoration failures during terminal cleanup.
    }
  }

  throw new Error('VIDEO_DURATION_BOUNDARY_INVALID');
}

function cancelled(): Error {
  return typeof DOMException === 'function'
    ? new DOMException('Video media source attachment aborted.', 'AbortError')
    : new Error('Video media source attachment aborted.');
}

/**
 * Attach a local Blob/File to a video element without any network request.
 *
 * Blob URLs are deliberately preferred over MediaSource here. A recorded WebM/Blob
 * is already a complete browser-readable media resource; feeding the complete file
 * through SourceBuffer introduces an unnecessary MSE compatibility boundary.
 * The URL is always revoked by the returned cleanup function.
 */
export async function attachVideoBlobSource(
  video: HTMLVideoElement,
  blob: Blob,
  signal?: AbortSignal,
): Promise<VideoSourceCleanup> {
  if (!blob.size) throw new Error('VIDEO_INPUT_EMPTY');
  if (signal?.aborted) throw cancelled();

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      signal?.removeEventListener('abort', abortListener);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    const abortListener = () => cleanup();
    signal?.addEventListener('abort', abortListener, { once: true });

    try {
      video.src = url;
      return cleanup;
    } catch (error) {
      cleanup();
      throw error instanceof Error ? error : new Error('VIDEO_BLOB_SOURCE_ATTACH_FAILED');
    }
  }

  if ('srcObject' in video) {
    try {
      video.srcObject = blob;
      const cleanup = () => {
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      };
      signal?.addEventListener('abort', cleanup, { once: true });
      return cleanup;
    } catch (error) {
      video.srcObject = null;
      throw error instanceof Error ? error : new Error('VIDEO_BLOB_SOURCE_ATTACH_FAILED');
    }
  }

  throw new Error('VIDEO_BLOB_SOURCE_UNAVAILABLE');
}
