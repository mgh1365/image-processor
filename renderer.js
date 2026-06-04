/**
 * Image Processing — Web App (Format Resilient Version)
 */

const STAMP_PATH = 'assets/stamp.png';

let readyImages = []; 
let processQueue = [];
let currentProcessIndex = 0;
let cropperInstance = null;
let imageCounter = 0;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const uploadStatus = document.getElementById('uploadStatus');
const fileListCard = document.getElementById('fileListCard');
const fileListContainer = document.getElementById('fileListContainer');
const cropModalTitle = document.getElementById('cropModalTitle');

// Editor controls
const rotationSlider = document.getElementById('rotationSlider');
const brightnessSlider = document.getElementById('brightnessSlider');
const contrastSlider = document.getElementById('contrastSlider');
const saturateSlider = document.getElementById('saturateSlider');

// Value displays
const rotationValue = document.getElementById('rotationValue');
const brightnessValue = document.getElementById('brightnessValue');
const contrastValue = document.getElementById('contrastValue');
const saturateValue = document.getElementById('saturateValue');

// --- Helpers ---
function cmToPx(cm, dpi) { return Math.round((cm / 2.54) * dpi); }

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`خطا در بارگذاری تصویر: ${src}`));
    img.src = src;
  });
}

function setStatus(msg) { 
  console.log("Status:", msg);
  document.getElementById('status').textContent = msg; 
}
function setUploadStatus(msg) { uploadStatus.textContent = msg; }

function getBaseName(fileName) {
  if (!fileName) return `image_${Date.now()}`;
  const lastDot = fileName.lastIndexOf('.');
  return lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
}

function getFormattedTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const timeStr = pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  try {
    const pDate = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    return `${pDate.replace(/\//g, '')},${timeStr}`;
  } catch (err) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())},${timeStr}`;
  }
}

// --- Clear List Logic ---
function clearList() {
  readyImages.forEach(item => URL.revokeObjectURL(item.blobUrl));
  processQueue.forEach(item => URL.revokeObjectURL(item.blobUrl));
  
  readyImages = [];
  processQueue = [];
  currentProcessIndex = 0;
  fileInput.value = '';
  
  fileListContainer.innerHTML = '';
  fileListCard.style.display = 'none';
  cropModal.style.display = 'none';
  
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  
  setUploadStatus('لیست تصاویر کاملاً پاک شد.');
  setStatus('');
}

document.getElementById('clearBtnTop').addEventListener('click', clearList);
document.getElementById('clearBtnBottom').addEventListener('click', clearList);

// --- Editor & Queue Logic ---
fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  setUploadStatus('در حال آماده‌سازی تصاویر...');
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const objectUrl = URL.createObjectURL(file);
    processQueue.push({ originalName: file.name, blobUrl: objectUrl });
  }
  
  fileInput.value = '';
  startNextInQueue();
});

function startNextInQueue() {
  if (currentProcessIndex < processQueue.length) {
    const currentItem = processQueue[currentProcessIndex];
    cropModalTitle.textContent = `تنظیمات تصویر (${currentProcessIndex + 1} از ${processQueue.length})`;
    
    resetEditorControls();
    
    cropImage.src = currentItem.blobUrl;
    cropModal.style.display = 'flex';

    if (cropperInstance) cropperInstance.destroy();

    cropImage.onload = () => {
      cropperInstance = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        background: false,
        ready: function () {
          updateFilterPreview();
        }
      });
    };
  } else {
    cropModal.style.display = 'none';
    renderFileList();
    processQueue = [];
    currentProcessIndex = 0;
  }
}

function resetEditorControls() {
  rotationSlider.value = 0;
  brightnessSlider.value = 100;
  contrastSlider.value = 100;
  saturateSlider.value = 100;
  
  rotationValue.textContent = '0';
  brightnessValue.textContent = '100';
  contrastValue.textContent = '100';
  saturateValue.textContent = '100';
}

function updateFilterPreview() {
  const cropperImages = document.querySelectorAll('.cropper-container img');
  const filterString = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
  
  cropperImages.forEach(img => {
    img.style.filter = filterString;
  });
}

rotationSlider.addEventListener('input', (e) => {
  if (cropperInstance) {
    cropperInstance.rotateTo(Number(e.target.value));
    rotationValue.textContent = e.target.value;
  }
});
brightnessSlider.addEventListener('input', (e) => { brightnessValue.textContent = e.target.value; updateFilterPreview(); });
contrastSlider.addEventListener('input', (e) => { contrastValue.textContent = e.target.value; updateFilterPreview(); });
saturateSlider.addEventListener('input', (e) => { saturateValue.textContent = e.target.value; updateFilterPreview(); });

confirmCropBtn.addEventListener('click', () => {
  if (!cropperInstance) return;

  const currentItem = processQueue[currentProcessIndex];
  
  // این مرحله تصویر را به صورت استاندارد در یک Canvas پردازش می‌کند تا مشکل فرمت‌های نامتعارف حل شود
  const croppedCanvas = cropperInstance.getCroppedCanvas({
    fillColor: '#ffffff',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  if (!croppedCanvas) {
    alert("خطا در برش تصویر. فرمت تصویر ممکن است پشتیبانی نشود.");
    currentProcessIndex++;
    startNextInQueue();
    return;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = croppedCanvas.width;
  finalCanvas.height = croppedCanvas.height;
  const finalCtx = finalCanvas.getContext('2d');
  
  finalCtx.filter = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
  finalCtx.drawImage(croppedCanvas, 0, 0);

  // تمام تصاویر اینجا به فرمت استاندارد JPEG با بالاترین کیفیت تبدیل و ذخیره موقت می‌شوند
  finalCanvas.toBlob((blob) => {
    if(!blob) {
       console.error("خطا در ساخت Blob از تصویر");
       currentProcessIndex++;
       startNextInQueue();
       return;
    }

    readyImages.push({
      id: `img_${imageCounter++}`,
      originalName: currentItem.originalName,
      blobUrl: URL.createObjectURL(blob)
    });

    currentProcessIndex++;
    startNextInQueue();
  }, 'image/jpeg', 0.98);
});

function renderFileList() {
  if (readyImages.length === 0) {
    setUploadStatus('لیست تصاویر خالی است.');
    return;
  }
  
  setUploadStatus(`تعداد ${readyImages.length} تصویر در لیست آماده پردازش است.`);
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

// --- Final Processing Logic ---
async function startProcessing() {
  if (!readyImages.length) {
    setStatus('❌ تصویری در لیست برای پردازش وجود ندارد.');
    return;
  }

  try {
    const sizeCm = parseFloat(document.getElementById('sizeInput').value) || 15;
    const dpi = parseInt(document.getElementById('dpiInput').value) || 150;
    const targetKB = parseFloat(document.getElementById('targetSizeInput').value) || 200;
    const borderW = parseInt(document.getElementById('borderWidthInput').value) || 0;
    const canvasEx = parseInt(document.getElementById('canvasExpandInput').value) || 0;
    const borderC = document.getElementById('borderColorInput').value;
    const doStamp = document.getElementById('stampEnabledInput').checked;

    const sizePx = cmToPx(sizeCm, dpi);
    const timestampSuffix = getFormattedTimestamp();

    let stampImg = null;
    if (doStamp) {
      try { 
        stampImg = await loadImage(STAMP_PATH); 
      } catch (e) { 
        console.warn('مهر یافت نشد.');
        setStatus('⚠️ مهر یافت نشد - ادامه پردازش بدون مهر...'); 
      }
    }

    setStatus('⏳ در حال آماده‌سازی پردازش...');

    for (let i = 0; i < readyImages.length; i++) {
      const currentItem = readyImages[i];
      setStatus(`⏳ در حال پردازش تصویر ${i + 1} از ${readyImages.length}...`);

      try {
        const img = await loadImage(currentItem.blobUrl);
        let canvas = resizeToSquare(img, sizePx);
        canvas = applyBorder(canvas, borderW, borderC, canvasEx);
        
        if (stampImg) {
          canvas = await applyStamp(canvas, stampImg);
        }
        
        const blob = await compressToTargetSize(canvas, targetKB);
        if (!blob) throw new Error("خطا در مرحله فشرده‌سازی تصویر.");

        const inputEl = document.getElementById(`nameInput_${currentItem.id}`);
        let customName = inputEl && inputEl.value.trim() !== '' ? inputEl.value.trim() : getBaseName(currentItem.originalName);
        
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        const finalFileName = `${customName}_${timestampSuffix}.${ext}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

      } catch (err) {
        console.error(`خطا در تصویر ${i + 1}:`, err);
        setStatus(`❌ خطا در تصویر ${i + 1}: ${err.message}`);
        // یک مکث کوتاه برای دیده شدن خطا، سپس ادامه برای تصویر بعدی
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setStatus(`✅ عملیات پردازش و دانلود به طور کامل انجام شد.`);
  } catch (globalErr) {
    console.error("خطای کلی:", globalErr);
    setStatus(`❌ خطای پیش‌بینی نشده: ${globalErr.message}`);
  }
}

function resizeToSquare(img, sizePx) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx; canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return canvas;
}

function applyBorder(srcCanvas, borderWidth, borderColor, expandValue) {
  const expand = expandValue > 0 ? expandValue : 0;
  const w = srcCanvas.width + expand * 2, h = srcCanvas.height + expand * 2;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  canvas.width = w; canvas.height = h;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(srcCanvas, expand, expand);
  if (borderWidth > 0) {
    const bx = expand, by = expand;
    ctx.strokeStyle = borderColor; 
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(bx + borderWidth / 2, by + borderWidth / 2, srcCanvas.width - borderWidth, srcCanvas.height - borderWidth);
  }
  return canvas;
}

async function applyStamp(canvas, stampImg) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  const maxStampW = Math.round(w * 0.25), stampW = Math.min(stampImg.naturalWidth, maxStampW);
  const stampH = Math.round((stampImg.naturalHeight / stampImg.naturalWidth) * stampW);
  const margin = Math.round(w * 0.025), sx = margin, sy = h - stampH - margin;
  
  ctx.drawImage(stampImg, sx, sy, stampW, stampH);
  return canvas;
}

async function compressToTargetSize(canvas, targetKB) {
  const targetBytes = targetKB * 1024;
  let quality = 0.95; // شروع با کیفیت بسیار بالا
  
  let currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));

  // کاهش کیفیت تا رسیدن به حجم مورد نظر
  while (currentBlob && currentBlob.size > targetBytes && quality > 0.1) {
    quality -= 0.1;
    currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));
  }
  
  if (currentBlob && currentBlob.size > targetBytes) {
      currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.1));
  }

  // تلاش برای ساخت PNG به عنوان آخرین راهکار در صورتی که حجم بهتری بدهد (مخصوص تصاویر ساده)
  const pngBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  if (pngBlob && currentBlob && pngBlob.size < currentBlob.size) {
    return pngBlob;
  }

  return currentBlob;
}

document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
