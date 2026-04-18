// netlify/functions/redirect.js
// GET /:slug  → redirect pendek ke URL tujuan + catat klik

import { getDb, jsonResponse, errorResponse } from './_db.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const sql = getDb();
  // Netlify toml route: /:slug → function menerima path asli, ambil segment pertama
  const slug = event.path.replace(/^\//, '').replace(/\/$/, '').trim();

  if (!slug) {
    return { statusCode: 302, headers: { Location: '/' }, body: '' };
  }

  try {
    const rows = await sql`
      SELECT id, url FROM links
      WHERE slug_pendek = ${slug} AND aktif = TRUE
      LIMIT 1
    `;

    if (!rows.length) {
      // Slug tidak ditemukan → balik ke halaman utama
      return { statusCode: 302, headers: { Location: '/' }, body: '' };
    }

    // Catat klik
    const ip  = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    const ua  = event.headers['user-agent'] || '';
    const ref = event.headers['referer'] || '';
    await sql`
      INSERT INTO klik_log (link_id, ip_address, user_agent, referer)
      VALUES (${rows[0].id}, ${ip}, ${ua}, ${ref})
    `;

    return {
      statusCode: 302,
      headers: { Location: rows[0].url },
      body: '',
    };
  } catch (err) {
    console.error(err);
    return errorResponse('Server error', 500);
  }
};
