import path from 'node:path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { tokenValido } from '../lib/csrf.js';
import * as Users from '../repositories/users.js';
import * as Addresses from '../repositories/addresses.js';
import * as Orders from '../repositories/orders.js';
import * as Favorites from '../repositories/favorites.js';
import * as Reviews from '../repositories/reviews.js';
import { query } from '../db.js';
import {
  uploadReviewMedia, sniffTipo, removerArquivos, REVIEW_DIR,
} from '../lib/upload.js';
import {
  validate, required, isCEP, isUF, isCPF, hasErrors,
} from '../lib/validate.js';
import { maskCpf } from '../lib/crypto.js';

export const accountRouter = Router();

// Limita submissões de avaliação (anti-DoS de disco / spam).
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: 'Muitas avaliações em pouco tempo. Tente novamente mais tarde.',
});

// Pré-autorização ANTES do multer: garante que o usuário pode avaliar ESTE item
// DESTE pedido (pedido dele, entregue, item presente e ainda não avaliado) antes
// de qualquer arquivo ser gravado em disco.
const autorizarAvaliacaoPedido = asyncHandler(async (req, res, next) => {
  const pedidoId = parseInt(req.params.pedidoId, 10);
  const livroId = parseInt(req.params.livroId, 10);
  if (!await Reviews.podeAvaliarItem(req.session.usuario.id, pedidoId, livroId)) {
    req.flash('erro', 'Você não pode avaliar este item.');
    return res.redirect(`/pedido/${pedidoId}`);
  }
  req.pedidoId = pedidoId;
  req.livroId = livroId;
  next();
});

function safeBack(value, fallback) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value : fallback;
}

// ---- Favoritos (toggle a partir do detalhe do livro) ----
accountRouter.post('/favoritos/:id', requireAuth, asyncHandler(async (req, res) => {
  const livroId = parseInt(req.params.id, 10);
  if (livroId) {
    const acao = await Favorites.toggle(req.session.usuario.id, livroId);
    req.flash('sucesso', acao === 'add' ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
  }
  res.redirect(safeBack(req.body.redirect, '/favoritos'));
}));

accountRouter.get('/favoritos', requireAuth, asyncHandler(async (req, res) => {
  const livros = await Favorites.listByUser(req.session.usuario.id);
  res.render('account/favoritos', { titulo: 'Meus favoritos', livros });
}));

// ---- Avaliação de um item DENTRO de um pedido (form multipart com mídia) ----
// Ordem: rate-limit → autoriza o item do pedido (antes do multer) → multer → handler.
accountRouter.post('/pedido/:pedidoId/avaliar/:livroId', requireAuth, reviewLimiter,
  autorizarAvaliacaoPedido, uploadReviewMedia, asyncHandler(async (req, res) => {
    const { pedidoId, livroId } = req;
    const voltar = `/pedido/${pedidoId}`;
    const arquivos = req.files ?? [];

    // CSRF: o corpo multipart só existe aqui (após o multer); validamos o token
    // do campo oculto _csrf (não usamos query string → não vaza em logs).
    if (!tokenValido(req, req.body?._csrf)) {
      removerArquivos(arquivos);
      req.flash('erro', 'Sessão expirada. Recarregue a página e tente novamente.');
      return res.redirect(voltar);
    }

    const nota = parseInt(req.body.nota, 10);
    if (!(nota >= 1 && nota <= 5)) {
      removerArquivos(arquivos);
      req.flash('erro', 'Selecione uma nota de 1 a 5.');
      return res.redirect(voltar);
    }

    // Defesa em profundidade: valida o conteúdo real (magic bytes); descarta o
    // que não for imagem/vídeo de verdade (mesmo que o Content-Type minta).
    const validas = [];
    for (const f of arquivos) {
      const tipo = sniffTipo(f.path);
      if (tipo) validas.push({ tipo, url: `/static/uploads/reviews/${f.filename}`, path: f.path });
      else removerArquivos([f]);
    }

    const avaliacaoId = await Reviews.upsert(
      req.session.usuario.id, pedidoId, livroId, nota, req.body.comentario);

    // Substitui as mídias anteriores (apaga arquivos e registros antigos).
    const antigas = await Reviews.listarMidias(avaliacaoId);
    if (antigas.length) {
      removerArquivos(antigas.map((u) => path.join(REVIEW_DIR, path.basename(u))));
      await Reviews.excluirMidias(avaliacaoId);
    }
    if (validas.length) {
      await Reviews.adicionarMidias(avaliacaoId, validas.map(({ tipo, url }) => ({ tipo, url })));
    }

    req.flash('sucesso',
      validas.length ? 'Avaliação registrada com mídia. Obrigado!' : 'Avaliação registrada. Obrigado!');
    res.redirect(voltar);
  }));

// ---- Minha conta (dashboard) ----
accountRouter.get('/minha-conta', requireAuth, asyncHandler(async (req, res) => {
  const usuarioId = req.session.usuario.id;
  const [perfil, pedidos, pendentes] = await Promise.all([
    Users.findById(usuarioId),
    Orders.listByUser(usuarioId),
    Reviews.pendentesDeAvaliacao(usuarioId),
  ]);
  res.render('account/index', {
    titulo: 'Minha conta',
    perfil,
    pedidos: pedidos.slice(0, 5),
    totalPedidos: pedidos.length,
    pendentes,
  });
}));

// ---- Perfil ----
accountRouter.get('/minha-conta/perfil', requireAuth, asyncHandler(async (req, res) => {
  const perfil = await Users.findById(req.session.usuario.id);
  const cpfMascarado = maskCpf(perfil.cpf);
  delete perfil.cpf; // o CPF cru nunca vai para o HTML
  res.render('account/perfil', { titulo: 'Meu perfil', perfil, cpfMascarado, erros: {} });
}));

accountRouter.post('/minha-conta/perfil', requireAuth, asyncHandler(async (req, res) => {
  const erros = validate({ nome: [required('Nome')], cpf: [isCPF()] }, req.body);
  if (hasErrors(erros)) {
    const atual = await Users.findById(req.session.usuario.id);
    const perfil = { email: atual.email, nome: req.body.nome, telefone: req.body.telefone };
    return res.status(422).render('account/perfil', {
      titulo: 'Meu perfil', perfil, cpfMascarado: maskCpf(atual.cpf), erros,
    });
  }
  await Users.updateProfile(req.session.usuario.id, req.body);
  req.flash('sucesso', 'Perfil atualizado.');
  res.redirect('/minha-conta/perfil');
}));

// ---- Endereços ----
accountRouter.get('/minha-conta/enderecos', requireAuth, asyncHandler(async (req, res) => {
  const enderecos = await Addresses.listByUser(req.session.usuario.id);
  res.render('account/enderecos', { titulo: 'Meus endereços', enderecos, erros: {}, valores: {} });
}));

accountRouter.post('/minha-conta/enderecos', requireAuth, asyncHandler(async (req, res) => {
  const erros = validate({
    cep: [required('CEP'), isCEP()],
    logradouro: [required('Logradouro')],
    numero: [required('Número')],
    bairro: [required('Bairro')],
    cidade: [required('Cidade')],
    uf: [required('UF'), isUF()],
  }, req.body);
  if (hasErrors(erros)) {
    const enderecos = await Addresses.listByUser(req.session.usuario.id);
    return res.status(422).render('account/enderecos', {
      titulo: 'Meus endereços', enderecos, erros, valores: req.body,
    });
  }
  await Addresses.create(req.session.usuario.id, req.body);
  req.flash('sucesso', 'Endereço adicionado.');
  res.redirect('/minha-conta/enderecos');
}));

accountRouter.post('/minha-conta/enderecos/:id/remover', requireAuth, asyncHandler(async (req, res) => {
  await Addresses.remove(parseInt(req.params.id, 10), req.session.usuario.id);
  req.flash('sucesso', 'Endereço removido.');
  res.redirect('/minha-conta/enderecos');
}));

// ---- Pedidos ----
accountRouter.get('/minha-conta/pedidos', requireAuth, asyncHandler(async (req, res) => {
  const pedidos = await Orders.listByUser(req.session.usuario.id);
  res.render('account/pedidos', { titulo: 'Meus pedidos', pedidos });
}));
