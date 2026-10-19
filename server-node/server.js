const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const hasPdfExtension = path.extname(file.originalname).toLowerCase() === ".pdf";
    const acceptedMime = !file.mimetype || file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";
    if (hasPdfExtension && acceptedMime) return callback(null, true);
    return callback(new Error("Format tidak didukung. Unggah file dengan ekstensi .pdf."));
  }
});

app.disable("x-powered-by");
app.use(express.static(FRONTEND_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "pdfku-node", endpoint: "/api/pdf-to-word" });
});

app.post("/api/pdf-to-word", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File PDF belum dipilih." });
    }

    const buffer = req.file.buffer;
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return res.status(400).json({ error: "File yang dikirim bukan PDF yang valid." });
    }

    let parsed;
    try {
      parsed = await pdfParse(buffer);
    } catch (_error) {
      return res.status(422).json({ error: "PDF tidak dapat dibaca. File mungkin rusak atau memiliki proteksi." });
    }

    const extractedText = String(parsed.text || "").replace(/\r/g, "").trim();
    if (!extractedText) {
      return res.status(422).json({
        error: "Tidak ditemukan teks yang dapat diekstrak. PDF hasil scan memerlukan OCR; fitur OCR belum tersedia pada versi ini."
      });
    }

    // Basic conversion: extract text into editable Word paragraphs.
    // This does not reproduce the original PDF's exact layout, images, or tables.
    const paragraphs = extractedText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 120 }
      }));

    const document = new Document({
      title: "Hasil Konversi PDF",
      description: "Dibuat oleh PDFKu Local PDF Toolkit",
      creator: "PDFKu",
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "Hasil Konversi PDF",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 240 }
          }),
          ...paragraphs
        ]
      }]
    });

    const docxBuffer = await Packer.toBuffer(document);
    res.status(200);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="hasil-konversi.docx"');
    res.setHeader("Content-Length", String(docxBuffer.length));
    return res.send(docxBuffer);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Ukuran file melebihi batas 25 MB." });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: "Upload tidak valid: " + error.message });
  }
  if (error) {
    console.error("[PDFKu Node]", error.message || error);
    return res.status(500).json({ error: "Terjadi kesalahan pada service Node.js." });
  }
  return res.status(500).json({ error: "Kesalahan server yang tidak diketahui." });
});

app.listen(PORT, () => {
  console.log(`PDFKu (Node.js) berjalan di http://localhost:${PORT}`);
  console.log(`Frontend: ${FRONTEND_DIR}`);
});
