/**
 * Image Processing — Web App (v3.2 - Critical Fix for Editor Logic)
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

// --- Editor & Queue Logic ---

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  setUploadStatus('در حال آمادهسازی تصاویر...');
  
  // Clean up previous state
  readyImages.forEach(item => URL.revokeObjectURL(item.blobUrl));
  readyImages = [];
  processQueue = [];
  currentProcessIndex = 0;
  fileListContainer.innerHTML = '';
  fileListCard.style.display = 'none';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const objectUrl = URL.createObjectURL(file);
    processQueue.push({ originalName: file.name, blobUrl: objectUrl });
  }
  
  fileInput.value = ''; // Allow re-selecting same files
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

    // The image must be loaded before Cropper is initialized
    cropImage.onload = () => {
      cropperInstance = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        background: false, // Make background transparent to see container bg
        ready: function () {
          // Apply initial filter values for visual preview
          updateFilterPreview();
        }
      });
    };
  } else {
    cropModal.style.display = 'none';
    renderFileList();
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
  if (!cropperInstance || !cropperInstance.cropper) return;
  
  // Cropper.js v1.5.13 uses a child element for the image inside the canvas
  const cropperImageElement = cropImage.nextElementSibling.querySelector('img');
  
  if (cropperImageElement) {
    const filterString = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
    cropperImageElement.style.filter = filterString;
  }
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

confirmCropBtn.addEventListener('click', async () => {
  if (!cropperInstance) return;

  const currentItem = processQueue[currentProcessIndex];
  
  // Use Cropper's built-in getCroppedCanvas which respects rotation
  const croppedCanvas = cropperInstance.getCroppedCanvas({
    fillColor: '#ffffff'
  });

  // Now, draw the filtered image onto this rotated/cropped canvas
  const finalCanvas = document.createElement('canvas');
  const finalCtx = finalCanvas.getContext('2d');
  finalCanvas.width = croppedCanvas.width;
  finalCanvas.height = croppedCanvas.height;
  
  // Apply the CSS filters to the canvas context
  finalCtx.filter = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
  
  // Draw the result from cropper (which is already cropped and rotated)
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
    input.placeholder = `نام دلخواه (پیشفرض: ${baseName})`;

    row.appendChild(thumb);
    row.appendChild(input);
    fileListContainer.appendChild(row);
  });
}

// --- Final Processing Logic ---

async function startProcessing() {
  if (!readyImages.length) {
    setStatus('تصویری برای پردازش وجود ندارد.');
    return;
  }

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
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sizePx, sizePx);
  // Image from editor is already square, so a simple draw is enough.
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return canvas;
}

function applyBorder(srcCanvas, borderWidth, borderColor, expandValue) {
  const expand = expandValue > 0 ? expandValue : 0;
  const w = srcCanvas.width + expand * 2, h = srcCanvas.height + expand * 2;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
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

  // Iteratively reduce quality
  while (currentBlob.size > targetBytes && quality > 0.1) {
    quality -= 0.1;
    currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));
  }
  
  // If it's still too large, return the lowest quality version
  if (currentBlob.size > targetBytes) {
      currentBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.1));
  }

  // If a PNG version would be smaller, use that
  const pngBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  if (pngBlob.size < currentBlob.size) {
    return pngBlob;
  }

  return currentBlob;
}

document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
