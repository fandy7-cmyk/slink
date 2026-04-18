// netlify/functions/links.js
// GET    /api/links          → publik, semua link aktif
// GET    /api/links/all      → admin, semua link
// POST   /api/links          → admin, tambah link
// PUT    /api/links/:id      → admin, edit link
// DELETE /api/links/:id      → admin, hapus link
// PUT    /api/links/reorder  → admin, ubah urutan (array of {id, urutan})

import { getDb, jsonResponse, errorResponse, parseBody } from './_db.js';
import { requireAuth } from './_auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});

  const sql = getDb();
  const rawPath = event.path.replace(/.*\/links/, '') || '/';
  const segments = rawPath.split('/').filter(Boolean);
  const id = segments[0] && !isNaN(segments[0]) ? parseInt(segments[0]) : null;
  const sub = id ? segments[1] : segments[0]; // e.g. "reorder"

  // ── GET /api/links (publik) ────────────────────────────
  if (event.httpMethod === 'GET' && !sub) {
    const isAdmin = requireAuth(event);
    try {
      let rows;
      if (isAdmin) {
        // admin lihat semua termasuk nonaktif + slug_pendek
        rows = await sql`
          SELECT l.*, k.nama AS kategori_nama,
            COALESCE((SELECT COUNT(*) FROM klik_log kl WHERE kl.link_id = l.id), 0)::INT AS total_klik
          FROM links l
          LEFT JOIN kategori k ON l.kategori_id = k.id
          ORDER BY l.urutan ASC, l.id ASC
        `;
      } else {
        rows = await sql`
          SELECT l.id, l.judul, l.deskripsi, l.url, l.ikon, l.warna_ikon,
            l.urutan, l.aktif, l.kategori_id, k.nama AS kategori_nama
          FROM links l
          LEFT JOIN kategori k ON l.kategori_id = k.id
          WHERE l.aktif = TRUE
          ORDER BY l.urutan ASC, l.id ASC
        `;
      }
      return jsonResponse({ links: rows });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengambil data links');
    }
  }

  // ── AUTH REQUIRED untuk semua method lain ─────────────
  const admin = requireAuth(event);
  if (!admin) return errorResponse('Unauthorized', 401);

  // ── POST /api/links (tambah) ───────────────────────────
  if (event.httpMethod === 'POST' && !sub) {
    const body = parseBody(event);
    const { judul, url, deskripsi, ikon, warna_ikon, kategori_id, urutan, aktif, slug_pendek } = body;
    if (!judul || !url) return errorResponse('Judul dan URL wajib diisi', 400);

    // Validasi slug_pendek unik (jika diisi)
    const slugVal = slug_pendek ? slug_pendek.toLowerCase().replace(/[^a-z0-9\-]/g, '').trim() : null;
    if (slugVal) {
      try {
        const exist = await sql`SELECT id FROM links WHERE slug_pendek = ${slugVal} LIMIT 1`;
        if (exist.length) return errorResponse('Slug pendek sudah digunakan, coba yang lain', 409);
      } catch (err) {
        console.error(err);
        return errorResponse('Gagal cek slug');
      }
    }

    try {
      const rows = await sql`
        INSERT INTO links (judul, url, deskripsi, ikon, warna_ikon, kategori_id, urutan, aktif, slug_pendek)
        VALUES (
          ${judul}, ${url}, ${deskripsi || null}, ${ikon || 'link'},
          ${warna_ikon || '#1a73e8'}, ${kategori_id || null},
          ${urutan ?? 0}, ${aktif !== false},
          ${slugVal}
        )
        RETURNING *
      `;
      return jsonResponse({ link: rows[0] }, 201);
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal menyimpan link');
    }
  }

  // ── PUT /api/links/reorder ─────────────────────────────
  if (event.httpMethod === 'PUT' && sub === 'reorder') {
    const { items } = parseBody(event); // [{id, urutan}]
    if (!Array.isArray(items)) return errorResponse('Format tidak valid', 400);
    try {
      for (const item of items) {
        await sql`UPDATE links SET urutan = ${item.urutan} WHERE id = ${item.id}`;
      }
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal menyimpan urutan');
    }
  }

  // ── PUT /api/links/:id (edit) ──────────────────────────
  if (event.httpMethod === 'PUT' && id) {
    const body = parseBody(event);
    const { judul, url, deskripsi, ikon, warna_ikon, kategori_id, urutan, aktif, slug_pendek } = body;

    // Validasi slug_pendek unik (selain dirinya sendiri)
    const slugVal = slug_pendek !== undefined
      ? (slug_pendek ? slug_pendek.toLowerCase().replace(/[^a-z0-9\-]/g, '').trim() : null)
      : undefined;

    if (slugVal) {
      try {
        const exist = await sql`SELECT id FROM links WHERE slug_pendek = ${slugVal} AND id != ${id} LIMIT 1`;
        if (exist.length) return errorResponse('Slug pendek sudah digunakan, coba yang lain', 409);
      } catch (err) {
        console.error(err);
        return errorResponse('Gagal cek slug');
      }
    }

    try {
      const rows = await sql`
        UPDATE links SET
          judul       = COALESCE(${judul}, judul),
          url         = COALESCE(${url}, url),
          deskripsi   = ${deskripsi !== undefined ? deskripsi : sql`deskripsi`},
          ikon        = COALESCE(${ikon}, ikon),
          warna_ikon  = COALESCE(${warna_ikon}, warna_ikon),
          kategori_id = ${kategori_id !== undefined ? kategori_id : sql`kategori_id`},
          urutan      = COALESCE(${urutan}, urutan),
          aktif       = COALESCE(${aktif}, aktif),
          slug_pendek = ${slugVal !== undefined ? slugVal : sql`slug_pendek`},
          updated_at  = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Link tidak ditemukan', 404);
      return jsonResponse({ link: rows[0] });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengupdate link');
    }
  }

  // ── DELETE /api/links/:id ──────────────────────────────
  if (event.httpMethod === 'DELETE' && id) {
    try {
      await sql`DELETE FROM links WHERE id = ${id}`;
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal menghapus link');
    }
  }

  return errorResponse('Not found', 404);
};
