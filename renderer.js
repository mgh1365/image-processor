/**
 * Image Processing — Web App (Stable Version)
 */

const STAMP_PATH = 'assets/stamp.png';

let readyImages = []; 
let cropQueue = [];
let currentCropIndex = 0;
let cropperInstance = null;
let imageCounter = 0;

const fileInput = document.getElementById('fileInput');
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const uploadStatus = document.getElementById('uploadStatus');
const fileListCard = document.getElementById('fileListCard');
const fileListContainer = document.getElementById('fileListContainer');

// ——— Helpers ———

function cmToPx(cm, dpi) {
  return Math.round((cm / 2.54) * dpi);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Load Error`));
    img.src = src;
  });
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

function setUploadStatus(msg) {
  uploadStatus.textContent = msg;
}

// تابع ایمن برای استخراج نام فایل بدون پسوند
function getBaseName(fileName) {
  if (!fileName) return `image_${Date.now()}`;
  const lastDot = fileName.lastIndexOf('.');
  return lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
}

// ساخت رشته تاریخ ایمن با پشتیبان میلادی در صورت عدم پشتیبانی مرورگر
function getFormattedTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const timeStr = pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  
  try {
    const options = { calendar: 'persian', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' };
    const pDate = new Intl.DateTimeFormat('fa-IR', options).format(d);
    const dateStr = pDate.replace(/\//g, '');
    return `${dateStr},${timeStr}`;
  } catch (err) {
    // در صورتی که مرورگر تاریخ شمسی را پشتیبانی نکرد
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    return `${y}${m}${day},${timeStr}`;
  }
}

// ——— Crop & List Logic ———

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  setUploadStatus('در حال آماده‌سازی تصاویر...');
  
  // پاک‌سازی قبلی‌ها
  readyImages.forEach(item => URL.revokeObjectURL(item.blobUrl));
  readyImages = [];
  cropQueue = [];
  currentCropIndex = 0;
  fileListContainer.innerHTML = '';
  fileListCard.style.display = 'none';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      if (img.width !== img.height) {
        cropQueue.push({ originalName: file.name, blobUrl: objectUrl });
      } else {
        readyImages.push({ id: `img_${imageCounter++}`, originalName: file.name, blobUrl: objectUrl });
      }
    } catch (err) {
      console.warn('Cannot load image:', file.name);
    }
  }
  
  // ریست کردن اینپوت برای اینکه کاربر بتواند همان فایل‌ها را دوباره انتخاب کند
  fileInput.value = '';

  processCropQueue();
});

function processCropQueue() {
  if (currentCropIndex < cropQueue.length) {
    const currentItem = cropQueue[currentCropIndex];
    document.getElementById('cropModalText').textContent = `کادر برش را برای تصویر تنظیم کنید.`;
    
    cropImage.src = currentItem.blobUrl;
    cropModal.style.display = 'flex';

    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      background: false,
    });
  } else {
    cropModal.style.display = 'none';
    renderFileList();
  }
}

confirmCropBtn.addEventListener('click', () => {
  if (!cropperInstance) return;

  const canvas = cropperInstance.getCroppedCanvas({ fillColor: '#fff' });
  canvas.toBlob((blob) => {
    const currentItem = cropQueue[currentCropIndex];
    readyImages.push({
      id: `img_${imageCounter++}`,
      originalName: currentItem.originalName,
      blobUrl: URL.createObjectURL(blob)
    });

    currentCropIndex++;
    processCropQueue();
  }, 'image/jpeg', 1.0);
});

// رندر ایمن و ساده لیست
function renderFileList() {
  if (readyImages.length === 0) {
    setUploadStatus('تصویری آماده نشد.');
    return;
  }
  
  setUploadStatus(`تعداد ${readyImages.length} تصویر آماده پردازش است.`);
  fileListCard.style.display = 'block';
  fileListContainer.innerHTML = '';

  readyImages.forEach(item => {
    const row = document.createElement('div');
    row.className = 'file-item';

    const thumb = document.createElement('img');
    thumb.src = item.blobUrl;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `nameInput_${item.id}`;
    
    const baseName = getBaseName(item.originalName);
    input.placeholder = `نام دلخواه (پیش‌فرض: ${baseName})`;

    row.appendChild(thumb);
    row.appendChild(input);
    fileListContainer.appendChild(row);
  });
}

// ——— Processing Logic ———

function resizeToSquare(img, sizePx) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx; canvas.height = sizePx;
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
  canvas.width = w; canvas.height = h;
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
  const w = canvas.width; const h = canvas.height;

  const maxStampW = Math.round(w * 0.25);
  const stampW = Math.min(stampImg.naturalWidth, maxStampW);
  const stampH = Math.round((stampImg.naturalHeight / stampImg.naturalWidth) * stampW);

  const margin = Math.round(w * 0.025);
  const sx = margin; const sy = h - stampH - margin;

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
    setStatus('تصویری برای پردازش وجود ندارد.');
    return;
  }

  const sizeCm      = parseFloat(document.getElementById('sizeInput').value) || 15;
  const dpi         = parseInt(document.getElementById('dpiInput').value) || 150;
  const targetKB    = parseFloat(document.getElementById('targetSizeInput').value) || 200;
  const borderW     = parseInt(document.getElementById('borderWidthInput').value) || 0;
  const canvasEx    = parseInt(document.getElementById('canvasExpandInput').value) || 0;
  const borderC     = document.getElementById('borderColorInput').value;
  const doStamp     = document.getElementById('stampEnabledInput').checked;

  const sizePx = cmToPx(sizeCm, dpi);
  const timestampSuffix = getFormattedTimestamp();

  let stampImg = null;
  if (doStamp) {
    try {
      stampImg = await loadImage(STAMP_PATH);
    } catch {
      setStatus('⚠️ مهر یافت نشد - ادامه بدون مهر');
    }
  }

  setStatus(`در حال پردازش...`);

  for (let i = 0; i < readyImages.length; i++) {
    const currentItem = readyImages[i];
    setStatus(`در حال پردازش ${i + 1} از ${readyImages.length}...`);

    try {
      const img = await loadImage(currentItem.blobUrl);
      let canvas = resizeToSquare(img, sizePx);
      canvas = applyBorder(canvas, borderW, borderC, canvasEx);
      if (stampImg) {
        canvas = await applyStamp(canvas, stampImg);
      }
      
      const blob = await compressToTargetSize(canvas, targetKB);

      // تشخیص نام فایل
      const inputEl = document.getElementById(`nameInput_${currentItem.id}`);
      let customName = inputEl && inputEl.value.trim() !== '' ? inputEl.value.trim() : getBaseName(currentItem.originalName);
      
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const finalFileName = `${customName}_${timestampSuffix}.${ext}`;

      // دانلود
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      setStatus(`❌ خطا در پردازش: ${err.message}`);
    }
  }

  setStatus(`✅ عملیات کامل شد.`);
}

document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
