const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
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
  const { enableBorder, enableStamp, targetWidthCm, stampPath } = opts;

  let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw new Error('Cannot read image dimensions.');

  const dpi = (meta.density && Number.isFinite(meta.density) && meta.density > 0) ? meta.density : 300;
  const targetWidthPx = Math.round((Number(targetWidthCm || 15) / 2.54) * dpi);

  // فقط کوچک‌سازی، نه بزرگ‌سازی
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

    // فاصله نصف شد: 5% عرض
    const margin = Math.round(fw * 0.05);

    const stampBuf = await sharp(stampPath)
      .resize({ width: stampW, withoutEnlargement: false })
      .png()
      .toBuffer();

    const sm = await sharp(stampBuf).metadata();
    const sh = sm.height || 0;

    const left = Math.max(0, margin);
    const top = Math.max(0, fh - sh - margin);

    pipeline = pipeline.composite([{ input: stampBuf, left, top }]);
  }

  return await pipeline.png().toBuffer();
}

async function compressToTarget(baseBuffer, targetBytes) {
  // مرحله 1: باینری سرچ کیفیت
  let low = 1, high = 100;
  let bestUnder = null;

  for (let i = 0; i < 10; i++) {
    const q = Math.floor((low + high) / 2);
    const buf = await sharp(baseBuffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();

    if (buf.length <= targetBytes) {
      bestUnder = { buf, q };
      low = q + 1;
    } else {
      high = q - 1;
    }
  }

  if (bestUnder) {
    return { buf: bestUnder.buf, quality: bestUnder.q, scaleApplied: 1.0 };
  }

  // مرحله 2: اگر هنوز بالاست، کاهش ابعاد مرحله‌ای + باینری سرچ کیفیت
  const scaleSteps = [0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.79, 0.76, 0.73, 0.70, 0.67, 0.64, 0.61, 0.58, 0.55, 0.52, 0.50];
  const meta = await sharp(baseBuffer).metadata();
  const ow = meta.width || 0;
  const oh = meta.height || 0;

  for (const s of scaleSteps) {
    const w = Math.max(120, Math.round(ow * s));
    const h = Math.max(120, Math.round(oh * s));

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

  // مرحله 3: fallback
  const fallback = await sharp(baseBuffer)
    .resize({ width: Math.max(100, Math.round((ow || 1000) * 0.45)) })
    .jpeg({ quality: 1, mozjpeg: true })
    .toBuffer();

  return { buf: fallback, quality: 1, scaleApplied: 0.45 };
}

/* ---------------- IPC ---------------- */

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
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const base = path.basename(inputPath, ext);
      const outputPath = path.join(dir, `${base}_${nowNameBase()}.jpg`);

      const baseBuffer = await buildBaseImageBuffer(inputPath, {
        enableBorder: !!enableBorder,
        enableStamp: !!enableStamp,
        targetWidthCm: Number(targetWidthCm || 15),
        stampPath: finalStamp
      });

      let finalBuf;
      let usedQuality = 95;
      let scaleApplied = 1.0;

      if (enableCompress) {
        const c = await compressToTarget(baseBuffer, targetBytes);
        finalBuf = c.buf;
        usedQuality = c.quality;
        scaleApplied = c.scaleApplied;
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
      results.push({ input: inputPath, ok: false, error: err.message || String(err) });
    }
  }

  if (openOutputs) {
    for (const p of openList) {
      await shell.openPath(p);
    }
  }

  return results;
});

/* ---------------- App lifecycle ---------------- */

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
