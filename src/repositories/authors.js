import { query } from '../db.js';

export async function listAll() {
  const { rows } = await query('SELECT * FROM autores ORDER BY nome');
  return rows;
}

export async function findBySlug(slug) {
  const { rows } = await query('SELECT * FROM autores WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}
