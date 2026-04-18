// netlify/functions/_auth.js
// JWT auth helper

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dinkes-banggai-laut-secret-2025';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromEvent(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function requireAuth(event) {
  const token = getTokenFromEvent(event);
  if (!token) return null;
  return verifyToken(token);
}
