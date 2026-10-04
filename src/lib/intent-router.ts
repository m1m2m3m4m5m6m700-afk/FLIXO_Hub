import type { ToolDefinition } from '../config/canonical-tool-definition';

export type IntentMatch = {
  readonly tool: ToolDefinition;
  readonly score: number;
};

const ALIASES: Record<string, readonly string[]> = {
  'filter-mask': ['live filter', 'camera filter', 'live camera', 'filters', 'filter mask', 'فلتر مباشر', 'فلاتر الكاميرا', 'كاميرا مباشرة'],
  'image-compressor': ['compress image', 'compress photo', 'reduce image size', 'resize image', 'ضغط الصورة', 'ضغط الصور'],
  'background-remover': ['remove background', 'background removal', 'transparent background', 'إزالة الخلفية', 'تفريغ الصورة'],
  'image-ocr': ['ocr', 'extract text', 'read text from image', 'نسخ النص من الصورة', 'استخراج النص'],
  'image-converter': ['convert image', 'png to webp', 'jpg to png', 'image format', 'تحويل الصورة', 'تحويل png'],
  'image-upscaler': ['upscale image', 'increase resolution', 'enhance image', 'تكبير الصورة', 'رفع جودة الصورة'],
  'image-cropper': ['crop image', 'crop photo', 'قص الصورة', 'قص الصور'],
  'watermark-adder': ['add watermark', 'watermark image', 'إضافة علامة مائية'],
  'watermark-remover': ['remove watermark', 'إزالة العلامة المائية'],
  'object-remover': ['remove object', 'erase object', 'إزالة عنصر', 'حذف عنصر من الصورة'],
  'background-blur': ['blur background', 'background blur', 'طمس الخلفية'],
  'passport-photo-maker': ['passport photo', 'id photo', 'صورة جواز السفر', 'صورة شخصية'],
  'meme-generator': ['make meme', 'meme', 'إنشاء ميم'],
  'collage-maker': ['photo collage', 'make collage', 'كولاج', 'دمج الصور'],
  'image-effects': ['image effects', 'brightness contrast', 'تأثيرات الصور'],
  'image-resizer': ['resize image','change image dimensions','resize to','تغيير حجم الصورة','تغيير أبعاد الصورة'],
  'image-rotate-flip': ['rotate and flip','rotate image','flip image','تدوير وقلب الصورة','تدوير الصورة','قلب الصورة'],
  'image-brightness-contrast': ['brightness contrast','adjust brightness and contrast','سطوع وتباين','ضبط السطوع والتباين'],
  'image-saturation-hue': ['saturation hue','adjust saturation and hue','التشبع ودرجة اللون','ضبط التشبع ودرجة اللون'],
  'image-exposure': ['exposure','adjust exposure','تعريض الصورة','ضبط التعريض'],
  'image-highlights-shadows': ['highlights shadows','highlights and shadows','الإبرازات والظلال','ضبط الإبرازات والظلال'],
  'image-sharpen': ['sharpen image','increase sharpness','حدة الصورة','زيادة حدة الصورة'],
  'image-blur': ['blur image','soften image','ضبابية الصورة','تمويه الصورة'],
  'image-grayscale-duotone': ['grayscale duotone','duotone','تدرج رمادي','دوتون'],
  'image-filters': ['photo filters','image filter preset','فلاتر الصور','فلتر الصورة'],
  'image-watermark': ['add watermark','watermark text','إضافة علامة مائية','علامة مائية'],
  'image-text-overlay': ['add text to image','text overlay','كتابة على الصورة','إضافة نص للصورة'],
  'image-draw-annotate': ['draw on image','annotate image','arrow annotation','الرسم على الصورة','التعليق على الصورة'],
  'image-redaction': ['redact image','censor image','hide sensitive region','تعمية الصورة','طمس بيانات حساسة'],
  'exif-cleaner': ['remove metadata', 'exif', 'تنظيف exif', 'حذف بيانات الصورة'],
  'svg-optimizer': ['optimize svg', 'minify svg', 'تحسين svg'],
  'image-to-svg': ['image to svg', 'convert image to svg', 'صورة إلى svg'],
  pix: ['photo editor', 'image editor', 'edit image', 'محرر الصور', 'تعديل الصور'],
  seed: ['gpu image editor', 'advanced image adjustments', 'تحسينات متقدمة للصورة'],
  'video-trimmer': ['trim video', 'cut video', 'video trim', 'trim first', 'اقتطع الفيديو', 'اقتطع أول', 'اقتطاع الفيديو'],
  'video-cropper': ['crop video', 'video crop', 'قص الفيديو من الأطراف', 'قص الفيديو من الاطراف'],
  'video-resizer': ['resize video', 'change video resolution', 'video dimensions', 'تغيير حجم الفيديو', 'تغيير دقة الفيديو'],
  'video-compressor': ['compress video', 'reduce video size', 'video compression', 'ضغط الفيديو', 'تصغير حجم الفيديو'],
};

const normalize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const scoreMatch = (query: string, tool: ToolDefinition): number => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const candidates = [tool.id, tool.title, tool.description, ...(ALIASES[tool.id] ?? [])].map(normalize);
  let score = 0;

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === normalizedQuery) score = Math.max(score, 100);
    else if (candidate.includes(normalizedQuery)) score = Math.max(score, 85);
    else if (normalizedQuery.includes(candidate)) score = Math.max(score, 75);
    else {
      const tokens = normalizedQuery.split(' ').filter((token) => token.length > 1);
      const stopwords = new Set(['the', 'this', 'that', 'from', 'into', 'with', 'for', 'and', 'to', 'of', 'a', 'an', 'is', 'on', 'in', 'لل', 'من', 'في', 'إلى', 'و', 'مع', 'هذه', 'هذا']);
      const meaningful = tokens.filter((token) => !stopwords.has(token));
      const hits = meaningful.filter((token) => candidate.includes(token)).length;
      const denominator = meaningful.length || tokens.length;
      if (hits) score = Math.max(score, Math.round((hits / denominator) * 70));
    }
  }

  return score;
};

export const findToolIntent = (query: string, tools: readonly ToolDefinition[]): IntentMatch[] =>
  tools
    .filter((tool) => tool.isReady)
    .map((tool) => ({ tool, score: scoreMatch(query, tool) }))
    .filter(({ score }) => score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

export const getBestToolIntent = (query: string, tools: readonly ToolDefinition[]): IntentMatch | null =>
  findToolIntent(query, tools)[0] ?? null;
