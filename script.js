const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");

const clearBtn = document.getElementById("clearBtn");
const runBtn = document.getElementById("runBtn");

const fileListDiv = document.getElementById("fileList");

let filesStore = [];

selectBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    fileInput.value = "";
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
    Array.from(fileList).forEach(file => {
        filesStore.push(file);
    });

    renderFiles();
}

function renderFiles() {

    fileListDiv.innerHTML = "";

    filesStore.forEach((file, index) => {

        const row = document.createElement("div");

        row.className = "file-row";

        row.innerHTML = `
            <div class="file-name">
                ${index + 1} - ${file.name}
            </div>

            <div class="file-size">
                ${(file.size / 1024).toFixed(2)} KB
            </div>
        `;

        fileListDiv.appendChild(row);
    });
}

clearBtn.addEventListener("click", () => {

    filesStore = [];
    renderFiles();

});

runBtn.addEventListener("click", async () => {

    if (!filesStore.length) {

        alert("هیچ فایلی انتخاب نشده");
        return;
    }

    runBtn.disabled = true;
    runBtn.innerText = "در حال پردازش...";

    try {

        const stamp = await loadImage("assets/stamp.png");

        for (const file of filesStore) {

            await processImage(file, stamp);

        }

        alert("پردازش تمام شد");

    } catch (err) {

        console.error(err);

        alert("خطا در پردازش");

    }

    runBtn.disabled = false;
    runBtn.innerText = "اجرا";

});

function loadImage(src) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = () => resolve(img);

        img.onerror = reject;

        img.src = src;

    });

}

function fileToImage(file) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = () => resolve(img);

        img.onerror = reject;

        img.src = URL.createObjectURL(file);

    });

}

async function processImage(file, stampImg) {

    const img = await fileToImage(file);

    const canvas = document.createElement("canvas");

    const ctx = canvas.getContext("2d");

    const margin = 5;

    canvas.width = img.width + margin * 2;
    canvas.height = img.height + margin * 2;

    ctx.fillStyle = "white";
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.drawImage(
        img,
        margin,
        margin
    );

    drawRoundedBorder(
        ctx,
        margin,
        margin,
        img.width,
        img.height,
        5,
        2
    );

    const stampWidth =
        img.width * 0.25;

    const stampHeight =
        stampWidth *
        (stampImg.height / stampImg.width);

    const offset =
        img.width * 0.10;

    const stampX =
        margin + offset;

    const stampY =
        margin +
        img.height -
        offset -
        stampHeight;

    ctx.drawImage(
        stampImg,
        stampX,
        stampY,
        stampWidth,
        stampHeight
    );

    const jpgData =
        canvas.toDataURL(
            "image/jpeg",
            0.95
        );

    downloadFile(
        jpgData,
        createOutputName(file.name)
    );
}

function drawRoundedBorder(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    borderWidth
) {

    ctx.beginPath();

    ctx.moveTo(x + radius, y);

    ctx.lineTo(
        x + width - radius,
        y
    );

    ctx.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + radius
    );

    ctx.lineTo(
        x + width,
        y + height - radius
    );

    ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height
    );

    ctx.lineTo(
        x + radius,
        y + height
    );

    ctx.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - radius
    );

    ctx.lineTo(
        x,
        y + radius
    );

    ctx.quadraticCurveTo(
        x,
        y,
        x + radius,
        y
    );

    ctx.closePath();

    ctx.lineWidth = borderWidth;

    ctx.strokeStyle = "black";

    ctx.stroke();
}

function createOutputName(original) {

    const d = new Date();

    const stamp =
        d.getFullYear() +
        "-" +
        String(
            d.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            d.getDate()
        ).padStart(2, "0") +
        "_" +
        String(
            d.getHours()
        ).padStart(2, "0") +
        "-" +
        String(
            d.getMinutes()
        ).padStart(2, "0");

    const base =
        original.replace(
            /\.[^/.]+$/,
            ""
        );

    return `${base}_${stamp}.jpg`;
}

function downloadFile(dataUrl, filename) {

    const a =
        document.createElement("a");

    a.href = dataUrl;

    a.download = filename;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

}
