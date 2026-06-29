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

// Monta o estado completo do checkout. O FRETE é derivado do endereço de
// entrega selecionado (um único CEP, sem campo separado).
async function montarEstado(req) {
  const cart = await Cart.resolveCart(req, { create: false });
  const { itens, subtotalCents, totalItens } = cart
    ? await Cart.resumo(cart.id)
    : { itens: [], subtotalCents: 0, totalItens: 0 };

  const co = req.session.checkout ?? {};
  const enderecos = await Addresses.listByUser(req.session.usuario.id);

  // Endereço ativo: o escolhido, senão o padrão, senão o primeiro.
  const enderecoId = co.enderecoId ?? (enderecos.find((e) => e.padrao)?.id ?? enderecos[0]?.id);
  const endereco = enderecos.find((e) => e.id === enderecoId) ?? null;

  // Frete calculado a partir do CEP do endereço selecionado.
  const frete = endereco ? calcularFrete(endereco.cep, subtotalCents) : null;

  // Cupom revalidado com o subtotal atual.
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
    cart, itens, subtotalCents, totalItens, enderecos, endereco, enderecoId,
    frete, cupom, descontoCents, freteCents, totalCents, metodo: co.metodo ?? 'pix',
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

// Seleciona o endereço de entrega (recalcula o frete ao recarregar).
checkoutRouter.post('/checkout/selecionar', asyncHandler(async (req, res) => {
  req.session.checkout = req.session.checkout ?? {};
  if (req.body.endereco_id) req.session.checkout.enderecoId = parseInt(req.body.endereco_id, 10);
  if (metodoValido(req.body.metodo)) req.session.checkout.metodo = req.body.metodo;
  res.redirect('/checkout');
}));

// Aplica cupom.
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

// Cadastra novo endereço (vira o endereço de entrega selecionado).
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
  req.flash('sucesso', 'Endereço cadastrado.');
  res.redirect('/checkout');
}));

// Finaliza: cria o pedido (pagamento sandbox) de forma atômica.
checkoutRouter.post('/checkout/finalizar', asyncHandler(async (req, res) => {
  const estado = await montarEstado(req);

  if (estado.itens.length === 0) {
    req.flash('aviso', 'Seu carrinho está vazio.');
    return res.redirect('/carrinho');
  }
  if (!estado.endereco) {
    req.flash('erro', 'Selecione ou cadastre um endereço de entrega.');
    return res.redirect('/checkout');
  }
  if (!estado.frete) {
    req.flash('erro', 'Não foi possível calcular o frete para este endereço.');
    return res.redirect('/checkout');
  }
  const metodo = metodoValido(req.body.metodo) ? req.body.metodo : estado.metodo;
  if (!metodoValido(metodo)) {
    req.flash('erro', 'Escolha um método de pagamento.');
    return res.redirect('/checkout');
  }

  // Pagamento sandbox/mock (ponto de integração real isolado em services/payment.js).
  const pagamento = processarPagamento(metodo, req.body, estado.totalCents);

  try {
    const pedido = await Orders.criarPedido({
      usuarioId: req.session.usuario.id,
      cartId: estado.cart.id,
      endereco: {
        cep: estado.endereco.cep, logradouro: estado.endereco.logradouro,
        numero: estado.endereco.numero, complemento: estado.endereco.complemento,
        bairro: estado.endereco.bairro, cidade: estado.endereco.cidade, uf: estado.endereco.uf,
      },
      freteCents: estado.freteCents,
      metodoPagamento: metodo,
      pagamento,
      cupomCodigo: estado.cupom?.codigo ?? null,
    });
    delete req.session.checkout;
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
