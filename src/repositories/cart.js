import crypto from 'node:crypto';
import { query, withTransaction } from '../db.js';
import { precoEfetivoCents } from '../lib/money.js';

// Carrinho do usuário logado (1 por usuário) ou do visitante (token na sessão).

async function findByUser(usuarioId) {
  const { rows } = await query('SELECT * FROM carrinhos WHERE usuario_id = $1', [usuarioId]);
  return rows[0] ?? null;
}
async function findByToken(token) {
  const { rows } = await query('SELECT * FROM carrinhos WHERE token = $1', [token]);
  return rows[0] ?? null;
}
async function createForUser(usuarioId) {
  const { rows } = await query(
    'INSERT INTO carrinhos (usuario_id) VALUES ($1) RETURNING *', [usuarioId]);
  return rows[0];
}
async function createWithToken(token) {
  const { rows } = await query(
    'INSERT INTO carrinhos (token) VALUES ($1) RETURNING *', [token]);
  return rows[0];
}

/**
 * Resolve o carrinho da requisição (cria se necessário).
 * Logado → carrinho por usuário; visitante → carrinho por token na sessão.
 */
export async function resolveCart(req, { create = true } = {}) {
  const usuario = req.session?.usuario;
  if (usuario) {
    let cart = await findByUser(usuario.id);
    if (!cart && create) cart = await createForUser(usuario.id);
    return cart;
  }
  let token = req.session?.cartToken;
  if (token) {
    const cart = await findByToken(token);
    if (cart) return cart;
  }
  if (!create) return null;
  token = crypto.randomBytes(16).toString('hex');
  req.session.cartToken = token;
  return createWithToken(token);
}

export async function addItem(cartId, livroId, quantidade = 1) {
  await query(
    `INSERT INTO itens_carrinho (carrinho_id, livro_id, quantidade)
     VALUES ($1, $2, $3)
     ON CONFLICT (carrinho_id, livro_id)
     DO UPDATE SET quantidade = itens_carrinho.quantidade + EXCLUDED.quantidade`,
    [cartId, livroId, quantidade],
  );
}

export async function setItemQty(cartId, livroId, quantidade) {
  if (quantidade <= 0) return removeItem(cartId, livroId);
  await query(
    `UPDATE itens_carrinho SET quantidade = $3
     WHERE carrinho_id = $1 AND livro_id = $2`,
    [cartId, livroId, quantidade],
  );
}

export async function removeItem(cartId, livroId) {
  await query(
    'DELETE FROM itens_carrinho WHERE carrinho_id = $1 AND livro_id = $2',
    [cartId, livroId],
  );
}

export async function clear(cartId) {
  await query('DELETE FROM itens_carrinho WHERE carrinho_id = $1', [cartId]);
}

/** Itens do carrinho com dados do livro, preço efetivo e subtotal por linha. */
export async function listItems(cartId) {
  const { rows } = await query(
    `SELECT ic.livro_id, ic.quantidade,
            l.titulo, l.slug, l.preco, l.preco_promocional, l.estoque, l.capa_url
     FROM itens_carrinho ic
     JOIN livros l ON l.id = ic.livro_id
     WHERE ic.carrinho_id = $1
     ORDER BY ic.id`,
    [cartId],
  );
  return rows.map((r) => {
    const unitCents = precoEfetivoCents(r);
    return {
      ...r,
      capa: r.capa_url || `/capa/${r.slug}.svg`,
      unitCents,
      subtotalCents: unitCents * r.quantidade,
      excedeEstoque: r.quantidade > r.estoque,
    };
  });
}

/** Quantidade total de itens (soma de quantidades) — para o badge. */
export async function count(cartId) {
  if (!cartId) return 0;
  const { rows } = await query(
    'SELECT COALESCE(SUM(quantidade), 0)::int AS n FROM itens_carrinho WHERE carrinho_id = $1',
    [cartId],
  );
  return rows[0].n;
}

/** Resumo (subtotal em centavos + nº de itens). */
export async function resumo(cartId) {
  const itens = await listItems(cartId);
  const subtotalCents = itens.reduce((s, i) => s + i.subtotalCents, 0);
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);
  return { itens, subtotalCents, totalItens };
}

/**
 * Funde o carrinho de visitante no carrinho do usuário ao logar.
 * Soma quantidades e remove o carrinho de visitante.
 */
export async function mergeGuestIntoUser(token, usuarioId) {
  if (!token) return;
  await withTransaction(async (client) => {
    const g = await client.query('SELECT id FROM carrinhos WHERE token = $1', [token]);
    if (!g.rows[0]) return;
    const guestId = g.rows[0].id;

    let u = await client.query('SELECT id FROM carrinhos WHERE usuario_id = $1', [usuarioId]);
    let userCartId;
    if (u.rows[0]) {
      userCartId = u.rows[0].id;
    } else {
      const created = await client.query(
        'INSERT INTO carrinhos (usuario_id) VALUES ($1) RETURNING id', [usuarioId]);
      userCartId = created.rows[0].id;
    }

    await client.query(
      `INSERT INTO itens_carrinho (carrinho_id, livro_id, quantidade)
       SELECT $1, livro_id, quantidade FROM itens_carrinho WHERE carrinho_id = $2
       ON CONFLICT (carrinho_id, livro_id)
       DO UPDATE SET quantidade = itens_carrinho.quantidade + EXCLUDED.quantidade`,
      [userCartId, guestId],
    );
    await client.query('DELETE FROM carrinhos WHERE id = $1', [guestId]);
  });
}
