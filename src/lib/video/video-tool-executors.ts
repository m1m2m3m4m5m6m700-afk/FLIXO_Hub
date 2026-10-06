import { renderVideoToWebm, type VideoRenderOptions, validateVideoRenderOptions, type VideoMetadata } from './video-executor';

type CapabilityParameters = Record<string, string | number | boolean>;
export type VideoToolExecutor = (inputBlob: Blob, parameters: CapabilityParameters, tool: { id: string }, signal?: AbortSignal) => Promise<Blob>;

function optionalFinite(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`VIDEO_PARAMETER_INVALID:${label}`);
  return number;
}

function requiredInteger(value: unknown, label: string, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`VIDEO_PARAMETER_INVALID:${label}`);
  return number;
}

export const VIDEO_EXECUTORS: Readonly<Record<string, VideoToolExecutor>> = Object.freeze({
  'video-trimmer': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    startSec: optionalFinite(parameters.startSec, 'startSec', 0, 86_400),
    endSec: optionalFinite(parameters.endSec, 'endSec', 0, 86_400),
    signal,
  }),
  'video-cropper': (inputBlob, parameters, _tool, signal) => {
    const options: VideoRenderOptions = {
      crop: {
        x: requiredInteger(parameters.x ?? 0, 'x', 0, 20_000),
        y: requiredInteger(parameters.y ?? 0, 'y', 0, 20_000),
        width: requiredInteger(parameters.width, 'width', 1, 20_000),
        height: requiredInteger(parameters.height, 'height', 1, 20_000),
      },
      signal,
    };
    return renderVideoToWebm(inputBlob, options);
  },
  'video-resizer': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    width: requiredInteger(parameters.width, 'width', 1, 8_000),
    height: requiredInteger(parameters.height, 'height', 1, 8_000),
    fps: optionalFinite(parameters.fps, 'fps', 1, 120),
    signal,
  }),
  'video-compressor': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    videoBitsPerSecond: optionalFinite(parameters.videoBitsPerSecond, 'videoBitsPerSecond', 1, 50_000_000),
    audioBitsPerSecond: optionalFinite(parameters.audioBitsPerSecond, 'audioBitsPerSecond', 1, 512_000),
    signal,
  }),
});

export function getVideoToolExecutor(tool: { id: string }): VideoToolExecutor | undefined {
  return VIDEO_EXECUTORS[tool.id];
}

export function assertVideoOutputMetadata(
  input: Pick<VideoMetadata, 'width' | 'height' | 'duration'>,
  output: Pick<VideoMetadata, 'width' | 'height' | 'duration'>,
  parameters: CapabilityParameters,
): void {
  if (output.width < 1 || output.height < 1 || output.duration <= 0) throw new Error('VIDEO_OUTPUT_METADATA_INVALID');
  if (parameters.width !== undefined && output.width !== Number(parameters.width)) throw new Error('VIDEO_OUTPUT_WIDTH_MISMATCH');
  if (parameters.height !== undefined && output.height !== Number(parameters.height)) throw new Error('VIDEO_OUTPUT_HEIGHT_MISMATCH');

  if (parameters.startSec !== undefined || parameters.endSec !== undefined) {
    const start = Number(parameters.startSec ?? 0);
    const end = Number(parameters.endSec ?? input.duration);
    const expected = end - start;
    if (Math.abs(output.duration - expected) > 0.4) throw new Error('VIDEO_OUTPUT_DURATION_MISMATCH');
  }
}
