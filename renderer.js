// ==================== state ====================
let files = [];

// ==================== DOM refs ====================
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const fileList     = document.getElementById('fileList');
const previewSection = document.getElementById('previewSection');
const previewCanvas  = document.getElementById('previewCanvas');
const qualitySlider  = document.getElementById('quality');
const qualityValue   = document.getElementById('qualityValue');

// ==================== upload ====================
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => addFiles(fileInput.files));

qualitySlider.addEventListener('input', () => {
  qualityValue.textContent = qualitySlider.value;
});

function addFiles(newFiles) {
  for (const f of newFiles) {
    if (f.type.startsWith('image/')) {
      files.push(f);
    }
  }
  renderFileList();
  if (files.length > 0) showPreview(files[0]);
}

function renderFileList() {
  fileList.innerHTML = '';
  files.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `<span>${f.name}</span><span class="remove" data-i="${i}">✕</span>`;
    fileList.appendChild(div);
  });

  fileList.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      files.splice(Number(btn.dataset.i), 1);
      renderFileList();
      if (files.length > 0) showPreview(files[0]);
      else previewSection.style.display = 'none';
    });
  });
}

// ==================== settings ====================
function getSettings() {
  return {
    border: {
      enabled: document.getElementById('borderEnabled').checked,
      color:   document.getElementById('borderColor').value,
      size:    parseInt(document.getElementById('borderSize').value) || 10,
    },
    stamp: {
      enabled:  document.getElementById('stampEnabled').checked,
      text:     document.getElementById('stampText').value,
      color:    document.getElementById('stampColor').value,
      fontSize: parseInt(document.getElementById('stampSize').value) || 40,
      position: document.getElementById('stampPosition').value,
    },
    resize: {
      enabled:    document.getElementById('resizeEnabled').checked,
      width:      parseInt(document.getElementById('resizeWidth').value) || 800,
      height:     parseInt(document.getElementById('resizeHeight').value) || 600,
      keepAspect: document.getElementById('keepAspect').checked,
    },
    quality: parseFloat(qualitySlider.value),
    format:  document.getElementById('outputFormat').value,
  };
}

// ==================== core processing ====================
function processImage(imgEl, settings) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  let w = imgEl.naturalWidth;
  let h = imgEl.naturalHeight;

  // resize
  if (settings.resize.enabled) {
    if (settings.resize.keepAspect) {
      const ratio = Math.min(settings.resize.width / w, settings.resize.height / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    } else {
      w = settings.resize.width;
      h = settings.resize.height;
    }
  }

  canvas.width  = w;
  canvas.height = h;
  ctx.drawImage(imgEl, 0, 0, w, h);

  // border
  if (settings.border.enabled) {
    const s = settings.border.size;
    ctx.strokeStyle = settings.border.color;
    ctx.lineWidth   = s * 2; // stroke is centered on edge, so double it
    ctx.strokeRect(0, 0, w, h);
  }

  // stamp
  if (settings.stamp.enabled && settings.stamp.text) {
    const fs  = settings.stamp.fontSize;
    ctx.font  = `bold ${fs}px sans-serif`;
    ctx.fillStyle = settings.stamp.color;
    ctx.textBaseline = 'middle';

    const padding  = 20;
    const textW    = ctx.measureText(settings.stamp.text).width;
    let x, y;

    switch (settings.stamp.position) {
      case 'top-left':     x = padding;          y = padding + fs / 2; break;
      case 'top-right':    x = w - textW - padding; y = padding + fs / 2; break;
      case 'bottom-left':  x = padding;          y = h - padding - fs / 2; break;
      case 'bottom-right': x = w - textW - padding; y = h - padding - fs / 2; break;
      default:             x = (w - textW) / 2;  y = h / 2; // center
    }

    // سایه برای خوانایی بهتر
    ctx.shadowColor   = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(settings.stamp.text, x, y);
    ctx.shadowColor = 'transparent';
  }

  return canvas;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src     = url;
  });
}

// ==================== preview ====================
async function showPreview(file) {
  const img      = await loadImage(file);
  const settings = getSettings();
  const canvas   = processImage(img, settings);

  previewCanvas.width  = canvas.width;
  previewCanvas.height = canvas.height;
  previewCanvas.getContext('2d').drawImage(canvas, 0, 0);
  previewSection.style.display = 'block';
}

document.getElementById('previewBtn').addEventListener('click', () => {
  if (files.length > 0) showPreview(files[0]);
});

// ==================== download ====================
document.getElementById('downloadBtn').addEventListener('click', async () => {
  if (files.length === 0) { alert('هیچ فایلی انتخاب نشده'); return; }

  const settings = getSettings();
  const ext      = settings.format === 'image/png'  ? 'png'
                 : settings.format === 'image/webp' ? 'webp'
                 : 'jpg';

  for (const file of files) {
    const img    = await loadImage(file);
    const canvas = processImage(img, settings);
    const dataURL = canvas.toDataURL(settings.format, settings.quality);

    const a      = document.createElement('a');
    const base   = file.name.replace(/\.[^.]+$/, '');
    a.href       = dataURL;
    a.download   = `${base}_edited.${ext}`;
    a.click();

    // کمی صبر بین دانلودها
    await new Promise(r => setTimeout(r, 300));
  }
});
