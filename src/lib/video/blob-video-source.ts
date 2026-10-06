export type VideoSourceCleanup = () => void;

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
