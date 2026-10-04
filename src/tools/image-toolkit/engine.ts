import type { ChangeEvent } from 'react';

export type LocalToolId =
  | 'background-remover'
  | 'ai-image-generator'
  | 'image-upscaler'
  | 'image-converter'
  | 'image-to-text'
  | 'object-remover'
  | 'crop-resize'
  | 'watermark-remover'
  | 'raster-to-svg'
  | 'image-rotate' | 'image-flip-horizontal' | 'image-flip-vertical' | 'image-brightness' | 'image-contrast' | 'image-saturation' | 'image-grayscale' | 'image-invert' | 'image-sepia' | 'image-blur' | 'image-sharpen' | 'image-resizer' | 'image-hue' | 'image-pixelate' | 'image-padding' | 'image-rounded-corners'
  | 'image-rotate-flip' | 'image-brightness-contrast' | 'image-saturation-hue' | 'image-exposure' | 'image-highlights-shadows' | 'image-grayscale-duotone' | 'image-filters' | 'image-watermark' | 'image-text-overlay' | 'image-draw-annotate' | 'image-redaction';

export type ImageInfo = { width: number; height: number };

export function imageInfo(blob: Blob): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be decoded.'));
    };
    image.src = url;
  });
}

export function loadImage(blob: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const onAbort = () => { URL.revokeObjectURL(url); reject(new DOMException('Image operation cancelled.','AbortError')); };
    signal?.addEventListener('abort',onAbort,{once:true});
    image.onload=()=>{ signal?.removeEventListener('abort',onAbort); URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be decoded.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.96): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create output image.')), type, quality));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function sharpenCanvas(ctx: CanvasRenderingContext2D, amount = 0.11) {
  const { canvas } = ctx;
  if (canvas.width < 3 || canvas.height < 3) return;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(pixels.data);
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const center = getPixel(source, canvas.width, x, y);
      const left = getPixel(source, canvas.width, x - 1, y);
      const right = getPixel(source, canvas.width, x + 1, y);
      const top = getPixel(source, canvas.width, x, y - 1);
      const bottom = getPixel(source, canvas.width, x, y + 1);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels.data[i + channel] = clamp(center[channel] + amount * (4 * center[channel] - left[channel] - right[channel] - top[channel] - bottom[channel]), 0, 255);
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

function progressiveResize(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  let source: CanvasImageSource = image;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  while (sourceWidth * 2 < width || sourceHeight * 2 < height) {
    const nextWidth = Math.min(width, Math.round(sourceWidth * 1.8));
    const nextHeight = Math.min(height, Math.round(sourceHeight * 1.8));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextWidth;
    stepCanvas.height = nextHeight;
    const stepContext = stepCanvas.getContext('2d');
    if (!stepContext) throw new Error('Canvas is unavailable.');
    stepContext.imageSmoothingEnabled = true;
    stepContext.imageSmoothingQuality = 'high';
    stepContext.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, nextWidth, nextHeight);
    source = stepCanvas;
    sourceWidth = nextWidth;
    sourceHeight = nextHeight;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return canvas;
}

export async function resizeImage(blob: Blob, scale: number, signal?: AbortSignal): Promise<Blob> {
  const image = await loadImage(blob, signal);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = progressiveResize(image, width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  sharpenCanvas(ctx, scale > 1 ? 0.10 : 0.06);
  return canvasBlob(canvas, 'image/png');
}

export async function convertImage(blob: Blob, type: 'image/png' | 'image/jpeg' | 'image/webp', signal?: AbortSignal): Promise<Blob> {
  throwIfAborted(signal);
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0);
  const quality = type === 'image/png' ? 1 : 0.96;
  return canvasBlob(canvas, type, quality);
}

export async function cropResizeImage(blob: Blob, crop: { x: number; y: number; width: number; height: number }, out: { width: number; height: number }, signal?: AbortSignal): Promise<Blob> {
  throwIfAborted(signal);
  const image = await loadImage(blob);
  const sourceX = clamp(Math.round(crop.x), 0, Math.max(0, image.naturalWidth - 1));
  const sourceY = clamp(Math.round(crop.y), 0, Math.max(0, image.naturalHeight - 1));
  const sourceWidth = clamp(Math.round(crop.width), 1, image.naturalWidth - sourceX);
  const sourceHeight = clamp(Math.round(crop.height), 1, image.naturalHeight - sourceY);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(out.width));
  canvas.height = Math.max(1, Math.round(out.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas, 'image/png');
}

export async function removeBackground(blob: Blob, tolerance = 42, signal?: AbortSignal): Promise<Blob> {
  throwIfAborted(signal);
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const corners = [getPixel(data, canvas.width, 0, 0), getPixel(data, canvas.width, canvas.width - 1, 0), getPixel(data, canvas.width, 0, canvas.height - 1), getPixel(data, canvas.width, canvas.width - 1, canvas.height - 1)];
  const background = corners.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0]).map((value) => value / corners.length);
  const matchesBackground = (x: number, y: number) => {
    const pixel = getPixel(data, canvas.width, x, y);
    return Math.hypot(pixel[0] - background[0], pixel[1] - background[1], pixel[2] - background[2]) <= tolerance;
  };
  const total = canvas.width * canvas.height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    const index = y * canvas.width + x;
    if (visited[index] || !matchesBackground(x, y)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < canvas.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, canvas.height - 1);
  }
  for (let y = 0; y < canvas.height; y += 1) {
    enqueue(0, y);
    enqueue(canvas.width - 1, y);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < canvas.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < canvas.height) enqueue(x, y + 1);
  }
  for (let index = 0; index < total; index += 1) {
    if (visited[index]) data[index * 4 + 3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvasBlob(canvas, 'image/png');
}

function reconstructRegion(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, region: { x: number; y: number; width: number; height: number }): void {
  const x = clamp(Math.round(region.x), 0, canvas.width - 1);
  const y = clamp(Math.round(region.y), 0, canvas.height - 1);
  const width = clamp(Math.round(region.width), 1, canvas.width - x);
  const height = clamp(Math.round(region.height), 1, canvas.height - y);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(imageData.data);
  const blend = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const px = x + xx;
      const py = y + yy;
      const u = (xx + 0.5) / width;
      const v = (yy + 0.5) / height;
      const left = getPixel(source, canvas.width, Math.max(0, x - 1), py);
      const right = getPixel(source, canvas.width, Math.min(canvas.width - 1, x + width), py);
      const top = getPixel(source, canvas.width, px, Math.max(0, y - 1));
      const bottom = getPixel(source, canvas.width, px, Math.min(canvas.height - 1, y + height));
      const target = (py * canvas.width + px) * 4;
      imageData.data[target] = (blend(left[0], right[0], u) + blend(top[0], bottom[0], v)) / 2;
      imageData.data[target + 1] = (blend(left[1], right[1], u) + blend(top[1], bottom[1], v)) / 2;
      imageData.data[target + 2] = (blend(left[2], right[2], u) + blend(top[2], bottom[2], v)) / 2;
      imageData.data[target + 3] = (blend(left[3], right[3], u) + blend(top[3], bottom[3], v)) / 2;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function fillRemoveRegion(blob: Blob, region: { x: number; y: number; width: number; height: number }, signal?: AbortSignal): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, 0, 0);
  reconstructRegion(ctx, canvas, region);
  return canvasBlob(canvas, 'image/png');
}

export async function watermarkRemove(blob: Blob, region: { x: number; y: number; width: number; height: number }, signal?: AbortSignal): Promise<Blob> {
  return fillRemoveRegion(blob, region, signal);
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function rasterToSvg(blob: Blob, columns = 48, signal?: AbortSignal): Promise<Blob> {
  const image = await loadImage(blob);
  const scale = Math.min(1, Math.max(1, columns) / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const rects: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 16) {
        x += 1;
        continue;
      }
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      let run = 1;
      while (x + run < width) {
        const next = (y * width + x + run) * 4;
        if (data[next] !== r || data[next + 1] !== g || data[next + 2] !== b || data[next + 3] !== alpha) break;
        run += 1;
      }
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="rgb(${r},${g},${b})" fill-opacity="${(alpha / 255).toFixed(2)}"/>`);
      x += run;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><title>${escapeXml('FLIXO Raster to SVG')}</title>${rects.join('')}</svg>`;
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export async function hueShiftImage(blob: Blob, degrees = 30, signal?: AbortSignal): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.filter = `hue-rotate(${degrees}deg)`;
  ctx.drawImage(image, 0, 0);
  return canvasBlob(canvas, 'image/png');
}

export async function pixelateImage(blob: Blob, blockSize = 8): Promise<Blob> {
  const image = await loadImage(blob);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const block = Math.max(2, Math.min(64, Math.round(blockSize)));
  const lowCanvas = document.createElement('canvas');
  lowCanvas.width = Math.max(1, Math.ceil(width / block));
  lowCanvas.height = Math.max(1, Math.ceil(height / block));
  const lowCtx = lowCanvas.getContext('2d');
  if (!lowCtx) throw new Error('Canvas is unavailable.');
  lowCtx.imageSmoothingEnabled = false;
  lowCtx.drawImage(image, 0, 0, lowCanvas.width, lowCanvas.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lowCanvas, 0, 0, lowCanvas.width, lowCanvas.height, 0, 0, width, height);
  return canvasBlob(canvas, 'image/png');
}

export async function padImage(blob: Blob, padding = 24): Promise<Blob> {
  const image = await loadImage(blob);
  const safePadding = Math.max(0, Math.min(2000, Math.round(padding)));
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth + safePadding * 2;
  canvas.height = image.naturalHeight + safePadding * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, safePadding, safePadding);
  return canvasBlob(canvas, 'image/png');
}

export async function roundedCornersImage(blob: Blob, radius = 24): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  const r = Math.max(0, Math.min(Math.min(canvas.width, canvas.height) / 2, Math.round(radius)));
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
  ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
  ctx.arcTo(0, canvas.height, 0, 0, r);
  ctx.arcTo(0, 0, canvas.width, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, 0, 0);
  return canvasBlob(canvas, 'image/png');
}

export type BasicImageEffect =
  | 'brightness' | 'contrast' | 'saturation' | 'grayscale' | 'invert' | 'sepia' | 'blur' | 'sharpen';

export async function applyBasicImageEffect(blob: Blob, effect: BasicImageEffect, value = 100, signal?: AbortSignal): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: effect !== 'blur' });
  if (!ctx) throw new Error('Canvas is unavailable.');
  const normalized = Math.max(0, Math.min(200, value));
  if (effect === 'blur') {
    ctx.filter = `blur(${Math.max(0, normalized / 20)}px)`;
  } else if (effect === 'brightness') {
    ctx.filter = `brightness(${normalized}%)`;
  } else if (effect === 'contrast') {
    ctx.filter = `contrast(${normalized}%)`;
  } else if (effect === 'saturation') {
    ctx.filter = `saturate(${normalized}%)`;
  } else if (effect === 'grayscale') {
    ctx.filter = `grayscale(${Math.max(0, Math.min(100, normalized))}%)`;
  } else if (effect === 'invert') {
    ctx.filter = `invert(${Math.max(0, Math.min(100, normalized))}%)`;
  } else if (effect === 'sepia') {
    ctx.filter = `sepia(${Math.max(0, Math.min(100, normalized))}%)`;
  }
  ctx.drawImage(image, 0, 0);
  if (effect === 'sharpen') {
    sharpenCanvas(ctx, Math.max(0.02, Math.min(0.35, normalized / 1000)));
  }
  return canvasBlob(canvas, 'image/png');
}

export async function rotateImage(blob: Blob, degrees = 90, signal?: AbortSignal) {
  const image = await loadImage(blob);
  const normalized = ((degrees % 360) + 360) % 360;
  const swap = normalized === 90 || normalized === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? image.naturalHeight : image.naturalWidth;
  canvas.height = swap ? image.naturalWidth : image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvasBlob(canvas, 'image/png');
}

export async function flipImage(blob: Blob, horizontal = true, signal?: AbortSignal) {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.translate(horizontal ? canvas.width : 0, horizontal ? 0 : canvas.height);
  ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
  ctx.drawImage(image, 0, 0);
  return canvasBlob(canvas, 'image/png');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileChange(event: ChangeEvent<HTMLInputElement>): File | null {
  return event.target.files?.[0] ?? null;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Image operation cancelled.', 'AbortError');
}
function parseHexColor(value: string): [number, number, number] {
  const n=value.replace('#',''); return [Number.parseInt(n.slice(0,2),16),Number.parseInt(n.slice(2,4),16),Number.parseInt(n.slice(4,6),16)];
}
export async function resizeImageToDimensions(blob: Blob,width:number,height:number,signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=progressiveResize(image,Math.max(1,Math.min(4000,Math.round(width))),Math.max(1,Math.min(4000,Math.round(height)))); throwIfAborted(signal); return canvasBlob(canvas,'image/png');
}
export async function rotateFlipImage(blob:Blob,p:{rotation:number;flipX:boolean;flipY:boolean},signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const rotation=((p.rotation%360)+360)%360; const swap=rotation===90||rotation===270; const canvas=document.createElement('canvas'); canvas.width=swap?image.naturalHeight:image.naturalWidth; canvas.height=swap?image.naturalWidth:image.naturalHeight; const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.translate(canvas.width/2,canvas.height/2); ctx.rotate(rotation*Math.PI/180); ctx.scale(p.flipX?-1:1,p.flipY?-1:1); ctx.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2); throwIfAborted(signal); return canvasBlob(canvas,'image/png');
}
export async function applyExposureImage(blob:Blob,exposure:number,signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.drawImage(image,0,0); const data=ctx.getImageData(0,0,canvas.width,canvas.height); const factor=2**exposure; for(let y=0;y<canvas.height;y++){throwIfAborted(signal);for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;data.data[i]=clamp(data.data[i]*factor,0,255);data.data[i+1]=clamp(data.data[i+1]*factor,0,255);data.data[i+2]=clamp(data.data[i+2]*factor,0,255);}} ctx.putImageData(data,0,0); return canvasBlob(canvas,'image/png');
}
export async function applyHighlightsShadowsImage(blob:Blob,highlights:number,shadows:number,signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.drawImage(image,0,0); const data=ctx.getImageData(0,0,canvas.width,canvas.height); for(let y=0;y<canvas.height;y++){throwIfAborted(signal);for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;const l=(0.2126*data.data[i]+0.7152*data.data[i+1]+0.0722*data.data[i+2])/255;const a=1+(highlights/100)*l*l*0.7+(shadows/100)*(1-l)*(1-l)*0.7;data.data[i]=clamp(data.data[i]*a,0,255);data.data[i+1]=clamp(data.data[i+1]*a,0,255);data.data[i+2]=clamp(data.data[i+2]*a,0,255);}} ctx.putImageData(data,0,0); return canvasBlob(canvas,'image/png');
}
export async function applyGrayscaleDuotoneImage(blob:Blob,intensity:number,darkColor:string,lightColor:string,signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.drawImage(image,0,0); const data=ctx.getImageData(0,0,canvas.width,canvas.height); const [dr,dg,db]=parseHexColor(darkColor),[lr,lg,lb]=parseHexColor(lightColor),mix=Math.max(0,Math.min(1,intensity/100)); for(let y=0;y<canvas.height;y++){throwIfAborted(signal);for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;const l=(0.2126*data.data[i]+0.7152*data.data[i+1]+0.0722*data.data[i+2])/255;data.data[i]=clamp(data.data[i]*(1-mix)+(dr+(lr-dr)*l)*mix,0,255);data.data[i+1]=clamp(data.data[i+1]*(1-mix)+(dg+(lg-dg)*l)*mix,0,255);data.data[i+2]=clamp(data.data[i+2]*(1-mix)+(db+(lb-db)*l)*mix,0,255);}} ctx.putImageData(data,0,0); return canvasBlob(canvas,'image/png');
}
export async function applyFilterPresetImage(blob:Blob,preset:string,signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.filter=({vivid:'contrast(112%) saturate(135%)',warm:'saturate(118%) sepia(12%)',cool:'saturate(105%) hue-rotate(12deg) brightness(103%)',vintage:'sepia(24%) contrast(94%) saturate(88%)',mono:'grayscale(100%) contrast(108%)',sepia:'sepia(90%) contrast(103%)',cinematic:'contrast(115%) saturate(108%) brightness(96%)'} as Record<string,string>)[preset]??'contrast(112%) saturate(135%)'; ctx.drawImage(image,0,0); throwIfAborted(signal); return canvasBlob(canvas,'image/png');
}
export async function addTextOverlayImage(blob:Blob,p:{text:string;x:number;y:number;fontSize:number;color:string;background?:string;backgroundOpacity:number;align:'left'|'center'|'right'},signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.drawImage(image,0,0); ctx.font=String(p.fontSize)+'px sans-serif'; ctx.textAlign=p.align; ctx.textBaseline='middle'; const x=p.x/100*canvas.width,y=p.y/100*canvas.height; if(p.background){const metrics=ctx.measureText(p.text),pad=Math.max(4,p.fontSize*.25),w=metrics.width+pad*2,h=p.fontSize+pad*2,left=p.align==='center'?x-w/2:p.align==='right'?x-w:x;ctx.save();ctx.globalAlpha=p.backgroundOpacity;ctx.fillStyle=p.background;ctx.fillRect(left,y-h/2,w,h);ctx.restore();} ctx.fillStyle=p.color; ctx.fillText(p.text,x,y); throwIfAborted(signal); return canvasBlob(canvas,'image/png');
}
export async function addWatermarkImage(blob:Blob,p:{text:string;x:number;y:number;fontSize:number;opacity:number;color:string},signal?:AbortSignal):Promise<Blob>{
  const result=await addTextOverlayImage(blob,{...p,backgroundOpacity:0,align:'left'},signal); return result;
}
export async function drawAnnotationImage(blob:Blob,p:{kind:'line'|'arrow'|'rect'|'ellipse';x1:number;y1:number;x2:number;y2:number;stroke:string;strokeWidth:number},signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.drawImage(image,0,0); const x1=p.x1/100*canvas.width,y1=p.y1/100*canvas.height,x2=p.x2/100*canvas.width,y2=p.y2/100*canvas.height; ctx.strokeStyle=p.stroke;ctx.lineWidth=p.strokeWidth;ctx.lineCap='round'; if(p.kind==='rect')ctx.strokeRect(x1,y1,x2-x1,y2-y1); else if(p.kind==='ellipse'){ctx.beginPath();ctx.ellipse((x1+x2)/2,(y1+y2)/2,Math.abs(x2-x1)/2,Math.abs(y2-y1)/2,0,0,Math.PI*2);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();if(p.kind==='arrow'){const a=Math.atan2(y2-y1,x2-x1),s=Math.max(8,p.strokeWidth*2);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-s*Math.cos(a-Math.PI/6),y2-s*Math.sin(a-Math.PI/6));ctx.lineTo(x2-s*Math.cos(a+Math.PI/6),y2-s*Math.sin(a+Math.PI/6));ctx.closePath();ctx.fillStyle=p.stroke;ctx.fill();}} throwIfAborted(signal); return canvasBlob(canvas,'image/png');
}
export async function redactImage(blob:Blob,p:{x:number;y:number;width:number;height:number;color:string},signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal); const image=await loadImage(blob,signal); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas is unavailable.'); ctx.drawImage(image,0,0); ctx.fillStyle=p.color;ctx.fillRect(p.x/100*canvas.width,p.y/100*canvas.height,p.width/100*canvas.width,p.height/100*canvas.height); throwIfAborted(signal); return canvasBlob(canvas,'image/png');
}
export async function executeCanonicalImageEngine(toolId:string,blob:Blob,parameters:Record<string,string|number|boolean>,signal?:AbortSignal):Promise<Blob>{
  throwIfAborted(signal);
  switch(toolId){
    case 'background-remover': return removeBackground(blob,Number(parameters.tolerance??42),signal);
    case 'image-upscaler': return resizeImage(blob,Number(parameters.scale??2),signal);
    case 'image-cropper': return cropResizeImage(blob,{x:Number(parameters.x??0),y:Number(parameters.y??0),width:Number(parameters.cropWidth??500),height:Number(parameters.cropHeight??500)},{width:Number(parameters.width??500),height:Number(parameters.height??500)},signal);
    case 'image-compressor':{const {compressImage}=await import('../image-compressor/engine.ts');const r=await compressImage(new File([blob],'flixo-input',{type:blob.type||'image/png'}),{quality:Number(parameters.quality??0.82),format:String(parameters.format??'image/webp') as 'image/png'|'image/jpeg'|'image/webp',targetSizeKB:parameters.targetSizeKB===undefined?undefined:Number(parameters.targetSizeKB),maxWidth:parameters.maxWidth===undefined?undefined:Number(parameters.maxWidth),maxHeight:parameters.maxHeight===undefined?undefined:Number(parameters.maxHeight)},signal);return r.blob;}
    case 'image-converter': return convertImage(blob,String(parameters.format??'image/webp') as 'image/png'|'image/jpeg'|'image/webp',signal);
    case 'image-effects':{let current=blob;if(parameters.brightness!==undefined)current=await applyBasicImageEffect(current,'brightness',Number(parameters.brightness),signal);if(parameters.contrast!==undefined)current=await applyBasicImageEffect(current,'contrast',Number(parameters.contrast),signal);if(parameters.saturate!==undefined)current=await applyBasicImageEffect(current,'saturation',Number(parameters.saturate),signal);if(parameters.grayscale!==undefined)current=await applyBasicImageEffect(current,'grayscale',Number(parameters.grayscale),signal);return current;}
    case 'image-resizer':{if(parameters.width!==undefined||parameters.height!==undefined){const i=await imageInfo(blob);return resizeImageToDimensions(blob,Number(parameters.width??i.width),Number(parameters.height??i.height),signal);}return resizeImage(blob,Number(parameters.scale??1.2),signal);}
    case 'image-rotate-flip': return rotateFlipImage(blob,{rotation:Number(parameters.rotation??90),flipX:Boolean(parameters.flipX),flipY:Boolean(parameters.flipY)},signal);
    case 'image-brightness-contrast':{let current=blob;if(parameters.brightness!==undefined)current=await applyBasicImageEffect(current,'brightness',Number(parameters.brightness),signal);if(parameters.contrast!==undefined)current=await applyBasicImageEffect(current,'contrast',Number(parameters.contrast),signal);return current;}
    case 'image-saturation-hue':{let current=blob;if(parameters.saturation!==undefined)current=await applyBasicImageEffect(current,'saturation',Number(parameters.saturation),signal);if(parameters.hue!==undefined)current=await hueShiftImage(current,Number(parameters.hue),signal);return current;}
    case 'image-exposure': return applyExposureImage(blob,Number(parameters.exposure),signal);
    case 'image-highlights-shadows': return applyHighlightsShadowsImage(blob,Number(parameters.highlights??0),Number(parameters.shadows??0),signal);
    case 'image-sharpen': return applyBasicImageEffect(blob,'sharpen',Number(parameters.amount??110),signal);
    case 'image-blur': return applyBasicImageEffect(blob,'blur',Number(parameters.radius??6)*20,signal);
    case 'image-grayscale-duotone': return applyGrayscaleDuotoneImage(blob,Number(parameters.intensity??100),String(parameters.darkColor??'#111111'),String(parameters.lightColor??'#f5f5f5'),signal);
    case 'image-filters': return applyFilterPresetImage(blob,String(parameters.preset??'vivid'),signal);
    case 'image-watermark': return addWatermarkImage(blob,{text:String(parameters.text),x:Number(parameters.x??10),y:Number(parameters.y??90),fontSize:Number(parameters.fontSize??32),opacity:Number(parameters.opacity??0.65),color:String(parameters.color??'#ffffff')},signal);
    case 'image-text-overlay': return addTextOverlayImage(blob,{text:String(parameters.text),x:Number(parameters.x??50),y:Number(parameters.y??50),fontSize:Number(parameters.fontSize??48),color:String(parameters.color??'#ffffff'),background:parameters.background?String(parameters.background):undefined,backgroundOpacity:Number(parameters.backgroundOpacity??0.5),align:String(parameters.align??'center') as 'left'|'center'|'right'},signal);
    case 'image-draw-annotate': return drawAnnotationImage(blob,{kind:String(parameters.kind??'arrow') as 'line'|'arrow'|'rect'|'ellipse',x1:Number(parameters.x1??10),y1:Number(parameters.y1??10),x2:Number(parameters.x2??80),y2:Number(parameters.y2??80),stroke:String(parameters.stroke??'#ff3b30'),strokeWidth:Number(parameters.strokeWidth??8)},signal);
    case 'image-redaction': return redactImage(blob,{x:Number(parameters.x??25),y:Number(parameters.y??25),width:Number(parameters.width??50),height:Number(parameters.height??25),color:String(parameters.color??'#000000')},signal);
    default: throw new Error('UNKNOWN_CANONICAL_IMAGE_OPERATION:'+toolId);
  }
}
