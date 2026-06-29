import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as Books from '../repositories/books.js';
import * as Categories from '../repositories/categories.js';
import * as Authors from '../repositories/authors.js';

export const catalogRouter = Router();

// Lê e normaliza os parâmetros de busca/filtro da query string.
function lerFiltros(req, extra = {}) {
  const q = req.query;
  const pagina = Math.max(1, parseInt(q.pagina, 10) || 1);
  return {
    termo: (q.q || '').trim() || undefined,
    categoriaSlug: extra.categoriaSlug ?? (q.categoria || undefined),
    autorSlug: extra.autorSlug ?? (q.autor || undefined),
    formato: q.formato || undefined,
    precoMin: q.preco_min ? Number(q.preco_min) : undefined,
    precoMax: q.preco_max ? Number(q.preco_max) : undefined,
    disponivel: q.disponivel === '1' || q.disponivel === 'on',
    ordenar: q.ordenar || 'relevancia',
    pagina,
    porPagina: 12,
  };
}

// Página de listagem genérica (catálogo, busca, categoria, autor).
async function renderListagem(req, res, { titulo, filtros, contexto = {} }) {
  const [resultado, categorias, autores] = await Promise.all([
    Books.search(filtros),
    Categories.listArvore(),
    Authors.listAll(),
  ]);
  res.render('catalog/list', {
    titulo,
    metaDescricao: `${titulo} — MyBook`,
    resultado,
    filtros,
    categorias,
    autores,
    contexto,
  });
}

catalogRouter.get('/catalogo', asyncHandler(async (req, res) => {
  await renderListagem(req, res, {
    titulo: 'Todos os livros',
    filtros: lerFiltros(req),
  });
}));

catalogRouter.get('/buscar', asyncHandler(async (req, res) => {
  const termo = (req.query.q || '').trim();
  await renderListagem(req, res, {
    titulo: termo ? `Resultados para "${termo}"` : 'Buscar livros',
    filtros: lerFiltros(req),
  });
}));

catalogRouter.get('/categoria/:slug', asyncHandler(async (req, res) => {
  const categoria = await Categories.findBySlug(req.params.slug);
  if (!categoria) return res.status(404).render('errors/404', { titulo: 'Categoria não encontrada' });
  await renderListagem(req, res, {
    titulo: categoria.nome,
    filtros: lerFiltros(req, { categoriaSlug: categoria.slug }),
    contexto: { tipo: 'categoria', categoria },
  });
}));

catalogRouter.get('/autor/:slug', asyncHandler(async (req, res) => {
  const autor = await Authors.findBySlug(req.params.slug);
  if (!autor) return res.status(404).render('errors/404', { titulo: 'Autor não encontrado' });
  await renderListagem(req, res, {
    titulo: autor.nome,
    filtros: lerFiltros(req, { autorSlug: autor.slug }),
    contexto: { tipo: 'autor', autor },
  });
}));

// Detalhe do livro.
catalogRouter.get('/livro/:slug', asyncHandler(async (req, res) => {
  const livro = await Books.findBySlug(req.params.slug);
  if (!livro) return res.status(404).render('errors/404', { titulo: 'Livro não encontrado' });

  const [relacionados, avaliacoes] = await Promise.all([
    Books.listRelacionados(livro.id, 4),
    Books.listAvaliacoes(livro.id),
  ]);

  let favoritado = false;
  if (req.session.usuario) {
    favoritado = await Books.isFavorito(req.session.usuario.id, livro.id);
  }

  res.render('catalog/book', {
    titulo: livro.titulo,
    metaDescricao: livro.descricao
      ? livro.descricao.slice(0, 150)
      : `${livro.titulo} na MyBook`,
    livro,
    relacionados,
    avaliacoes,
    favoritado,
  });
}));
