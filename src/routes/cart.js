import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as Cart from '../repositories/cart.js';
import { query } from '../db.js';

export const cartRouter = Router();

// Destino seguro de redirect (evita open-redirect).
function safeBack(value, fallback = '/carrinho') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : fallback;
}

cartRouter.get('/carrinho', asyncHandler(async (req, res) => {
  const cart = await Cart.resolveCart(req, { create: false });
  const { itens, subtotalCents, totalItens } = cart
    ? await Cart.resumo(cart.id)
    : { itens: [], subtotalCents: 0, totalItens: 0 };
  res.render('cart/index', {
    titulo: 'Seu carrinho',
    itens, subtotalCents, totalItens,
  });
}));

cartRouter.post('/carrinho/adicionar', asyncHandler(async (req, res) => {
  const livroId = parseInt(req.body.livro_id, 10);
  const quantidade = Math.max(1, parseInt(req.body.quantidade, 10) || 1);
  if (!livroId) return res.redirect('back');

  const livro = await query(
    'SELECT id, titulo, estoque FROM livros WHERE id = $1 AND ativo', [livroId]);
  if (!livro.rows[0]) {
    req.flash('erro', 'Livro não encontrado.');
    return res.redirect('/catalogo');
  }
  if (livro.rows[0].estoque <= 0) {
    req.flash('aviso', 'Este livro está indisponível no momento.');
    return res.redirect(safeBack(req.get('referer'), '/carrinho'));
  }

  const cart = await Cart.resolveCart(req);
  await Cart.addItem(cart.id, livroId, quantidade);
  req.flash('sucesso', `"${livro.rows[0].titulo}" adicionado ao carrinho.`);
  res.redirect('/carrinho');
}));

cartRouter.post('/carrinho/atualizar', asyncHandler(async (req, res) => {
  const livroId = parseInt(req.body.livro_id, 10);
  const quantidade = parseInt(req.body.quantidade, 10);
  // Campo vazio (NaN) não deve virar erro de SQL — ignora a atualização.
  if (Number.isNaN(quantidade)) return res.redirect('/carrinho');
  const cart = await Cart.resolveCart(req, { create: false });
  if (cart && livroId) await Cart.setItemQty(cart.id, livroId, quantidade);
  res.redirect('/carrinho');
}));

cartRouter.post('/carrinho/remover', asyncHandler(async (req, res) => {
  const livroId = parseInt(req.body.livro_id, 10);
  const cart = await Cart.resolveCart(req, { create: false });
  if (cart && livroId) await Cart.removeItem(cart.id, livroId);
  req.flash('sucesso', 'Item removido do carrinho.');
  res.redirect('/carrinho');
}));
