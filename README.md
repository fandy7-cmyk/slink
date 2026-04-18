# Superlink Dinkes Banggai Laut

Portal link resmi Dinas Kesehatan Kabupaten Banggai Laut — dibangun dengan Vanilla HTML/CSS/JS + Netlify Functions + Neon PostgreSQL.

---

## 📁 Struktur Project

```
superlink-dinkes/
├── public/
│   ├── index.html          ← Halaman publik (superlink)
│   └── admin.html          ← Panel admin
├── netlify/
│   └── functions/
│       ├── _db.js          ← Shared DB utility
│       ├── _auth.js        ← JWT helper
│       ├── auth.js         ← POST /api/auth/login & /register
│       ├── links.js        ← CRUD /api/links
│       ├── kategori.js     ← CRUD /api/kategori
│       ├── track.js        ← POST /api/track/:id (klik logging)
│       ├── settings.js     ← GET/PUT /api/settings
│       └── stats.js        ← GET /api/stats (admin dashboard)
├── schema.sql              ← DDL database Neon
├── netlify.toml            ← Konfigurasi Netlify
└── package.json
```

---

## 🚀 Langkah Deploy

### 1. Siapkan Database (Neon)
1. Buat project baru di [neon.tech](https://neon.tech)
2. Copy **Connection String** (DATABASE_URL)
3. Jalankan `schema.sql` di SQL Editor Neon

### 2. Deploy ke Netlify
1. Push project ke GitHub
2. Connect repo di [app.netlify.com](https://app.netlify.com)
3. Build settings:
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`

### 3. Environment Variables
Tambahkan di Netlify → Site Settings → Environment Variables:

| Key            | Value                                      |
|----------------|--------------------------------------------|
| `DATABASE_URL` | Connection string Neon (postgresql://...)  |
| `JWT_SECRET`   | String acak panjang (min 32 karakter)      |
| `SETUP_KEY`    | Key rahasia untuk register admin pertama   |

### 4. Register Admin Pertama
Kirim POST request ke `/api/auth/register`:

```bash
curl -X POST https://your-site.netlify.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nama": "Admin Dinkes BL",
    "email": "admin@dinkesbl.go.id",
    "password": "passwordrahasia",
    "setup_key": "KEY_YANG_KAMU_SET_DI_ENV"
  }'
```

Setelah berhasil, akses `/admin` untuk login.

---

## 🔗 API Endpoints

| Method | Path                    | Auth   | Keterangan              |
|--------|-------------------------|--------|-------------------------|
| POST   | /api/auth/login         | –      | Login admin             |
| POST   | /api/auth/register      | –      | Daftar admin (sekali)   |
| GET    | /api/links              | –      | Ambil link aktif        |
| POST   | /api/links              | ✓      | Tambah link             |
| PUT    | /api/links/:id          | ✓      | Edit link               |
| DELETE | /api/links/:id          | ✓      | Hapus link              |
| PUT    | /api/links/reorder      | ✓      | Ubah urutan batch       |
| GET    | /api/kategori           | –      | Ambil semua kategori    |
| POST   | /api/kategori           | ✓      | Tambah kategori         |
| PUT    | /api/kategori/:id       | ✓      | Edit kategori           |
| DELETE | /api/kategori/:id       | ✓      | Hapus kategori          |
| POST   | /api/track/:id          | –      | Catat klik link         |
| GET    | /api/settings           | –      | Ambil settings publik   |
| PUT    | /api/settings           | ✓      | Update settings         |
| GET    | /api/stats              | ✓      | Statistik klik (admin)  |

---

## ✨ Fitur

- **Halaman Publik**: Tampilan superlink dengan filter kategori, pencarian, dark mode, animasi, dan QR code per link
- **Panel Admin**: Login aman, tambah/edit/hapus link & kategori, statistik klik, settings tampilan
- **Tracking Klik**: Setiap klik tercatat (IP, user agent, referer)
- **QR Code**: Generate QR otomatis per link
- **Dark Mode**: Toggle dengan preferensi tersimpan
- **Responsive**: Mobile-first design
