const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let win;

/* ------------------------------ UI HTML ------------------------------ */
const HTML = `
<!doctype html>
<html lang="fa">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Batch Image Processor</title>
  <style>
    * { box-sizing: border-box; font-family: sans-serif; }
    body { margin: 0; background: #f5f7fb; color: #1a1a1a; }
    .container { max-width: 1020px; margin: 20px auto; padding: 0 12px; }
    h1 { margin-bottom: 12px; }
    .panel { background: #fff; border: 1px solid #dde3ee; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
    .dropzone {
      border: 2px dashed #9eb3d1; border-radius: 10px; padding: 26px;
      text-align: center; color: #4f6484; background: #f8fbff; margin-bottom: 10px;
    }
    .dropzone.active { border-color: #2f7cf6; background: #eef5ff; }
    .row { display: flex; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    label { display: block; margin: 8px 0; font-size: 14px; }
    input[type="text"], input[type="number"] {
      width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #cdd7e8;
    }
    .check { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    button {
      border: 1px solid #cdd7e8; background: #fff; padding: 9px 12px;
      border-radius: 8px; cursor: pointer;
    }
    button.primary { background: #2f7cf6; color: #fff; border-color: #2f7cf6; }
    button.secondary { background: #f5f7fb; }
    #fileList { margin: 8px 0 0; padding-left: 18px; max-height: 180px; overflow: auto; }
    #log {
      background: #0d1117; color: #d6e2ff; border-radius: 10px;
      padding: 10px; min-height: 170px; white-space: pre-wrap; line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>پردازش دسته‌ای تصاویر</h1>

    <section class="panel">
      <div id="dropZone" class="dropzone">فایل‌ها را اینجا رها کنید</div>
      <div class="row">
        <button id="btnSelect">Select Files</button>
        <button id="btnClear" class="secondary">Clear List</button>
      </div>
      <ul id="fileList"></ul>
    </section>

    <section class="panel">
      <h2>تنظیمات</h2>

      <label class="check">
        <input type="checkbox" id="enableBorder" checked />
        افزودن حاشیه (2px مشکی + گوشه 5px + بوم سفید 5px)
      </label>

      <label class="check">
        <input type="checkbox" id="enableStamp" checked />
        افزودن مهر
      </label>

      <div class="row">
        <input id="stampPath" type="text" placeholder="assets/stamp.png" />
        <button id="btnStamp" class="secondary">Choose Stamp</button>
      </div>

      <label class="check">
        <input type="checkbox" id="enableCompress" checked />
        فشرده‌سازی تا حجم هدف (KB)
      </label>

      <div class="grid2">
        <label>
          حجم هدف (KB)
          <input id="targetKB" type="number" min="1" max="10000" step="0.1" value="350" />
        </label>
        <label>
          عرض هدف (cm)
          <input id="targetWidthCm" type="number" min="1" step="0.1" value="15" />
        </label>
      </div>

      <label class="check">
        <input type="checkbox" id="openOutputs" checked />
        بعد از اتمام، خروجی‌ها باز شوند
      </label>

      <div class="row">
        <button id="btnRun" class="primary">شروع پردازش</button>
      </div>
    </section>

    <section class="panel">
      <h2>Log</h2>
      <pre id="log"></pre>
    </section>
  </div>

  <script>
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
      logEl.textContent += msg + '\\n';
      logEl.scrollTop = logEl.scrollHeight;
    }

    function renderFiles() {
      fileListEl.innerHTML = '';
      files.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p;
        fileListEl.appendChild(li);
      });
    }

    function addFiles(paths) {
      const set = new Set(files);
      (paths || []).forEach((p) => {
        if (p && typeof p === 'string') set.add(p.trim());
      });
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
      log('+ ' + arr.length + ' فایل اضافه شد (Drag & Drop).');
    });

    btnSelect.addEventListener('click', async () => {
      const selected = await ipcRenderer.invoke('select-files');
      addFiles(selected);
      log('+ ' + (selected || []).length + ' فایل اضافه شد (Select).');
    });

    btnClear.addEventListener('click', () => {
      files = [];
      renderFiles();
      log('لیست فایل‌ها پاک شد.');
    });

    btnStamp.addEventListener('click', async () => {
      const p = await ipcRenderer.invoke('pick-stamp');
      if (p) stampPathEl.value = p;
    });

    btnRun.addEventListener('click', async () => {
      if (!files.length) {
        log('هیچ فایلی انتخاب نشده.');
        return;
      }

      btnRun.disabled = true;
      log('شروع پردازش...');

      try {
        const payload = {
          filePaths: files,
          enableBorder: enableBorderEl.checked,
          enableStamp: enableStampEl.checked,
          enableCompress: enableCompressEl.checked,
          targetKB: Number(targetKBEl.value || 350),
          targetWidthCm: Number(targetWidthCmEl.value || 15),
          openOutputs: openOutputsEl.checked,
          stampPath: stampPathEl.value.trim()
        };

        const out = await ipcRenderer.invoke('process-images', payload);

        let ok = 0, fail = 0;
        for (const r of out) {
          if (r.ok) {
            ok++;
            log('✓ ' + r.output + ' | size=' + r.sizeKB.toFixed(1) + 'KB | q=' + r.quality + (r.scaleApplied ? (' | scale=' + r.scaleApplied) : ''));
          } else {
            fail++;
            log('✗ ' + r.input + ' -> ' + r.error);
          }
        }

        log('اتمام. موفق: ' + ok + ' | ناموفق: ' + fail);
        alert('اتمام پردازش\\nموفق: ' + ok + '\\nناموفق: ' + fail);
      } catch (e) {
        log('خطا: ' + (e.message || e));
        alert('خطا: ' + (e.message || e));
      } finally {
        btnRun.disabled = false;
      }
    });
  </script>
</body>
</html>
`;

/* ------------------------------ Helpers ------------------------------ */

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(HTML));
}

function nowNameBase() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd} , ${HH}${MM}`;
}

async function buildBaseImageBuffer(inputPath, opts) {
  const {
    enableBorder,
    enableStamp,
    targetWidthCm,
    stampPath
  } = opts;

  let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw new Error('Cannot read image dimensions.');

  const dpi = (meta.density && Number.isFinite(meta.density) && meta.density > 0) ? meta.density : 300;
  const targetWidthPx = Math.round((Number(targetWidthCm || 15) / 2.54) * dpi);

  // Only downscale, never upscale
  if (meta.width > targetWidthPx) {
    pipeline = pipeline.resize({ width: targetWidthPx, withoutEnlargement: true });
  }

  if (enableBorder) {
    const m = await pipeline.metadata();
    const w = m.width;
    const h = m.height;

    const roundedMask = Buffer.from(`
<svg width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" rx="5" ry="5" fill="white"/>
</svg>`);

    pipeline = pipeline
      .composite([{ input: roundedMask, blend: 'dest-in' }])
      .extend({
        top: 2, bottom: 2, left: 2, right: 2,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .extend({
        top: 5, bottom: 5, left: 5, right: 5,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });
  }

  if (enableStamp) {
    const m = await pipeline.metadata();
    const fw = m.width;
    const fh = m.height;

    const stampW = Math.round(fw * 0.25);

    // فاصله مهر نصف شد: قبلاً 10%، الان 5%
    const margin = Math.round(fw * 0.05);

    const stampBuf = await sharp(stampPath)
      .resize({ width: stampW, withoutEnlargement: false })
      .png()
      .toBuffer();

    const sm = await sharp(stampBuf).metadata();
    const sw = sm.width || 0;
    const sh = sm.height || 0;

    const left = Math.max(0, margin);
    const top = Math.max(0, fh - sh - margin);

    pipeline = pipeline.composite([{ input: stampBuf, left, top }]);
  }

  // خروجی پایه PNG تا مرحله نهایی فشرده‌سازی JPEG دقیق‌تر کنترل شود
  return await pipeline.png().toBuffer();
}

async function compressToTarget(baseBuffer, targetBytes) {
  // 1) تلاش با تغییر کیفیت (binary search)
  let low = 1, high = 100;
  let bestUnder = null;
  let bestOver = null;

  for (let i = 0; i < 10; i++) {
    const q = Math.floor((low + high) / 2);
    const buf = await sharp(baseBuffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();

    if (buf.length <= targetBytes) {
      bestUnder = { buf, q };
      low = q + 1; // کیفیت بالاتر ولی هنوز زیر هدف
    } else {
      bestOver = { buf, q };
      high = q - 1;
    }
  }

  if (bestUnder) {
    return { buf: bestUnder.buf, quality: bestUnder.q, scaleApplied: 1.0 };
  }

  // 2) اگر حتی کیفیت 1 هم بالاست => کاهش ابعاد مرحله‌ای + دوباره binary search کیفیت
  const scaleSteps = [0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.79, 0.76, 0.73, 0.70, 0.67, 0.64, 0.61, 0.58, 0.55, 0.52, 0.50];

  const meta = await sharp(baseBuffer).metadata();
  const origW = meta.width || 0;
  const origH = meta.height || 0;

  for (const s of scaleSteps) {
    const w = Math.max(120, Math.round(origW * s));
    const h = Math.max(120, Math.round(origH * s));

    const resizedBase = await sharp(baseBuffer)
      .resize({ width: w, height: h, fit: 'fill' })
      .png()
      .toBuffer();

    let l = 1, r = 100;
    let localBest = null;
    for (let i = 0; i < 10; i++) {
      const q = Math.floor((l + r) / 2);
      const b = await sharp(resizedBase).jpeg({ quality: q, mozjpeg: true }).toBuffer();
      if (b.length <= targetBytes) {
        localBest = { buf: b, q };
        l = q + 1;
      } else {
        r = q - 1;
      }
    }

    if (localBest) {
      return { buf: localBest.buf, quality: localBest.q, scaleApplied: Number(s.toFixed(2)) };
    }
  }

  // 3) fallback نهایی (اگر هدف خیلی خیلی کم باشد)
  const fallback = await sharp(baseBuffer)
    .resize({ width: Math.max(100, Math.round(origW * 0.45)) })
    .jpeg({ quality: 1, mozjpeg: true })
    .toBuffer();

  return { buf: fallback, quality: 1, scaleApplied: 0.45 };
}

/* ------------------------------ IPC ------------------------------ */

ipcMain.handle('select-files', async () => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'] }]
  });
  return res.canceled ? [] : res.filePaths;
});

ipcMain.handle('pick-stamp', async () => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (res.canceled || !res.filePaths?.length) return '';
  return res.filePaths[0];
});

ipcMain.handle('process-images', async (_, payload) => {
  const {
    filePaths,
    enableBorder,
    enableStamp,
    enableCompress,
    targetKB,
    targetWidthCm,
    openOutputs,
    stampPath
  } = payload;

  if (!filePaths || !filePaths.length) throw new Error('No input files selected.');

  const fallbackStamp = path.join(__dirname, 'assets', 'stamp.png');
  const finalStamp = (stampPath && fs.existsSync(stampPath)) ? stampPath : fallbackStamp;

  if (enableStamp && !fs.existsSync(finalStamp)) {
    throw new Error('Stamp file not found. Set stamp path or put assets/stamp.png');
  }

  const results = [];
  const openList = [];
  const targetBytes = Math.max(1, Number(targetKB || 1)) * 1024;

  for (const inputPath of filePaths) {
    try {
      const inputDir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const base = path.basename(inputPath, ext);
      const outputPath = path.join(inputDir, `${base}_${nowNameBase()}.jpg`);

      const baseBuffer = await buildBaseImageBuffer(inputPath, {
        enableBorder: !!enableBorder,
        enableStamp: !!enableStamp,
        targetWidthCm: Number(targetWidthCm || 15),
        stampPath: finalStamp
      });

      let finalBuf, usedQuality = 95, scaleApplied = 1.0;

      if (enableCompress) {
        const comp = await compressToTarget(baseBuffer, targetBytes);
        finalBuf = comp.buf;
        usedQuality = comp.quality;
        scaleApplied = comp.scaleApplied;
      } else {
        finalBuf = await sharp(baseBuffer).jpeg({ quality: 95, mozjpeg: true }).toBuffer();
      }

      fs.writeFileSync(outputPath, finalBuf);
      const sizeKB = finalBuf.length / 1024;

      results.push({
        input: inputPath,
        output: outputPath,
        ok: true,
        sizeKB,
        quality: usedQuality,
        scaleApplied
      });

      if (openOutputs) openList.push(outputPath);
    } catch (err) {
      results.push({
        input: inputPath,
        ok: false,
        error: err.message || String(err)
      });
    }
  }

  if (openOutputs) {
    for (const p of openList) {
      await shell.openPath(p);
    }
  }

  return results;
});

/* ------------------------------ App ------------------------------ */

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
