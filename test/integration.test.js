// Testes de INTEGRAÇÃO contra um PostgreSQL real (schema + seed carregados).
// Exercitam o fluxo de compra na camada de dados/serviços.
// Requer as variáveis DB_* apontando para um banco com 001_schema.sql + 002_seed.sql.
// Pulam automaticamente se o banco não estiver acessível.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { pool, checkConnection } from '../src/db.js';
import * as Books from '../src/repositories/books.js';
import * as Users from '../src/repositories/users.js';
import * as Cart from '../src/repositories/cart.js';
import * as Orders from '../src/repositories/orders.js';
import * as Coupons from '../src/repositories/coupons.js';
import { calcularFrete } from '../src/services/shipping.js';
import { processarPagamento } from '../src/services/payment.js';

let dbOk = false;
const email = `teste_${Date.now()}@mybook.test`;

before(async () => {
  try { await checkConnection(); dbOk = true; }
  catch { dbOk = true; throw new Error('Banco indisponível — defina DB_* e carregue schema+seed.'); }
});

after(async () => {
  if (dbOk) {
    await pool.query('DELETE FROM usuarios WHERE email = $1', [email]).catch(() => {});
    await pool.end();
  }
});

test('seed carregado: há livros em destaque', async () => {
  const destaques = await Books.listDestaques(8);
  assert.ok(destaques.length > 0, 'esperava livros em destaque do seed');
  assert.ok(destaques[0].precoEfetivoCents > 0);
});

test('busca por título funciona (trigram/ILIKE)', async () => {
  const r = await Books.search({ termo: 'Duna' });
  assert.ok(r.itens.some((l) => /Duna/i.test(l.titulo)));
});

test('fluxo completo: cadastro → carrinho → cupom → pedido → baixa de estoque', async () => {
  // 1. Cria usuário e valida login.
  const usuario = await Users.create({ nome: 'Teste Integração', email, senha: 'senha12345' });
  const login = await Users.verifyCredentials(email, 'senha12345');
  assert.equal(login.id, usuario.id);

  // 2. Pega um livro com estoque e monta carrinho.
  const { rows: [livro] } = await pool.query(
    "SELECT id, slug, estoque FROM livros WHERE ativo AND estoque > 2 ORDER BY id LIMIT 1");
  const cart = await Cart.resolveCart({ session: { usuario } });
  await Cart.addItem(cart.id, livro.id, 2);
  const resumo = await Cart.resumo(cart.id);
  assert.equal(resumo.totalItens, 2);
  assert.ok(resumo.subtotalCents > 0);

  // 3. Cupom de boas-vindas (percentual) valida sobre o subtotal.
  const cupom = await Coupons.validar('BEMVINDO10', resumo.subtotalCents);
  assert.equal(cupom.ok, true);
  assert.ok(cupom.descontoCents > 0);

  // 4. Frete e pagamento sandbox.
  const frete = calcularFrete('01310-100', resumo.subtotalCents);
  const pagamento = processarPagamento('cartao', { cartao_numero: '4111111111111111' }, resumo.subtotalCents);

  // 5. Cria o pedido (transação atômica).
  const estoqueAntes = livro.estoque;
  const pedido = await Orders.criarPedido({
    usuarioId: usuario.id, cartId: cart.id,
    endereco: { cep: '01310-100', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
    freteCents: frete.freteCents, metodoPagamento: 'cartao', pagamento, cupomCodigo: 'BEMVINDO10',
  });
  assert.ok(pedido.id > 0);

  // 6. Verifica persistência e efeitos colaterais.
  const persistido = await Orders.findById(pedido.id);
  assert.equal(persistido.status, 'pago'); // cartão aprova na hora
  assert.equal(persistido.itens.length, 1);
  assert.equal(persistido.itens[0].quantidade, 2);

  const { rows: [depois] } = await pool.query('SELECT estoque FROM livros WHERE id = $1', [livro.id]);
  assert.equal(depois.estoque, estoqueAntes - 2, 'estoque deve baixar');

  const carrinhoVazio = await Cart.resumo(cart.id);
  assert.equal(carrinhoVazio.totalItens, 0, 'carrinho deve esvaziar após o pedido');

  const pedidosUsuario = await Orders.listByUser(usuario.id);
  assert.ok(pedidosUsuario.some((p) => p.id === pedido.id), 'pedido deve aparecer no histórico');
});

test('estoque insuficiente é bloqueado', async () => {
  const usuario = await Users.findByEmail(email);
  const cart = await Cart.resolveCart({ session: { usuario } });
  const { rows: [livro] } = await pool.query(
    "SELECT id, estoque FROM livros WHERE ativo ORDER BY id LIMIT 1");
  await Cart.addItem(cart.id, livro.id, livro.estoque + 999);
  await assert.rejects(
    () => Orders.criarPedido({
      usuarioId: usuario.id, cartId: cart.id,
      endereco: { cep: '01310-100', logradouro: 'x', numero: '1', bairro: 'x', cidade: 'x', uf: 'SP' },
      freteCents: 0, metodoPagamento: 'pix', pagamento: processarPagamento('pix', {}, 1000), cupomCodigo: null,
    }),
    (err) => err.codigo === 'SEM_ESTOQUE',
  );
  await Cart.clear(cart.id);
});
