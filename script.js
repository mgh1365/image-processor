const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1150,
    height: 760,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

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
  const finalStampPath = (stampPath && fs.existsSync(stampPath)) ? stampPath : fallbackStamp;
  if (enableStamp && !fs.existsSync(finalStampPath)) {
    throw new Error('Stamp file not found. Set stamp path or put assets/stamp.png');
  }

  const results = [];
  const openList = [];

  for (const inputPath of filePaths) {
    try {
      const inputDir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const base = path.basename(inputPath, ext);

      let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();
      const meta = await pipeline.metadata();
      if (!meta.width || !meta.height) throw new Error('Cannot read image dimensions.');

      const dpi = (meta.density && Number.isFinite(meta.density) && meta.density > 0) ? meta.density : 300;
      const targetWidthPx = Math.round((Number(targetWidthCm || 15) / 2.54) * dpi);

      if (meta.width > targetWidthPx) {
        pipeline = pipeline.resize({ width: targetWidthPx, withoutEnlargement: true });
      }

      if (enableBorder) {
        const m = await pipeline.metadata();
        const w = m.width, h = m.height;

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
        const fw = m.width, fh = m.height;
        const stampW = Math.round(fw * 0.25);
        const margin = Math.round(fw * 0.10);

        const stampBuf = await sharp(finalStampPath)
          .resize({ width: stampW, withoutEnlargement: false })
          .png()
          .toBuffer();

        const sm = await sharp(stampBuf).metadata();
        const sh = sm.height || 0;

        const left = Math.max(0, margin);
        const top = Math.max(0, fh - sh - margin);

        pipeline = pipeline.composite([{ input: stampBuf, left, top }]);
      }

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const MM = String(now.getMinutes()).padStart(2, '0');
      const outputPath = path.join(inputDir, `${base}_${yyyy}${mm}${dd} , ${HH}${MM}.jpg`);

      if (enableCompress) {
        const targetBytes = Math.max(1, Number(targetKB || 1)) * 1024;

        let low = 1, high = 100, best = null;
        for (let i = 0; i < 8; i++) {
          const q = Math.floor((low + high) / 2);
          const buf = await pipeline.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer();
          if (buf.length <= targetBytes) {
            best = buf;
            low = q + 1;
          } else {
            high = q - 1;
          }
        }
        if (!best) best = await pipeline.clone().jpeg({ quality: 1, mozjpeg: true }).toBuffer();
        fs.writeFileSync(outputPath, best);
      } else {
        await pipeline.jpeg({ quality: 95, mozjpeg: true }).toFile(outputPath);
      }

      results.push({ input: inputPath, output: outputPath, ok: true });
      if (openOutputs) openList.push(outputPath);
    } catch (err) {
      results.push({ input: inputPath, ok: false, error: err.message || String(err) });
    }
  }

  if (openOutputs) {
    for (const p of openList) await shell.openPath(p);
  }

  return results;
});
