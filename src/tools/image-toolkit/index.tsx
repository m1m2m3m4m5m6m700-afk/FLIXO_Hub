import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { applyBasicImageEffect, convertImage, cropResizeImage, fillRemoveRegion, flipImage, hueShiftImage, imageInfo, padImage, pixelateImage, removeBackground, rasterToSvg, resizeImage, rotateImage, roundedCornersImage, watermarkRemove } from './engine';
import { recognizeWithOcrWorker } from './ocr-worker-client';
import { assertImageCropperOutputIntegrity } from '../image-cropper/output-integrity';
import { assertImageConverterOutputIntegrity } from '../image-converter/output-integrity';
import { validateFileSafety } from '../../lib/contracts/file-safety';
import { validateUploadBoundary } from '../../lib/contracts/upload-boundary';
import { LOCALE_METADATA, isLocale } from '../../lib/i18n';
import { getToolSeo } from '../../lib/seo/tool-seo';
import { getAuthoritativeToolSeoName } from '../../config/tool-seo-name-resolver';
import type { LocalToolId } from './engine';
import { CANONICAL_IMAGE_TOOL_IDS, executeCanonicalImageTool } from '../../lib/canonical-image-executor';

const DEFINITIONS: Record<Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>, { title: string; description: string; accept: string }> = {
  'background-remover': { title: 'Background Remover', description: 'Remove connected, uniform backgrounds locally in your browser with edge-aware flood fill.', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  'image-upscaler': { title: 'Image Upscaler', description: 'Increase image dimensions with high-quality browser resampling and controlled sharpening.', accept: 'image/png,image/jpeg,image/webp' },
  'image-converter': { title: 'Image Converter', description: 'Convert images between PNG, JPG, and WebP without uploading them.', accept: 'image/png,image/jpeg,image/webp' },
  'image-effects': { title: 'Image Effects', description: 'Adjust brightness and contrast locally in your browser.', accept: 'image/png,image/jpeg,image/webp' },
  'image-to-text': { title: 'Image to Text OCR', description: 'Extract visible text from an image in your browser with OCR preprocessing.', accept: 'image/png,image/jpeg,image/webp' },
  'object-remover': { title: 'Object Remover', description: 'Reconstruct a selected rectangular object region from surrounding pixels locally.', accept: 'image/png,image/jpeg,image/webp' },
  'crop-resize': { title: 'Crop & Resize', description: 'Crop an image and export it at exact dimensions.', accept: 'image/png,image/jpeg,image/webp' },
  'watermark-remover': { title: 'Watermark Remover', description: 'Reconstruct a selected watermark region locally with edge interpolation.', accept: 'image/png,image/jpeg,image/webp' },
  'raster-to-svg': { title: 'Raster to SVG', description: 'Convert a small raster image to compact pixel-based SVG locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-rotate': { title: 'Rotate Image', description: 'Rotate an image locally in your browser.', accept: 'image/png,image/jpeg,image/webp' },
  'image-flip-horizontal': { title: 'Flip Image Horizontal', description: 'Flip an image horizontally in your browser.', accept: 'image/png,image/jpeg,image/webp' },
  'image-flip-vertical': { title: 'Flip Image Vertical', description: 'Flip an image vertically in your browser.', accept: 'image/png,image/jpeg,image/webp' },
  'image-brightness': { title: 'Brightness', description: 'Adjust image brightness locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-contrast': { title: 'Contrast', description: 'Adjust image contrast locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-saturation': { title: 'Saturation', description: 'Adjust image saturation locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-grayscale': { title: 'Grayscale', description: 'Convert an image to grayscale locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-invert': { title: 'Invert Colors', description: 'Invert image colors locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-sepia': { title: 'Sepia', description: 'Apply a sepia effect locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-blur': { title: 'Blur', description: 'Apply a local blur effect.', accept: 'image/png,image/jpeg,image/webp' },
  'image-sharpen': { title: 'Sharpen', description: 'Sharpen an image locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-resizer': { title: 'Resize Image', description: 'Resize an image locally with deterministic browser resampling.', accept: 'image/png,image/jpeg,image/webp' },
    'image-rotate-flip': { title: 'Rotate & Flip', description: 'Rotate and flip images locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-brightness-contrast': { title: 'Brightness & Contrast', description: 'Adjust brightness and contrast locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-saturation-hue': { title: 'Saturation & Hue', description: 'Adjust saturation and hue locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-exposure': { title: 'Exposure', description: 'Adjust image exposure locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-highlights-shadows': { title: 'Highlights & Shadows', description: 'Adjust highlights and shadows locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-grayscale-duotone': { title: 'Grayscale & Duotone', description: 'Convert an image to grayscale or a duotone palette locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-filters': { title: 'Image Filters', description: 'Apply deterministic local filter presets.', accept: 'image/png,image/jpeg,image/webp' },
  'image-watermark': { title: 'Image Watermark', description: 'Add a text watermark locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-text-overlay': { title: 'Text Overlay', description: 'Place text over an image locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-draw-annotate': { title: 'Draw & Annotate', description: 'Draw deterministic annotations locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-redaction': { title: 'Image Redaction', description: 'Permanently cover a selected region locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-hue': { title: 'Hue', description: 'Shift image hue locally in the browser.', accept: 'image/png,image/jpeg,image/webp' },
  'image-pixelate': { title: 'Pixelate Image', description: 'Pixelate an image locally without uploading it.', accept: 'image/png,image/jpeg,image/webp' },
  'image-padding': { title: 'Image Padding', description: 'Add transparent padding around an image locally.', accept: 'image/png,image/jpeg,image/webp' },
  'image-rounded-corners': { title: 'Rounded Corners', description: 'Add rounded transparent corners to an image locally.', accept: 'image/png,image/jpeg,image/webp' },
};

type Props = { toolId: Exclude<LocalToolId, 'image-compressor'> };
type SharedImageToolId = Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>;
type Result = { blob: Blob; text?: string; fileName: string; info?: { width: number; height: number }; objectUrl?: string };

type RasterMime = 'image/png' | 'image/jpeg' | 'image/webp';
const RASTER_SIGNATURE_POLICIES: Record<RasterMime, { extensions: readonly string[]; signatures: readonly string[] }> = {
  'image/png': { extensions: ['png'], signatures: ['89504e470d0a1a0a'] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], signatures: ['ffd8ff'] },
  'image/webp': { extensions: ['webp'], signatures: ['52494646'] },
};

type UiCopy = Readonly<{
  imageTools: string; prompt: string; promptRequired: string; chooseImage: string; chooseImageFirst: string; imageInput: string;
  outputFormat: string; scale: string; backgroundTolerance: string; svgColumns: string;
  x: string; y: string; width: string; height: string; outputWidth: string; outputHeight: string;
  run: string; processing: string; generate: string; result: string; download: string; downloadNow: string;
  noResult: string; toolResult: string; privacyOcr: string;
}>;

const UI_COPY: Record<string, UiCopy> = {
  en: { imageTools:'FLIXO · IMAGE TOOLS', prompt:'Prompt', promptRequired:'Enter a prompt first.', chooseImage:'Choose an image', chooseImageFirst:'Choose an image first.', imageInput:'IMAGE INPUT', outputFormat:'Output format', scale:'Scale', backgroundTolerance:'Background tolerance', svgColumns:'SVG columns', x:'X', y:'Y', width:'Width', height:'Height', outputWidth:'Output width', outputHeight:'Output height', run:'Run tool', processing:'Processing…', generate:'Generate image', result:'RESULT', download:'Download', downloadNow:'Download now', noResult:'No result yet.', toolResult:'Tool result', privacyOcr:'OCR preprocesses the selected image locally, then runs Tesseract.js recognition in a dedicated Web Worker.' },
  ar: { imageTools:'FLIXO · أدوات الصور', prompt:'الوصف', promptRequired:'أدخل وصفًا أولًا.', chooseImage:'اختر صورة', chooseImageFirst:'اختر صورة أولًا.', imageInput:'مدخل الصورة', outputFormat:'تنسيق الإخراج', scale:'المقياس', backgroundTolerance:'تسامح الخلفية', svgColumns:'أعمدة SVG', x:'X', y:'Y', width:'العرض', height:'الارتفاع', outputWidth:'عرض الإخراج', outputHeight:'ارتفاع الإخراج', run:'تشغيل الأداة', processing:'جارٍ المعالجة…', generate:'إنشاء صورة', result:'النتيجة', download:'تنزيل', downloadNow:'تنزيل الآن', noResult:'لا توجد نتيجة بعد.', toolResult:'نتيجة الأداة', privacyOcr:'تُعالج الصورة المحددة محليًا أولًا، ثم يتعرف Tesseract.js على النص داخل Web Worker مخصص.' },
  es: { imageTools:'FLIXO · HERRAMIENTAS DE IMAGEN', prompt:'Indicación', promptRequired:'Introduce una indicación primero.', chooseImage:'Elige una imagen', chooseImageFirst:'Elige una imagen primero.', imageInput:'ENTRADA DE IMAGEN', outputFormat:'Formato de salida', scale:'Escala', backgroundTolerance:'Tolerancia del fondo', svgColumns:'Columnas SVG', x:'X', y:'Y', width:'Ancho', height:'Alto', outputWidth:'Ancho de salida', outputHeight:'Alto de salida', run:'Ejecutar herramienta', processing:'Procesando…', generate:'Generar imagen', result:'RESULTADO', download:'Descargar', downloadNow:'Descargar ahora', noResult:'Aún no hay resultado.', toolResult:'Resultado de la herramienta', privacyOcr:'La imagen seleccionada se preprocesa localmente y Tesseract.js reconoce el texto en un Web Worker dedicado.' },
  fr: { imageTools:'FLIXO · OUTILS D’IMAGE', prompt:'Consigne', promptRequired:'Saisissez d’abord une consigne.', chooseImage:'Choisissez une image', chooseImageFirst:'Choisissez d’abord une image.', imageInput:'ENTRÉE IMAGE', outputFormat:'Format de sortie', scale:'Échelle', backgroundTolerance:'Tolérance de l’arrière-plan', svgColumns:'Colonnes SVG', x:'X', y:'Y', width:'Largeur', height:'Hauteur', outputWidth:'Largeur de sortie', outputHeight:'Hauteur de sortie', run:'Exécuter l’outil', processing:'Traitement…', generate:'Générer une image', result:'RÉSULTAT', download:'Télécharger', downloadNow:'Télécharger maintenant', noResult:'Aucun résultat pour le moment.', toolResult:'Résultat de l’outil', privacyOcr:'L’image sélectionnée est prétraitée localement, puis Tesseract.js reconnaît le texte dans un Web Worker dédié.' },
  de: { imageTools:'FLIXO · BILDTOOLS', prompt:'Eingabe', promptRequired:'Geben Sie zuerst eine Eingabe ein.', chooseImage:'Bild auswählen', chooseImageFirst:'Wählen Sie zuerst ein Bild aus.', imageInput:'BILDEINGABE', outputFormat:'Ausgabeformat', scale:'Skalierung', backgroundTolerance:'Hintergrundtoleranz', svgColumns:'SVG-Spalten', x:'X', y:'Y', width:'Breite', height:'Höhe', outputWidth:'Ausgabebreite', outputHeight:'Ausgabehöhe', run:'Tool ausführen', processing:'Verarbeitung…', generate:'Bild generieren', result:'ERGEBNIS', download:'Herunterladen', downloadNow:'Jetzt herunterladen', noResult:'Noch kein Ergebnis.', toolResult:'Tool-Ergebnis', privacyOcr:'Das ausgewählte Bild wird lokal vorverarbeitet; anschließend erkennt Tesseract.js den Text in einem dedizierten Web Worker.' },
  hi: { imageTools:'FLIXO · इमेज टूल्स', prompt:'प्रॉम्प्ट', promptRequired:'पहले एक प्रॉम्प्ट दर्ज करें।', chooseImage:'छवि चुनें', chooseImageFirst:'पहले एक छवि चुनें।', imageInput:'इमेज इनपुट', outputFormat:'आउटपुट फ़ॉर्मेट', scale:'स्केल', backgroundTolerance:'बैकग्राउंड टॉलरेंस', svgColumns:'SVG कॉलम', x:'X', y:'Y', width:'चौड़ाई', height:'ऊँचाई', outputWidth:'आउटपुट चौड़ाई', outputHeight:'आउटपुट ऊँचाई', run:'टूल चलाएँ', processing:'प्रोसेस हो रहा है…', generate:'छवि बनाएँ', result:'परिणाम', download:'डाउनलोड', downloadNow:'अभी डाउनलोड करें', noResult:'अभी कोई परिणाम नहीं।', toolResult:'टूल परिणाम', privacyOcr:'चयनित छवि को स्थानीय रूप से प्रीप्रोसेस किया जाता है और फिर समर्पित Web Worker में Tesseract.js पहचान चलती है।' },
  id: { imageTools:'FLIXO · ALAT GAMBAR', prompt:'Perintah', promptRequired:'Masukkan perintah terlebih dahulu.', chooseImage:'Pilih gambar', chooseImageFirst:'Pilih gambar terlebih dahulu.', imageInput:'MASUKAN GAMBAR', outputFormat:'Format keluaran', scale:'Skala', backgroundTolerance:'Toleransi latar belakang', svgColumns:'Kolom SVG', x:'X', y:'Y', width:'Lebar', height:'Tinggi', outputWidth:'Lebar keluaran', outputHeight:'Tinggi keluaran', run:'Jalankan alat', processing:'Memproses…', generate:'Buat gambar', result:'HASIL', download:'Unduh', downloadNow:'Unduh sekarang', noResult:'Belum ada hasil.', toolResult:'Hasil alat', privacyOcr:'Gambar pilihan diproses secara lokal, lalu Tesseract.js mengenali teks dalam Web Worker khusus.' },
  it: { imageTools:'FLIXO · STRUMENTI IMMAGINE', prompt:'Descrizione', promptRequired:'Inserisci prima una descrizione.', chooseImage:'Scegli un’immagine', chooseImageFirst:'Scegli prima un’immagine.', imageInput:'INPUT IMMAGINE', outputFormat:'Formato di output', scale:'Scala', backgroundTolerance:'Tolleranza dello sfondo', svgColumns:'Colonne SVG', x:'X', y:'Y', width:'Larghezza', height:'Altezza', outputWidth:'Larghezza di output', outputHeight:'Altezza di output', run:'Esegui lo strumento', processing:'Elaborazione…', generate:'Genera immagine', result:'RISULTATO', download:'Scarica', downloadNow:'Scarica ora', noResult:'Nessun risultato ancora.', toolResult:'Risultato dello strumento', privacyOcr:'L’immagine selezionata viene preelaborata localmente, quindi Tesseract.js riconosce il testo in un Web Worker dedicato.' },
  ja: { imageTools:'FLIXO · 画像ツール', prompt:'プロンプト', promptRequired:'最初にプロンプトを入力してください。', chooseImage:'画像を選択', chooseImageFirst:'最初に画像を選択してください。', imageInput:'画像入力', outputFormat:'出力形式', scale:'倍率', backgroundTolerance:'背景の許容値', svgColumns:'SVG列数', x:'X', y:'Y', width:'幅', height:'高さ', outputWidth:'出力幅', outputHeight:'出力高さ', run:'ツールを実行', processing:'処理中…', generate:'画像を生成', result:'結果', download:'ダウンロード', downloadNow:'今すぐダウンロード', noResult:'まだ結果はありません。', toolResult:'ツールの結果', privacyOcr:'選択した画像をローカルで前処理し、専用のWeb WorkerでTesseract.jsによる認識を実行します。' },
  ko: { imageTools:'FLIXO · 이미지 도구', prompt:'프롬프트', promptRequired:'먼저 프롬프트를 입력하세요.', chooseImage:'이미지 선택', chooseImageFirst:'먼저 이미지를 선택하세요.', imageInput:'이미지 입력', outputFormat:'출력 형식', scale:'배율', backgroundTolerance:'배경 허용 범위', svgColumns:'SVG 열', x:'X', y:'Y', width:'너비', height:'높이', outputWidth:'출력 너비', outputHeight:'출력 높이', run:'도구 실행', processing:'처리 중…', generate:'이미지 생성', result:'결과', download:'다운로드', downloadNow:'지금 다운로드', noResult:'아직 결과가 없습니다.', toolResult:'도구 결과', privacyOcr:'선택한 이미지를 로컬에서 전처리한 다음 전용 Web Worker에서 Tesseract.js 인식을 실행합니다.' },
  ms: { imageTools:'FLIXO · ALAT IMEJ', prompt:'Gesaan', promptRequired:'Masukkan gesaan dahulu.', chooseImage:'Pilih imej', chooseImageFirst:'Pilih imej dahulu.', imageInput:'INPUT IMEJ', outputFormat:'Format output', scale:'Skala', backgroundTolerance:'Toleransi latar', svgColumns:'Lajur SVG', x:'X', y:'Y', width:'Lebar', height:'Tinggi', outputWidth:'Lebar output', outputHeight:'Tinggi output', run:'Jalankan alat', processing:'Memproses…', generate:'Jana imej', result:'HASIL', download:'Muat turun', downloadNow:'Muat turun sekarang', noResult:'Tiada hasil lagi.', toolResult:'Hasil alat', privacyOcr:'Imej yang dipilih dipraproses secara setempat, kemudian Tesseract.js menjalankan pengecaman dalam Web Worker khusus.' },
  nl: { imageTools:'FLIXO · AFBEELDINGSTOOLS', prompt:'Beschrijving', promptRequired:'Voer eerst een beschrijving in.', chooseImage:'Kies een afbeelding', chooseImageFirst:'Kies eerst een afbeelding.', imageInput:'AFBEELDINGSINVOER', outputFormat:'Uitvoerindeling', scale:'Schaal', backgroundTolerance:'Achtergrondtolerantie', svgColumns:'SVG-kolommen', x:'X', y:'Y', width:'Breedte', height:'Hoogte', outputWidth:'Uitvoerbreedte', outputHeight:'Uitvoerhoogte', run:'Tool uitvoeren', processing:'Bezig met verwerken…', generate:'Afbeelding genereren', result:'RESULTAAT', download:'Downloaden', downloadNow:'Nu downloaden', noResult:'Nog geen resultaat.', toolResult:'Toolresultaat', privacyOcr:'De geselecteerde afbeelding wordt lokaal voorbewerkt en Tesseract.js voert herkenning uit in een speciale Web Worker.' },
  pl: { imageTools:'FLIXO · NARZĘDZIA DO OBRAZÓW', prompt:'Polecenie', promptRequired:'Najpierw wprowadź polecenie.', chooseImage:'Wybierz obraz', chooseImageFirst:'Najpierw wybierz obraz.', imageInput:'WEJŚCIE OBRAZU', outputFormat:'Format wyjściowy', scale:'Skala', backgroundTolerance:'Tolerancja tła', svgColumns:'Kolumny SVG', x:'X', y:'Y', width:'Szerokość', height:'Wysokość', outputWidth:'Szerokość wyjścia', outputHeight:'Wysokość wyjścia', run:'Uruchom narzędzie', processing:'Przetwarzanie…', generate:'Wygeneruj obraz', result:'WYNIK', download:'Pobierz', downloadNow:'Pobierz teraz', noResult:'Brak wyniku.', toolResult:'Wynik narzędzia', privacyOcr:'Wybrany obraz jest przetwarzany lokalnie, a następnie Tesseract.js rozpoznaje tekst w dedykowanym Web Workerze.' },
  pt: { imageTools:'FLIXO · FERRAMENTAS DE IMAGEM', prompt:'Comando', promptRequired:'Introduza primeiro um comando.', chooseImage:'Escolha uma imagem', chooseImageFirst:'Escolha primeiro uma imagem.', imageInput:'ENTRADA DE IMAGEM', outputFormat:'Formato de saída', scale:'Escala', backgroundTolerance:'Tolerância do fundo', svgColumns:'Colunas SVG', x:'X', y:'Y', width:'Largura', height:'Altura', outputWidth:'Largura de saída', outputHeight:'Altura de saída', run:'Executar ferramenta', processing:'A processar…', generate:'Gerar imagem', result:'RESULTADO', download:'Transferir', downloadNow:'Transferir agora', noResult:'Ainda não há resultado.', toolResult:'Resultado da ferramenta', privacyOcr:'A imagem selecionada é pré-processada localmente e o Tesseract.js reconhece o texto num Web Worker dedicado.' },
  ru: { imageTools:'FLIXO · ИНСТРУМЕНТЫ ДЛЯ ИЗОБРАЖЕНИЙ', prompt:'Запрос', promptRequired:'Сначала введите запрос.', chooseImage:'Выберите изображение', chooseImageFirst:'Сначала выберите изображение.', imageInput:'ВХОДНОЕ ИЗОБРАЖЕНИЕ', outputFormat:'Формат вывода', scale:'Масштаб', backgroundTolerance:'Допуск фона', svgColumns:'Столбцы SVG', x:'X', y:'Y', width:'Ширина', height:'Высота', outputWidth:'Ширина результата', outputHeight:'Высота результата', run:'Запустить инструмент', processing:'Обработка…', generate:'Создать изображение', result:'РЕЗУЛЬТАТ', download:'Скачать', downloadNow:'Скачать сейчас', noResult:'Результата пока нет.', toolResult:'Результат инструмента', privacyOcr:'Выбранное изображение обрабатывается локально, затем Tesseract.js распознаёт текст в выделенном Web Worker.' },
  sv: { imageTools:'FLIXO · BILDVERKTYG', prompt:'Beskrivning', promptRequired:'Ange en prompt först.', chooseImage:'Välj en bild', chooseImageFirst:'Välj en bild först.', imageInput:'BILDINDATA', outputFormat:'Utdataformat', scale:'Skala', backgroundTolerance:'Bakgrundstolerans', svgColumns:'SVG-kolumner', x:'X', y:'Y', width:'Bredd', height:'Höjd', outputWidth:'Utdata-bredd', outputHeight:'Utdata-höjd', run:'Kör verktyget', processing:'Bearbetar…', generate:'Skapa bild', result:'RESULTAT', download:'Ladda ner', downloadNow:'Ladda ner nu', noResult:'Inget resultat ännu.', toolResult:'Verktygsresultat', privacyOcr:'Den valda bilden förbehandlas lokalt och Tesseract.js kör igenkänning i en dedikerad Web Worker.' },
  th: { imageTools:'FLIXO · เครื่องมือรูปภาพ', prompt:'พรอมต์', promptRequired:'กรุณาป้อนพรอมต์ก่อน', chooseImage:'เลือกภาพ', chooseImageFirst:'เลือกภาพก่อน', imageInput:'อินพุตรูปภาพ', outputFormat:'รูปแบบเอาต์พุต', scale:'มาตราส่วน', backgroundTolerance:'ค่าความคลาดเคลื่อนของพื้นหลัง', svgColumns:'คอลัมน์ SVG', x:'X', y:'Y', width:'ความกว้าง', height:'ความสูง', outputWidth:'ความกว้างเอาต์พุต', outputHeight:'ความสูงเอาต์พุต', run:'เรียกใช้เครื่องมือ', processing:'กำลังประมวลผล…', generate:'สร้างภาพ', result:'ผลลัพธ์', download:'ดาวน์โหลด', downloadNow:'ดาวน์โหลดตอนนี้', noResult:'ยังไม่มีผลลัพธ์', toolResult:'ผลลัพธ์ของเครื่องมือ', privacyOcr:'ภาพที่เลือกจะถูกประมวลผลล่วงหน้าในเครื่อง จากนั้น Tesseract.js จะรู้จำข้อความใน Web Worker เฉพาะ' },
  tr: { imageTools:'FLIXO · GÖRSEL ARAÇLARI', prompt:'İstek', promptRequired:'Önce bir istek girin.', chooseImage:'Bir görsel seçin', chooseImageFirst:'Önce bir görsel seçin.', imageInput:'GÖRSEL GİRDİSİ', outputFormat:'Çıktı biçimi', scale:'Ölçek', backgroundTolerance:'Arka plan toleransı', svgColumns:'SVG sütunları', x:'X', y:'Y', width:'Genişlik', height:'Yükseklik', outputWidth:'Çıktı genişliği', outputHeight:'Çıktı yüksekliği', run:'Aracı çalıştır', processing:'İşleniyor…', generate:'Görsel oluştur', result:'SONUÇ', download:'İndir', downloadNow:'Şimdi indir', noResult:'Henüz sonuç yok.', toolResult:'Araç sonucu', privacyOcr:'Seçilen görsel yerel olarak ön işlenir, ardından Tesseract.js ayrılmış bir Web Worker içinde tanıma yapar.' },
  uk: { imageTools:'FLIXO · ІНСТРУМЕНТИ ЗОБРАЖЕНЬ', prompt:'Запит', promptRequired:'Спочатку введіть запит.', chooseImage:'Виберіть зображення', chooseImageFirst:'Спочатку виберіть зображення.', imageInput:'ВХІДНЕ ЗОБРАЖЕННЯ', outputFormat:'Формат виводу', scale:'Масштаб', backgroundTolerance:'Допуск фону', svgColumns:'Стовпці SVG', x:'X', y:'Y', width:'Ширина', height:'Висота', outputWidth:'Ширина виводу', outputHeight:'Висота виводу', run:'Запустити інструмент', processing:'Обробка…', generate:'Створити зображення', result:'РЕЗУЛЬТАТ', download:'Завантажити', downloadNow:'Завантажити зараз', noResult:'Результату ще немає.', toolResult:'Результат інструмента', privacyOcr:'Вибране зображення обробляється локально, після чого Tesseract.js розпізнає текст у спеціальному Web Worker.' },
  vi: { imageTools:'FLIXO · CÔNG CỤ HÌNH ẢNH', prompt:'Lời nhắc', promptRequired:'Trước tiên hãy nhập lời nhắc.', chooseImage:'Chọn ảnh', chooseImageFirst:'Trước tiên hãy chọn một ảnh.', imageInput:'ĐẦU VÀO HÌNH ẢNH', outputFormat:'Định dạng đầu ra', scale:'Tỷ lệ', backgroundTolerance:'Dung sai nền', svgColumns:'Cột SVG', x:'X', y:'Y', width:'Chiều rộng', height:'Chiều cao', outputWidth:'Chiều rộng đầu ra', outputHeight:'Chiều cao đầu ra', run:'Chạy công cụ', processing:'Đang xử lý…', generate:'Tạo ảnh', result:'KẾT QUẢ', download:'Tải xuống', downloadNow:'Tải xuống ngay', noResult:'Chưa có kết quả.', toolResult:'Kết quả công cụ', privacyOcr:'Ảnh đã chọn được xử lý trước cục bộ, sau đó Tesseract.js nhận dạng văn bản trong Web Worker chuyên dụng.' },
};

function baseName(name: string) { return name.replace(/\.[^.]+$/, '') || 'flixo-image'; }

async function validateSharedImageInput(file: File, toolId: SharedImageToolId) {
  const allowedMime = DEFINITIONS[toolId].accept.split(',');
  const basePolicy = { allowedMime, maxBytes: 25 * 1024 * 1024, maxPixels: 40_000_000 } as const;
  const basic = validateFileSafety({ name: file.name, mime: file.type, bytes: file.size }, basePolicy);
  if (!basic.safe) throw new Error(`Input rejected by File Safety: ${basic.failures.join('; ')}`);
  const rasterPolicy = RASTER_SIGNATURE_POLICIES[file.type as RasterMime];
  if (rasterPolicy) {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const boundary = validateUploadBoundary({ name: file.name, mime: file.type, bytes }, { ...basePolicy, allowedExtensions: rasterPolicy.extensions, signatures: rasterPolicy.signatures });
    if (!boundary.safe) throw new Error(`Input rejected by Upload Security Boundary: ${boundary.failures.join('; ')}`);
  }
  const sourceInfo = await imageInfo(file);
  const dimensionCheck = validateFileSafety({ name: file.name, mime: file.type, bytes: file.size, width: sourceInfo.width, height: sourceInfo.height }, basePolicy);
  if (!dimensionCheck.safe) throw new Error(`Input rejected by File Safety: ${dimensionCheck.failures.join('; ')}`);
}

async function preprocessForOcr(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(2.5, Math.max(1, 1600 / Math.max(image.width, image.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < data.data.length; index += 4) {
    const luminance = 0.2126 * data.data[index] + 0.0722 * data.data[index + 2] + 0.7152 * data.data[index + 1];
    const boosted = Math.max(0, Math.min(255, (luminance - 128) * 1.45 + 128));
    data.data[index] = boosted; data.data[index + 1] = boosted; data.data[index + 2] = boosted;
  }
  context.putImageData(data, 0, 0);
  image.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare OCR input.')), 'image/png'));
}

async function createResult(blob: Blob, fileName: string, info?: Result['info'], text?: string): Promise<Result> {
  const objectUrl = URL.createObjectURL(blob);
  return { blob, fileName, info, text, objectUrl };
}

export function ImageToolPage({ toolId }: Props) {
  const location = useLocation();
  const localeCode = location.pathname.split('/').filter(Boolean)[0] ?? '';
  const locale = isLocale(localeCode) ? localeCode : 'en';
  const localeMetadata = LOCALE_METADATA[locale];
  const ui = UI_COPY[locale] ?? UI_COPY.en;
  const isGenerator = toolId === 'ai-image-generator';
  const canonicalToolId = toolId === 'image-to-text' ? 'image-ocr' : toolId;
  const canonicalTool = getToolSeo(locale, canonicalToolId)?.tool;
  const localizedTitle = canonicalTool ? getAuthoritativeToolSeoName(canonicalTool, locale) : undefined;
  const localizedSeo = getToolSeo(locale, canonicalToolId);
  const definition = isGenerator
    ? { title: getAuthoritativeToolSeoName(getToolSeo(locale, 'ai-image-generator')!.tool, locale) ?? 'AI Image Generator', description: localizedSeo?.description ?? 'Generate an image through the configured FLIXO image model endpoint.', accept: '' }
    : { ...DEFINITIONS[toolId], title: localizedTitle ?? DEFINITIONS[toolId].title, description: localizedSeo?.description ?? DEFINITIONS[toolId].description };
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/webp');
  const [scale, setScale] = useState('2'); const [tolerance, setTolerance] = useState('42'); const [columns, setColumns] = useState('48');
  const [advanced, setAdvanced] = useState({
    rotation: '90', flipX: false, flipY: false,
    brightness: '110', contrast: '110', saturation: '110', hue: '0',
    exposure: '1', highlights: '15', shadows: '15', sharpen: '110', blur: '6',
    duotoneIntensity: '100', darkColor: '#111111', lightColor: '#f5f5f5',
    filter: 'vivid', watermark: 'FLIXO', text: 'FLIXO',
    x: '50', y: '50', width: '50', height: '25', fontSize: '48',
    x1: '10', y1: '10', x2: '80', y2: '80', stroke: '#ff3b30', strokeWidth: '8',
    watermarkX: '10', watermarkY: '90', watermarkFontSize: '32', watermarkOpacity: '0.65', watermarkColor: '#ffffff',
    background: '', backgroundOpacity: '0.5', align: 'center', annotationKind: 'arrow',
  });
  const [cropX, setCropX] = useState('0'); const [cropY, setCropY] = useState('0'); const [cropW, setCropW] = useState('500'); const [cropH, setCropH] = useState('500'); const [outW, setOutW] = useState('500'); const [outH, setOutH] = useState('500');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<Result | null>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);
  const replaceResult = (next: Result | null) => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = next?.objectUrl; setResult(next); };

  const isCanonicalImageTool = (candidate: LocalToolId): candidate is LocalToolId =>
    CANONICAL_IMAGE_TOOL_IDS.includes(candidate);

  const canonicalParameters = (): Record<string, string | number | boolean> => {
    switch (toolId) {
      case 'background-remover': return { tolerance: Number(tolerance) || 42 };
      case 'image-upscaler': return { scale: Number(scale) };
      case 'image-converter': return { format: outputFormat };
      case 'image-effects': return { brightness: Number(advanced.brightness), contrast: Number(advanced.contrast) };
      case 'image-resizer': return { scale: Number(scale) };
      case 'image-rotate-flip': return { rotation: Number(advanced.rotation), flipX: advanced.flipX, flipY: advanced.flipY };
      case 'image-brightness-contrast': return { brightness: Number(advanced.brightness), contrast: Number(advanced.contrast) };
      case 'image-saturation-hue': return { saturation: Number(advanced.saturation), hue: Number(advanced.hue) };
      case 'image-exposure': return { exposure: Number(advanced.exposure) };
      case 'image-highlights-shadows': return { highlights: Number(advanced.highlights), shadows: Number(advanced.shadows) };
      case 'image-sharpen': return { amount: Number(advanced.sharpen) };
      case 'image-blur': return { radius: Number(advanced.blur) };
      case 'image-grayscale-duotone': return { intensity: Number(advanced.duotoneIntensity), darkColor: advanced.darkColor, lightColor: advanced.lightColor };
      case 'image-filters': return { preset: advanced.filter };
      case 'image-watermark': return { text: advanced.watermark, x: Number(advanced.watermarkX), y: Number(advanced.watermarkY), fontSize: Number(advanced.watermarkFontSize), opacity: Number(advanced.watermarkOpacity), color: advanced.watermarkColor };
      case 'image-text-overlay': {
        const params: Record<string, string | number | boolean> = { text: advanced.text, x: Number(advanced.x), y: Number(advanced.y), fontSize: Number(advanced.fontSize), color: '#ffffff', backgroundOpacity: Number(advanced.backgroundOpacity), align: advanced.align };
        if (advanced.background) params.background = advanced.background;
        return params;
      }
      case 'image-draw-annotate': return { kind: advanced.annotationKind, x1: Number(advanced.x1), y1: Number(advanced.y1), x2: Number(advanced.x2), y2: Number(advanced.y2), stroke: advanced.stroke, strokeWidth: Number(advanced.strokeWidth) };
      case 'image-redaction': return { x: Number(advanced.x), y: Number(advanced.y), width: Number(advanced.width), height: Number(advanced.height), color: '#000000' };
      default: return {};
    }
  };


  const run = async () => {
    setBusy(true); setError(''); replaceResult(null);
    try {
      if (isGenerator) {
        if (!prompt.trim()) throw new Error(ui.promptRequired);
        const body = new FormData(); body.append('capability', 'generate-image'); body.append('prompt', prompt.trim());
        const response = await fetch(import.meta.env.VITE_FLIXO_AI_IMAGE_ENDPOINT || '/api/ai/image', { method: 'POST', body });
        if (!response.ok) throw new Error('AI image endpoint is not configured or returned an error.');
        const blob = await response.blob(); if (!blob.type.startsWith('image/')) throw new Error('AI endpoint did not return an image.');
        const info = await imageInfo(blob); replaceResult(await createResult(blob, `flixo-ai-${info.width}x${info.height}.png`, info)); return;
      }
      if (toolId === 'image-upscaler') { const factor = Number(scale); if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) throw new Error('Scale must be between 0.25 and 4.'); }
      if (!file) throw new Error(ui.chooseImageFirst);
      await validateSharedImageInput(file, toolId);
      let blob: Blob; let fileName = baseName(file.name); let info: Result['info'];
      if (isCanonicalImageTool(toolId)) {
        const parameters = canonicalParameters();
        const receipt = await executeCanonicalImageTool({ toolId, inputBlob: file, parameters, origin: 'manual' });
        blob = receipt.outputBlob;
        info = await imageInfo(blob);
        const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
        fileName = baseName(file.name) + '-flixo.' + extension;
      } else if (toolId === 'background-remover') { blob = await removeBackground(file, Number(tolerance) || 42); fileName += '-no-background.png'; }
      else if (toolId === 'image-upscaler') { const factor = Number(scale); blob = await resizeImage(file, factor); fileName += `-upscaled-${factor}x.png`; }
      else if (toolId === 'image-converter') { blob = await convertImage(file, outputFormat); info = await imageInfo(blob); assertImageConverterOutputIntegrity(blob, info); fileName += outputFormat === 'image/jpeg' ? '.jpg' : outputFormat === 'image/png' ? '.png' : '.webp'; }
      else if (toolId === 'image-to-text') { const prepared = await preprocessForOcr(file); const ocr = await recognizeWithOcrWorker(prepared, 'eng+ara'); replaceResult(await createResult(new Blob([ocr.text], { type: 'text/plain;charset=utf-8' }), `${baseName(file.name)}.txt`, undefined, ocr.text)); return; }
      else if (toolId === 'object-remover') { blob = await fillRemoveRegion(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }); fileName += '-object-removed.png'; }
      else if (toolId === 'watermark-remover') { blob = await watermarkRemove(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }); fileName += '-watermark-removed.png'; }
      else if (toolId === 'crop-resize') { blob = await cropResizeImage(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }, { width: Number(outW), height: Number(outH) }); info = await imageInfo(blob); assertImageCropperOutputIntegrity(blob, info); fileName += '-cropped.png'; }
      else if (toolId === 'image-rotate') { blob = await rotateImage(file, 90); fileName += '-rotated.png'; }
      else if (toolId === 'image-flip-horizontal') { blob = await flipImage(file, true); fileName += '-flipped-h.png'; }
      else if (toolId === 'image-flip-vertical') { blob = await flipImage(file, false); fileName += '-flipped-v.png'; }
      else if (toolId === 'image-brightness') { blob = await applyBasicImageEffect(file, 'brightness', 115); fileName += '-brightness.png'; }
      else if (toolId === 'image-contrast') { blob = await applyBasicImageEffect(file, 'contrast', 115); fileName += '-contrast.png'; }
      else if (toolId === 'image-saturation') { blob = await applyBasicImageEffect(file, 'saturation', 115); fileName += '-saturation.png'; }
      else if (toolId === 'image-grayscale') { blob = await applyBasicImageEffect(file, 'grayscale', 100); fileName += '-grayscale.png'; }
      else if (toolId === 'image-invert') { blob = await applyBasicImageEffect(file, 'invert', 100); fileName += '-invert.png'; }
      else if (toolId === 'image-sepia') { blob = await applyBasicImageEffect(file, 'sepia', 100); fileName += '-sepia.png'; }
      else if (toolId === 'image-blur') { blob = await applyBasicImageEffect(file, 'blur', 80); fileName += '-blur.png'; }
      else if (toolId === 'image-sharpen') { blob = await applyBasicImageEffect(file, 'sharpen', 110); fileName += '-sharpen.png'; }
      else if (toolId === 'image-resizer') { throw new Error('UNREACHABLE_CANONICAL_IMAGE_TOOL'); }
      else if (toolId === 'image-hue') { blob = await hueShiftImage(file, 30); fileName += '-hue.png'; }
      else if (toolId === 'image-pixelate') { blob = await pixelateImage(file, 10); fileName += '-pixelated.png'; }
      else if (toolId === 'image-padding') { blob = await padImage(file, 24); fileName += '-padded.png'; }
      else if (toolId === 'image-rounded-corners') { blob = await roundedCornersImage(file, 24); fileName += '-rounded.png'; }
      else { blob = await rasterToSvg(file, Number(columns) || 48); fileName += '.svg'; }
      if (blob.type.startsWith('image/') && !info) info = await imageInfo(blob);
      replaceResult(await createResult(blob, fileName, info));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tool failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div lang={localeMetadata.languageTag} dir={localeMetadata.direction} className="image-tool-shell">
      <div className="image-tool-container">
        <header className="image-tool-header"><div><p className="image-tool-eyebrow">{ui.imageTools}</p><h2>{definition.title}</h2><p className="image-tool-lead">{definition.description}</p></div></header>
        <section className="compressor-grid" aria-label={definition.title}>
          <div className="compressor-card">
            {isGenerator
              ? <label><span>{ui.prompt}</span><textarea data-testid="ai-image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={ui.prompt} rows={6} /></label>
              : <><label className="upload-zone" htmlFor="image-tool-file"><span className="upload-title">{file ? file.name : ui.chooseImage}</span><span className="upload-subtitle">{definition.accept.replaceAll('image/', '').toUpperCase() || ui.imageInput}</span></label><input id="image-tool-file" className="sr-only" type="file" accept={definition.accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></>}
            {toolId === 'image-converter' && <label><span>{ui.outputFormat}</span><select aria-label={ui.outputFormat} value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as typeof outputFormat)}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>}
            {(toolId === 'image-upscaler' || toolId === 'image-resizer') && <label><span>{ui.scale}</span><input aria-label={ui.scale} inputMode="decimal" value={scale} onChange={(event) => setScale(event.target.value)} /></label>}
            {toolId === 'background-remover' && <label><span>{ui.backgroundTolerance}</span><input aria-label={ui.backgroundTolerance} inputMode="numeric" value={tolerance} onChange={(event) => setTolerance(event.target.value)} /></label>}
            {toolId === 'raster-to-svg' && <label><span>{ui.svgColumns}</span><input aria-label={ui.svgColumns} inputMode="numeric" value={columns} onChange={(event) => setColumns(event.target.value)} /></label>}
            {toolId === 'image-rotate-flip' && <div className="control-grid">
              <label><span>Rotation</span><select aria-label="Rotation" value={advanced.rotation} onChange={(event) => setAdvanced((value) => ({ ...value, rotation: event.target.value }))}><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>
              <label><span><input type="checkbox" checked={advanced.flipX} onChange={(event) => setAdvanced((value) => ({ ...value, flipX: event.target.checked }))} /> Flip horizontal</span></label>
              <label><span><input type="checkbox" checked={advanced.flipY} onChange={(event) => setAdvanced((value) => ({ ...value, flipY: event.target.checked }))} /> Flip vertical</span></label>
            </div>}
            {toolId === 'image-brightness-contrast' && <div className="control-grid">
              <label><span>Brightness</span><input aria-label="Brightness" type="range" min="1" max="200" value={advanced.brightness} onChange={(e) => setAdvanced((v) => ({ ...v, brightness: e.target.value }))} /></label>
              <label><span>Contrast</span><input aria-label="Contrast" type="range" min="1" max="200" value={advanced.contrast} onChange={(e) => setAdvanced((v) => ({ ...v, contrast: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-saturation-hue' && <div className="control-grid">
              <label><span>Saturation</span><input aria-label="Saturation" type="range" min="0" max="200" value={advanced.saturation} onChange={(e) => setAdvanced((v) => ({ ...v, saturation: e.target.value }))} /></label>
              <label><span>Hue</span><input aria-label="Hue" type="range" min="-360" max="360" value={advanced.hue} onChange={(e) => setAdvanced((v) => ({ ...v, hue: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-exposure' && <label><span>Exposure</span><input aria-label="Exposure" type="range" min="-4" max="4" step="0.25" value={advanced.exposure} onChange={(e) => setAdvanced((v) => ({ ...v, exposure: e.target.value }))} /></label>}
            {toolId === 'image-highlights-shadows' && <div className="control-grid">
              <label><span>Highlights</span><input aria-label="Highlights" type="range" min="-100" max="100" value={advanced.highlights} onChange={(e) => setAdvanced((v) => ({ ...v, highlights: e.target.value }))} /></label>
              <label><span>Shadows</span><input aria-label="Shadows" type="range" min="-100" max="100" value={advanced.shadows} onChange={(e) => setAdvanced((v) => ({ ...v, shadows: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-sharpen' && <label><span>Sharpen amount</span><input aria-label="Sharpen amount" type="range" min="1" max="200" value={advanced.sharpen} onChange={(e) => setAdvanced((v) => ({ ...v, sharpen: e.target.value }))} /></label>}
            {toolId === 'image-blur' && <label><span>Blur radius</span><input aria-label="Blur radius" type="range" min="1" max="32" value={advanced.blur} onChange={(e) => setAdvanced((v) => ({ ...v, blur: e.target.value }))} /></label>}
            {toolId === 'image-grayscale-duotone' && <div className="control-grid">
              <label><span>Intensity</span><input aria-label="Intensity" type="range" min="1" max="100" value={advanced.duotoneIntensity} onChange={(e) => setAdvanced((v) => ({ ...v, duotoneIntensity: e.target.value }))} /></label>
              <label><span>Dark color</span><input aria-label="Dark color" value={advanced.darkColor} onChange={(e) => setAdvanced((v) => ({ ...v, darkColor: e.target.value }))} /></label>
              <label><span>Light color</span><input aria-label="Light color" value={advanced.lightColor} onChange={(e) => setAdvanced((v) => ({ ...v, lightColor: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-filters' && <label><span>Filter</span><select aria-label="Filter" value={advanced.filter} onChange={(e) => setAdvanced((v) => ({ ...v, filter: e.target.value }))}><option value="vivid">Vivid</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="vintage">Vintage</option><option value="mono">Mono</option><option value="sepia">Sepia</option><option value="cinematic">Cinematic</option></select></label>}
            {toolId === 'image-watermark' && <div className="control-grid">
              <label><span>Watermark text</span><input aria-label="Watermark text" value={advanced.watermark} onChange={(e) => setAdvanced((v) => ({ ...v, watermark: e.target.value }))} /></label>
              <label><span>X %</span><input aria-label="Watermark X" inputMode="numeric" value={advanced.watermarkX} onChange={(e) => setAdvanced((v) => ({ ...v, watermarkX: e.target.value }))} /></label>
              <label><span>Y %</span><input aria-label="Watermark Y" inputMode="numeric" value={advanced.watermarkY} onChange={(e) => setAdvanced((v) => ({ ...v, watermarkY: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-text-overlay' && <div className="control-grid">
              <label><span>Text</span><input aria-label="Overlay text" value={advanced.text} onChange={(e) => setAdvanced((v) => ({ ...v, text: e.target.value }))} /></label>
              <label><span>X %</span><input aria-label="Overlay X" value={advanced.x} onChange={(e) => setAdvanced((v) => ({ ...v, x: e.target.value }))} /></label>
              <label><span>Y %</span><input aria-label="Overlay Y" value={advanced.y} onChange={(e) => setAdvanced((v) => ({ ...v, y: e.target.value }))} /></label>
              <label><span>Font size</span><input aria-label="Overlay font size" value={advanced.fontSize} onChange={(e) => setAdvanced((v) => ({ ...v, fontSize: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-draw-annotate' && <div className="control-grid">
              <label><span>Kind</span><select aria-label="Annotation kind" value={advanced.annotationKind} onChange={(e) => setAdvanced((v) => ({ ...v, annotationKind: e.target.value }))}><option value="arrow">Arrow</option><option value="line">Line</option><option value="rect">Rectangle</option><option value="ellipse">Ellipse</option></select></label>
              <label><span>X1 %</span><input aria-label="X1" value={advanced.x1} onChange={(e) => setAdvanced((v) => ({ ...v, x1: e.target.value }))} /></label>
              <label><span>Y1 %</span><input aria-label="Y1" value={advanced.y1} onChange={(e) => setAdvanced((v) => ({ ...v, y1: e.target.value }))} /></label>
              <label><span>X2 %</span><input aria-label="X2" value={advanced.x2} onChange={(e) => setAdvanced((v) => ({ ...v, x2: e.target.value }))} /></label>
              <label><span>Y2 %</span><input aria-label="Y2" value={advanced.y2} onChange={(e) => setAdvanced((v) => ({ ...v, y2: e.target.value }))} /></label>
            </div>}
            {toolId === 'image-redaction' && <div className="control-grid">
              <label><span>X %</span><input aria-label="Redaction X" value={advanced.x} onChange={(e) => setAdvanced((v) => ({ ...v, x: e.target.value }))} /></label>
              <label><span>Y %</span><input aria-label="Redaction Y" value={advanced.y} onChange={(e) => setAdvanced((v) => ({ ...v, y: e.target.value }))} /></label>
              <label><span>Width %</span><input aria-label="Redaction width" value={advanced.width} onChange={(e) => setAdvanced((v) => ({ ...v, width: e.target.value }))} /></label>
              <label><span>Height %</span><input aria-label="Redaction height" value={advanced.height} onChange={(e) => setAdvanced((v) => ({ ...v, height: e.target.value }))} /></label>
            </div>}
            {['object-remover', 'watermark-remover', 'crop-resize'].includes(toolId) && <div className="control-grid">{([ [ui.x, cropX, setCropX, 'object-x'], [ui.y, cropY, setCropY, 'object-y'], [ui.width, cropW, setCropW, 'object-width'], [ui.height, cropH, setCropH, 'object-height'] ] as const).map(([labelText, value, setter, testId]) => <label key={testId}><span>{labelText}</span><input data-testid={testId} aria-label={labelText} inputMode="numeric" value={value} onChange={(event) => setter(event.target.value)} /></label>)}{toolId === 'crop-resize' && <><label><span>{ui.outputWidth}</span><input aria-label={ui.outputWidth} inputMode="numeric" value={outW} onChange={(event) => setOutW(event.target.value)} /></label><label><span>{ui.outputHeight}</span><input aria-label={ui.outputHeight} inputMode="numeric" value={outH} onChange={(event) => setOutH(event.target.value)} /></label></>}</div>}
            <div className="button-row"><button className="primary-button" disabled={busy || (!file && !isGenerator)} onClick={() => void run()}>{busy ? ui.processing : isGenerator ? ui.generate : ui.run}</button></div>
            {error && <p role="alert" className="error-box">{error}</p>}
            {toolId === 'image-to-text' && <p className="privacy-note">{ui.privacyOcr}</p>}
          </div>
          <aside className="result-card" aria-live="polite"><p className="image-tool-eyebrow">{ui.result}</p>{result ? <>{result.text !== undefined ? <pre style={{ whiteSpace: 'pre-wrap' }}>{result.text || ui.noResult}</pre> : result.objectUrl && <img src={result.objectUrl} alt={ui.toolResult} style={{ maxWidth: '100%', borderRadius: 12 }} />}{result.info && <p className="privacy-note">Output: {result.info.width} × {result.info.height}px · {Math.round(result.blob.size / 1024)} KB · {result.blob.type || 'application/octet-stream'}</p>}<div className="button-row"><a className="primary-button" href={result.objectUrl} download={result.fileName}>{ui.download} {result.fileName}</a><a className="primary-button" role="button" href={result.objectUrl} download={result.fileName}>{ui.downloadNow}</a></div></> : <p>{ui.noResult}</p>}</aside>
        </section>
      </div>
    </div>
  );
}
