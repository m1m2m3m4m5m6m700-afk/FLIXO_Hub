import { renderVideoToWebm } from './video-executor';
import { VIDEO_LIMITS } from './video-safety';

export type CapabilityParameters = Record<string, string | number | boolean>;
export type VideoToolExecutor = (inputBlob: Blob, parameters: CapabilityParameters, tool: { id: string }, signal?: AbortSignal) => Promise<Blob>;

function finite(value: unknown, name: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number.`);
  return n;
}

function integer(value: unknown, name: string, min: number, max: number): number {
  const n = finite(value, name);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return n;
}

function optionalTrim(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  return finite(value, name);
}

export const VIDEO_EXECUTORS: Readonly<Record<string, VideoToolExecutor>> = Object.freeze({
  'video-trimmer': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    startSec: optionalTrim(parameters.startSec, 'Trim start'),
    endSec: optionalTrim(parameters.endSec, 'Trim end'),
    signal,
  }),
  'video-cropper': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    crop: {
      x: integer(parameters.x ?? 0, 'Crop X', 0, VIDEO_LIMITS.maxWidth - 1),
      y: integer(parameters.y ?? 0, 'Crop Y', 0, VIDEO_LIMITS.maxHeight - 1),
      width: integer(parameters.width, 'Crop width', 1, VIDEO_LIMITS.maxWidth),
      height: integer(parameters.height, 'Crop height', 1, VIDEO_LIMITS.maxHeight),
    },
    signal,
  }),
  'video-resizer': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    width: integer(parameters.width, 'Output width', 1, VIDEO_LIMITS.maxWidth),
    height: integer(parameters.height, 'Output height', 1, VIDEO_LIMITS.maxHeight),
    fps: parameters.fps === undefined ? 30 : finite(parameters.fps, 'FPS'),
    signal,
  }),
  'video-compressor': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    videoBitsPerSecond: parameters.videoBitsPerSecond === undefined ? 2_500_000 : integer(parameters.videoBitsPerSecond, 'Video bitrate', 100_000, 50_000_000),
    audioBitsPerSecond: parameters.audioBitsPerSecond === undefined ? 128_000 : integer(parameters.audioBitsPerSecond, 'Audio bitrate', 8_000, 512_000),
    signal,
  }),
});

export function getVideoToolExecutor(tool: { id: string }): VideoToolExecutor | undefined {
  return VIDEO_EXECUTORS[tool.id];
}
