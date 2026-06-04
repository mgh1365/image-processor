const { ipcRenderer } = require('electron');

const dropZone = document.getElementById('dropZone');
const btnSelect = document.getElementById('btnSelect');
const btnClear = document.getElementById('btnClear');
const fileListEl = document.getElementById('fileList');

const enableBorderEl = document.getElementById('enableBorder');
const enableStampEl = document.getElementById('enableStamp');
const enableCompressEl = document.getElementById('enableCompress');
const targetKBEl = document.getElementById('targetKB');
const targetWidthCmEl = document.getElementById('targetWidthCm');
const openOutputsEl = document.getElementById('openOutputs');
const stampPathEl = document.getElementById('stampPath');
const btnStamp = document.getElementById('btnStamp');
const btnRun = document.getElementById('btnRun');
const logEl = document.getElementById('log');

let files = [];

function log(msg) {
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

function renderFiles() {
  fileListEl.innerHTML = '';
  for (const p of files) {
    const li = document.createElement('li');
    li.textContent = p;
    fileListEl.appendChild(li);
  }
}

function addFiles(paths) {
  const set = new Set(files);
  for (const p of (paths || [])) {
    if (p && typeof p === 'string') set.add(p.trim());
  }
  files = [...set].filter(Boolean);
  renderFiles();
}

['dragenter', 'dragover'].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('active');
  });
});

['dragleave', 'drop'].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('active');
  });
});

dropZone.addEventListener('drop', (e) => {
  const arr = [];
  for (const f of e.dataTransfer.files) {
    if (f.path) arr.push(f.path);
  }
  addFiles(arr);
  log(`+ ${arr.length} فایل اضافه شد (Drag & Drop).`);
});

btnSelect.addEventListener('click', async () => {
  try {
    const selected = await ipcRenderer.invoke('select-files');
    addFiles(selected);
    log(`+ ${(selected || []).length} فایل اضافه شد (Select).`);
  } catch (err) {
    log('خطا در انتخاب فایل: ' + (err.message || err));
  }
});

btnClear.addEventListener('click', () => {
  files = [];
  renderFiles();
  log('لیست فایل‌ها پاک شد.');
});

btnStamp.addEventListener('click', async () => {
  try {
    const p = await ipcRenderer.invoke('pick-stamp');
    if (p) {
      stampPathEl.value = p;
      log('مهر انتخاب شد: ' + p);
    }
  } catch (err) {
    log('خطا در انتخاب مهر: ' + (err.message || err));
  }
});

btnRun.addEventListener('click', async () => {
  if (!files.length) {
    log('هیچ فایلی انتخاب نشده.');
    return;
  }

  const payload = {
    filePaths: files,
    enableBorder: enableBorderEl.checked,
    enableStamp: enableStampEl.checked,
    enableCompress: enableCompressEl.checked,
    targetKB: Number(targetKBEl.value || 350),
    targetWidthCm: Number(targetWidthCmEl.value || 15),
    openOutputs: openOutputsEl.checked,
    stampPath: (stampPathEl.value || '').trim()
  };

  btnRun.disabled = true;
  log('شروع پردازش...');

  try {
    const out = await ipcRenderer.invoke('process-images', payload);

    let ok = 0;
    let fail = 0;

    for (const r of out) {
      if (r.ok) {
        ok++;
        log(`✓ ${r.output} | size=${Number(r.sizeKB || 0).toFixed(1)}KB | q=${r.quality}${r.scaleApplied ? ` | scale=${r.scaleApplied}` : ''}`);
      } else {
        fail++;
        log(`✗ ${r.input} -> ${r.error}`);
      }
    }

    log(`اتمام. موفق: ${ok} | ناموفق: ${fail}`);
    alert(`اتمام پردازش\nموفق: ${ok}\nناموفق: ${fail}`);
  } catch (err) {
    log('خطای پردازش: ' + (err.message || err));
    alert('خطا: ' + (err.message || err));
  } finally {
    btnRun.disabled = false;
  }
});

try {
  if (!ipcRenderer) throw new Error('ipcRenderer unavailable');
  log('Renderer آماده است.');
} catch (e) {
  log('خطا: این صفحه باید داخل Electron اجرا شود. ' + e.message);
}
