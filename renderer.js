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
  brightnessValutextContent = '100';
  contrastValue.textContent = '100';
  saturateValue.textContent = '100';
}

function updateFilterPreview() {
  // Target ALL images inside the Cropper container to ensure the crop box itself shows the filter
  const cropperImages = document.querySelectorAll('.cropper-container img');
  const filterString = `brightness(${brightnessSlider.value}%) contrast(${${
