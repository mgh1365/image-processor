const STAMP_PATH = 'assets/stamp.png';
const SECRET_CHARS = ['n', 'o', 'r', 'u', 'z', 'k', 'h', 'a', 'n'];

let readyImages = [];
let processQueue = [];
let currentProcessIndex = -1;
let cropperInstance = null;
let currentFileObj = null;

const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const fileInput = document.getElementById('fileInput');
const fileListContainer = document.getElementById('fileListContainer');

// Editor controls
const rotSlider = document.getElementById('rotationSlider');
const briSlider = document.getElementById('brightnessSlider');
const conSlider = document.getElementById('contrastSlider');
const satSlider = document.getElementById('saturateSlider');
const rotVal = document.getElementById('rotVal');

// --- Helpers ---
function cmToPx(cm, dpi) {
  return Math.round((cm / 2.54) * dpi);
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

function getFormattedTimestamp() {
  const d = new Date();
  return d.getFullYear() +
         String(d.getMonth() + 1).padStart(2, '0') +
         String(d.getDate()).padStart(2, '0') + '_' +
         String(d.getHours()).padStart(2, '0') +
         String(d.getMinutes()).padStart(2, '0') +
         String(d.getSeconds()).padStart(2, '0');
}

// --- List Management ---
function clearList() {
  readyImages = [];
  processQueue = [];
  fileListContainer.innerHTML = '';
  fileInput.value = '';
  setStatus('');
}

document.getElementById('clearBtnTop').addEventListener('click', clearList);
document.getElementById('clearBtnBottom').addEventListener('click', clearList);

// --- File Upload & Queue ---
fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  processQueue = processQueue.concat(files);
  if (cropModal.style.display !== 'flex') {
    startNextInQueue();
  }
});

function startNextInQueue() {
  if (processQueue.length === 0) {
    cropModal.style.display = 'none';
    renderFileList();
    return;
  }
  
  currentFileObj = processQueue.shift();
  const reader = new FileReader();
  reader.onload = (e) => {
    cropImage.src = e.target.result;
    cropModal.style.display = 'flex';
    resetEditorControls();
    
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(cropImage, {
      viewMode: 1,
      autoCropArea: 1,
      ready() {
        updateFilterPreview();
      }
    });
  };
  reader.readAsDataURL(currentFileObj);
}

function resetEditorControls() {
  rotSlider.value = 0;
  briSlider.value = 100;
  conSlider.value = 100;
  satSlider.value = 100;
  rotVal.textContent = "0";
}

function updateFilterPreview() {
  const filterStr = `brightness(${briSlider.value}%) contrast(${conSlider.value}%) saturate(${satSlider.value}%)`;
  document.querySelector('.cropper-view-box img').style.filter = filterStr;
  document.querySelector('.cropper-canvas img').style.filter = filterStr;
}

rotSlider.addEventListener('input', (e) => {
  rotVal.textContent = e.target.value;
  if (cropperInstance) cropperInstance.rotateTo(parseFloat(e.target.value));
});

[briSlider, conSlider, satSlider].forEach(slider => {
  slider.addEventListener('input', updateFilterPreview);
});

confirmCropBtn.addEventListener('click', () => {
  if (!cropperInstance) return;
  
  const canvas = cropperInstance.getCroppedCanvas();
  const ctx = canvas.getContext('2d');
  
  // اعمال فیلترها روی تصویر نهایی برش خورده
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.filter = `brightness(${briSlider.value}%) contrast(${conSlider.value}%) saturate(${satSlider.value}%)`;
  tempCtx.drawImage(canvas, 0, 0);
  
  tempCanvas.toBlob((blob) => {
    readyImages.push({
      originalName: currentFileObj.name,
      blob: blob,
      previewUrl: URL.createObjectURL(blob)
    });
    startNextInQueue();
  }, 'image/jpeg', 0.95);
});

function renderFileList() {
  fileListContainer.innerHTML = '';
  readyImages.forEach((imgObj, index) => {
    const defaultName = imgObj.originalName.replace(/\.[^/.]+$/, "");
    
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
      <img src="${imgObj.previewUrl}" alt="preview" />
      <input type="text" id="nameInput_${index}" value="${defaultName}" placeholder="نام فایل خروجی" />
    `;
    fileListContainer.appendChild(div);
  });
}

// --- Processing Functions ---
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

function applyBorder(srcCanvas, borderWidth, borderColor, expandValue) {
  const w = srcCanvas.width + expandValue * 2;
  const h = srcCanvas.height + expandValue * 2;
  
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(srcCanvas, expandValue, expandValue);
  
  if (borderWidth > 0) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(expandValue, expandValue, srcCanvas.width, srcCanvas.height);
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

// تابع جدید: اعمال واترمارک مخفی پراکنده
function applyScatteredWatermark(canvas, textArray) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  // رنگ بسیار کم‌رنگ برای مخفی ماندن
  ctx.fillStyle = 'rgba(128, 128, 128, 0.03)';
  ctx.font = `${Math.floor(w * 0.05)}px Tahoma`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // پراکنده کردن حروف در نقاط مختلف تصویر
  textArray.forEach(char => {
    const rx = Math.random() * (w * 0.8) + (w * 0.1);
    const ry = Math.random() * (h * 0.8) + (h * 0.1);
    
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate((Math.random() - 0.5) * Math.PI / 2); // چرخش تصادفی
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });
  
  return canvas;
}

async function compressToTargetSize(canvas, targetKB) {
  const targetBytes = targetKB * 1024;
  let lo = 0.01, hi = 0.99, best = null;
  
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', mid));
    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best || await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.01));
}

// --- Main Processing ---
async function startProcessing() {
  if (!readyImages.length) {
    setStatus('لطفاً ابتدا تصاویری برای پردازش اضافه و ویرایش کنید.');
    return;
  }
  
  const sizeCm = parseFloat(document.getElementById('sizeInput').value) || 15;
  const dpi = parseInt(document.getElementById('dpiInput').value) || 96;
  const targetKB = parseFloat(document.getElementById('targetSizeInput').value) || 200;
  const borderW = parseInt(document.getElementById('borderWidthInput').value) || 0;
  const canvasEx = parseInt(document.getElementById('canvasExpandInput').value) || 0;
  const borderC = document.getElementById('borderColorInput').value;
  const doStamp = document.getElementById('stampEnabledInput').checked;
  const doWatermark = document.getElementById('watermarkEnabledInput').checked;
  
  const sizePx = cmToPx(sizeCm, dpi);
  
  let stampImg = null;
  if (doStamp) {
    try {
      stampImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = STAMP_PATH;
      });
    } catch {
      console.warn('مهر بارگذاری نشد.');
    }
  }
  
  setStatus(`در حال پردازش ۰ از ${readyImages.length}...`);
  
  for (let i = 0; i < readyImages.length; i++) {
    setStatus(`در حال پردازش ${i + 1} از ${readyImages.length}...`);
    try {
      const imgObj = readyImages[i];
      
      const img = await new Promise((resolve, reject) => {
        const tempImg = new Image();
        tempImg.onload = () => resolve(tempImg);
        tempImg.onerror = reject;
        tempImg.src = imgObj.previewUrl;
      });
      
      let canvas = resizeToSquare(img, sizePx);
      canvas = applyBorder(canvas, borderW, borderC, canvasEx);
      
      if (stampImg) {
        canvas = await applyStamp(canvas, stampImg);
      }
      
      if (doWatermark) {
        canvas = applyScatteredWatermark(canvas, SECRET_CHARS);
      }
      
      const blob = await compressToTargetSize(canvas, targetKB);
      
      const customNameInput = document.getElementById(`nameInput_${i}`);
      const baseName = customNameInput && customNameInput.value.trim() !== "" ? customNameInput.value.trim() : "Image";
      const finalName = `${baseName}_${getFormattedTimestamp()}.jpg`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error(err);
    }
  }
  
  setStatus(`✅ پردازش ${readyImages.length} تصویر کامل شد.`);
}

document.getElementById('processBtnTop').addEventListener('click', startProcessing);
document.getElementById('processBtnBottom').addEventListener('click', startProcessing);
