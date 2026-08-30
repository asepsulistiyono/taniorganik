/* ═══════════════════════════════════════════════════════════════
   KEBUN PAK TANI — script.js (JavaScript murni, tanpa framework)

   Tugas file ini:
   1. Ambil daftar produk dari Google Apps Script  (GET  ?action=produk)
   2. Kirim pesanan ke Google Sheets               (POST body JSON)
   3. Mengelola keranjang, formulir, dan tampilan halaman.

   Jika API_URL masih "[ISI_DISINI]" atau kosong, website berjalan
   dalam MODE DEMO dengan data contoh — semua fitur tetap bisa dicoba.
   ═══════════════════════════════════════════════════════════════ */

// ─────────────────────────── KONFIGURASI ───────────────────────────
// [ISI_DISINI] → ganti dengan URL Web App Apps Script Anda (akhiran /exec).
// Contoh: "https://script.google.com/macros/s/AKfycbx…/exec"
const API_URL = "[ISI_DISINI]";

// [GANTI] → nomor WhatsApp kebun, format 62xxx (tanpa + atau spasi)
const WA_NUMBER = "6281234567890";

// ─────────────────────────── DATA DEMO ─────────────────────────────
// Dipakai hanya selama API_URL belum diisi. Ganti/sesuaikan bebas.
const PRODUK_DEMO = [
  { id: "P01", nama: "Bayam Hijau",        harga: 8000,  satuan: "ikat", stok: 24, kategori: "Sayur",   status: "Tersedia",
    gambar: "https://image.qwenlm.ai/generated-images/c40eb1d9-792d-4476-a076-f92cdfc0d919/_result.png" },
  { id: "P02", nama: "Kangkung",           harga: 7000,  satuan: "ikat", stok: 18, kategori: "Sayur",   status: "Tersedia",
    gambar: "https://image.qwenlm.ai/generated-images/c8820f56-cde1-4163-8151-f1492ffdbaac/_result.png" },
  { id: "P03", nama: "Sawi Hijau (Caisim)",harga: 9000,  satuan: "ikat", stok: 15, kategori: "Sayur",   status: "Tersedia",
    gambar: "https://image.qwenlm.ai/generated-images/9c88df15-f9d0-4a84-8a0b-75cf7dd601d2/_result.png" },
  { id: "P04", nama: "Pepaya California",  harga: 12000, satuan: "kg",   stok: 30, kategori: "Buah",    status: "Tersedia",
    gambar: "https://image.qwenlm.ai/generated-images/99c72bcd-7f54-453b-9184-410ef6d6525f/_result.png" },
  { id: "P05", nama: "Pisang Cavendish",   harga: 15000, satuan: "kg",   stok: 12, kategori: "Buah",    status: "Tersedia",
    gambar: "https://image.qwenlm.ai/generated-images/67f6999f-2720-4959-8533-b6ccc100e55d/_result.png" },
  { id: "P06", nama: "Cabai Rawit Merah",  harga: 35000, satuan: "kg",   stok: 6,  kategori: "Sayur",   status: "Tersedia",
    gambar: "https://image.qwenlm.ai/generated-images/5c05e47d-3892-4a49-82b0-88bf7964bf05/_result.png" },
  { id: "P07", nama: "Terong Ungu",        harga: 10000, satuan: "kg",   stok: 0,  kategori: "Sayur",   status: "Habis", gambar: "" },
  { id: "P08", nama: "Jeruk Peras",        harga: 13000, satuan: "kg",   stok: 9,  kategori: "Buah",    status: "Tersedia", gambar: "" },
];

// Gambar cadangan jika produk tidak punya foto
const GAMBAR_CADANGAN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#ece1c6"/><path d="M100 38c30 18 45 40 45 66 0 23-18 34-45 34s-45-11-45-34c0-26 15-48 45-66z" fill="#c2d98a"/><path d="M100 55v95M100 85l-24-18M100 110l27-20" stroke="#2f5e33" stroke-width="6" stroke-linecap="round" fill="none"/></svg>'
  );

// ─────────────────────────── STATE GLOBAL ──────────────────────────
const state = {
  produk: [],            // daftar produk (dari API atau demo)
  mode: "demo",          // "demo" | "live"
  kategori: "Semua",     // filter aktif
  keranjang: new Map(),  // idProduk -> jumlah
  sukses: null,          // data pesanan yang berhasil terkirim
  mengirim: false,
};
const KEY_KERANJANG = "kpt-keranjang-v1";
const WA_LINK = "https://wa.me/" + WA_NUMBER;

// ─────────────────────────── UTILITAS ──────────────────────────────
const $ = (s) => document.querySelector(s);
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const isoDate = (d) => {
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};
const formatTanggal = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const stokEfektif = (p) => (String(p.status).toLowerCase() === "habis" ? 0 : Number(p.stok) || 0);
const cariProduk = (id) => state.produk.find((p) => p.id === id);

// ─────────────────────────── NOTIFIKASI TOAST ──────────────────────
function toast(pesan, tipe = "info") {
  const wadah = $("#toastWadah");
  const el = document.createElement("div");
  el.className = "toast" + (tipe === "gagal" ? " gagal" : "");
  const ikon =
    tipe === "gagal"
      ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/></svg>'
      : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  el.innerHTML = ikon + "<span>" + esc(pesan) + "</span>";
  wadah.appendChild(el);
  setTimeout(() => {
    el.classList.add("keluar");
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

// ─────────────────────────── AMBIL PRODUK ──────────────────────────
async function muatProduk() {
  renderSkeleton();

  // MODE DEMO: API_URL belum diisi
  if (!API_URL || API_URL === "[ISI_DISINI]") {
    state.mode = "demo";
    await jeda(650); // simulasi jaringan, biar kerangka loading terlihat
    state.produk = PRODUK_DEMO.map((p) => ({ ...p }));
    $("#bannerDemo").hidden = false;
    selesaiMuat();
    return;
  }

  // MODE LIVE: ambil dari Google Apps Script
  state.mode = "live";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(API_URL + "?action=produk", { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.pesan || "Jawaban API tidak valid");
    state.produk = (json.data || []).map(normalisasiProduk);
    selesaiMuat();
  } catch (err) {
    renderGalat(err.name === "AbortError" ? "Koneksi lambat — server tidak menjawab." : "Gagal memuat produk dari Google Sheets.");
  } finally {
    clearTimeout(timer);
  }
}

function normalisasiProduk(r) {
  const stok = Number(r.stok) || 0;
  return {
    id: String(r.id ?? ""),
    nama: String(r.nama ?? "Tanpa nama"),
    harga: Number(r.harga) || 0,
    satuan: String(r.satuan || "pcs"),
    stok,
    gambar: String(r.gambar || ""),
    kategori: String(r.kategori || "Lainnya"),
    status: String(r.status || (stok > 0 ? "Tersedia" : "Habis")),
  };
}

function selesaiMuat() {
  pulihkanKeranjang();
  renderTicker();
  renderChips();
  renderGrid();
  renderKeranjangUI();
}

// ─────────────────────────── TICKER PANEN ──────────────────────────
function renderTicker() {
  const tersedia = state.produk.filter((p) => stokEfektif(p) > 0);
  const items = [
    ...tersedia.slice(0, 8).map((p) => p.nama + " segar"),
    "100% organik tanpa pestisida kimia",
    "Panen Selasa & Jumat",
    "Antar area Lembang & Bandung Utara",
  ];
  const html = items.map((t) => '<span class="ticker-item">' + esc(t) + "</span>").join("");
  // digandakan 2x agar animasi geser menyambung tanpa putus
  $("#tickerTrack").innerHTML = html + html;
}

// ─────────────────────────── FILTER KATEGORI ───────────────────────
function renderChips() {
  const kategori = ["Semua", ...new Set(state.produk.map((p) => p.kategori))];
  $("#filterChips").innerHTML = kategori
    .map((k) => {
      const n = k === "Semua" ? state.produk.length : state.produk.filter((p) => p.kategori === k).length;
      return (
        '<button class="chip' + (state.kategori === k ? " aktif" : "") + '" data-kategori="' + esc(k) + '" role="tab" aria-selected="' + (state.kategori === k) + '">' +
        esc(k) + '<span class="jumlah">(' + n + ")</span></button>"
      );
    })
    .join("");
}

$("#filterChips").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.kategori = btn.dataset.kategori;
  renderChips();
  renderGrid();
});

// ─────────────────────────── GRID PRODUK ───────────────────────────
function renderSkeleton() {
  $("#gridProduk").innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton" aria-hidden="true"></div>').join("");
}

function renderGalat(pesan) {
  $("#filterChips").innerHTML = "";
  $("#gridProduk").innerHTML =
    '<div class="status-panel">' +
    '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--bata)" stroke-width="1.8" stroke-linecap="round" style="margin:0 auto .7rem;display:block"><path d="M12 8v5M12 16.5v.1"/><circle cx="12" cy="12" r="9.2"/></svg>' +
    "<p><strong>" + esc(pesan) + "</strong><br>Periksa koneksi Anda, atau pastikan URL Apps Script di <code>script.js</code> sudah benar dan di-deploy dengan akses <em>Anyone</em>.</p>" +
    '<button class="btn btn-utama" id="btnCobaLagi">Coba Lagi</button></div>';
  $("#btnCobaLagi").addEventListener("click", muatProduk);
}

function renderGrid() {
  const grid = $("#gridProduk");
  const list = state.produk.filter((p) => state.kategori === "Semua" || p.kategori === state.kategori);

  if (!list.length) {
    grid.innerHTML =
      '<div class="status-panel"><p><strong>Belum ada produk di kategori ini.</strong><br>Cek lagi setelah hari panen berikutnya, ya.</p></div>';
    return;
  }

  grid.innerHTML = list
    .map((p) => {
      const stok = stokEfektif(p);
      const qty = state.keranjang.get(p.id) || 0;
      const habis = stok === 0;
      const aksi = habis
        ? '<button class="btn-pesan" disabled>Stok Habis</button>'
        : qty > 0
          ? '<div class="stepper">' +
            '<button data-aksi="kurang" data-id="' + esc(p.id) + '" aria-label="Kurangi ' + esc(p.nama) + '">&minus;</button>' +
            '<span class="qty">' + qty + " <small>" + esc(p.satuan) + "</small></span>" +
            '<button data-aksi="tambah" data-id="' + esc(p.id) + '" aria-label="Tambah ' + esc(p.nama) + '" ' + (qty >= stok ? "disabled" : "") + ">+</button></div>"
          : '<button class="btn-pesan" data-aksi="tambah" data-id="' + esc(p.id) + '">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
            " Keranjang</button>";

      return (
        '<article class="kartu">' +
        '<div class="kartu-foto">' +
        '<img src="' + (p.gambar ? esc(p.gambar) : GAMBAR_CADANGAN) + '" alt="' + esc(p.nama) + '" loading="lazy" onerror="this.onerror=null;this.src=GAMBAR_CADANGAN_JS" />' +
        '<span class="tag-kategori">' + esc(p.kategori) + "</span>" +
        '<span class="badge-stok' + (habis ? " habis" : "") + '">' + (habis ? "Habis" : "Stok " + stok + " " + esc(p.satuan)) + "</span>" +
        "</div>" +
        '<div class="kartu-isi"><h3 class="kartu-nama">' + esc(p.nama) + "</h3>" +
        '<div class="kartu-harga"><span>' + rupiah(p.harga) + '</span><span class="satuan">/ ' + esc(p.satuan) + "</span></div>" +
        '<div class="kartu-aksi">' + aksi + "</div></div></article>"
      );
    })
    .join("");
}

// fallback gambar error (dipakai atribut onerror di atas)
window.GAMBAR_CADANGAN_JS = GAMBAR_CADANGAN;

// Klik tambah/kurang di grid produk (event delegation)
$("#gridProduk").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-aksi]");
  if (!btn || btn.disabled) return;
  const { aksi, id } = btn.dataset;
  if (aksi === "tambah") tambahKeKeranjang(id);
  else kurangiKeranjang(id);
});

// ─────────────────────────── KERANJANG ─────────────────────────────
function tambahKeKeranjang(id) {
  const p = cariProduk(id);
  if (!p) return;
  const qty = state.keranjang.get(id) || 0;
  const maks = stokEfektif(p);
  if (qty + 1 > maks) {
    toast("Stok " + p.nama + " tinggal " + maks + " " + p.satuan, "gagal");
    return;
  }
  state.keranjang.set(id, qty + 1);
  if (qty === 0) toast(p.nama + " masuk keranjang");
  setelahKeranjangBerubah();
}

function kurangiKeranjang(id) {
  const qty = (state.keranjang.get(id) || 0) - 1;
  if (qty <= 0) state.keranjang.delete(id);
  else state.keranjang.set(id, qty);
  setelahKeranjangBerubah();
}

function hapusDariKeranjang(id) {
  const p = cariProduk(id);
  state.keranjang.delete(id);
  setelahKeranjangBerubah();
  if (p) toast(p.nama + " dikeluarkan dari keranjang");
}

function setelahKeranjangBerubah() {
  state.sukses = null; // mulai belanja lagi setelah pesanan sukses
  simpanKeranjang();
  renderGrid();
  renderKeranjangUI();
  // animasi "pop" pada badge header
  const badge = $("#badgeKeranjang");
  badge.classList.remove("pop");
  void badge.offsetWidth;
  badge.classList.add("pop");
}

function simpanKeranjang() {
  try {
    localStorage.setItem(KEY_KERANJANG, JSON.stringify([...state.keranjang]));
  } catch (_) { /* penyimpanan penuh / tidak tersedia — abaikan */ }
}

function pulihkanKeranjang() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_KERANJANG) || "[]");
    state.keranjang = new Map();
    arr.forEach(([id, qty]) => {
      const p = cariProduk(id);
      if (!p) return;
      const q = Math.min(Number(qty) || 0, stokEfektif(p));
      if (q > 0) state.keranjang.set(id, q);
    });
  } catch (_) { state.keranjang = new Map(); }
}

function isiKeranjang() {
  return [...state.keranjang].map(([id, qty]) => ({ produk: cariProduk(id), qty })).filter((x) => x.produk);
}

function hitungTotal() {
  return isiKeranjang().reduce((sum, x) => sum + x.produk.harga * x.qty, 0);
}

// ─────────────────────────── UI KERANJANG (badge, drawer, cartbar, nota) ──
function renderKeranjangUI() {
  const items = isiKeranjang();
  const totalJenis = items.length;
  const total = hitungTotal();

  // Badge di header
  const badge = $("#badgeKeranjang");
  badge.hidden = totalJenis === 0;
  badge.textContent = totalJenis;

  // Cartbar mengambang (mobile)
  const cartbar = $("#cartbar");
  cartbar.hidden = totalJenis === 0;
  $("#cartbarJumlah").textContent = totalJenis;
  $("#cartbarTotal").textContent = rupiah(total);

  renderDrawer(items, total);
  renderNota(items, total);
}

function renderDrawer(items, total) {
  const isi = $("#drawerIsi");
  const kaki = $("#drawerKaki");

  if (!items.length) {
    isi.innerHTML =
      '<div class="drawer-kosong">' +
      '<svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 9h13l-1.2 10.2a2 2 0 0 1-2 1.8H8.7a2 2 0 0 1-2-1.8L5.5 9z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/></svg>' +
      "<p><strong>Keranjang masih kosong.</strong><br>Yuk pilih hasil panen yang segar dulu.</p></div>";
    kaki.innerHTML = '<a class="btn btn-utama" href="#panen" id="linkKePanen">Lihat Hasil Panen</a>';
    $("#linkKePanen").addEventListener("click", tutupDrawer);
    return;
  }

  isi.innerHTML = items
    .map(({ produk: p, qty }) => {
      const maks = stokEfektif(p);
      return (
        '<div class="drawer-item">' +
        '<img src="' + (p.gambar ? esc(p.gambar) : GAMBAR_CADANGAN) + '" alt="" onerror="this.onerror=null;this.src=GAMBAR_CADANGAN_JS" />' +
        '<div class="drawer-item-info"><div class="n">' + esc(p.nama) + '</div><div class="h">' + rupiah(p.harga) + " / " + esc(p.satuan) +
        '</div><div class="s">' + rupiah(p.harga * qty) + "</div></div>" +
        '<div class="stepper">' +
        '<button data-daksi="kurang" data-id="' + esc(p.id) + '" aria-label="Kurangi">&minus;</button>' +
        '<span class="qty">' + qty + "</span>" +
        '<button data-daksi="tambah" data-id="' + esc(p.id) + '" aria-label="Tambah" ' + (qty >= maks ? "disabled" : "") + ">+</button>" +
        "</div>" +
        '<button class="btn-tutup" data-daksi="hapus" data-id="' + esc(p.id) + '" aria-label="Hapus ' + esc(p.nama) + '" style="width:32px;height:32px;font-size:1.05rem">&times;</button>' +
        "</div>"
      );
    })
    .join("");

  kaki.innerHTML =
    '<div class="drawer-total"><span class="t">Total</span><span class="v">' + rupiah(total) + "</span></div>" +
    '<button class="btn btn-utama" id="btnLanjutForm">Lanjut ke Formulir Pengiriman' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg></button>';

  $("#btnLanjutForm").addEventListener("click", () => {
    tutupDrawer();
    $("#pesan").scrollIntoView({ behavior: "smooth" });
  });
}

$("#drawerIsi").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-daksi]");
  if (!btn || btn.disabled) return;
  const { daksi, id } = btn.dataset;
  if (daksi === "tambah") tambahKeKeranjang(id);
  else if (daksi === "kurang") kurangiKeranjang(id);
  else hapusDariKeranjang(id);
});

// Nota di samping formulir
function renderNota(items, total) {
  const isi = $("#notaIsi");

  if (state.sukses) {
    isi.innerHTML = tampilanSukses(state.sukses);
    const btnWa = $("#btnWaKonfirmasi");
    if (btnWa) btnWa.addEventListener("click", () => window.open(buatLinkWA(state.sukses), "_blank", "noopener"));
    const btnLagi = $("#btnPesanLagi");
    if (btnLagi) btnLagi.addEventListener("click", pesanLagi);
    return;
  }

  if (!items.length) {
    isi.innerHTML =
      '<p class="nota-kosong">Keranjang kosong — <a href="#panen">pilih hasil panen dulu</a>, nanti rinciannya muncul di sini.</p>';
    return;
  }

  isi.innerHTML =
    items
      .map(
        ({ produk: p, qty }) =>
          '<div class="nota-item"><span class="n">' + esc(p.nama) + " <small>" + qty + " " + esc(p.satuan) + " &times; " + rupiah(p.harga) + "</small></span>" +
          '<span class="h">' + rupiah(p.harga * qty) + "</span></div>"
      )
      .join("") +
    '<div style="height:.7rem"></div>' +
    '<div class="nota-baris"><span>Subtotal</span><span>' + rupiah(total) + "</span></div>" +
    '<div class="nota-baris"><span>Ongkos kirim</span><span>konfirmasi via WA</span></div>' +
    '<div class="nota-total"><span class="label">Total</span><span class="nilai">' + rupiah(total) + "</span></div>" +
    '<button type="submit" form="formPesanan" class="btn-kirim" id="btnKirim">Kirim Pesanan' +
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>' +
    '<p class="nota-catatan">Setelah terkirim, kami hubungi Anda via WhatsApp untuk konfirmasi &amp; pembayaran.</p>';
}

// ─────────────────────────── DRAWER BUKA/TUTUP ─────────────────────
function bukaDrawer() {
  $("#drawer").classList.add("buka");
  $("#drawerLatar").hidden = false;
  document.documentElement.style.overflow = "hidden";
  $("#btnTutupDrawer").focus();
}
function tutupDrawer() {
  $("#drawer").classList.remove("buka");
  $("#drawerLatar").hidden = true;
  document.documentElement.style.overflow = "";
}
$("#btnBukaKeranjang").addEventListener("click", bukaDrawer);
$("#btnTutupDrawer").addEventListener("click", tutupDrawer);
$("#drawerLatar").addEventListener("click", tutupDrawer);
$("#cartbar").addEventListener("click", bukaDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    tutupDrawer();
    $("#menuMobile").hidden = true;
    $("#btnNavToggle").classList.remove("buka");
    $("#btnNavToggle").setAttribute("aria-expanded", "false");
  }
});

// ─────────────────────────── MENU MOBILE ───────────────────────────
$("#btnNavToggle").addEventListener("click", () => {
  const buka = $("#menuMobile").hidden;
  $("#menuMobile").hidden = !buka;
  $("#btnNavToggle").classList.toggle("buka", buka);
  $("#btnNavToggle").setAttribute("aria-expanded", String(buka));
});
$("#menuMobile").addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    $("#menuMobile").hidden = true;
    $("#btnNavToggle").classList.remove("buka");
  }
});

// ─────────────────────────── FORMULIR PESANAN ──────────────────────
function inisialisasiForm() {
  const hariIni = new Date();
  const besok = new Date(hariIni);
  besok.setDate(besok.getDate() + 1);
  const fTanggal = $("#fTanggal");
  fTanggal.min = isoDate(hariIni);
  fTanggal.value = isoDate(besok);

  // bersihkan pesan error saat pengguna mengetik
  ["fNama", "fWA", "fAlamat", "fTanggal"].forEach((id) => {
    $("#" + id).addEventListener("input", () => {
      const field = $("#" + id).closest(".field");
      field.classList.remove("sal");
      const err = field.querySelector(".err");
      if (err) err.textContent = "";
    });
  });
}

function setError(idInput, idErr, pesan) {
  $("#" + idErr).textContent = pesan;
  $("#" + idInput).closest(".field").classList.add("sal");
}

function validasiForm() {
  let valid = true;
  const nama = $("#fNama").value.trim();
  const wa = $("#fWA").value.trim();
  const alamat = $("#fAlamat").value.trim();
  const tanggal = $("#fTanggal").value;

  if (nama.length < 2) { setError("fNama", "errNama", "Nama minimal 2 huruf."); valid = false; }
  const angkaWA = wa.replace(/[\s\-().+]/g, "");
  if (!/^(0|62)\d{8,13}$/.test(angkaWA)) { setError("fWA", "errWA", "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890."); valid = false; }
  if (alamat.length < 10) { setError("fAlamat", "errAlamat", "Alamat terlalu pendek — tulis lengkap agar kurir tidak nyasar."); valid = false; }
  if (!tanggal) { setError("fTanggal", "errTanggal", "Pilih tanggal kirim."); valid = false; }
  else if (tanggal < isoDate(new Date())) { setError("fTanggal", "errTanggal", "Tanggal kirim tidak boleh lewat."); valid = false; }
  return valid;
}

$("#formPesanan").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.mengirim) return;

  if (!isiKeranjang().length) {
    toast("Keranjang masih kosong — pilih hasil panen dulu", "gagal");
    $("#panen").scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (!validasiForm()) {
    toast("Periksa lagi kolom yang ditandai merah", "gagal");
    return;
  }

  state.mengirim = true;
  const btn = $("#btnKirim");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim pesanan…';
  }

  const payload = {
    nama: $("#fNama").value.trim(),
    wa: $("#fWA").value.trim(),
    alamat: $("#fAlamat").value.trim(),
    tanggal_kirim: formatTanggal($("#fTanggal").value),
    catatan: $("#fCatatan").value.trim(),
    items: isiKeranjang().map(({ produk: p, qty }) => ({
      nama: p.nama, jumlah: qty, satuan: p.satuan, harga: p.harga, subtotal: p.harga * qty,
    })),
    total: hitungTotal(),
  };

  try {
    let hasil;
    if (state.mode === "demo") {
      await jeda(1100); // simulasi simpan ke Google Sheets
      hasil = { ok: true, id: "DEMO-" + Date.now().toString(36).toUpperCase() };
    } else {
      const res = await fetch(API_URL, {
        method: "POST",
        // PENTING: jangan ubah jadi "application/json" —
        // text/plain (bawaan fetch saat body string) menghindari
        // preflight CORS yang tidak didukung Apps Script.
        body: JSON.stringify(payload),
      });
      hasil = await res.json();
      if (!hasil.ok) throw new Error(hasil.pesan || "Server menolak pesanan");
    }

    state.sukses = { ...payload, id: hasil.id || "TERKIRIM" };
    state.keranjang.clear();
    simpanKeranjang();
    renderGrid();
    renderKeranjangUI();
    $("#formPesanan").reset();
    inisialisasiForm();
    toast("Pesanan berhasil terkirim!");
    if (window.innerWidth < 920) $("#pesan").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    renderKeranjangUI();
    const isi = $("#notaIsi");
    isi.insertAdjacentHTML(
      "beforeend",
      '<div class="gagal-panel">Pesanan gagal terkirim: ' + esc(err.message) + ". Coba lagi, atau chat kami langsung via WhatsApp.</div>"
    );
    toast("Gagal mengirim pesanan", "gagal");
  } finally {
    state.mengirim = false;
  }
});

// ─────────────────────────── TAMPILAN SUKSES ───────────────────────
function tampilanSukses(s) {
  const rincian = s.items.map((it) => it.nama + " " + it.jumlah + " " + it.satuan).join(", ");
  return (
    '<div class="sukses">' +
    '<svg class="sukses-lingkaran" viewBox="0 0 74 74"><circle class="lingkar" cx="37" cy="37" r="33" fill="none" stroke="var(--hijau-muda)" stroke-width="4" stroke-linecap="round"/><path class="centang" d="M23 38.5l10 10 18-21" fill="none" stroke="var(--hijau)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    "<h4>Terima kasih, " + esc(s.nama.split(" ")[0]) + "!</h4>" +
    "<p>Pesanan Anda sudah kami terima" + (state.mode === "demo" ? " (mode demo — belum masuk spreadsheet)" : " dan tercatat di spreadsheet kami") + ".</p>" +
    '<span class="id-pesanan">No. pesanan: ' + esc(s.id) + "</span>" +
    '<div class="sukses-rincian">' +
    "<div><span>Pesanan</span><strong>" + esc(rincian) + "</strong></div>" +
    "<div><span>Tanggal kirim</span><strong>" + esc(s.tanggal_kirim) + "</strong></div>" +
    "<div><span>Total</span><strong>" + rupiah(s.total) + "</strong></div>" +
    "</div>" +
    "<p>Langkah terakhir: konfirmasi lewat WhatsApp agar kami bisa siapkan panen Anda.</p>" +
    '<div class="sukses-aksi">' +
    '<button class="btn btn-wa-besar" id="btnWaKonfirmasi">' +
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2.6-.9 1.2-1.6 1.5-1.1.4-2.4.3-4.5-.9-1.6-.9-2.9-2.4-3.6-4.1-.5-1.3-.3-2.5.6-3.4.2-.2.5-.3.7-.3h.5c.1 0 .3-.1.5.4l.8 1.9c.1.2.1.3 0 .5l-.4.5c-.2.3-.5.4-.2.8a6.7 6.7 0 0 0 3.3 2.9c.2.1.4.1.5-.1.2-.2.6-.8.8-1 .1-.2.3-.2.5-.1.2.1 1.5.7 1.7.8.1.1.2.6-.1 1.6z"/></svg>' +
    " Konfirmasi via WhatsApp</button>" +
    '<button class="btn btn-lagi" id="btnPesanLagi">Pesan Lagi</button>' +
    "</div></div>"
  );
}

function buatLinkWA(s) {
  const rincian = s.items.map((it) => "- " + it.nama + " " + it.jumlah + " " + it.satuan + " (" + rupiah(it.subtotal) + ")").join("\n");
  const teks =
    "Halo Kebun Pak Tani! Saya ingin konfirmasi pesanan dari website.\n\n" +
    "No. pesanan: " + s.id + "\n" + rincian + "\nTotal: " + rupiah(s.total) + "\n" +
    "Tanggal kirim: " + s.tanggal_kirim + "\n\n" +
    "Nama: " + s.nama + "\nAlamat: " + s.alamat + (s.catatan ? "\nCatatan: " + s.catatan : "");
  return WA_LINK + "?text=" + encodeURIComponent(teks);
}

function pesanLagi() {
  state.sukses = null;
  renderKeranjangUI();
  $("#panen").scrollIntoView({ behavior: "smooth" });
}

// ─────────────────────────── PANDUAN: kode Apps Script ─────────────
// Isi kotak kode di halaman (section #panduan) + tombol salin.
const APPSCRIPT_KODE = String.raw`/***************************************************************
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
}`;

function inisialisasiPanduan() {
  const el = $("#kodeAppsScript");
  if (el) el.textContent = APPSCRIPT_KODE;

  const btn = $("#btnSalinKode");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(APPSCRIPT_KODE);
      } catch (_) {
        // fallback untuk browser lama
        const ta = document.createElement("textarea");
        ta.value = APPSCRIPT_KODE;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      btn.classList.add("berhasil");
      const label = btn.querySelector("span");
      const awal = label.textContent;
      label.textContent = "Tersalin!";
      toast("Kode Apps Script tersalin — tempel di editor Apps Script");
      setTimeout(() => {
        btn.classList.remove("berhasil");
        label.textContent = awal;
      }, 2200);
    });
  }
}

// ─────────────────────────── ANIMASI REVEAL ────────────────────────
function inisialisasiReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

// ─────────────────────────── MULAI ─────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // tutup banner demo
  $("#tutupBanner").addEventListener("click", () => ($("#bannerDemo").hidden = true));

  inisialisasiForm();
  inisialisasiReveal();
  inisialisasiPanduan();
  muatProduk();

  // aktifkan animasi baris judul pembuka
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("siap")));
});
