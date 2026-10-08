export type SvgIntegrityResult = { valid: boolean; failures: string[]; bytes: number; mime: string };

const SVG_LIMIT_BYTES = 25 * 1024 * 1024;

export function validateSvgOutput(blob: Blob, text: string): SvgIntegrityResult {
  const failures: string[] = [];
  if (blob.size < 1) failures.push('output is empty');
  if (blob.size > SVG_LIMIT_BYTES) failures.push('output exceeds the maximum size');
  if (!['image/svg+xml', 'image/svg+xml;charset=utf-8'].includes(blob.type)) failures.push(`unsupported SVG MIME type: ${blob.type}`);
  const normalized = text.trim().replace(/^\uFEFF/, '');
  if (!/^<svg\b[^>]*>/i.test(normalized)) failures.push('missing SVG root element');
  if (!/<\/svg>\s*$/i.test(normalized)) failures.push('missing SVG closing element');
  if (!/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(normalized)) failures.push('missing SVG namespace');
  if (/<\s*(?:script|foreignObject)\b/i.test(normalized)) failures.push('active SVG elements are not permitted');
  if (/(?:\b(?:href|xlink:href|src)\s*=\s*["'](?:https?:\/\/|\/\/|javascript:)|\burl\s*\(\s*["']?(?:https?:\/\/|\/\/|javascript:))/iu.test(normalized)) failures.push('external SVG references are not permitted');
  if (/<!DOCTYPE|<!ENTITY/i.test(normalized)) failures.push('SVG declarations are not permitted');
  return { valid: failures.length === 0, failures, bytes: blob.size, mime: blob.type };
}
