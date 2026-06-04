const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 860,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC: select files ────────────────────────────────────────────────────────
ipcMain.handle('select-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] }]
  });
  return canceled ? [] : filePaths;
});

// ─── IPC: pick stamp ──────────────────────────────────────────────────────────
ipcMain.handle('pick-stamp', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  return canceled ? null : filePaths[0];
});

// ─── IPC: process images ──────────────────────────────────────────────────────
ipcMain.handle('process-images', async (_event, payload) => {
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

  const results = [];
  const DPI = 96;
  const targetWidthPx = Math.round((targetWidthCm / 2.54) * DPI);

  for (const inputPath of filePaths) {
    try {
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath).toLowerCase();
      const base = path.basename(inputPath, ext);
      const outputPath = path.join(dir, `${base}_processed.jpg`);

      let img = sharp(inputPath);
      const meta = await img.metadata();

      // 1. Resize to target width if needed
      let scaleApplied = null;
      if (meta.width && meta.width !== targetWidthPx) {
        img = img.resize({ width: targetWidthPx, withoutEnlargement: false });
        scaleApplied = `${meta.width}→${targetWidthPx}px`;
      }

      // 2. Add border (white canvas 5px + black border 2px + rounded concept via padding)
      if (enableBorder) {
        img = img.flatten({ background: { r: 255, g: 255, b: 255 } });

        // Convert to buffer to get actual size after resize
        const buf = await img.toBuffer();
        const resized = sharp(buf);
        const rm = await resized.metadata();
        const w = rm.width;
        const h = rm.height;

        const canvas = 5;   // white canvas px each side
        const border = 2;   // black border px each side
        const total = canvas + border;

        img = sharp(buf)
          .extend({
            top: canvas, bottom: canvas, left: canvas, right: canvas,
            background: { r: 255, g: 255, b: 255 }
          });

        const buf2 = await img.toBuffer();
        img = sharp(buf2).extend({
          top: border, bottom: border, left: border, right: border,
          background: { r: 0, g: 0, b: 0 }
        });
      }

      // 3. Add stamp
      if (enableStamp && stampPath && fs.existsSync(stampPath)) {
        const buf3 = await img.toBuffer();
        const baseMeta = await sharp(buf3).metadata();
        const stampW = Math.round(baseMeta.width * 0.25);

        const stampBuf = await sharp(stampPath)
          .resize({ width: stampW })
          .toBuffer();

        img = sharp(buf3).composite([{
          input: stampBuf,
          gravity: 'southeast'
        }]);
      }

      // 4. Compress to target KB
      let quality = 90;
      let finalBuf;
      let sizeKB;

      if (enableCompress) {
        const targetBytes = targetKB * 1024;
        const rawBuf = await img.jpeg({ quality }).toBuffer();

        if (rawBuf.length <= targetBytes) {
          finalBuf = rawBuf;
          sizeKB = rawBuf.length / 1024;
        } else {
          // Binary search for quality
          let lo = 10, hi = quality;
          finalBuf = rawBuf;
          sizeKB = rawBuf.length / 1024;

          while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const testBuf = await sharp(rawBuf).jpeg({ quality: mid }).toBuffer();
            if (testBuf.length <= targetBytes) {
              finalBuf = testBuf;
              sizeKB = testBuf.length / 1024;
              quality = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
        }
      } else {
        finalBuf = await img.jpeg({ quality }).toBuffer();
        sizeKB = finalBuf.length / 1024;
      }

      fs.writeFileSync(outputPath, finalBuf);

      if (openOutputs) shell.openPath(outputPath);

      results.push({ ok: true, input: inputPath, output: outputPath, sizeKB, quality, scaleApplied });
    } catch (err) {
      results.push({ ok: false, input: inputPath, error: err.message });
    }
  }

  return results;
});
