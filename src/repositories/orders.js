import { query, withTransaction } from '../db.js';
import { precoEfetivoCents, toCents, fromCents } from '../lib/money.js';
import * as Coupons from './coupons.js';

/** Recalcula o desconto de um cupom já carregado, para um subtotal em centavos. */
function calcularDesconto(cupom, subtotalCents) {
  if (!cupom) return 0;
  let d = cupom.tipo === 'percentual'
    ? Math.round(subtotalCents * (Number(cupom.valor) / 100))
    : toCents(cupom.valor);
  return Math.min(d, subtotalCents);
}

/**
 * Cria um pedido a partir do carrinho, de forma ATÔMICA:
 * valida estoque (FOR UPDATE), calcula totais no servidor, baixa estoque,
 * incrementa vendidos, registra uso de cupom e esvazia o carrinho.
 *
 * @returns {Promise<{id:number}>}
 * @throws  Error com .codigo = 'CARRINHO_VAZIO' | 'SEM_ESTOQUE'
 */
export async function criarPedido({
  usuarioId, cartId, endereco, freteCents, metodoPagamento, pagamento, cupomCodigo,
}) {
  return withTransaction(async (client) => {
    // Trava as linhas dos livros do carrinho para checar estoque com segurança.
    const itensRes = await client.query(
      `SELECT ic.livro_id, ic.quantidade, l.titulo, l.estoque,
              l.preco, l.preco_promocional
       FROM itens_carrinho ic
       JOIN livros l ON l.id = ic.livro_id
       WHERE ic.carrinho_id = $1
       FOR UPDATE OF l`,
      [cartId],
    );
    const itens = itensRes.rows;
    if (itens.length === 0) {
      const e = new Error('Seu carrinho está vazio.');
      e.codigo = 'CARRINHO_VAZIO';
      throw e;
    }

    let subtotalCents = 0;
    for (const it of itens) {
      if (it.quantidade > it.estoque) {
        const e = new Error(`Estoque insuficiente para "${it.titulo}" (restam ${it.estoque}).`);
        e.codigo = 'SEM_ESTOQUE';
        throw e;
      }
      it.unitCents = precoEfetivoCents(it);
      subtotalCents += it.unitCents * it.quantidade;
    }

    // Cupom (revalidado no servidor).
    let cupom = null;
    let descontoCents = 0;
    if (cupomCodigo) {
      const c = await client.query(
        'SELECT * FROM cupons WHERE UPPER(codigo) = UPPER($1) FOR UPDATE', [cupomCodigo]);
      cupom = c.rows[0] ?? null;
      const minimo = cupom ? (toCents(cupom.valor_minimo) ?? 0) : 0;
      const expirado = cupom?.validade && new Date(cupom.validade) < new Date();
      const esgotado = cupom?.uso_maximo !== null && cupom && cupom.usos >= cupom.uso_maximo;
      if (cupom && cupom.ativo && !expirado && !esgotado && subtotalCents >= minimo) {
        descontoCents = calcularDesconto(cupom, subtotalCents);
      } else {
        cupom = null; // cupom inválido é simplesmente ignorado no fechamento
      }
    }

    const totalCents = Math.max(0, subtotalCents - descontoCents) + freteCents;
    const status = pagamento.status === 'pago' ? 'pago' : 'pendente';

    const pedidoRes = await client.query(
      `INSERT INTO pedidos
        (usuario_id, status, subtotal, frete, desconto, total,
         metodo_pagamento, cupom_id, endereco_json, pagamento_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        usuarioId, status, fromCents(subtotalCents), fromCents(freteCents),
        fromCents(descontoCents), fromCents(totalCents), metodoPagamento,
        cupom?.id ?? null, JSON.stringify(endereco), JSON.stringify(pagamento),
      ],
    );
    const pedidoId = pedidoRes.rows[0].id;

    for (const it of itens) {
      await client.query(
        `INSERT INTO itens_pedido (pedido_id, livro_id, titulo, quantidade, preco_unitario)
         VALUES ($1,$2,$3,$4,$5)`,
        [pedidoId, it.livro_id, it.titulo, it.quantidade, fromCents(it.unitCents)],
      );
      await client.query(
        'UPDATE livros SET estoque = estoque - $2, vendidos = vendidos + $2 WHERE id = $1',
        [it.livro_id, it.quantidade],
      );
    }

    if (cupom) await Coupons.registrarUso(client, cupom.id);

    // Esvazia o carrinho.
    await client.query('DELETE FROM itens_carrinho WHERE carrinho_id = $1', [cartId]);

    return { id: pedidoId };
  });
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
  const pedido = rows[0];
  if (!pedido) return null;
  const itens = await query(
    `SELECT ip.*, l.slug AS livro_slug
     FROM itens_pedido ip LEFT JOIN livros l ON l.id = ip.livro_id
     WHERE ip.pedido_id = $1 ORDER BY ip.id`, [id]);
  pedido.itens = itens.rows;
  return pedido;
}

/**
 * Cliente solicita reembolso: só permitido no próprio pedido e quando 'entregue'.
 * Retorna true se mudou o status.
 */
export async function solicitarReembolso(id, usuarioId) {
  const { rowCount } = await query(
    `UPDATE pedidos SET status = 'reembolso_solicitado'
     WHERE id = $1 AND usuario_id = $2 AND status = 'entregue'`,
    [id, usuarioId],
  );
  return rowCount > 0;
}

export async function listByUser(usuarioId) {
  const { rows } = await query(
    `SELECT p.*, COALESCE(SUM(ip.quantidade), 0)::int AS total_itens
     FROM pedidos p LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
     WHERE p.usuario_id = $1
     GROUP BY p.id ORDER BY p.criado_em DESC`,
    [usuarioId],
  );
  return rows;
}
