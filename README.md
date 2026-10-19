# PDFKu — Local PDF Toolkit

Website lokal dengan antarmuka vanilla HTML, CSS, dan JavaScript. Project memiliki dua backend terpisah:

- **PDF to Word** — Node.js (`POST /api/pdf-to-word`, port `3000`)
- **Compress PDF** — Python + Flask + PyMuPDF (`POST /api/compress`, port `5001`)

Tidak menggunakan React, Vue, atau framework frontend.

## Persyaratan

- Node.js 18 atau lebih baru dan npm
- Python 3.10 atau lebih baru (direkomendasikan 3.11/3.12)
- Browser modern

## 1. Jalankan backend Node.js dan website

Buka terminal pertama:

```bash
cd server-node
npm install
npm start
```

Jika berhasil, terminal menampilkan `PDFKu (Node.js) berjalan di http://localhost:3000`.

Buka website dari alamat tersebut: **http://localhost:3000**. Jangan membuka `index.html` dengan `file://`, karena endpoint Node.js perlu diakses melalui server lokal.

Pemeriksaan endpoint:

- `GET http://localhost:3000/api/health`
- `POST http://localhost:3000/api/pdf-to-word` dengan multipart form field bernama `file`

## 2. Jalankan backend Python untuk kompresi PDF

Buka terminal kedua dari folder utama project:

### Windows PowerShell

```powershell
cd server-python
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

Jika PowerShell menolak aktivasi virtual environment karena kebijakan skrip, kamu bisa langsung menjalankan Python dari environment setelah dibuat atau gunakan Command Prompt:

```bat
.venv\Scripts\activate.bat
```

### macOS / Linux

```bash
cd server-python
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

Service kompresi berjalan di **http://127.0.0.1:5001**.

Pemeriksaan endpoint:

- `GET http://127.0.0.1:5001/api/health`
- `POST http://127.0.0.1:5001/api/compress` dengan multipart form field bernama `file`

Biarkan kedua terminal berjalan saat menggunakan website.

## Cara memakai

1. Jalankan kedua backend.
2. Buka `http://localhost:3000`.
3. Pilih **PDF to Word** atau **Compress PDF** pada sidebar.
4. Pilih file PDF atau drag-and-drop ke area unggah.
5. Klik tombol proses. File hasil akan diunduh oleh browser.

## Batasan yang perlu diketahui

### PDF to Word

Endpoint Node.js memakai `pdf-parse` untuk mengekstrak teks dan paket `docx` untuk membuat dokumen `.docx`. Ini adalah **konverter teks dasar**, bukan replika penuh konverter komersial: tata letak, kolom, gambar, tabel, dan pemformatan kompleks mungkin tidak dipertahankan. PDF yang hanya berisi hasil scan dan tidak memiliki lapisan teks akan membutuhkan OCR; OCR belum dipasang pada versi ini.

Batas ukuran unggahan PDF to Word: 25 MB.

### Compress PDF

Endpoint Python menggunakan PyMuPDF untuk menulis ulang PDF dan mengompres stream yang didukung. Hasil pengurangan ukuran bergantung pada isi file. PDF yang sudah terkompresi dapat memiliki ukuran sama atau justru sedikit lebih besar setelah diproses. Versi ini mengutamakan optimasi struktural; bukan kompresi gambar lossy agresif.

Batas ukuran unggahan compress PDF: 50 MB.

## Keamanan dan privasi

- Kedua backend diatur untuk mendengarkan pada loopback lokal (`localhost` / `127.0.0.1`) dan tidak untuk diakses dari jaringan luar.
- File diolah di memori dan tidak disimpan sebagai file unggahan permanen oleh kode aplikasi.
- Hindari membuka port atau mengekspos server ini ke internet sebelum menambahkan autentikasi, validasi, pembatasan request, dan kontrol keamanan yang sesuai.
- Untuk dokumen sensitif, pastikan komputer yang digunakan aman dan tutup kedua service setelah selesai.

## Struktur folder

```text
pdfku-local/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server-node/
│   ├── package.json
│   └── server.js
├── server-python/
│   ├── app.py
│   └── requirements.txt
└── README.md
```
