// netlify/functions/auth.js
// POST /api/auth/login
// POST /api/auth/register (first-time setup only)

import bcrypt from 'bcryptjs';
import { getDb, jsonResponse, errorResponse, parseBody } from './_db.js';
import { signToken } from './_auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({});

  const sql = getDb();
  const path = event.path.replace(/.*\/auth/, '');
  const body = parseBody(event);

  // ── LOGIN ──────────────────────────────────────────────
  if (event.httpMethod === 'POST' && path === '/login') {
    const { email, password } = body;
    if (!email || !password) return errorResponse('Email dan password wajib diisi', 400);

    try {
      const rows = await sql`
        SELECT * FROM admin WHERE email = ${email.toLowerCase().trim()} LIMIT 1
      `;
      if (!rows.length) return errorResponse('Email atau password salah', 401);

      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) return errorResponse('Email atau password salah', 401);

      // update last_login
      await sql`UPDATE admin SET last_login = NOW() WHERE id = ${admin.id}`;

      const token = signToken({ id: admin.id, email: admin.email, nama: admin.nama });
      return jsonResponse({
        token,
        admin: { id: admin.id, nama: admin.nama, email: admin.email }
      });
    } catch (err) {
      console.error(err);
      return errorResponse('Server error', 500);
    }
  }

  // ── REGISTER (first-time setup) ────────────────────────
  if (event.httpMethod === 'POST' && path === '/register') {
    const { nama, email, password, setup_key } = body;

    // Guard: hanya bisa register kalau belum ada admin
    if (setup_key !== process.env.SETUP_KEY) {
      return errorResponse('Setup key tidak valid', 403);
    }

    if (!nama || !email || !password) return errorResponse('Semua field wajib diisi', 400);
    if (password.length < 8) return errorResponse('Password minimal 8 karakter', 400);

    try {
      const existing = await sql`SELECT id FROM admin WHERE email = ${email.toLowerCase()} LIMIT 1`;
      if (existing.length) return errorResponse('Email sudah terdaftar', 409);

      const hash = await bcrypt.hash(password, 12);
      const rows = await sql`
        INSERT INTO admin (nama, email, password_hash)
        VALUES (${nama}, ${email.toLowerCase()}, ${hash})
        RETURNING id, nama, email
      `;
      const token = signToken({ id: rows[0].id, email: rows[0].email, nama: rows[0].nama });
      return jsonResponse({ token, admin: rows[0] }, 201);
    } catch (err) {
      console.error(err);
      return errorResponse('Server error', 500);
    }
  }

  return errorResponse('Not found', 404);
};
