// netlify/functions/bundles.js
// GET    /api/bundles              → admin: semua bundle
// GET    /api/bundles/:slug        → publik: bundle by slug + items
// POST   /api/bundles              → admin: buat bundle baru
// PUT    /api/bundles/:id          → admin: edit bundle
// DELETE /api/bundles/:id          → admin: hapus bundle
// POST   /api/bundles/:id/items    → admin: tambah item ke bundle
// PUT    /api/bundles/:id/items/:itemId  → admin: edit item
// DELETE /api/bundles/:id/items/:itemId → admin: hapus item

import { getDb, jsonResponse, errorResponse, parseBody } from './_db.js';
import { requireAuth } from './_auth.js';

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});

  const sql = getDb();
  const rawPath = event.path.replace(/.*\/bundles/, '') || '/';
  const segments = rawPath.split('/').filter(Boolean);
  // /            → []
  // /:id         → [id]
  // /:id/items   → [id, 'items']
  // /:id/items/:itemId → [id, 'items', itemId]

  const seg0 = segments[0] || null;
  const seg1 = segments[1] || null;
  const seg2 = segments[2] || null;

  const isNumericId = seg0 && !isNaN(seg0);
  const bundleId    = isNumericId ? parseInt(seg0) : null;
  const isSlug      = seg0 && isNaN(seg0);
  const isItems     = seg1 === 'items';
  const itemId      = seg2 && !isNaN(seg2) ? parseInt(seg2) : null;

  // ── GET /api/bundles/:slug (publik, by slug) ───────────────
  if (event.httpMethod === 'GET' && isSlug) {
    try {
      const rows = await sql`
        SELECT * FROM bundles WHERE slug = ${seg0} AND aktif = TRUE LIMIT 1
      `;
      if (!rows.length) return errorResponse('Bundle tidak ditemukan', 404);
      const bundle = rows[0];
      const items = await sql`
        SELECT * FROM bundle_items WHERE bundle_id = ${bundle.id} ORDER BY id ASC
      `;
      return jsonResponse({ bundle, items });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengambil bundle');
    }
  }

  // ── GET /api/bundles (admin: semua) ───────────────────────
  if (event.httpMethod === 'GET' && !seg0) {
    const admin = requireAuth(event);
    if (!admin) return errorResponse('Unauthorized', 401);
    try {
      const rows = await sql`
        SELECT b.*, COUNT(bi.id)::INT AS jumlah_item
        FROM bundles b
        LEFT JOIN bundle_items bi ON bi.bundle_id = b.id
        GROUP BY b.id
        ORDER BY b.created_at DESC
      `;
      return jsonResponse({ bundles: rows });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengambil data bundle');
    }
  }

  // ── GET /api/bundles/:id (admin: detail + items) ──────────
  if (event.httpMethod === 'GET' && bundleId && !isItems) {
    const admin = requireAuth(event);
    if (!admin) return errorResponse('Unauthorized', 401);
    try {
      const rows = await sql`SELECT * FROM bundles WHERE id = ${bundleId} LIMIT 1`;
      if (!rows.length) return errorResponse('Bundle tidak ditemukan', 404);
      const items = await sql`
        SELECT * FROM bundle_items WHERE bundle_id = ${bundleId} ORDER BY id ASC
      `;
      return jsonResponse({ bundle: rows[0], items });
    } catch (err) {
      return errorResponse('Gagal mengambil bundle');
    }
  }

  // ── AUTH REQUIRED mulai sini ───────────────────────────────
  const admin = requireAuth(event);
  if (!admin) return errorResponse('Unauthorized', 401);

  // ── POST /api/bundles (buat bundle) ───────────────────────
  if (event.httpMethod === 'POST' && !seg0) {
    const { judul, deskripsi, slug: rawSlug, aktif } = parseBody(event);
    if (!judul) return errorResponse('Judul wajib diisi', 400);
    const slug = rawSlug ? slugify(rawSlug) : slugify(judul);
    try {
      // Cek slug unik
      const exist = await sql`SELECT id FROM bundles WHERE slug = ${slug} LIMIT 1`;
      if (exist.length) return errorResponse('Slug sudah digunakan, coba judul/slug lain', 409);
      const rows = await sql`
        INSERT INTO bundles (judul, deskripsi, slug, aktif)
        VALUES (${judul}, ${deskripsi || null}, ${slug}, ${aktif !== false})
        RETURNING *
      `;
      return jsonResponse({ bundle: rows[0] }, 201);
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal membuat bundle');
    }
  }

  // ── PUT /api/bundles/:id (edit bundle) ────────────────────
  if (event.httpMethod === 'PUT' && bundleId && !isItems) {
    const { judul, deskripsi, slug: rawSlug, aktif } = parseBody(event);
    try {
      const slug = rawSlug ? slugify(rawSlug) : undefined;
      // Cek slug unik (selain dirinya sendiri)
      if (slug) {
        const exist = await sql`SELECT id FROM bundles WHERE slug = ${slug} AND id != ${bundleId} LIMIT 1`;
        if (exist.length) return errorResponse('Slug sudah digunakan', 409);
      }
      const rows = await sql`
        UPDATE bundles SET
          judul      = COALESCE(${judul}, judul),
          deskripsi  = ${deskripsi !== undefined ? deskripsi : sql`deskripsi`},
          slug       = COALESCE(${slug || null}, slug),
          aktif      = COALESCE(${aktif !== undefined ? aktif : null}, aktif),
          updated_at = NOW()
        WHERE id = ${bundleId}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Bundle tidak ditemukan', 404);
      return jsonResponse({ bundle: rows[0] });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengupdate bundle');
    }
  }

  // ── DELETE /api/bundles/:id ───────────────────────────────
  if (event.httpMethod === 'DELETE' && bundleId && !isItems) {
    try {
      await sql`DELETE FROM bundle_items WHERE bundle_id = ${bundleId}`;
      await sql`DELETE FROM bundles WHERE id = ${bundleId}`;
      return jsonResponse({ ok: true });
    } catch (err) {
      return errorResponse('Gagal menghapus bundle');
    }
  }

  // ── POST /api/bundles/:id/items ───────────────────────────
  if (event.httpMethod === 'POST' && bundleId && isItems && !itemId) {
    const { judul, url, deskripsi, ikon } = parseBody(event);
    if (!judul || !url) return errorResponse('Judul dan URL wajib diisi', 400);
    try {
      const rows = await sql`
        INSERT INTO bundle_items (bundle_id, judul, url, deskripsi, ikon)
        VALUES (${bundleId}, ${judul}, ${url}, ${deskripsi || null}, ${ikon || '🔗'})
        RETURNING *
      `;
      return jsonResponse({ item: rows[0] }, 201);
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal menambah item');
    }
  }

  // ── PUT /api/bundles/:id/items/:itemId ────────────────────
  if (event.httpMethod === 'PUT' && bundleId && isItems && itemId) {
    const { judul, url, deskripsi, ikon } = parseBody(event);
    try {
      const rows = await sql`
        UPDATE bundle_items SET
          judul     = COALESCE(${judul}, judul),
          url       = COALESCE(${url}, url),
          deskripsi = ${deskripsi !== undefined ? deskripsi : sql`deskripsi`},
          ikon      = COALESCE(${ikon}, ikon)
        WHERE id = ${itemId} AND bundle_id = ${bundleId}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Item tidak ditemukan', 404);
      return jsonResponse({ item: rows[0] });
    } catch (err) {
      return errorResponse('Gagal mengupdate item');
    }
  }

  // ── DELETE /api/bundles/:id/items/:itemId ─────────────────
  if (event.httpMethod === 'DELETE' && bundleId && isItems && itemId) {
    try {
      await sql`DELETE FROM bundle_items WHERE id = ${itemId} AND bundle_id = ${bundleId}`;
      return jsonResponse({ ok: true });
    } catch (err) {
      return errorResponse('Gagal menghapus item');
    }
  }

  return errorResponse('Not found', 404);
};
