import { query } from '../db.js';

/** O usuário comprou este livro? (existe item de pedido pago/enviado/entregue). */
export async function podeAvaliar(usuarioId, livroId) {
  const { rows } = await query(
    `SELECT 1 FROM itens_pedido ip
     JOIN pedidos p ON p.id = ip.pedido_id
     WHERE p.usuario_id = $1 AND ip.livro_id = $2
       AND p.status IN ('pago','separacao','enviado','entregue','reembolso_solicitado','reembolsado')
     LIMIT 1`,
    [usuarioId, livroId],
  );
  return rows.length > 0;
}

/** Cria ou atualiza a avaliação do usuário para o livro. Retorna o id. */
export async function upsert(usuarioId, livroId, nota, comentario) {
  const { rows } = await query(
    `INSERT INTO avaliacoes (livro_id, usuario_id, nota, comentario)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (livro_id, usuario_id)
     DO UPDATE SET nota = EXCLUDED.nota, comentario = EXCLUDED.comentario, criado_em = now()
     RETURNING id`,
    [livroId, usuarioId, nota, comentario || null],
  );
  return rows[0].id;
}

/** Anexa mídias (fotos/vídeos) a uma avaliação. midias: [{tipo, url}]. */
export async function adicionarMidias(avaliacaoId, midias) {
  for (const m of midias) {
    await query(
      'INSERT INTO avaliacao_midias (avaliacao_id, tipo, url) VALUES ($1,$2,$3)',
      [avaliacaoId, m.tipo, m.url],
    );
  }
}

/** URLs das mídias atuais de uma avaliação (para apagar os arquivos antigos). */
export async function listarMidias(avaliacaoId) {
  const { rows } = await query(
    'SELECT url FROM avaliacao_midias WHERE avaliacao_id = $1', [avaliacaoId]);
  return rows.map((r) => r.url);
}

/** Remove os registros de mídia de uma avaliação. */
export async function excluirMidias(avaliacaoId) {
  await query('DELETE FROM avaliacao_midias WHERE avaliacao_id = $1', [avaliacaoId]);
}

/** Livros que o usuário pode avaliar e ainda não avaliou (para a área da conta). */
export async function pendentesDeAvaliacao(usuarioId) {
  const { rows } = await query(
    `SELECT DISTINCT l.id, l.titulo, l.slug
     FROM itens_pedido ip
     JOIN pedidos p ON p.id = ip.pedido_id
     JOIN livros l ON l.id = ip.livro_id
     WHERE p.usuario_id = $1
       AND p.status IN ('pago','separacao','enviado','entregue')
       AND NOT EXISTS (
         SELECT 1 FROM avaliacoes av WHERE av.livro_id = l.id AND av.usuario_id = $1)
     ORDER BY l.titulo`,
    [usuarioId],
  );
  return rows;
}
