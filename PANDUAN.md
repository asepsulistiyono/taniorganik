# PANDUAN PEMASANGAN — Website Kebun Pak Tani

Website ini hanya 3 file (`index.html`, `style.css`, `script.js`) — **tanpa framework, tanpa server, 100% gratis**.
Database = **Google Sheets**, API = **Google Apps Script** (kode siap tempel di `google-apps-script/Code.gs`).

---

## C. STRUKTUR GOOGLE SHEETS

Buat spreadsheet baru di **sheets.new**, lalu buat 2 sheet (tab):

### Sheet `Produk` (daftar dagangan)

| ID  | Nama              | Harga | Satuan | Stok | Gambar_URL        | Kategori | Status    |
|-----|-------------------|-------|--------|------|-------------------|----------|-----------|
| P01 | Bayam Hijau       | 8000  | ikat   | 24   | https://…jpg      | Sayur    | Tersedia  |
| P02 | Kangkung          | 7000  | ikat   | 18   |                   | Sayur    | Tersedia  |
| P03 | Pepaya California | 12000 | kg     | 30   |                   | Buah     | Tersedia  |
| P04 | Terong Ungu       | 10000 | kg     | 0    |                   | Sayur    | Habis     |

Catatan:
- **Harga** ditulis angka saja (8000, bukan Rp 8.000).
- **Gambar_URL** boleh kosong — website otomatis menampilkan gambar cadangan.
  Cara dapat link gambar gratis: unggah foto ke [postimages.org](https://postimages.org) atau Google Drive (Share → Anyone with the link), lalu salin link langsung ke file gambar.
- **Update stok harian:** cukup ubah angka `Stok` / `Status` — website langsung mengikuti.
- Tips: jalankan fungsi `setupSheets()` di Apps Script untuk membuat kedua sheet ini otomatis.

### Sheet `Pesanan` (terisi otomatis dari website)

| Timestamp | Nama_Pemesan | Alamat | No_WA | Produk | Jumlah | Total_Harga | Tanggal_Kirim | Status_Pesanan |
|-----------|--------------|--------|-------|--------|--------|-------------|---------------|----------------|
| 12/05/2026 09.14 | Bu Sari | Jl. Melati 5, Lembang | 0812… | Bayam 2 ikat @8000; Pepaya 1 kg @12000 | 2 ikat, 1 kg | 28000 | Selasa, 13 Mei 2026 | Menunggu Konfirmasi |

`Status_Pesanan` bisa Anda ubah manual: **Menunggu Konfirmasi → Diproses → Dikirim → Selesai**.

---

## D. LANGKAH DEMO / TESTING (dari nol sampai online)

### Tahap 1 — Coba website dalam mode demo (1 menit)
1. Buka `index.html` (klik dua kali, terbuka di browser).
2. Website jalan dengan **data contoh** dan banner kuning "mode demo".
3. Coba: masukkan Bayam ke keranjang → isi formulir → **Kirim Pesanan** → muncul tampilan sukses + tombol konfirmasi WhatsApp. Semua fitur bisa dicoba tanpa setup apa pun.

### Tahap 2 — Siapkan Google Sheets (3 menit)
1. Buka **sheets.new** → beri nama, misal "Data Kebun Pak Tani".
2. Buat 2 sheet sesuai tabel di bagian C (atau lewati — dibuat otomatis oleh `setupSheets()` nanti).
3. Salin **ID spreadsheet** dari URL:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit` → yang ditebalkan.

### Tahap 3 — Pasang Apps Script (5 menit)
1. Di spreadsheet: menu **Extensions → Apps Script**.
2. Hapus isi editor, tempel seluruh isi file **`google-apps-script/Code.gs`**.
3. Ganti `SHEET_ID = "[ISI_DISINI]"` dengan ID dari Tahap 2.
4. Simpan (Ctrl+S). Pilih fungsi **`setupSheets`** di dropdown toolbar → klik **Run** → izinkan akses (pilih akun Google Anda → *Advanced* → *Go to project* → *Allow*).
5. Cek spreadsheet: sheet `Produk` dan `Pesanan` sudah jadi, lengkap dengan 3 produk contoh.

### Tahap 4 — Deploy sebagai Web App (3 menit)
1. Klik **Deploy → New deployment** → ikon gerigi → pilih **Web app**.
2. *Description*: "API Kebun v1".
3. **Execute as: Me** · **Who has access: Anyone** (wajib!).
4. Klik **Deploy** → **Authorize access** (jika diminta).
5. **Salin Web App URL** — bentuknya `https://script.google.com/macros/s/AKfycb…/exec`.
6. **Uji API** di browser:
   - `URL-anda/exec?action=ping` → harus muncul `{"ok":true,…}`
   - `URL-anda/exec?action=produk` → harus muncul daftar produk JSON.

### Tahap 5 — Hubungkan website (2 menit)
1. Buka `script.js`, baris paling atas:
   ```js
   const API_URL = "[ISI_DISINI]";   // ← ganti dengan URL /exec dari Tahap 4
   const WA_NUMBER = "6281234567890"; // ← ganti dengan nomor WA Anda (62xxx)
   ```
2. Ganti nama kebun, alamat, dan nomor WA di `index.html` (cari komentar `[GANTI]`).
3. Muat ulang `index.html` — banner demo hilang, produk tampil dari Google Sheets Anda.
4. **Uji pesanan:** pesan sesuatu dari website, lalu buka sheet `Pesanan` — baris baru muncul.

### Tahap 6 — Online-kan gratis (5 menit)
Pilih salah satu:
- **Netlify Drop** (paling mudah): buka [app.netlify.com/drop](https://app.netlify.com/drop), seret folder berisi 3 file ini. Langsung dapat link `.netlify.app`.
- **GitHub Pages**: buat repository baru di github.com, unggah 3 file, aktifkan Pages di Settings.
- **Vercel**: impor dari GitHub, otomatis online.

Bagikan link ke pembeli lewat status WhatsApp / grup warga. Selesai!

---

## Catatan penting

- **Setiap mengubah kode Apps Script**, deploy ulang: *Deploy → Manage deployments → ✏️ Edit → Version: New version* → Deploy. URL tetap sama.
- **Setiap menambah produk/stok**, cukup edit sheet `Produk` — tidak perlu deploy ulang.
- Jika gambar dari Google Drive tidak muncul, pastikan izin file = "Anyone with the link", atau gunakan postimages.org.
- Website mengirim POST sebagai `text/plain` agar tidak kena preflight CORS — ini disengaja, jangan diubah.
