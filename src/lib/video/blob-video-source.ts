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
  const previousPlaybackRate = Number.isFinite(video.playbackRate) && video.playbackRate > 0 ? video.playbackRate : 1;

  const waitForMediaSignal = (timeoutMs: number): Promise<void> => new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const type of events) video.removeEventListener(type, onSignal);
      signal?.removeEventListener('abort', onSignal);
      resolve();
    };
    const onSignal = () => finish();
    const events = ['durationchange', 'timeupdate', 'progress', 'loadeddata', 'canplay', 'seeked', 'ended'] as const;
    const timer = setTimeout(finish, Math.max(1, timeoutMs));
    for (const type of events) video.addEventListener(type, onSignal);
    signal?.addEventListener('abort', onSignal, { once: true });
  });

  try {
    try {
      video.currentTime = 1e9;
    } catch {
      // Some WebM streams reject out-of-range seeks before exposing a finite duration.
    }
    await waitForMediaSignal(2_000);

    if (signal?.aborted) throw cancelled();
    const refined = finiteBounded();
    if (refined !== undefined) return refined;

    const observedTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    if (video.ended && observedTime > 0 && observedTime <= maxDurationSeconds) return observedTime;

    // MediaRecorder-generated WebM can have no finite Duration element and no seekable
    // range. In that case, use a muted, accelerated playback probe. This remains fully
    // local, bounded by maxDurationSeconds, and never exposes the source to a provider.
    const fallbackTimeoutMs = Math.min(
      45_000,
      Math.max(3_000, Math.ceil((maxDurationSeconds * 1_000) / 16) + 2_000),
    );
    video.muted = true;
    video.playbackRate = 16;
    await new Promise<void>((resolve, reject) => {
      if (video.ended) {
        resolve();
        return;
      }
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('error', onError);
        signal?.removeEventListener('abort', onAbort);
      };
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };
      const onEnded = () => finish(resolve);
      const onError = () => finish(() => reject(new Error('VIDEO_MEDIA_EVENT_FAILED')));
      const onAbort = () => finish(() => reject(cancelled()));
      const timer = setTimeout(() => finish(() => reject(new Error('VIDEO_DURATION_PROBE_TIMEOUT'))), fallbackTimeoutMs);
      video.addEventListener('ended', onEnded, { once: true });
      video.addEventListener('error', onError, { once: true });
      signal?.addEventListener('abort', onAbort, { once: true });
      void video.play().catch(() => {
        // The ended/error/timeout guards remain authoritative.
      });
    });

    const fallbackDuration = finiteBounded();
    if (fallbackDuration !== undefined) return fallbackDuration;
    const endedTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    if (video.ended && endedTime > 0 && endedTime <= maxDurationSeconds) return endedTime;
  } finally {
    video.pause();
    video.playbackRate = previousPlaybackRate;
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

  // Detached media elements can stall metadata/decode events in headless Chromium.
  // Canonical callers intentionally create ephemeral video elements; attach those
  // elements to document.body for reliable browser media scheduling, while keeping
  // the original Blob bytes and object URL entirely local to the browser.
  const attachToDocument = typeof document !== 'undefined'
    && Boolean(document.body)
    && !video.isConnected
    && video.parentNode === null;
  if (attachToDocument) document.body!.appendChild(video);

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
      if (attachToDocument) video.remove();
    };

    const abortListener = () => cleanup();
    signal?.addEventListener('abort', abortListener, { once: true });

    try {
      video.src = url;
      video.load();
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
        if (attachToDocument) video.remove();
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
