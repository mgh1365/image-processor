/**
 * Image Processing — Web App (v3.4 - Fixes applied: Clear All, Live Filter, High-Res Stamp + Hidden Text Watermark)
 */

const STAMP_PATH = 'assets/stamp.png';
const SECRET_CHARS = ['n', 'o', 'r', 'u', 'z', 'k', 'h', 'a', 'n'];

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
    img.onerror = () => reject(new Error(`Load Error for ${src}`));
    img.src = src;
  });
}

function setStatus(msg) { document.getElementById('status').textContent = msg; }
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

// --- Hidden Watermark Logic ---
function getAverageColor(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < imgData.length; i += 40) {
    r += imgData[i]; g += imgData[i + 1]; b += imgData[i + 2];
    count++;
  }
  return `rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`;
}

function applyScatteredWatermark(canvas, textArray) {
  const ctx = canvas.getContext('2d');
  const avgColor = getAverageColor(canvas);
  
  ctx.fillStyle = avgColor;
  ctx.font = '8px Arial';
  ctx.globalAlpha = 0.8;
  
  textArray.forEach(char => {
    if (char.trim() === '') return;
    const x = Math.random() * (canvas.width - 20) + 10;
    const y = Math.random() * (canvas.height - 20) + 10;
    ctx.fillText(char, x, y);
  });
  
  ctx.globalAlpha = 1.0;
  return canvas;
}

// --- Clear List Logic ---
function clearList() {
  // Release memory
  readyImages.forEach(item => URL.revokeObjectURL(item.blobUrl));
  processQueue.forEach(item => URL.revokeObjectURL(item.blobUrl));
  
  // Reset states
  readyImages = [];
  processQueue = [];
  currentProcessIndex = 0;
  fileInput.value = '';
  
  // Reset UI
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
  // Target ALL images inside the Cropper container to ensure the crop box itself shows the filter
  const cropperImages = document.querySelectorAll('.cropper-container img');
  const filterString = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
  
  cropperImages.forEach(img => {
    img.style.filter = filterString;
  });
}

// Event listeners for editor controls
rotationSlider.addEventListener('input', (e) => {
  if (cropperInstance) {
    cropperInstance.rotateTo(Number(e.target.value));
    rotationValue.textContent = e.target.value;
  }
});

brightnessSlider.addEventListener('input', (e) => {
  brightnessValue.textContent = e.target.value;
  updateFilterPreview();
});
contrastSlider.addEventListener('input', (e) => {
  contrastValue.textContent = e.target.value;
  updateFilterPreview();
});
saturateSlider.addEventListener('input', (e) => {
  saturateValue.textContent = e.target.value;
  updateFilterPreview();
});

confirmCropBtn.addEventListener('click', () => {
  if (!cropperInstance) return;

  const currentItem = processQueue[currentProcessIndex];
  
  const croppedCanvas = cropperInstance.getCroppedCanvas({
    fillColor: '#ffffff',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = croppedCanvas.width;
  finalCanvas.height = croppedCanvas.height;
  const finalCtx = finalCanvas.getContext('2d');
  
  finalCtx.filter = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
  finalCtx.drawImage(croppedCanvas, 0, 0);

  finalCanvas.toBlob((blob) => {
    readyImages.push({
      id: `img_${imageCounter++}`,
      originalName: currentItem.originalName,
      blobUrl: URL.createObjectURL(blob)
    });

    currentProcessIndex++;
    startNextInQueue();
  }, 'image/jpeg', 0.95);
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
    setStatus('تصویری در لیست برای پردازش وجود ندارد.');
    return;
  }

  const sizeCm = parseFloat(document.getElementById('sizeInput').value) || 15;
  const dpi = parseInt(document.getElementById('dpiInput').value) || 150;
  const targetKB = parseFloat(document.getElementById('targetSizeInput').value) || 200;
  const borderW = parseInt(document.getElementById('borderWidthInput').value) || 0;
  const canvasEx = parseInt(document.getElementById('canvasExpandInput').value) || 0;
  const borderC = document.getElementById('borderColorInput').value;
  const doStamp = document.getElementById('stampEnabledInput').checked;
  const doWatermark = document.getElementById('watermarkEnabledInput').checked;

  const sizePx = cmToPx(sizeCm, dpi);
  const timestampSuffix = getFormattedTimestamp();

  let stampImg = null;
  if (doStamp) {
    try { stampImg = await loadImage(STAMP_PATH); } 
    catch { setStatus('⚠️ مهر یافت نشد - ادامه بدون مهر'); }
  }

  setStatus(`در حال پردازش...`);

  for (let i = 0; i < readyImages.length; i++) {
    const currentItem = readyImages[i];
    setStatus(`در حال پردازش ${i + 1} از ${readyImages.length}...`);

    try {
      const img = await loadImage(currentItem.blobUrl);
      let canvas = resizeToSquare(img, sizePx);
      canvas = applyBorder(canvas, borderW, borderC, canvasEx);
      
      if (stampImg) canvas = await applyStamp(canvas, stampImg);
      
      // اعمال حروف مخفی در صورت فعال بودن
      if (doWatermark) {
        canvas = applyScatteredWatermark(canvas, SECRET_CHARS);
      }
      
      const blob = await compressToTargetSize(canvas, targetKB);

      const inputEl = document.getElementById(`nameInput_${currentItem.id}`);
      let customName = inputEl && inputEl.value.trim() !== '' ? inputEl.value.trim() : getBaseName(currentItem.originalName);
      
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
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
      console.error(err);
      setStatus(`❌ خطا در پردازش: ${err.message}`);
    }
  }
  setStatus(`✅ عملیات کامل شد.`);
}

function resizeToSquare(img, sizePx) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx; canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  
  // Highest quality image rendering for the main background
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
  
  // Ensure the highest quality rendering for the stamp/watermark
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
  let quality = 0.9;
  let currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));

  while (currentBlob.size > targetBytes && quality > 0.1) {
    quality -= 0.1;
    currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));
  }
  
  if (currentBlob.size > targetBytes) {
      currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.1));
  }

  const pngBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  if (pngBlob.size < currentBlob.size) {
    return pngBlob;
  }

  return currentBlob;
}

document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
