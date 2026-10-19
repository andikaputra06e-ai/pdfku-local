(() => {
  "use strict";

  const PYTHON_API = "http://127.0.0.1:5001";
  const MAX_WORD_BYTES = 25 * 1024 * 1024;
  const MAX_COMPRESS_BYTES = 50 * 1024 * 1024;

  const elements = {
    navButtons: [...document.querySelectorAll("[data-tool]")],
    breadcrumbTool: document.querySelector("#breadcrumbTool"),
    pageTitle: document.querySelector("#pageTitle"),
    pageDescription: document.querySelector("#pageDescription"),
    panelTitle: document.querySelector("#panelTitle"),
    panelDescription: document.querySelector("#panelDescription"),
    dropzone: document.querySelector("#dropzone"),
    fileInput: document.querySelector("#fileInput"),
    chooseFile: document.querySelector("#chooseFile"),
    selectedFile: document.querySelector("#selectedFile"),
    fileName: document.querySelector("#fileName"),
    fileSize: document.querySelector("#fileSize"),
    removeFile: document.querySelector("#removeFile"),
    outputNote: document.querySelector("#outputNote"),
    processButton: document.querySelector("#processButton"),
    processButtonText: document.querySelector("#processButtonText"),
    progressArea: document.querySelector("#progressArea"),
    progressText: document.querySelector("#progressText"),
    resultMessage: document.querySelector("#resultMessage")
  };

  let activeTool = "word";
  let selectedFile = null;
  let busy = false;

  const toolCopy = {
    word: {
      name: "PDF to Word",
      title: 'Ubah PDF menjadi<br><span>Word yang editable.</span>',
      description: "Ekstrak teks dari PDF dan simpan sebagai dokumen Word (.docx) yang bisa kamu edit kembali.",
      panelTitle: "Mulai konversi",
      panelDescription: "Pilih satu file PDF untuk dikonversi menjadi Word.",
      button: "Konversi ke Word",
      output: 'Output: <strong>.DOCX</strong> · Dokumen Word yang bisa diedit',
      progress: "Mengekstrak teks dan membuat dokumen Word…"
    },
    compress: {
      name: "Compress PDF",
      title: 'Kecilkan ukuran<br><span>file PDF kamu.</span>',
      description: "Optimalkan struktur PDF dengan endpoint Python lokal agar file lebih ringkas dan mudah dibagikan.",
      panelTitle: "Kompres dokumen",
      panelDescription: "Pilih satu file PDF untuk dioptimalkan.",
      button: "Kompres PDF",
      output: 'Output: <strong>.PDF</strong> · File PDF hasil optimasi',
      progress: "Mengoptimalkan PDF menggunakan Python…"
    }
  };

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Ukuran tidak diketahui";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${units[unitIndex]}`;
  }

  function clearResult() {
    elements.resultMessage.className = "result-message hidden";
    elements.resultMessage.textContent = "";
  }

  function showResult(message, type, extraNode = null) {
    elements.resultMessage.className = `result-message ${type}`;
    elements.resultMessage.replaceChildren(document.createTextNode(message));
    if (extraNode) elements.resultMessage.append(" ", extraNode);
    elements.resultMessage.classList.remove("hidden");
  }

  function setTool(tool) {
    if (busy) return;
    activeTool = tool;
    const copy = toolCopy[tool];
    elements.navButtons.forEach(button => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    elements.breadcrumbTool.textContent = copy.name;
    elements.pageTitle.innerHTML = copy.title;
    elements.pageDescription.textContent = copy.description;
    elements.panelTitle.textContent = copy.panelTitle;
    elements.panelDescription.textContent = copy.panelDescription;
    elements.processButtonText.textContent = copy.button;
    elements.outputNote.innerHTML = copy.output;
    elements.fileInput.accept = ".pdf,application/pdf";
    elements.progressText.textContent = copy.progress;
    clearResult();
    updateSelectedFile();
  }

  function validateFile(file) {
    if (!file) return "Pilih file PDF terlebih dahulu.";
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return "Format tidak didukung. Silakan pilih file PDF.";
    }
    const maxBytes = activeTool === "word" ? MAX_WORD_BYTES : MAX_COMPRESS_BYTES;
    if (file.size > maxBytes) {
      return `Ukuran file melewati batas ${activeTool === "word" ? "25 MB" : "50 MB"} untuk fitur ini.`;
    }
    return "";
  }

  function choose(file) {
    if (!file || busy) return;
    const validationError = validateFile(file);
    if (validationError) {
      selectedFile = null;
      updateSelectedFile();
      showResult(validationError, "error");
      return;
    }
    selectedFile = file;
    clearResult();
    updateSelectedFile();
  }

  function updateSelectedFile() {
    const hasFile = Boolean(selectedFile);
    elements.selectedFile.classList.toggle("hidden", !hasFile);
    elements.dropzone.classList.toggle("has-file", hasFile);
    if (hasFile) {
      elements.fileName.textContent = selectedFile.name;
      elements.fileSize.textContent = formatBytes(selectedFile.size);
    }
    elements.processButton.disabled = !hasFile || busy;
  }

  function setBusy(value) {
    busy = value;
    elements.progressArea.classList.toggle("hidden", !value);
    elements.chooseFile.disabled = value;
    elements.removeFile.disabled = value;
    elements.processButton.disabled = value || !selectedFile;
    elements.processButtonText.textContent = value ? "Memproses…" : toolCopy[activeTool].button;
    elements.navButtons.forEach(button => button.disabled = value);
  }

  async function readError(response) {
    try {
      const body = await response.json();
      return body.error || body.message || `Permintaan gagal (${response.status}).`;
    } catch {
      return `Permintaan gagal (${response.status}). Pastikan server backend berjalan.`;
    }
  }

  async function processFile() {
    if (!selectedFile || busy) return;
    const validationError = validateFile(selectedFile);
    if (validationError) {
      showResult(validationError, "error");
      return;
    }

    clearResult();
    setBusy(true);
    const formData = new FormData();
    formData.append("file", selectedFile, selectedFile.name);

    try {
      let response;
      if (activeTool === "word") {
        response = await fetch("/api/pdf-to-word", { method: "POST", body: formData });
      } else {
        response = await fetch(`${PYTHON_API}/api/compress`, { method: "POST", body: formData });
      }

      if (!response.ok) throw new Error(await readError(response));
      const blob = await response.blob();
      if (!blob.size) throw new Error("Server mengembalikan file kosong.");

      const outputName = activeTool === "word" ? "hasil-konversi.docx" : "hasil-kompres.pdf";
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = outputName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);

      if (activeTool === "compress") {
        const original = Number(response.headers.get("X-Original-Size")) || selectedFile.size;
        const compressed = Number(response.headers.get("X-Compressed-Size")) || blob.size;
        if (compressed < original) {
          const percent = ((original - compressed) / original * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 });
          showResult(`Selesai. Ukuran berubah dari ${formatBytes(original)} menjadi ${formatBytes(compressed)} (berkurang ${percent}%). File hasil mulai diunduh.`, "success");
        } else if (compressed > original) {
          showResult(`Selesai, tetapi file hasil (${formatBytes(compressed)}) lebih besar daripada file awal (${formatBytes(original)}). PDF ini mungkin sudah terkompresi. File hasil mulai diunduh.`, "success");
        } else {
          showResult(`Selesai. Ukuran file tetap ${formatBytes(compressed)}. PDF mungkin sudah optimal. File hasil mulai diunduh.`, "success");
        }
      } else {
        showResult("Konversi berhasil. File hasil-konversi.docx mulai diunduh. Perlu diketahui: versi ini mengekstrak teks dan tidak mempertahankan tata letak PDF secara persis.", "success");
      }
    } catch (error) {
      const message = error instanceof TypeError
        ? (activeTool === "word"
            ? "Tidak dapat terhubung ke Node.js. Jalankan server Node.js dan buka website dari http://localhost:3000."
            : "Tidak dapat terhubung ke service Python di http://127.0.0.1:5001. Pastikan server Python berjalan.")
        : error.message;
      showResult(message || "Terjadi kesalahan yang tidak diketahui.", "error");
    } finally {
      setBusy(false);
      updateSelectedFile();
    }
  }

  elements.navButtons.forEach(button => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });
  elements.chooseFile.addEventListener("click", event => {
    event.stopPropagation();
    elements.fileInput.click();
  });
  elements.dropzone.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    elements.fileInput.click();
  });
  elements.dropzone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
  elements.fileInput.addEventListener("change", event => {
    choose(event.target.files && event.target.files[0]);
    event.target.value = "";
  });
  elements.removeFile.addEventListener("click", () => {
    if (busy) return;
    selectedFile = null;
    clearResult();
    updateSelectedFile();
  });
  elements.processButton.addEventListener("click", processFile);

  ["dragenter", "dragover"].forEach(type => {
    elements.dropzone.addEventListener(type, event => {
      event.preventDefault();
      if (!busy) elements.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(type => {
    elements.dropzone.addEventListener(type, event => {
      event.preventDefault();
      elements.dropzone.classList.remove("dragover");
    });
  });
  elements.dropzone.addEventListener("drop", event => {
    if (busy) return;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    choose(file);
  });

  setTool("word");
})();
