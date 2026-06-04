/**
 * Image Processing — Web App (v3 with Editor)
 */

const STAMP_PATH = 'assets/stamp.png';

let readyImages = []; 
let processQueue = []; // Renamed from cropQueue to reflect new purpose
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
    img.onerror = () => reject(new Error(`Load Error`));
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
  
  fileInput.value = '';
  startNextInQueue();
});

function startNextInQueue() {
  if (currentProcessIndex < processQueue.length) {
    const currentItem = processQueue[currentProcessIndex];
    cropModalTitle.textContent = `تنظیمات تصویر (${currentProcessIndex + 1} از ${processQueue.length})`;
    
    resetEditorControls();
    updateFilter();
    
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

function updateFilter() {
  const brightness = brightnessSlider.value;
  const contrast = contrastSlider.value;
  const saturate = saturateSlider.value;
  
  const filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
  
  // Apply filter to the cropper's internal image element for live preview
  if (cropperInstance && cropperInstance.cropper) {
    const imgElement = cropperInstance.cropper.querySelector('.cropper-canvas img');
    if (imgElement) {
        imgElement.style.filter = filterString;
    }
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
  updateFilter();
});
contrastSlider.addEventListener('input', (e) => {
  contrastValue.textContent = e.target.value;
  updateFilter();
});
saturateSlider.addEventListener('input', (e) => {
  saturateValue.textContent = e.target.value;
  updateFilter();
});

confirmCropBtn.addEventListener('click', async () => {
  if (!cropperInstance) return;

  const currentItem = processQueue[currentProcessIndex];

  // 1. Create a new canvas and apply filters
  const filteredCanvas = document.createElement('canvas');
  const filteredCtx = filteredCanvas.getContext('2d');
  const originalImage = await loadImage(currentItem.blobUrl);
  
  filteredCanvas.width = originalImage.naturalWidth;
  filteredCanvas.height = originalImage.naturalHeight;
  
  filteredCtx.filter = `brightness(${brightnessSlider.value}%) contrast(${contrastSlider.value}%) saturate(${saturateSlider.value}%)`;
  filteredCtx.drawImage(originalImage, 0, 0);

  // 2. Use the filtered canvas as the source for Cropper.js
  const data = cropperInstance.getData();
  const croppedCanvas = cropperInstance.getCroppedCanvas({
    width: data.width,
    height: data.height,
    fillColor: '#fff'
  });

  // Manually draw the filtered image onto the cropped canvas respecting rotation
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = croppedCanvas.width;
  tempCanvas.height = croppedCanvas.height;

  tempCtx.fillStyle = '#fff';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  
  tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
  tempCtx.rotate(data.rotate * Math.PI / 180);
  
  const sourceData = cropperInstance.getCanvasData();
  tempCtx.drawImage(
    filteredCanvas, 
    sourceData.left, 
    sourceData.top,
    sourceData.width,
    sourceData.height
  );

  const finalCroppedCanvas = cropperInstance.getCroppedCanvas({ fillColor: '#fff' });

  finalCroppedCanvas.toBlob((blob) => {
    readyImages.push({
      id: `img_${imageCounter++}`,
      originalName: currentItem.originalName,
      blobUrl: URL.createObjectURL(blob)
    });

    currentProcessIndex++;
    startNextInQueue();
  }, 'image/jpeg', 1.0);
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

// --- Final Processing Logic (Largely Unchanged) ---

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
  const w = srcCanvas.width + expand * 2, h = srcCanvas.height + expand * 2;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  canvas.width = w; canvas.height = h;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(srcCanvas, expand, expand);
  if (borderWidth > 0) {
    const r = 5, bx = expand + (borderWidth / 2), by = expand + (borderWidth / 2);
    const bw = srcCanvas.width - borderWidth, bh = srcCanvas.height - borderWidth;
    ctx.beginPath();
    ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = borderColor; ctx.lineWidth = borderWidth;
    ctx.stroke();
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
  const pngBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  if (pngBlob.size <= targetBytes) return pngBlob;
  let lo = 0.01, hi = 0.99, best = null;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const blob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', mid));
    if (blob.size <= targetBytes) { best = blob; lo = mid; } else { hi = mid; }
  }
  if (!best) best = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.01));
  return best;
}

document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
