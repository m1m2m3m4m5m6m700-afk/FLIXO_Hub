import { readdirSync } from "node:fs";
import { join } from "node:path";

const { CANONICAL_LOCALES } = await import("../src/lib/i18n/config.ts");
const root = join(process.cwd(), "src", "lib", "i18n", "locales");
const canonical = [...CANONICAL_LOCALES];

if (!canonical.includes("en")) {
  throw new Error("English must be present in CANONICAL_LOCALES");
}

const files = new Set(readdirSync(root));
const missingFiles = canonical.filter((locale) => !files.has(`${locale}.ts`));

if (missingFiles.length) {
  throw new Error(`Missing canonical locale files: ${missingFiles.join(", ")}`);
}

const extras = [...files]
  .filter((file) => /^([a-z]{2})\.ts$/.test(file) && !canonical.includes(file.slice(0, -3)))
  .sort();

const loadLocale = async (locale) => {
  const module = await import(`../src/lib/i18n/locales/${locale}.ts`);
  return module[locale];
};

const flatten = (value, prefix = "") => {
  const entries = [];
  if (!value || typeof value !== "object") return entries;

  for (const [key, child] of Object.entries(value)) {
    if (key === "locale" || key === "languageTag" || key === "direction") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      entries.push(...flatten(child, path));
    } else {
      entries.push([path, child]);
    }
  }

  return entries;
};

const english = await loadLocale("en");
const expected = new Map(flatten(english));
const untranslatedAllowlist = new Set([
  "FLIXO",
  "ltr",
  "rtl",
  "PNG",
  "JPG",
  "JPEG",
  "WebP",
  "SVG",
  "Seed",
  "OCR",
  "EXIF",
  "CSV",
  "JSON",
  "XML",
  "YAML",
  "CSS",
  "HTML",
  "JavaScript",
  "MP3",
  "MP4",
  "WAV",
  "OGG",
  "FLAC",
  "M4A",
  "WebM",
  "Bokeh",
]);

const localeSpecificUntranslatedAllowlist = new Map([
  ["fr", new Set(["Saturation"])],
  ["nl", new Set(["Contrast"])],
]);

const gaps = [];
const untranslated = [];

for (const locale of canonical) {
  const actual = new Map(flatten(await loadLocale(locale)));
  const missingKeys = [...expected.keys()].filter((key) => !actual.has(key));
  if (missingKeys.length) gaps.push({ locale, missingKeys });

  if (locale !== "en") {
    const sameAsEnglish = [...expected.entries()]
      .filter(([key, englishValue]) => {
        if (typeof englishValue !== "string" || englishValue.length < 4) return false;
        if (untranslatedAllowlist.has(englishValue)) return false;
        if (localeSpecificUntranslatedAllowlist.get(locale)?.has(englishValue)) return false;
        return actual.get(key) === englishValue;
      })
      .map(([key, englishValue]) => ({ key, value: englishValue }));
    if (sameAsEnglish.length) untranslated.push({ locale, values: sameAsEnglish });
  }
}

if (gaps.length || untranslated.length) {
  console.error(JSON.stringify({ gaps, untranslated }, null, 2));
  if (gaps.length) throw new Error("Canonical locale dictionaries are incomplete");
  throw new Error("Canonical locale dictionaries contain untranslated user-visible values");
}

console.log(`I18N_CANONICAL_LOCALES_OK=${canonical.length}`);
console.log(`I18N_KEY_COVERAGE_OK=${canonical.length}`);
console.log(`I18N_UNTRANSLATED_VALUES_OK=0`);
console.log(`I18N_EXTRA_DICTIONARIES=${extras.length ? extras.join(", ") : "none"}`);
