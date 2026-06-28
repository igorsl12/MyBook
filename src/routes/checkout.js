import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import * as Cart from '../repositories/cart.js';
import * as Addresses from '../repositories/addresses.js';
import * as Orders from '../repositories/orders.js';
import * as Coupons from '../repositories/coupons.js';
import { calcularFrete } from '../services/shipping.js';
import { processarPagamento, metodoValido } from '../services/payment.js';
import {
  validate, required, isCEP, isUF, hasErrors,
} from '../lib/validate.js';

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

// Monta o estado completo do checkout a partir da sessão + carrinho.
async function montarEstado(req) {
  const cart = await Cart.resolveCart(req, { create: false });
  const { itens, subtotalCents, totalItens } = cart
    ? await Cart.resumo(cart.id)
    : { itens: [], subtotalCents: 0, totalItens: 0 };

  const co = req.session.checkout ?? {};
  const enderecos = await Addresses.listByUser(req.session.usuario.id);

  // Frete (recalculado com o subtotal atual).
  let frete = null;
  if (co.cep) frete = calcularFrete(co.cep, subtotalCents);

  // Cupom (revalidado com o subtotal atual).
  let cupom = null;
  let descontoCents = 0;
  if (co.cupomCodigo) {
    const r = await Coupons.validar(co.cupomCodigo, subtotalCents);
    if (r.ok) { cupom = r.cupom; descontoCents = r.descontoCents; }
    else { delete req.session.checkout.cupomCodigo; }
  }

  const freteCents = frete ? frete.freteCents : 0;
  const totalCents = Math.max(0, subtotalCents - descontoCents) + freteCents;

  return {
    cart, itens, subtotalCents, totalItens, enderecos,
    cep: co.cep ?? '', frete, cupom, descontoCents, freteCents, totalCents,
    enderecoId: co.enderecoId ?? (enderecos.find((e) => e.padrao)?.id ?? enderecos[0]?.id),
    metodo: co.metodo ?? 'pix',
  };
}

checkoutRouter.get('/checkout', asyncHandler(async (req, res) => {
  const estado = await montarEstado(req);
  if (estado.itens.length === 0) {
    req.flash('aviso', 'Seu carrinho está vazio.');
    return res.redirect('/carrinho');
  }
  res.render('checkout/index', { titulo: 'Finalizar compra', ...estado, erros: {} });
}));

// Calcular frete por CEP.
checkoutRouter.post('/checkout/frete', asyncHandler(async (req, res) => {
  const erros = validate({ cep: [required('CEP'), isCEP()] }, req.body);
  req.session.checkout = req.session.checkout ?? {};
  if (!hasErrors(erros)) {
    req.session.checkout.cep = req.body.cep;
  } else {
    req.flash('erro', erros.cep);
  }
  res.redirect('/checkout');
}));

// Aplicar cupom.
checkoutRouter.post('/checkout/cupom', asyncHandler(async (req, res) => {
  const codigo = (req.body.cupom || '').trim();
  const cart = await Cart.resolveCart(req, { create: false });
  const { subtotalCents } = cart ? await Cart.resumo(cart.id) : { subtotalCents: 0 };
  req.session.checkout = req.session.checkout ?? {};
  const r = await Coupons.validar(codigo, subtotalCents);
  if (r.ok) {
    req.session.checkout.cupomCodigo = codigo;
    req.flash('sucesso', `Cupom ${r.cupom.codigo} aplicado.`);
  } else {
    delete req.session.checkout.cupomCodigo;
    req.flash('erro', r.motivo);
  }
  res.redirect('/checkout');
}));

// Cadastrar novo endereço durante o checkout.
checkoutRouter.post('/checkout/endereco', asyncHandler(async (req, res) => {
  const erros = validate({
    cep: [required('CEP'), isCEP()],
    logradouro: [required('Logradouro')],
    numero: [required('Número')],
    bairro: [required('Bairro')],
    cidade: [required('Cidade')],
    uf: [required('UF'), isUF()],
  }, req.body);

  if (hasErrors(erros)) {
    const estado = await montarEstado(req);
    return res.status(422).render('checkout/index', {
      titulo: 'Finalizar compra', ...estado, erros, novoEndereco: req.body,
    });
  }
  const novo = await Addresses.create(req.session.usuario.id, req.body);
  req.session.checkout = req.session.checkout ?? {};
  req.session.checkout.enderecoId = novo.id;
  if (!req.session.checkout.cep) req.session.checkout.cep = novo.cep;
  req.flash('sucesso', 'Endereço cadastrado.');
  res.redirect('/checkout');
}));

// Finalizar: cria o pedido (sandbox) de forma atômica.
checkoutRouter.post('/checkout/finalizar', asyncHandler(async (req, res) => {
  const estado = await montarEstado(req);

  if (estado.itens.length === 0) {
    req.flash('aviso', 'Seu carrinho está vazio.');
    return res.redirect('/carrinho');
  }
  const enderecoId = parseInt(req.body.endereco_id, 10) || estado.enderecoId;
  const endereco = estado.enderecos.find((e) => e.id === enderecoId);
  if (!endereco) {
    req.flash('erro', 'Selecione ou cadastre um endereço de entrega.');
    return res.redirect('/checkout');
  }
  if (!estado.frete) {
    req.flash('erro', 'Calcule o frete informando seu CEP.');
    return res.redirect('/checkout');
  }
  const metodo = metodoValido(req.body.metodo) ? req.body.metodo : estado.metodo;
  if (!metodoValido(metodo)) {
    req.flash('erro', 'Escolha um método de pagamento.');
    return res.redirect('/checkout');
  }

  // Processa pagamento sandbox/mock.
  const pagamento = processarPagamento(metodo, req.body, estado.totalCents);

  try {
    const pedido = await Orders.criarPedido({
      usuarioId: req.session.usuario.id,
      cartId: estado.cart.id,
      endereco: {
        cep: endereco.cep, logradouro: endereco.logradouro, numero: endereco.numero,
        complemento: endereco.complemento, bairro: endereco.bairro,
        cidade: endereco.cidade, uf: endereco.uf,
      },
      freteCents: estado.freteCents,
      metodoPagamento: metodo,
      pagamento,
      cupomCodigo: estado.cupom?.codigo ?? null,
    });
    delete req.session.checkout; // limpa estado do checkout
    req.flash('sucesso', 'Pedido criado com sucesso!');
    res.redirect(`/pedido/${pedido.id}`);
  } catch (err) {
    if (err.codigo === 'SEM_ESTOQUE' || err.codigo === 'CARRINHO_VAZIO') {
      req.flash('erro', err.message);
      return res.redirect('/carrinho');
    }
    throw err;
  }
}));

// Confirmação / detalhe do pedido (dono ou admin).
checkoutRouter.get('/pedido/:id', asyncHandler(async (req, res) => {
  const pedido = await Orders.findById(parseInt(req.params.id, 10));
  if (!pedido) return res.status(404).render('errors/404', { titulo: 'Pedido não encontrado' });
  const u = req.session.usuario;
  if (pedido.usuario_id !== u.id && u.papel !== 'admin') {
    return res.status(403).render('errors/403', { titulo: 'Acesso negado' });
  }
  res.render('checkout/confirmacao', { titulo: `Pedido #${pedido.id}`, pedido });
}));
