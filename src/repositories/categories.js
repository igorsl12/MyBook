import { query } from '../db.js';

/** Todas as categorias (para menus/admin). */
export async function listAll() {
  const { rows } = await query('SELECT * FROM categorias ORDER BY nome');
  return rows;
}

/** Categorias raiz (parent_id IS NULL) com seus filhos aninhados. */
export async function listArvore() {
  const { rows } = await query('SELECT * FROM categorias ORDER BY nome');
  const porId = new Map(rows.map((c) => [c.id, { ...c, filhos: [] }]));
  const raizes = [];
  for (const c of porId.values()) {
    if (c.parent_id && porId.has(c.parent_id)) {
      porId.get(c.parent_id).filhos.push(c);
    } else {
      raizes.push(c);
    }
  }
  return raizes;
}

export async function findBySlug(slug) {
  const { rows } = await query('SELECT * FROM categorias WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}
