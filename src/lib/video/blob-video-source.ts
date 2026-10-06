export type VideoSourceCleanup = () => void;

type MediaSourceCtor = typeof MediaSource;

function cancelled(): Error {
  return typeof DOMException === 'function'
    ? new DOMException('Video media source attachment aborted.', 'AbortError')
    : new Error('Video media source attachment aborted.');
}

function supportsMediaSource(mime: string): boolean {
  const ctor = globalThis.MediaSource as MediaSourceCtor | undefined;
  return Boolean(
    ctor
    && typeof ctor.isTypeSupported === 'function'
    && ctor.isTypeSupported(mime || 'video/webm'),
  );
}

async function appendBlobToSourceBuffer(
  sourceBuffer: SourceBuffer,
  blob: Blob,
  signal?: AbortSignal,
): Promise<void> {
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    if (signal?.aborted) throw cancelled();
    const bytes = await blob.slice(offset, Math.min(blob.size, offset + chunkSize)).arrayBuffer();
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        cleanup();
        reject(cancelled());
      };
      const onUpdateEnd = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('VIDEO_MEDIA_SOURCE_APPEND_FAILED'));
      };
      const cleanup = () => {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        signal?.removeEventListener('abort', onAbort);
      };
      sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true });
      sourceBuffer.addEventListener('error', onError, { once: true });
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        sourceBuffer.appendBuffer(bytes);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('VIDEO_MEDIA_SOURCE_APPEND_FAILED'));
      }
    });
  }
}

export async function attachVideoBlobSource(
  video: HTMLVideoElement,
  blob: Blob,
  signal?: AbortSignal,
): Promise<VideoSourceCleanup> {
  if (!blob.size) throw new Error('VIDEO_INPUT_EMPTY');
  if (signal?.aborted) throw cancelled();

  const mime = blob.type || 'video/webm';
  const MediaSourceClass = globalThis.MediaSource as MediaSourceCtor | undefined;

  if (MediaSourceClass && supportsMediaSource(mime)) {
    const mediaSource = new MediaSourceClass();
    let closed = false;
    function cleanup() {
      if (closed) return;
      closed = true;
      signal?.removeEventListener('abort', abortListener);
      video.srcObject = null;
      if (mediaSource.readyState === 'open') {
        try { mediaSource.endOfStream(); } catch { /* source may already be closing */ }
      }
    }
    const abortListener = () => cleanup();
    signal?.addEventListener('abort', abortListener, { once: true });
    video.srcObject = mediaSource;

    try {
      await new Promise<void>((resolve, reject) => {
        const onSourceOpen = async () => {
          mediaSource.removeEventListener('sourceopen', onSourceOpen);
          try {
            if (signal?.aborted) throw cancelled();
            const sourceBuffer = mediaSource.addSourceBuffer(mime);
            await appendBlobToSourceBuffer(sourceBuffer, blob, signal);
            if (mediaSource.readyState === 'open') mediaSource.endOfStream();
            resolve();
          } catch (error) {
            reject(error instanceof Error ? error : new Error('VIDEO_MEDIA_SOURCE_FAILED'));
          }
        };
        const onSourceEnded = () => {
          mediaSource.removeEventListener('sourceopen', onSourceOpen);
          reject(new Error('VIDEO_MEDIA_SOURCE_CLOSED'));
        };
        mediaSource.addEventListener('sourceopen', onSourceOpen, { once: true });
        mediaSource.addEventListener('sourceended', onSourceEnded, { once: true });
        if (mediaSource.readyState === 'open') void onSourceOpen();
      });
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  if ('srcObject' in video) {
    video.srcObject = blob;
    return () => {
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    };
  }

  throw new Error('VIDEO_MEDIA_SOURCE_UNAVAILABLE');
}
