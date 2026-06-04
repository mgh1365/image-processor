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



function addFiles(fileList){

    const arr = Array.from(fileList);

    arr.forEach(file => {

        filesStore.push(file);
    });

    renderFiles();
}



function renderFiles(){

    fileListDiv.innerHTML = "";

    filesStore.forEach((file,index)=>{

        const row = document.createElement("div");

        row.className = "file-row";

        const sizeKB =
            (file.size / 1024).toFixed(2);

        row.innerHTML = `
            <div class="file-name">
                ${index+1} - ${file.name}
            </div>

            <div class="file-size">
                ${sizeKB} KB
            </div>
        `;

        fileListDiv.appendChild(row);

    });

}



clearBtn.addEventListener("click",()=>{

    filesStore = [];

    renderFiles();
});



runBtn.addEventListener("click",()=>{

    if(filesStore.length===0){

        alert("هیچ فایلی انتخاب نشده");
        return;
    }

    alert(
        `تعداد فایل ها: ${filesStore.length}`
    );

});
