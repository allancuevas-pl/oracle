// Extract embedded property photos from an IM PDF, entirely in the browser.
//
// IMs embed real photos as image XObjects. We walk each page's operator list,
// pull the painted images, skip anything too small to be a real photo (logos,
// icons, map pins), and return the largest few as JPEG blobs ready to upload.
//
// Done client-side on purpose: the browser already has the file, pdf.js is
// mature here, and it avoids a heavy Node action / native image deps in Convex.

import * as pdfjsLib from 'pdfjs-dist';
// Let Vite bundle and instantiate the worker (the ?worker form) — far more
// reliable in production than pointing workerSrc at an emitted .mjs URL, which
// can fail to load as a module worker.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const DEFAULTS = { max: 12, minDim: 350, maxPages: 25, quality: 0.82 };

// Resolve a page image object by name (pdf.js populates these asynchronously).
// CRITICAL: time out per image — some images never decode (unsupported masks /
// formats), and pdf.js simply never fires the callback, which would otherwise
// hang the whole extraction forever.
function getImageObj(page, name) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    try {
      page.objs.get(name, (obj) => { clearTimeout(timer); resolve(obj); });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// Draw a pdf.js image object onto a canvas and export as a JPEG blob.
function imageObjToBlob(obj, quality) {
  return new Promise((resolve) => {
    try {
      const w = obj.width ?? obj.bitmap?.width;
      const h = obj.height ?? obj.bitmap?.height;
      if (!w || !h) return resolve(null);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (obj.bitmap) {
        // Modern pdf.js decodes to an ImageBitmap — easiest path.
        ctx.drawImage(obj.bitmap, 0, 0);
      } else if (obj.data) {
        const imgData = ctx.createImageData(w, h);
        const src = obj.data;
        const dst = imgData.data;
        if (src.length === w * h * 4) {
          dst.set(src); // RGBA
        } else if (src.length === w * h * 3) {
          for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
            dst[j] = src[i]; dst[j + 1] = src[i + 1]; dst[j + 2] = src[i + 2]; dst[j + 3] = 255;
          }
        } else if (src.length === w * h) {
          for (let i = 0, j = 0; i < src.length; i += 1, j += 4) {
            dst[j] = dst[j + 1] = dst[j + 2] = src[i]; dst[j + 3] = 255; // grayscale
          }
        } else {
          return resolve(null); // unsupported encoding (mask, JBIG2, etc.)
        }
        ctx.putImageData(imgData, 0, 0);
      } else {
        return resolve(null);
      }

      // Reject blank / near-white images. These rank high by pixel area (cover
      // backgrounds, floor-plan whitespace, or images pdf.js hands back in a
      // colorspace the canvas renders as white) but aren't real photos. Sample
      // pixels and skip anything overwhelmingly white or near-uniform.
      if (isBlank(ctx, w, h)) return resolve(null);

      canvas.toBlob(
        (b) => resolve(b ? { blob: b, w, h, area: w * h } : null),
        'image/jpeg',
        quality,
      );
    } catch {
      resolve(null);
    }
  });
}

// True if the rendered image is mostly white or has almost no tonal variation.
function isBlank(ctx, w, h) {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(1, Math.floor((w * h) / 4000)) * 4; // ~4k samples
    let n = 0, white = 0, sum = 0, sumSq = 0;
    for (let i = 0; i < data.length; i += step) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      n++;
      if (data[i] > 243 && data[i + 1] > 243 && data[i + 2] > 243) white++;
      sum += lum; sumSq += lum * lum;
    }
    if (!n) return true;
    const whiteFrac = white / n;
    const variance = sumSq / n - (sum / n) ** 2;
    return whiteFrac > 0.9 || variance < 35; // mostly white, or near-flat tone
  } catch {
    return false; // if we can't sample, keep it rather than drop a real photo
  }
}

/**
 * Extract up to `max` property photos from a PDF File.
 * Returns an array of JPEG Blobs (largest first). Never throws — returns [] on failure.
 */
export async function extractPhotosFromPdf(file, opts = {}) {
  const { max, minDim, maxPages, quality } = { ...DEFAULTS, ...opts };
  try {
    const buf = await file.arrayBuffer();
    // Guard the whole document load so a non-responsive worker can't hang forever.
    const pdf = await Promise.race([
      pdfjsLib.getDocument({ data: buf }).promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('pdf load timed out')), 20000)),
    ]);
    const candidates = [];
    const seen = new Set();
    const pageLimit = Math.min(pdf.numPages, maxPages);
    let processed = 0;
    const MAX_IMAGES = 50;          // bound total decode work so big IMs stay fast
    const MIN_PHOTO_BYTES = 25_000; // real photos compress large; this drops maps/logos/diagrams

    outer:
    for (let p = 1; p <= pageLimit; p++) {
      const page = await pdf.getPage(p);
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== pdfjsLib.OPS.paintImageXObject) continue;
        const name = ops.argsArray[i]?.[0];
        if (typeof name !== 'string' || seen.has(name)) continue;
        seen.add(name);
        if (++processed > MAX_IMAGES) break outer;

        const obj = await getImageObj(page, name);
        if (!obj) continue;
        const w = obj.width ?? obj.bitmap?.width ?? 0;
        const h = obj.height ?? obj.bitmap?.height ?? 0;
        if (Math.max(w, h) < minDim) continue; // skip logos / icons / pins

        const res = await imageObjToBlob(obj, quality); // null if blank/white/undecodable
        if (res?.blob && res.blob.size >= MIN_PHOTO_BYTES) candidates.push(res);
        if (candidates.length >= max) break outer; // collected enough real photos
      }
    }

    // Rank by JPEG byte size, not pixel area: a detailed photo compresses large,
    // while a blank/near-white image (even a big one) compresses tiny. This puts
    // the real exterior/interior shots first and pushes low-content images last.
    candidates.sort((a, b) => b.blob.size - a.blob.size);
    return candidates.slice(0, max).map((c) => c.blob);
  } catch (err) {
    console.warn('[photos] pdf.js extraction error:', err);
    return [];
  }
}
