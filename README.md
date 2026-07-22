# Staris Studio - Educational Games Landing Page & Order System

Landing page + order system untuk 3 permainan edukasi (Misi Momo, Kiki's Mission, Makmal Dr Atom), dibina di atas **Google Apps Script** (Code.gs + HTML Service), dengan **Google Sheet** sebagai database order, dan dihoskan/dikawal remotely melalui **GitHub**.

## Struktur Projek

- `Code.gs` — backend: routing, order logic, email, admin API
- `Index.html` / `IndexJS.html` — landing page awam (hero, kelebihan, produk, pakej, form order, payment)
- `Admin.html` — dashboard admin (password-protected) untuk approve order
- `CSS.html` — styling dikongsi kedua-dua halaman
- `appsscript.json` — manifest Apps Script
- `assets/` — gambar mascot, logo & screenshot (dihoskan via jsDelivr CDN dari repo GitHub ini)
- `.clasp.json` — pautan projek ke Apps Script (dijana oleh `clasp create`)

## Flow Sistem

1. Admin promo di WhatsApp → hantar link landing page kepada klien.
2. Klien pilih pakej & isi borang order → order masuk ke Google Sheet (`Orders`), email notifikasi dihantar ke admin & klien.
3. Klien buat pembayaran (QR / manual transfer) & hantar resit ke WhatsApp admin.
4. Admin buka `?page=admin`, log masuk dengan password, klik **Approve** pada order berkenaan.
5. Sistem jana Order ID unik, kemas kini status ke "Selesai", hantar email Order ID ke klien (admin boleh WhatsApp terus jika perlu, ada butang WhatsApp pada setiap row).
6. Klien guna Order ID untuk akses produk.

## Setup Kali Pertama (Selepas Deploy)

1. Buka Apps Script project (`clasp open`).
2. Jalankan fungsi `setup` sekali sahaja dari editor (Run → pilih fungsi `setup`, isi parameter password & email admin), **ATAU** terus tukar Script Properties:
   - `ADMIN_PASSWORD` — password untuk log masuk admin dashboard
   - `ADMIN_EMAIL` — email untuk terima notifikasi order baru (default: email pemilik script)
3. Deploy sebagai **Web App**:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Guna URL web app untuk landing page (`https://script.google.com/.../exec`) dan tambah `?page=admin` untuk dashboard admin.

## Kemaskini Asset Image URL

`Code.gs` ada constant `ASSET_BASE_URL` yang perlu dikemaskini kepada:

```
https://cdn.jsdelivr.net/gh/<GITHUB_USERNAME>/<REPO_NAME>@main/assets
```

Selepas repo GitHub siap dipush. jsDelivr cache boleh ambil masa ~10 minit untuk update selepas push baru.

## Deploy / Update Kod (Remote via GitHub + clasp)

```bash
git pull                     # dapatkan versi terkini dari GitHub
clasp push                   # push kod ke Apps Script
clasp deploy                 # (opsyenal) buat deployment baru jika guna versioned deployment
```

Selepas edit kod tempatan:

```bash
git add -A
git commit -m "Update ..."
git push
clasp push
```

## Struktur Google Sheet (`Orders`)

| Timestamp | Order Ref | Nama | Telefon | Email | Pakej | Jumlah (RM) | Kaedah Bayaran | Status | Order ID | Tarikh Selesai |
|---|---|---|---|---|---|---|---|---|---|---|

## Nota Keselamatan

- Admin dashboard dilindungi password ringkas (Script Property) — sesuai untuk skala kecil-sederhana. Jangan kongsi password admin melalui saluran awam.
- Elakkan letak apa-apa maklumat sensitif (password, API key) terus dalam kod yang dipush ke GitHub public repo.
