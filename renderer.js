/**
 * Image Processing — Web App (GitHub Pages)
 */

const STAMP_PATH = 'assets/stamp.png';

// آرایه‌ای برای نگهداری تصاویر آماده پردازش (فایل‌های اصلی یا کراپ شده)
let readyImages = []; 
// صف تصاویری که نیاز به کراپ دارند
let cropQueue = [];
let currentCropIndex = 0;
let cropperInstance = null;

// المان‌های مربوط به کراپ
const fileInput = document.getElementById('fileInput');
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const uploadStatus = document.getElementById('uploadStatus');

// ——— Helpers ———

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

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

function setUploadStatus(msg) {
  uploadStatus.textContent = msg;
}

// ——— Crop Logic ———

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;

  setUploadStatus('در حال بررسی ابعاد تصاویر...');
  
  // پاکسازی وضعیت قبلی
  readyImages.forEach(item => URL.revokeObjectURL(item.blobUrl));
  readyImages = [];
  cropQueue = [];
  currentCropIndex = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      // بررسی مربع بودن
      if (img.width !== img.height) {
        cropQueue.push({ name: file.name, blobUrl: objectUrl });
      } else {
        readyImages.push({ name: file.name, blobUrl: objectUrl });
      }
    } catch (err) {
      console.error(err);
    }
  }

  processCropQueue();
});

function processCropQueue() {
  if (currentCropIndex < cropQueue.length) {
    const currentItem = cropQueue[currentCropIndex];
    document.getElementById('cropModalText').textContent = `تصویر "${currentItem.name}" مربع نیست، لطفاً بخش مورد نظر را برای برش مشخص کنید.`;
    
    cropImage.src = currentItem.blobUrl;
    cropModal.classList.remove('hidden');

    // ایجاد نمونه جدید از Cropper
    if (cropperInstance) cropperInstance.destroy();
    
    cropperInstance = new Cropper(cropImage, {
      aspectRatio: 1, // اجبار به کادر مربعی
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      background: false,
    });
  } else {
    // صف کراپ تمام شده است
    cropModal.classList.add('hidden');
    if (readyImages.length > 0) {
      setUploadStatus(`تعداد ${readyImages.length} تصویر آماده پردازش است.`);
    } else {
      setUploadStatus('هیچ تصویری انتخاب نشده است.');
    }
  }
}

confirmCropBtn.addEventListener('click', () => {
  if (!cropperInstance) return;

  // دریافت بوم کراپ شده
  const canvas = cropperInstance.getCroppedCanvas({ fillColor: '#fff' });
  
  canvas.toBlob((blob) => {
    const currentItem = cropQueue[currentCropIndex];
    // افزودن تصویر کراپ شده به لیست آماده‌ها
    readyImages.push({
      name: currentItem.name,
      blobUrl: URL.createObjectURL(blob)
    });

    currentCropIndex++;
    processCropQueue();
  }, 'image/jpeg', 1.0);
});

// ——— Processing Functions ———

function resizeToSquare(img, sizePx) {
  // این تابع اکنون تصویر را دریافت می‌کند. اگر پیشتر کراپ شده باشد یا مربع باشد، فقط ریسایز می‌شود.
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

function applyBorder(srcCanvas, borderWidth, borderColor, expandValue) {
  const expand = expandValue > 0 ? expandValue : 0;
  const w = srcCanvas.width + expand * 2;
  const h = srcCanvas.height + expand * 2;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(srcCanvas, expand, expand);

  if (borderWidth > 0) {
    const r = 5;
    const bx = expand + (borderWidth / 2);
    const by = expand + (borderWidth / 2);
    const bw = srcCanvas.width - borderWidth;
    const bh = srcCanvas.height - borderWidth;

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

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  return canvas;
}

async function applyStamp(canvas, stampImg) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const maxStampW = Math.round(w * 0.25);
  const stampW = Math.min(stampImg.naturalWidth, maxStampW);
  const stampH = Math.round((stampImg.naturalHeight / stampImg.naturalWidth) * stampW);

  const margin = Math.round(w * 0.025);
  const sx = margin;
  const sy = h - stampH - margin;

  ctx.drawImage(stampImg, sx, sy, stampW, stampH);
  return canvas;
}

async function compressToTargetSize(canvas, targetKB) {
  const targetBytes = targetKB * 1024;
  const pngBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  if (pngBlob.size <= targetBytes) return pngBlob;

  let lo = 0.01, hi = 0.99, best = null;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const blob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', mid));
    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (!best) {
    best = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.01));
  }
  return best;
}

// ——— Main Execution ———

async function startProcessing() {
  if (!readyImages.length) {
    setStatus('لطفاً ابتدا تصاویر را انتخاب و در صورت نیاز کراپ کنید.');
    return;
  }

  const sizeCm      = parseFloat(document.getElementById('sizeInput').value) || 15;
  const dpi         = parseInt(document.getElementById('dpiInput').value) || 96;
  const targetKB    = parseFloat(document.getElementById('targetSizeInput').value) || 200;
  const borderW     = parseInt(document.getElementById('borderWidthInput').value) || 0;
  const canvasEx    = parseInt(document.getElementById('canvasExpandInput').value) || 0;
  const borderC     = document.getElementById('borderColorInput').value;
  const doStamp     = document.getElementById('stampEnabledInput').checked;

  const sizePx = cmToPx(sizeCm, dpi);

  let stampImg = null;
  if (doStamp) {
    try {
      stampImg = await loadImage(STAMP_PATH);
    } catch {
      setStatus('⚠️ مهر بارگذاری نشد — ادامه بدون مهر');
    }
  }

  setStatus(`در حال پردازش ۰ از ${readyImages.length}...`);

  for (let i = 0; i < readyImages.length; i++) {
    setStatus(`در حال پردازش ${i + 1} از ${readyImages.length}...`);

    try {
      const img = await loadImage(readyImages[i].blobUrl);

      // ۱. تغییر اندازه نهایی
      let canvas = resizeToSquare(img, sizePx);

      // ۲. حاشیه
      canvas = applyBorder(canvas, borderW, borderC, canvasEx);

      // ۳. مهر
      if (stampImg) {
        canvas = await applyStamp(canvas, stampImg);
      }

      // ۴. فشرده‌سازی
      const blob = await compressToTargetSize(canvas, targetKB);

      // ۵. دانلود
      const ext  = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const name = readyImages[i].name.replace(/\.[^/.]+$/, '') + '_processed.' + ext;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      setStatus(`❌ خطا در پردازش فایل ${readyImages[i].name}: ${err.message}`);
    }
  }

  setStatus(`✅ پردازش ${readyImages.length} تصویر کامل شد.`);
}

// اتصال هر دو دکمه اجرا (بالا و پایین) به تابع پردازش
document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
