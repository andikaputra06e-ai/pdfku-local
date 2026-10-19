from __future__ import annotations

import io
import logging

import fitz  # PyMuPDF
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB
CORS(
    app,
    resources={r"/api/*": {"origins": [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]}},
    expose_headers=["X-Original-Size", "X-Compressed-Size"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdfku-python")


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "pdfku-python",
        "endpoint": "/api/compress",
    })


@app.post("/api/compress")
def compress_pdf():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify(error="File PDF belum dipilih."), 400

    if not upload.filename.lower().endswith(".pdf"):
        return jsonify(error="Format tidak didukung. Unggah file dengan ekstensi .pdf."), 400

    original_bytes = upload.read()
    if len(original_bytes) < 5 or not original_bytes.startswith(b"%PDF-"):
        return jsonify(error="File yang dikirim bukan PDF yang valid."), 400

    document = None
    try:
        document = fitz.open(stream=original_bytes, filetype="pdf")
        if document.needs_pass:
            return jsonify(error="PDF dilindungi kata sandi. Buka kunci file secara sah terlebih dahulu."), 422

        if document.page_count == 0:
            return jsonify(error="PDF tidak memiliki halaman."), 422

        # Rewrites the document and compresses streams where possible.
        # This is structural/lossless optimization, not aggressive image downsampling.
        output_bytes = document.tobytes(
            garbage=4,
            clean=True,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
        )

        result_stream = io.BytesIO(output_bytes)
        result_stream.seek(0)
        response = send_file(
            result_stream,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="hasil-kompres.pdf",
            max_age=0,
        )
        response.headers["X-Original-Size"] = str(len(original_bytes))
        response.headers["X-Compressed-Size"] = str(len(output_bytes))
        response.headers["Cache-Control"] = "no-store"
        return response

    except (fitz.FileDataError, ValueError) as exc:
        logger.info("PDF could not be processed: %s", exc)
        return jsonify(error="PDF tidak dapat dibaca atau rusak."), 422
    except Exception:
        logger.exception("Unexpected PDF compression error")
        return jsonify(error="Terjadi kesalahan saat mengompres PDF."), 500
    finally:
        if document is not None:
            document.close()


@app.errorhandler(RequestEntityTooLarge)
def handle_large_file(_error):
    return jsonify(error="Ukuran file melebihi batas 50 MB."), 413


if __name__ == "__main__":
    print("PDFKu (Python) berjalan di http://127.0.0.1:5001")
    app.run(host="127.0.0.1", port=5001, debug=False)
