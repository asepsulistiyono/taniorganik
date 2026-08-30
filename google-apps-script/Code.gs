/***************************************************************
 * KEBUN PAK TANI — REST API (Google Apps Script)
 * ---------------------------------------------------------------
 * CARA PAKAI:
 * 1. Buka spreadsheet Anda -> menu Extensions -> Apps Script.
 * 2. Hapus semua isi editor, tempel seluruh kode ini.
 * 3. Ganti SHEET_ID di bawah dengan ID spreadsheet Anda.
 * 4. Jalankan fungsi setupSheets() SEKALI (klik Run, izinkan
 *    akses) -> sheet "Produk" & "Pesanan" dibuat otomatis.
 * 5. Deploy -> New deployment -> Web app
 *      Execute as        : Me
 *      Who has access    : Anyone
 * 6. Salin URL /exec ke script.js website (baris API_URL).
 *
 * ENDPOINT:
 *   GET  URL/exec?action=produk  -> daftar produk (JSON)
 *   GET  URL/exec?action=ping    -> cek API aktif
 *   POST URL/exec                -> simpan pesanan (body JSON)
 *   GET  URL/exec                -> halaman info API
 ***************************************************************/

// =============== KONFIGURASI ===============
// [ISI_DISINI] -> ganti dengan ID spreadsheet Anda.
// Contoh URL spreadsheet:
//   https://docs.google.com/spreadsheets/d/1AbC...xyz/edit
// Maka SHEET_ID = "1AbC...xyz"
var SHEET_ID = "[ISI_DISINI]";

var NAMA_SHEET_PRODUK  = "Produk";
var NAMA_SHEET_PESANAN = "Pesanan";

// =============== ENDPOINT GET ===============
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (action === "produk") {
    return keluaranJSON_({ ok: true, data: bacaProduk_() });
  }
  if (action === "ping") {
    return keluaranJSON_({ ok: true, pesan: "API Kebun aktif", waktu: new Date().toISOString() });
  }
  // Tanpa parameter -> tampilkan halaman web (Web App)
  return halamanWeb_();
}

// =============== ENDPOINT POST: simpan pesanan ===============
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Validasi data minimal
    if (!body.nama || !body.wa || !body.items || !body.items.length) {
      return keluaranJSON_({ ok: false, pesan: "Data pesanan tidak lengkap." });
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName(NAMA_SHEET_PESANAN);
    if (!sh) { setupSheets(); sh = ss.getSheetByName(NAMA_SHEET_PESANAN); }

    // Bentuk items: [{nama:"Bayam", jumlah:2, satuan:"ikat",
    //                 harga:8000, subtotal:16000}, ...]
    var rincian = [];
    var jumlah  = [];
    for (var i = 0; i < body.items.length; i++) {
      var it = body.items[i];
      rincian.push(it.nama + " " + it.jumlah + " " + (it.satuan || "") + " @" + it.harga);
      jumlah.push(it.jumlah + " " + (it.satuan || ""));
    }

    var idPesanan = "PSN-" + new Date().getTime();
    sh.appendRow([
      new Date(),                 // Timestamp
      body.nama,                  // Nama_Pemesan
      body.alamat || "",          // Alamat
      body.wa,                    // No_WA
      rincian.join("; "),         // Produk
      jumlah.join(", "),          // Jumlah
      body.total || 0,            // Total_Harga
      body.tanggal_kirim || "",   // Tanggal_Kirim
      "Menunggu Konfirmasi"       // Status_Pesanan
    ]);

    return keluaranJSON_({
      ok: true,
      id: idPesanan,
      pesan: "Pesanan berhasil disimpan. Silakan konfirmasi via WhatsApp."
    });
  } catch (err) {
    return keluaranJSON_({ ok: false, pesan: "Gagal menyimpan pesanan: " + err.message });
  }
}

// =============== Baca sheet Produk ===============
function bacaProduk_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(NAMA_SHEET_PRODUK);
  if (!sh) return [];

  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  data.shift(); // buang baris judul kolom

  var hasil = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1]) continue; // lewati baris kosong
    var stok = Number(r[4]) || 0;
    hasil.push({
      id:       String(r[0]),
      nama:     String(r[1] || "Tanpa nama"),
      harga:    Number(r[2]) || 0,
      satuan:   String(r[3] || "pcs"),
      stok:     stok,
      gambar:   String(r[5] || ""),
      kategori: String(r[6] || "Lainnya"),
      status:   String(r[7] || (stok > 0 ? "Tersedia" : "Habis"))
    });
  }
  return hasil;
}

// =============== Balasan JSON ===============
function keluaranJSON_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============== Halaman web (jika URL dibuka langsung) ===============
function halamanWeb_() {
  var html = ""
    + "<!doctype html><html><head><meta charset='utf-8'>"
    + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    + "<title>API Kebun Pak Tani</title>"
    + "<style>body{font-family:Georgia,serif;background:#f5eedd;color:#1b3a20;"
    + "display:flex;align-items:center;justify-content:center;min-height:100vh;"
    + "margin:0;padding:24px}.k{background:#fffdf4;border:2px dashed #7a6248;"
    + "border-radius:12px;padding:32px;max-width:520px}h1{font-size:24px}"
    + "code{background:#ece1c6;padding:2px 6px;border-radius:4px}</style></head>"
    + "<body><div class='k'><h1>API Kebun Pak Tani aktif</h1>"
    + "<p>Endpoint yang tersedia:</p><ul>"
    + "<li><code>?action=produk</code> — daftar produk (JSON)</li>"
    + "<li><code>?action=ping</code> — cek status API</li>"
    + "<li><code>POST</code> — simpan pesanan baru</li></ul>"
    + "<p>Hubungkan URL ini ke <code>API_URL</code> di file script.js website Anda.</p>"
    + "</div></body></html>";
  return HtmlService.createHtmlOutput(html).setTitle("API Kebun Pak Tani");
}

// =============== JALANKAN SEKALI: buat sheet + data contoh ===============
// Klik Run pada fungsi ini di editor, lalu izinkan akses yang diminta.
function setupSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // --- Sheet Produk ---
  var sp = ss.getSheetByName(NAMA_SHEET_PRODUK);
  if (!sp) sp = ss.insertSheet(NAMA_SHEET_PRODUK);
  if (sp.getLastRow() === 0) {
    sp.appendRow(["ID", "Nama", "Harga", "Satuan", "Stok", "Gambar_URL", "Kategori", "Status"]);
    sp.appendRow(["P01", "Bayam Hijau", 8000, "ikat", 24, "", "Sayur", "Tersedia"]);
    sp.appendRow(["P02", "Kangkung", 7000, "ikat", 18, "", "Sayur", "Tersedia"]);
    sp.appendRow(["P03", "Pepaya California", 12000, "kg", 30, "", "Buah", "Tersedia"]);
  }
  sp.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#2f5e33").setFontColor("#f5eedd");
  sp.setFrozenRows(1);

  // --- Sheet Pesanan ---
  var so = ss.getSheetByName(NAMA_SHEET_PESANAN);
  if (!so) so = ss.insertSheet(NAMA_SHEET_PESANAN);
  if (so.getLastRow() === 0) {
    so.appendRow(["Timestamp", "Nama_Pemesan", "Alamat", "No_WA", "Produk",
                  "Jumlah", "Total_Harga", "Tanggal_Kirim", "Status_Pesanan"]);
  }
  so.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#4b3826").setFontColor("#f5eedd");
  so.setFrozenRows(1);

  Logger.log("Sheet Produk & Pesanan siap. Lanjut deploy sebagai Web App.");
}
