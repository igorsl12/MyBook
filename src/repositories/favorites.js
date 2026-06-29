import { query } from '../db.js';
import { presentLivro } from './books.js';

/** Alterna favorito: adiciona se não existe, remove se existe. Retorna 'add'|'remove'. */
export async function toggle(usuarioId, livroId) {
  const existe = await query(
    'SELECT 1 FROM favoritos WHERE usuario_id = $1 AND livro_id = $2',
    [usuarioId, livroId],
  );
  if (existe.rows.length) {
    await query('DELETE FROM favoritos WHERE usuario_id = $1 AND livro_id = $2',
      [usuarioId, livroId]);
    return 'remove';
  }
  await query(
    'INSERT INTO favoritos (usuario_id, livro_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [usuarioId, livroId]);
  return 'add';
}

/** Livros favoritados pelo usuário (prontos para o card). */
export async function listByUser(usuarioId) {
  const { rows } = await query(
    `SELECT l.*, e.nome AS editora_nome,
            COALESCE(json_agg(DISTINCT jsonb_build_object('nome', a.nome, 'slug', a.slug))
              FILTER (WHERE a.id IS NOT NULL), '[]') AS autores,
            0 AS nota_media, 0 AS total_avaliacoes
     FROM favoritos f
     JOIN livros l ON l.id = f.livro_id
     LEFT JOIN editoras e ON e.id = l.editora_id
     LEFT JOIN livros_autores la ON la.livro_id = l.id
     LEFT JOIN autores a ON a.id = la.autor_id
     WHERE f.usuario_id = $1
     GROUP BY l.id, e.nome, f.criado_em
     ORDER BY f.criado_em DESC`,
    [usuarioId],
  );
  return rows.map(presentLivro);
}
