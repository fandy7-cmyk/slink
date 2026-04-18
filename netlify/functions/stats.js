// netlify/functions/stats.js
// GET /api/stats  → admin only, ringkasan statistik klik

import { getDb, jsonResponse, errorResponse } from './_db.js';
import { requireAuth } from './_auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const admin = requireAuth(event);
  if (!admin) return errorResponse('Unauthorized', 401);

  const sql = getDb();

  try {
    // Total klik keseluruhan
    const [{ total_klik }] = await sql`SELECT COUNT(*)::INT AS total_klik FROM klik_log`;

    // Total klik hari ini
    const [{ klik_hari_ini }] = await sql`
      SELECT COUNT(*)::INT AS klik_hari_ini FROM klik_log
      WHERE clicked_at >= CURRENT_DATE
    `;

    // Total link aktif
    const [{ total_links }] = await sql`SELECT COUNT(*)::INT AS total_links FROM links WHERE aktif = TRUE`;

    // Top 5 link by klik
    const top_links = await sql`
      SELECT l.id, l.judul, l.url, l.ikon, l.warna_ikon,
        COUNT(kl.id)::INT AS total_klik
      FROM links l
      LEFT JOIN klik_log kl ON kl.link_id = l.id
      GROUP BY l.id
      ORDER BY total_klik DESC
      LIMIT 5
    `;

    // Klik per hari (7 hari terakhir)
    const klik_7hari = await sql`
      SELECT 
        DATE(clicked_at)::TEXT AS tanggal,
        COUNT(*)::INT AS jumlah
      FROM klik_log
      WHERE clicked_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(clicked_at)
      ORDER BY tanggal ASC
    `;

    return jsonResponse({
      total_klik,
      klik_hari_ini,
      total_links,
      top_links,
      klik_7hari,
    });
  } catch (err) {
    console.error(err);
    return errorResponse('Gagal mengambil statistik');
  }
};
