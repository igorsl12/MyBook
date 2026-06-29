import { query } from '../db.js';

// Avaliação é vinculada ao PEDIDO: o cliente avalia o item de um pedido entregue.
// Status em que o produto já foi recebido (logo, avaliável).
const STATUS_AVALIAVEL = ['entregue', 'reembolso_solicitado', 'reembolsado'];

/**
 * O usuário pode avaliar este livro NESTE pedido?
 * Exige: pedido do usuário, que contém o item, já entregue, e ainda não avaliado.
 */
export async function podeAvaliarItem(usuarioId, pedidoId, livroId) {
  const { rows } = await query(
    `SELECT 1
       FROM pedidos p
       JOIN itens_pedido ip ON ip.pedido_id = p.id
      WHERE p.id = $1 AND p.usuario_id = $2 AND ip.livro_id = $3
        AND p.status = ANY($4)
        AND NOT EXISTS (
          SELECT 1 FROM avaliacoes a WHERE a.pedido_id = $1 AND a.livro_id = $3)
      LIMIT 1`,
    [pedidoId, usuarioId, livroId, STATUS_AVALIAVEL],
  );
  return rows.length > 0;
}

/** IDs dos livros já avaliados dentro de um pedido (para marcar "Avaliado"). */
export async function avaliadosNoPedido(pedidoId) {
  const { rows } = await query(
    'SELECT livro_id FROM avaliacoes WHERE pedido_id = $1', [pedidoId]);
  return new Set(rows.map((r) => r.livro_id));
}

/** Cria/atualiza a avaliação de um livro dentro de um pedido. Retorna o id. */
export async function upsert(usuarioId, pedidoId, livroId, nota, comentario) {
  const { rows } = await query(
    `INSERT INTO avaliacoes (pedido_id, livro_id, usuario_id, nota, comentario)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (pedido_id, livro_id)
     DO UPDATE SET nota = EXCLUDED.nota, comentario = EXCLUDED.comentario, criado_em = now()
     RETURNING id`,
    [pedidoId, livroId, usuarioId, nota, comentario || null],
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

/**
 * Itens pendentes de avaliação do usuário (pedidos entregues, itens ainda não
 * avaliados) — para o painel da conta. Inclui o pedido a que pertence.
 */
export async function pendentesDeAvaliacao(usuarioId) {
  const { rows } = await query(
    `SELECT DISTINCT p.id AS pedido_id, l.titulo, l.slug
       FROM pedidos p
       JOIN itens_pedido ip ON ip.pedido_id = p.id
       JOIN livros l ON l.id = ip.livro_id
      WHERE p.usuario_id = $1 AND p.status = ANY($2)
        AND NOT EXISTS (
          SELECT 1 FROM avaliacoes a WHERE a.pedido_id = p.id AND a.livro_id = l.id)
      ORDER BY p.id DESC, l.titulo`,
    [usuarioId, STATUS_AVALIAVEL],
  );
  return rows;
}
