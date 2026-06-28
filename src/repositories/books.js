import { query } from '../db.js';
import { precoEfetivoCents, toCents } from '../lib/money.js';

// SELECT base reutilizado: agrega autores e estatísticas de avaliação.
const BASE_SELECT = `
  SELECT
    l.*,
    e.nome AS editora_nome,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', a.id, 'nome', a.nome, 'slug', a.slug))
        FILTER (WHERE a.id IS NOT NULL),
      '[]'
    ) AS autores,
    COALESCE(AVG(av.nota), 0)::numeric(3,2) AS nota_media,
    COUNT(DISTINCT av.id)                   AS total_avaliacoes
  FROM livros l
  LEFT JOIN editoras e        ON e.id = l.editora_id
  LEFT JOIN livros_autores la ON la.livro_id = l.id
  LEFT JOIN autores a         ON a.id = la.autor_id
  LEFT JOIN avaliacoes av     ON av.livro_id = l.id
`;
const GROUP_BY = ' GROUP BY l.id, e.nome ';

/** Transforma a linha do banco no formato consumido pelas views. */
export function presentLivro(row) {
  if (!row) return null;
  const precoCents = toCents(row.preco);
  const efetivoCents = precoEfetivoCents(row);
  const emPromocao = efetivoCents < precoCents;
  return {
    ...row,
    autores: row.autores ?? [],
    notaMedia: Number(row.nota_media ?? 0),
    totalAvaliacoes: Number(row.total_avaliacoes ?? 0),
    precoCents,
    precoEfetivoCents: efetivoCents,
    emPromocao,
    descontoPct: emPromocao
      ? Math.round((1 - efetivoCents / precoCents) * 100)
      : 0,
    semEstoque: row.estoque <= 0,
    // Sem capa cadastrada? Geramos uma SVG no servidor (offline, fiel à paleta).
    capa: row.capa_url || `/capa/${row.slug}.svg`,
  };
}

const presentAll = (rows) => rows.map(presentLivro);

export async function listDestaques(limit = 8) {
  const { rows } = await query(
    `${BASE_SELECT} WHERE l.ativo AND l.destaque ${GROUP_BY}
     ORDER BY l.vendidos DESC LIMIT $1`,
    [limit],
  );
  return presentAll(rows);
}

export async function listLancamentos(limit = 8) {
  const { rows } = await query(
    `${BASE_SELECT} WHERE l.ativo ${GROUP_BY}
     ORDER BY l.data_publicacao DESC NULLS LAST, l.criado_em DESC LIMIT $1`,
    [limit],
  );
  return presentAll(rows);
}

export async function listMaisVendidos(limit = 8) {
  const { rows } = await query(
    `${BASE_SELECT} WHERE l.ativo ${GROUP_BY}
     ORDER BY l.vendidos DESC LIMIT $1`,
    [limit],
  );
  return presentAll(rows);
}

export async function findBySlug(slug) {
  const { rows } = await query(
    `${BASE_SELECT} WHERE l.slug = $1 ${GROUP_BY}`,
    [slug],
  );
  const livro = presentLivro(rows[0]);
  if (!livro) return null;
  // Categorias do livro (para breadcrumb e relacionados).
  const cats = await query(
    `SELECT c.id, c.nome, c.slug FROM categorias c
     JOIN livros_categorias lc ON lc.categoria_id = c.id
     WHERE lc.livro_id = $1`,
    [livro.id],
  );
  livro.categorias = cats.rows;
  return livro;
}

/** Livros relacionados: mesma categoria, exceto o próprio. */
export async function listRelacionados(livroId, limit = 4) {
  const { rows } = await query(
    `${BASE_SELECT}
     WHERE l.ativo AND l.id <> $1 AND l.id IN (
       SELECT lc2.livro_id FROM livros_categorias lc2
       WHERE lc2.categoria_id IN (
         SELECT categoria_id FROM livros_categorias WHERE livro_id = $1
       )
     )
     ${GROUP_BY} ORDER BY l.vendidos DESC LIMIT $2`,
    [livroId, limit],
  );
  return presentAll(rows);
}

/** Avaliações de um livro, com o nome do autor da avaliação. */
export async function listAvaliacoes(livroId) {
  const { rows } = await query(
    `SELECT av.nota, av.comentario, av.criado_em, COALESCE(p.nome, 'Leitor(a)') AS autor
     FROM avaliacoes av
     LEFT JOIN perfis p ON p.usuario_id = av.usuario_id
     WHERE av.livro_id = $1
     ORDER BY av.criado_em DESC`,
    [livroId],
  );
  return rows;
}

/** O usuário já favoritou este livro? */
export async function isFavorito(usuarioId, livroId) {
  const { rows } = await query(
    'SELECT 1 FROM favoritos WHERE usuario_id = $1 AND livro_id = $2',
    [usuarioId, livroId],
  );
  return rows.length > 0;
}

/**
 * Busca/filtro/ordenação paginada (usado na Fase 2 — Catálogo).
 * opts: { termo, categoriaSlug, autorSlug, formato, precoMin, precoMax,
 *         disponivel, ordenar, pagina, porPagina }
 */
export async function search(opts = {}) {
  const {
    termo, categoriaSlug, autorSlug, formato,
    precoMin, precoMax, disponivel, ordenar = 'relevancia',
    pagina = 1, porPagina = 12,
  } = opts;

  const where = ['l.ativo'];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };

  if (termo) {
    const t = `%${termo}%`;
    where.push(`(l.titulo ILIKE ${p(t)} OR l.isbn ILIKE ${p(t)} OR EXISTS (
      SELECT 1 FROM livros_autores la2 JOIN autores a2 ON a2.id = la2.autor_id
      WHERE la2.livro_id = l.id AND a2.nome ILIKE ${p(t)}))`);
  }
  if (categoriaSlug) {
    where.push(`l.id IN (SELECT lc.livro_id FROM livros_categorias lc
      JOIN categorias c ON c.id = lc.categoria_id WHERE c.slug = ${p(categoriaSlug)})`);
  }
  if (autorSlug) {
    where.push(`l.id IN (SELECT la.livro_id FROM livros_autores la
      JOIN autores a ON a.id = la.autor_id WHERE a.slug = ${p(autorSlug)})`);
  }
  if (formato) where.push(`l.formato = ${p(formato)}`);
  if (precoMin) where.push(`COALESCE(l.preco_promocional, l.preco) >= ${p(precoMin)}`);
  if (precoMax) where.push(`COALESCE(l.preco_promocional, l.preco) <= ${p(precoMax)}`);
  if (disponivel) where.push('l.estoque > 0');

  const orderMap = {
    relevancia: 'l.destaque DESC, l.vendidos DESC',
    preco_asc: 'COALESCE(l.preco_promocional, l.preco) ASC',
    preco_desc: 'COALESCE(l.preco_promocional, l.preco) DESC',
    lancamento: 'l.data_publicacao DESC NULLS LAST',
    vendidos: 'l.vendidos DESC',
    titulo: 'l.titulo ASC',
  };
  const orderBy = orderMap[ordenar] ?? orderMap.relevancia;
  const whereSql = `WHERE ${where.join(' AND ')}`;

  // Total (sem paginação) para montar a paginação.
  const totalRes = await query(
    `SELECT COUNT(*)::int AS total FROM livros l ${whereSql}`,
    params,
  );
  const total = totalRes.rows[0].total;

  const limit = p(porPagina);
  const offset = p((Math.max(1, pagina) - 1) * porPagina);
  const { rows } = await query(
    `${BASE_SELECT} ${whereSql} ${GROUP_BY} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return {
    itens: presentAll(rows),
    total,
    pagina: Math.max(1, pagina),
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}
