import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import * as Admin from '../repositories/admin.js';
import * as Categories from '../repositories/categories.js';
import * as Authors from '../repositories/authors.js';
import * as Orders from '../repositories/orders.js';
import { TRANSICOES } from '../lib/orderStatus.js';
import { invalidarCacheCategorias } from '../middleware/categories.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

// Dados comuns ao formulário de livro (editoras/autores/categorias).
async function dadosFormLivro() {
  const [editoras, autores, categorias] = await Promise.all([
    Admin.listEditoras(), Authors.listAll(), Categories.listAll(),
  ]);
  return { editoras, autores, categorias };
}

// ---- Dashboard ----
adminRouter.get('/admin', asyncHandler(async (req, res) => {
  const metricas = await Admin.metricas();
  res.render('admin/dashboard', { titulo: 'Admin · Dashboard', admin: true, metricas });
}));

// ---- Livros ----
adminRouter.get('/admin/livros', asyncHandler(async (req, res) => {
  const livros = await Admin.listLivros();
  res.render('admin/livros', { titulo: 'Admin · Livros', admin: true, livros });
}));

adminRouter.get('/admin/livros/novo', asyncHandler(async (req, res) => {
  res.render('admin/livro-form', {
    titulo: 'Admin · Novo livro', admin: true,
    livro: { autorIds: [], categoriaIds: [], ativo: true }, ...await dadosFormLivro(), erros: {},
  });
}));

adminRouter.post('/admin/livros/novo', asyncHandler(async (req, res) => {
  if (!req.body.titulo?.trim()) {
    return res.status(422).render('admin/livro-form', {
      titulo: 'Admin · Novo livro', admin: true, livro: req.body,
      ...await dadosFormLivro(), erros: { titulo: 'Título é obrigatório.' },
    });
  }
  const id = await Admin.criarLivro(req.body);
  req.flash('sucesso', 'Livro criado.');
  res.redirect(`/admin/livros/${id}/editar`);
}));

adminRouter.get('/admin/livros/:id/editar', asyncHandler(async (req, res) => {
  const livro = await Admin.getLivro(parseInt(req.params.id, 10));
  if (!livro) return res.status(404).render('errors/404', { titulo: 'Livro não encontrado' });
  res.render('admin/livro-form', {
    titulo: `Admin · ${livro.titulo}`, admin: true, livro, ...await dadosFormLivro(), erros: {},
  });
}));

adminRouter.post('/admin/livros/:id/editar', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!req.body.titulo?.trim() || Number(req.body.preco) < 0) {
    const livro = { ...await Admin.getLivro(id), ...req.body, id };
    return res.status(422).render('admin/livro-form', {
      titulo: 'Admin · Editar livro', admin: true, livro, ...await dadosFormLivro(),
      erros: { titulo: !req.body.titulo?.trim() ? 'Título é obrigatório.' : '', preco: Number(req.body.preco) < 0 ? 'Preço inválido.' : '' },
    });
  }
  await Admin.atualizarLivro(id, req.body);
  req.flash('sucesso', 'Livro atualizado.');
  res.redirect('/admin/livros');
}));

adminRouter.post('/admin/livros/:id/remover', asyncHandler(async (req, res) => {
  await Admin.removerLivro(parseInt(req.params.id, 10));
  req.flash('sucesso', 'Livro removido.');
  res.redirect('/admin/livros');
}));

adminRouter.post('/admin/livros/:id/estoque', asyncHandler(async (req, res) => {
  await Admin.ajustarEstoque(parseInt(req.params.id, 10), parseInt(req.body.estoque, 10) || 0);
  req.flash('sucesso', 'Estoque atualizado.');
  res.redirect('/admin/livros');
}));

// ---- Autores / Editoras / Categorias ----
adminRouter.get('/admin/catalogo', asyncHandler(async (req, res) => {
  const [autores, editoras, categorias] = await Promise.all([
    Authors.listAll(), Admin.listEditoras(), Categories.listAll(),
  ]);
  res.render('admin/catalogo', { titulo: 'Admin · Catálogo', admin: true, autores, editoras, categorias });
}));

adminRouter.post('/admin/autores', asyncHandler(async (req, res) => {
  if (req.body.nome?.trim()) await Admin.criarAutor(req.body);
  res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/autores/:id/editar', asyncHandler(async (req, res) => {
  if (req.body.nome?.trim()) await Admin.atualizarAutor(parseInt(req.params.id, 10), req.body);
  req.flash('sucesso', 'Autor atualizado.');
  res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/autores/:id/remover', asyncHandler(async (req, res) => {
  await Admin.removerAutor(parseInt(req.params.id, 10)); res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/editoras', asyncHandler(async (req, res) => {
  if (req.body.nome?.trim()) await Admin.criarEditora(req.body);
  res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/editoras/:id/editar', asyncHandler(async (req, res) => {
  if (req.body.nome?.trim()) await Admin.atualizarEditora(parseInt(req.params.id, 10), req.body);
  req.flash('sucesso', 'Editora atualizada.');
  res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/editoras/:id/remover', asyncHandler(async (req, res) => {
  await Admin.removerEditora(parseInt(req.params.id, 10)); res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/categorias', asyncHandler(async (req, res) => {
  if (req.body.nome?.trim()) await Admin.criarCategoria(req.body);
  invalidarCacheCategorias();
  res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/categorias/:id/editar', asyncHandler(async (req, res) => {
  if (req.body.nome?.trim()) await Admin.atualizarCategoria(parseInt(req.params.id, 10), req.body);
  invalidarCacheCategorias();
  req.flash('sucesso', 'Categoria atualizada.');
  res.redirect('/admin/catalogo');
}));
adminRouter.post('/admin/categorias/:id/remover', asyncHandler(async (req, res) => {
  await Admin.removerCategoria(parseInt(req.params.id, 10));
  invalidarCacheCategorias();
  res.redirect('/admin/catalogo');
}));

// ---- Pedidos ----
adminRouter.get('/admin/pedidos', asyncHandler(async (req, res) => {
  const pedidos = await Admin.listPedidos();
  res.render('admin/pedidos', { titulo: 'Admin · Pedidos', admin: true, pedidos });
}));

adminRouter.get('/admin/pedidos/:id', asyncHandler(async (req, res) => {
  const pedido = await Orders.findById(parseInt(req.params.id, 10));
  if (!pedido) return res.status(404).render('errors/404', { titulo: 'Pedido não encontrado' });
  res.render('admin/pedido', {
    titulo: `Admin · Pedido #${pedido.id}`, admin: true, pedido,
    transicoes: TRANSICOES[pedido.status] ?? [],
  });
}));

adminRouter.post('/admin/pedidos/:id/status', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const pedido = await Orders.findById(id);
  const permitidas = TRANSICOES[pedido?.status] ?? [];
  if (pedido && permitidas.includes(req.body.status)) {
    const ok = await Admin.atualizarStatusPedido(id, req.body.status, pedido.status);
    req.flash(ok ? 'sucesso' : 'erro',
      ok ? 'Status atualizado.' : 'O status mudou enquanto isso — recarregue a página.');
  } else {
    req.flash('erro', 'Transição de status inválida.');
  }
  res.redirect(`/admin/pedidos/${id}`);
}));

// ---- Cupons ----
adminRouter.get('/admin/cupons', asyncHandler(async (req, res) => {
  const cupons = await Admin.listCupons();
  res.render('admin/cupons', { titulo: 'Admin · Cupons', admin: true, cupons });
}));
adminRouter.post('/admin/cupons', asyncHandler(async (req, res) => {
  if (req.body.codigo?.trim()) await Admin.criarCupom(req.body);
  req.flash('sucesso', 'Cupom criado.');
  res.redirect('/admin/cupons');
}));
adminRouter.post('/admin/cupons/:id/alternar', asyncHandler(async (req, res) => {
  await Admin.alternarCupom(parseInt(req.params.id, 10));
  res.redirect('/admin/cupons');
}));
