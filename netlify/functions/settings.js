// netlify/functions/settings.js
// GET  /api/settings         → publik
// PUT  /api/settings         → admin, update semua settings

import { getDb, jsonResponse, errorResponse, parseBody } from './_db.js';
import { requireAuth } from './_auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});

  const sql = getDb();

  // ── GET (publik) ───────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const rows = await sql`SELECT key, value FROM settings`;
      const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return jsonResponse({ settings });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal mengambil settings');
    }
  }

  // ── PUT (admin) ────────────────────────────────────────
  if (event.httpMethod === 'PUT') {
    const admin = requireAuth(event);
    if (!admin) return errorResponse('Unauthorized', 401);

    const body = parseBody(event);
    try {
      for (const [key, value] of Object.entries(body)) {
        await sql`
          INSERT INTO settings (key, value, updated_at)
          VALUES (${key}, ${value}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `;
      }
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error(err);
      return errorResponse('Gagal menyimpan settings');
    }
  }

  return errorResponse('Not found', 404);
};
