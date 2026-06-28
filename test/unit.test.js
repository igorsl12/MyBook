import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toCents, fromCents, formatBRL, precoEfetivoCents } from '../src/lib/money.js';
import { slugify } from '../src/lib/slug.js';
import { calcularFrete, normalizarCep } from '../src/services/shipping.js';
import { processarPagamento, metodoValido, statusInicial } from '../src/services/payment.js';
import { gerarCapaSVG } from '../src/services/cover.js';
import { TRANSICOES, statusLabel } from '../src/lib/orderStatus.js';
import {
  validate, required, isEmail, isCEP, minLen, hasErrors,
} from '../src/lib/validate.js';

test('money: toCents/fromCents/format sem erro de float', () => {
  assert.equal(toCents('49.90'), 4990);
  assert.equal(toCents('0.10'), 10);
  assert.equal(fromCents(4990), '49.90');
  // Intl usa espaço não-quebrável entre "R$" e o número; checamos as partes.
  assert.match(formatBRL(4990), /^R\$\s?49,90$/);
  assert.equal(toCents(''), null);
});

test('money: precoEfetivo usa promoção só quando menor', () => {
  assert.equal(precoEfetivoCents({ preco: '49.90', preco_promocional: '39.90' }), 3990);
  assert.equal(precoEfetivoCents({ preco: '49.90', preco_promocional: null }), 4990);
  assert.equal(precoEfetivoCents({ preco: '49.90', preco_promocional: '59.90' }), 4990);
});

test('slug: remove acentos e normaliza', () => {
  assert.equal(slugify('Memórias Póstumas de Brás Cubas'), 'memorias-postumas-de-bras-cubas');
  assert.equal(slugify('  Olá, Mundo!  '), 'ola-mundo');
});

test('frete: regiões, CEP inválido e frete grátis', () => {
  assert.equal(normalizarCep('01310-100'), '01310100');
  assert.equal(calcularFrete('123', 1000), null);
  const sp = calcularFrete('01310-100', 5000);
  assert.equal(sp.regiao, 'Sudeste (SP)');
  assert.equal(sp.freteCents, 1490);
  const gratis = calcularFrete('01310100', 20000); // > R$150
  assert.equal(gratis.gratis, true);
  assert.equal(gratis.freteCents, 0);
});

test('pagamento: métodos sandbox', () => {
  assert.ok(metodoValido('pix') && metodoValido('cartao') && metodoValido('boleto'));
  assert.ok(!metodoValido('cripto'));
  const pix = processarPagamento('pix', {}, 5000);
  assert.equal(pix.metodo, 'pix');
  assert.equal(pix.status, 'pendente');
  assert.ok(pix.qrSvg.startsWith('<svg'));
  const cartao = processarPagamento('cartao', { cartao_numero: '4111111111111111' }, 5000);
  assert.equal(cartao.status, 'pago');
  assert.equal(cartao.bandeira, 'Visa');
  assert.equal(cartao.ultimos4, '1111');
  assert.equal(statusInicial(cartao), 'pago');
  assert.equal(statusInicial(pix), 'pendente');
});

test('capa SVG: gera com título e marca', () => {
  const svg = gerarCapaSVG({ titulo: 'Duna', autor: 'Frank Herbert' });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('MYBOOK'));
});

test('status de pedido: transições válidas', () => {
  assert.deepEqual(TRANSICOES.pendente, ['pago', 'cancelado']);
  assert.deepEqual(TRANSICOES.entregue, []);
  assert.equal(statusLabel('pago'), 'Pago');
});

test('validação: required/email/cep/minLen', () => {
  const erros = validate({
    email: [required('E-mail'), isEmail()],
    senha: [required('Senha'), minLen(6, 'Senha')],
    cep: [isCEP()],
  }, { email: 'invalido', senha: '123', cep: '00000-000' });
  assert.ok(hasErrors(erros));
  assert.match(erros.email, /inválido/);
  assert.match(erros.senha, /6/);
  assert.equal(erros.cep, undefined); // cep válido
});
