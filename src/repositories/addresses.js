import { query, withTransaction } from '../db.js';

export async function listByUser(usuarioId) {
  const { rows } = await query(
    'SELECT * FROM enderecos WHERE usuario_id = $1 ORDER BY padrao DESC, id DESC',
    [usuarioId],
  );
  return rows;
}

export async function findById(id, usuarioId) {
  const { rows } = await query(
    'SELECT * FROM enderecos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0] ?? null;
}

export async function create(usuarioId, e) {
  // Atômico: contar, (re)definir padrão e inserir no mesmo client evita dois
  // endereços marcados como padrão em criações concorrentes.
  return withTransaction(async (client) => {
    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM enderecos WHERE usuario_id = $1', [usuarioId]);
    const padrao = count.rows[0].n === 0 || e.padrao === true;
    if (padrao) {
      await client.query('UPDATE enderecos SET padrao = false WHERE usuario_id = $1', [usuarioId]);
    }
    const { rows } = await client.query(
      `INSERT INTO enderecos
         (usuario_id, cep, logradouro, numero, complemento, bairro, cidade, uf, padrao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [usuarioId, e.cep, e.logradouro, e.numero, e.complemento || null,
       e.bairro, e.cidade, String(e.uf).toUpperCase(), padrao],
    );
    return rows[0];
  });
}

export async function remove(id, usuarioId) {
  await query('DELETE FROM enderecos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
}
