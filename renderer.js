/**
 * Image Processing — Web App (GitHub Pages)
 * مهر: پایین چپ، عرض max 25% عرض تصویر، فاصله 5% از گوشه
 */

const STAMP_PATH = 'assets/stamp.png';

// ——— helpers ———

function cmToPx(cm, dpi) {
  return Math.round((cm / 2.54) * dpi);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`بارگذاری تصویر ناموفق: ${src}`));
    img.src = src;
  });
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق'));
    reader.readAsDataURL(file);
  });
}

/**
 * تغییر اندازه به مربع با حفظ نسبت تصویر (letterbox با پس‌زمینه سفید)
 */
function resizeToSquare(img, sizePx) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sizePx, sizePx);

  const ratio = Math.min(sizePx / img.width, sizePx / img.height);
  const dw = Math.round(img.width * ratio);
  const dh = Math.round(img.height * ratio);
  const dx = Math.round((sizePx - dw) / 2);
  const dy = Math.round((sizePx - dh) / 2);

  ctx.drawImage(img, dx, dy, dw, dh);
  return canvas;
}

/**
 * اعمال حاشیه با border-radius=5 و توسعه اختیاری بوم
 */
function applyBorder(srcCanvas, borderWidth, borderColor, expandCanvas) {
  const expand = expandCanvas ? 2 : 0;
  const total = borderWidth + expand;

  const w = srcCanvas.width + total * 2;
  const h = srcCanvas.height + total * 2;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // لایه سفید برای توسعه بوم
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  if (borderWidth > 0) {
    // رسم حاشیه با border-radius=5
    const bx = expand;
    const by = expand;
    const bw = srcCanvas.width + borderWidth * 2;
    const bh = srcCanvas.height + borderWidth * 2;
    const r = 5;

    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();

    ctx.fillStyle = borderColor;
    ctx.fill();
  }

  // تصویر اصلی روی حاشیه
  ctx.drawImage(srcCanvas, total, total);

  return canvas;
}

/**
 * اعمال مهر در گوشه پایین چپ
 * عرض مهر = min(stampNaturalWidth, 25% عرض canvas)
 * فاصله از گوشه = 5% عرض canvas
 */
async function applyStamp(canvas, stampImg) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const maxStampW = Math.round(w * 0.25);
  const stampW = Math.min(stampImg.naturalWidth, maxStampW);
  const stampH = Math.round((stampImg.naturalHeight / stampImg.naturalWidth) * stampW);

  const margin = Math.round(w * 0.05);
  const sx = margin;                      // پایین چپ — X از چپ
  const sy = h - stampH - margin;        // پایین چپ — Y از بالا

  ctx.drawImage(stampImg, sx, sy, stampW, stampH);
  return canvas;
}

/**
 * فشرده‌سازی با جستجوی دودویی برای رسیدن به حجم هدف (KB)
 */
async function compressToTargetSize(canvas, targetKB) {
  const targetBytes = targetKB * 1024;

  // اگر PNG بدون فشرده‌سازی کوچک‌تر از هدف بود، همانطور برگردان
  const pngBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  if (pngBlob.size <= targetBytes) {
    return pngBlob;
  }

  // جستجوی دودویی روی کیفیت JPEG
  let lo = 0.01, hi = 0.99, best = null;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const blob = await new Promise(res =>
      canvas.toBlob(b => res(b), 'image/jpeg', mid)
    );
    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // اگر حتی با کمترین کیفیت هم بزرگ‌تر بود
  if (!best) {
    best = await new Promise(res =>
      canvas.toBlob(b => res(b), 'image/jpeg', 0.01)
    );
  }

  return best;
}

// ——— main ———

document.getElementById('processBtn').addEventListener('click', async () => {
  const files = document.getElementById('fileInput').files;
  if (!files.length) {
    setStatus('لطفاً ابتدا تصاویر را انتخاب کنید.');
    return;
  }

  const sizeCm     = parseFloat(document.getElementById('sizeInput').value) || 15;
  const dpi        = parseInt(document.getElementById('dpiInput').value) || 96;
  const targetKB   = parseFloat(document.getElementById('targetSizeInput').value) || 200;
  const borderW    = parseInt(document.getElementById('borderWidthInput').value) || 0;
  const borderC    = document.getElementById('borderColorInput').value;
  const doExpand   = document.getElementById('canvasExpandInput').checked;
  const doStamp    = document.getElementById('stampEnabledInput').checked;

  const sizePx = cmToPx(sizeCm, dpi);

  // بارگذاری مهر (یکبار)
  let stampImg = null;
  if (doStamp) {
    try {
      stampImg = await loadImage(STAMP_PATH);
    } catch {
      setStatus('⚠️ مهر بارگذاری نشد — ادامه بدون مهر');
    }
  }

  setStatus(`در حال پردازش ۰ از ${files.length}...`);

  for (let i = 0; i < files.length; i++) {
    setStatus(`در حال پردازش ${i + 1} از ${files.length}...`);

    try {
      const dataURL = await fileToDataURL(files[i]);
      const img = await loadImage(dataURL);

      // ۱. تغییر اندازه
      let canvas = resizeToSquare(img, sizePx);

      // ۲. حاشیه
      canvas = applyBorder(canvas, borderW, borderC, doExpand);

      // ۳. مهر
      if (stampImg) {
        canvas = await applyStamp(canvas, stampImg);
      }

      // ۴. فشرده‌سازی
      const blob = await compressToTargetSize(canvas, targetKB);

      // ۵. دانلود
      const ext  = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const name = files[i].name.replace(/\.[^/.]+$/, '') + '_processed.' + ext;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      setStatus(`❌ خطا در پردازش فایل ${files[i].name}: ${err.message}`);
    }
  }

  setStatus(`✅ پردازش ${files.length} تصویر کامل شد.`);
});

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}
