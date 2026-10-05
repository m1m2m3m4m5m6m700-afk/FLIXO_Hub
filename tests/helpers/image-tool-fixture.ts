import { expect, type Page } from '@playwright/test';

// 4x4 RGBA PNG with distinct pixels so browser image decoders and rendering paths
// can be verified without relying on a near-white/low-information fixture.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAD8klEQVR42u2dsWvbQBSHz8X/g2fTyfoHTCBQG0K3kl1TF+9dS8mUQtd2ypC10R6ylYLo2CnQgLbirF6zdHSXDg6V73w6nWTd73tbUF9I/X2+u/f0kEY3s9nWWCKfTGyXTbHZmJD87HRlvT45y63XN9+LsPz7c3v+m8yef1cF5a+KW/vn99rx+X/bBOW/MIR0IAACEAhAIACBAAQCEKlEflEd9O9G28XC2gcwZcmnOeAoLjNWAFYCBGAF2BNjr1+W/f/LQlvF11d2Q4Nbva78tw/2/MBWryu/Onmyf36HtnrnzbZqVoAUYt78nIYAwvARIMUD3s8lAgD/8Bg77+c7Dnyh8wAfYx/yXPl3/c4DFE3mAWqW/d3Tfj535LMCpLXnu0o9BAA+AiR52m+w5yMA8BEA+AggVeohAPD39wFcdbqr5g+9GRS9znfeDIpb57vym9T5zvzdPMfNJFYAgVIPAYCPAOqnfQQAPgIAHwGOKqp3t73CRwBx+MYwD9DLPED58lPUOp95gCMOH/hsAcBHgJThL3+/7/3vQgBh+AggDh8Beij1jgk+AojDN4Z5gCjzAHXLfvb5vLU6v818VoAO9vx98NkCgI8AnPYRAPgIAHwEoNRDAOD30AdgHsB/HsDntB/l+QCOOt9nHmCcwrfxz9cPe689Wq4dEo9ffj37eb1eD67UYwtoKVKDjwCB8KfT6eD/XwggDB8BxOEjgDh8BBCHb0wi8wChpV4I/CjPB3DU+W3mswKIfvMRAPgIoA4fAcThI4A4fHkB1OFLCwD8f32A1OcBYsPv5X0Bjjqf5wPwzWcLAD4CAB8BgC8vAPCFBQC+sADAP7APkOI8QJfwmQfgm88WAHwEAD4CAB8BeojylQG+qgDVZQ58VQGA306MbmazrbXOrHbq2OXSu8539Qmy05V3n6Bu2c8uimZ9hvvu3xewG6sY8wC7L510vIRicCuAD3wisS0A+MIC1MFf/gCghADAFxYA+MIC1JV6wBcRAPjdxFHOA7Ra5/fwvgCffOYBKPXYAoCPAJz2lQUAvrAAwBcW4NmdRuBrCQD8I+kD9PJ8gLLsrs6P8L6ANvsEes8H8IBPpLYFAF9YgBr4dSNmRIoCAF9YAODrClBX6gFfRADgD6QPEGUeoGbZL7KsnzqfeYCOVwAP+ERqWwDwhQXgtC8sAPCFBQC+rgCUesICAD+RPkCjeQCP037f7wtgHqDteQBKPeEtAPicAdjzEQD4CYXfQ6KI4UXIQ6KAL74FcMAT2AK2i4V1Cyg2G5NXVeM639VnuL6q4tb5znmAh6h1viu/OnnyrvND+wTeh0BWAqoAAgEIBCAQgEAAAgGIVOIviweL3Ndf+PsAAAAASUVORK5CYII=', 'base64');

export async function uploadFixture(page: Page, name = 'fixture.png') {
  await page.locator('#image-tool-file, input[type="file"]').first().setInputFiles({ name, mimeType: 'image/png', buffer: PNG });
}

export async function assertImageResult(page: Page) {
  const result = page.locator('img[alt="Tool result"]');
  await expect(result).toBeVisible();
  await expect.poll(async () => result.evaluate((image) => {
    const candidate = image as HTMLImageElement;
    return candidate.complete && candidate.naturalWidth > 0 && candidate.naturalHeight > 0;
  }), { message: 'Tool result image was not decoded before inspection.' }).toBe(true);
  const meta = await page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]') as HTMLImageElement | null;
    if (!image) throw new Error('Tool result image not found.');
    if (typeof image.decode === 'function') await image.decode();
    const response = await fetch(image.src);
    if (!response.ok) throw new Error(`Output blob fetch failed: ${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { type: blob.type, size: blob.size, width: image.naturalWidth, height: image.naturalHeight, bytes: Array.from(bytes) };
  });
  expect(meta.size).toBeGreaterThan(20);
  expect(meta.width).toBeGreaterThan(0);
  expect(meta.height).toBeGreaterThan(0);
  expect(meta.bytes.length).toBe(meta.size);
  return meta;
}

export async function captureDownload(page: Page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download now' }).click();
  return downloadPromise;
}

export async function assertDownload(page: Page, pattern: RegExp) {
  const download = await captureDownload(page);
  expect(download.suggestedFilename()).toMatch(pattern);
  expect(download.suggestedFilename()).not.toContain('undefined');
  return download;
}
