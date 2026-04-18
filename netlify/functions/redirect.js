// netlify/functions/redirect.js
// GET /:slug
//   1. Cek tabel bundles (aktif) → kembalikan bundle.html sebagai HTML body
//   2. Cek tabel links (slug_pendek, aktif) → redirect 302 + catat klik
//   3. Tidak ketemu → redirect ke /

import { getDb, jsonResponse, errorResponse } from './_db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const sql = getDb();
  const slug = event.path.replace(/^\//, '').replace(/\/$/, '').trim();

  if (!slug) {
    return { statusCode: 302, headers: { Location: '/' }, body: '' };
  }

  try {
    // ── 1. Cek bundle ─────────────────────────────────────
    const bundles = await sql`
      SELECT id FROM bundles WHERE slug = ${slug} AND aktif = TRUE LIMIT 1
    `;

    if (bundles.length) {
      // Serve bundle.html langsung sebagai response body
      const html = readFileSync(join(process.cwd(), 'public', 'bundle.html'), 'utf-8');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    }

    // ── 2. Cek link pendek ────────────────────────────────
    const links = await sql`
      SELECT id, url FROM links WHERE slug_pendek = ${slug} AND aktif = TRUE LIMIT 1
    `;

    if (!links.length) {
      return { statusCode: 302, headers: { Location: '/' }, body: '' };
    }

    // Catat klik
    const ip  = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    const ua  = event.headers['user-agent'] || '';
    const ref = event.headers['referer'] || '';
    await sql`
      INSERT INTO klik_log (link_id, ip_address, user_agent, referer)
      VALUES (${links[0].id}, ${ip}, ${ua}, ${ref})
    `;

    return {
      statusCode: 302,
      headers: { Location: links[0].url },
      body: '',
    };

  } catch (err) {
    console.error(err);
    return errorResponse('Server error', 500);
  }
};