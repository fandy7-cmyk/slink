// netlify/functions/kategori.js
// GET    /api/kategori       → semua kategori
// POST   /api/kategori       → tambah (admin)
// PUT    /api/kategori/:id   → edit (admin)
// DELETE /api/kategori/:id   → hapus (admin)

import { getDb, jsonResponse, errorResponse, parseBody } from './_db.js';
import { requireAuth } from './_auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});

  const sql = getDb();
  const rawPath = event.path.replace(/.*\/kategori/, '') || '/';
  const id = rawPath.split('/').filter(Boolean)[0];
  const numId = id && !isNaN(id) ? parseInt(id) : null;

  // ── GET (publik) ───────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const rows = await sql`
        SELECT k.*, COUNT(l.id)::INT AS jumlah_link
        FROM kategori k
        LEFT JOIN links l ON l.kategori_id = k.id AND l.aktif = TRUE
        GROUP BY k.id
        ORDER BY k.id ASC
      `;
      return jsonResponse({ kategori: rows });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengambil data kategori');
    }
  }

  const admin = requireAuth(event);
  if (!admin) return errorResponse('Unauthorized', 401);

  // ── POST ───────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const { nama } = parseBody(event);
    if (!nama) return errorResponse('Nama kategori wajib diisi', 400);
    try {
      const rows = await sql`
        INSERT INTO kategori (nama) VALUES (${nama}) RETURNING *
      `;
      return jsonResponse({ kategori: rows[0] }, 201);
    } catch (err) {
      return errorResponse('Gagal menyimpan kategori');
    }
  }

  // ── PUT ────────────────────────────────────────────────
  if (event.httpMethod === 'PUT' && numId) {
    const { nama } = parseBody(event);
    try {
      const rows = await sql`
        UPDATE kategori SET
          nama   = COALESCE(${nama}, nama)
        WHERE id = ${numId}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Kategori tidak ditemukan', 404);
      return jsonResponse({ kategori: rows[0] });
    } catch (err) {
      return errorResponse('Gagal mengupdate kategori');
    }
  }

  // ── DELETE ─────────────────────────────────────────────
  if (event.httpMethod === 'DELETE' && numId) {
    try {
      await sql`DELETE FROM kategori WHERE id = ${numId}`;
      return jsonResponse({ ok: true });
    } catch (err) {
      return errorResponse('Gagal menghapus kategori');
    }
  }

  return errorResponse('Not found', 404);
};
