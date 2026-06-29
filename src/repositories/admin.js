import { query, withTransaction } from '../db.js';
import { slugify } from '../lib/slug.js';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function metricas() {
  const [vendas, pedidos, estoqueBaixo, catalogo] = await Promise.all([
    query(`SELECT COALESCE(SUM(total),0) AS receita,
                  COUNT(*) FILTER (WHERE status NOT IN ('cancelado')) AS pagos
           FROM pedidos`),
    query(`SELECT status, COUNT(*)::int AS n FROM pedidos GROUP BY status`),
    query(`SELECT id, titulo, slug, estoque FROM livros WHERE ativo AND estoque <= 5
            ORDER BY estoque ASC LIMIT 10`),
    query(`SELECT COUNT(*)::int AS livros,
                  (SELECT COUNT(*)::int FROM autores) AS autores,
                  (SELECT COUNT(*)::int FROM categorias) AS categorias
           FROM livros WHERE ativo`),
  ]);
  const porStatus = Object.fromEntries(pedidos.rows.map((r) => [r.status, r.n]));
  return {
    receitaCents: Math.round(Number(vendas.rows[0].receita) * 100),
    pedidosPagos: Number(vendas.rows[0].pagos),
    porStatus,
    estoqueBaixo: estoqueBaixo.rows,
    catalogo: catalogo.rows[0],
  };
}

// ---------------------------------------------------------------------------
// Livros
// ---------------------------------------------------------------------------
export async function listLivros() {
  const { rows } = await query(
    `SELECT l.id, l.titulo, l.slug, l.preco, l.preco_promocional, l.estoque,
            l.ativo, l.destaque, e.nome AS editora
     FROM livros l LEFT JOIN editoras e ON e.id = l.editora_id
     ORDER BY l.criado_em DESC`);
  return rows;
}

export async function getLivro(id) {
  const { rows } = await query('SELECT * FROM livros WHERE id = $1', [id]);
  const livro = rows[0];
  if (!livro) return null;
  const [autores, categorias] = await Promise.all([
    query('SELECT autor_id FROM livros_autores WHERE livro_id = $1', [id]),
    query('SELECT categoria_id FROM livros_categorias WHERE livro_id = $1', [id]),
  ]);
  livro.autorIds = autores.rows.map((r) => r.autor_id);
  livro.categoriaIds = categorias.rows.map((r) => r.categoria_id);
  return livro;
}

function normalizarLivro(data) {
  const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
  return {
    titulo: data.titulo?.trim(),
    subtitulo: data.subtitulo?.trim() || null,
    isbn: data.isbn?.trim() || null,
    descricao: data.descricao?.trim() || null,
    preco: num(data.preco) ?? 0,
    preco_promocional: num(data.preco_promocional),
    estoque: parseInt(data.estoque, 10) || 0,
    capa_url: data.capa_url?.trim() || null,
    paginas: data.paginas ? parseInt(data.paginas, 10) : null,
    idioma: data.idioma?.trim() || 'Português',
    formato: data.formato === 'ebook' ? 'ebook' : 'fisico',
    data_publicacao: data.data_publicacao || null,
    editora_id: data.editora_id ? parseInt(data.editora_id, 10) : null,
    destaque: data.destaque === 'on' || data.destaque === 'true' || data.destaque === true,
    ativo: data.ativo === undefined ? true : (data.ativo === 'on' || data.ativo === 'true' || data.ativo === true),
  };
}

async function gerarSlugUnico(base, ignoreId = null) {
  let slug = slugify(base);
  let i = 1;
  // Garante unicidade do slug.
  while (true) {
    const { rows } = await query(
      'SELECT id FROM livros WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)',
      [slug, ignoreId]);
    if (rows.length === 0) return slug;
    slug = `${slugify(base)}-${++i}`;
  }
}

export async function criarLivro(data) {
  const v = normalizarLivro(data);
  const slug = await gerarSlugUnico(v.titulo);
  const autorIds = [].concat(data.autores || []).map(Number).filter(Boolean);
  const categoriaIds = [].concat(data.categorias || []).map(Number).filter(Boolean);

  return withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO livros (titulo, subtitulo, slug, isbn, descricao, preco,
        preco_promocional, estoque, capa_url, paginas, idioma, formato,
        data_publicacao, editora_id, destaque, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [v.titulo, v.subtitulo, slug, v.isbn, v.descricao, v.preco, v.preco_promocional,
       v.estoque, v.capa_url, v.paginas, v.idioma, v.formato, v.data_publicacao,
       v.editora_id, v.destaque, v.ativo]);
    const id = r.rows[0].id;
    await vincular(client, id, autorIds, categoriaIds);
    return id;
  });
}

export async function atualizarLivro(id, data) {
  const v = normalizarLivro(data);
  const slug = await gerarSlugUnico(v.titulo, id);
  const autorIds = [].concat(data.autores || []).map(Number).filter(Boolean);
  const categoriaIds = [].concat(data.categorias || []).map(Number).filter(Boolean);

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE livros SET titulo=$2, subtitulo=$3, slug=$4, isbn=$5, descricao=$6,
        preco=$7, preco_promocional=$8, estoque=$9, capa_url=$10, paginas=$11,
        idioma=$12, formato=$13, data_publicacao=$14, editora_id=$15, destaque=$16, ativo=$17
       WHERE id=$1`,
      [id, v.titulo, v.subtitulo, slug, v.isbn, v.descricao, v.preco, v.preco_promocional,
       v.estoque, v.capa_url, v.paginas, v.idioma, v.formato, v.data_publicacao,
       v.editora_id, v.destaque, v.ativo]);
    await client.query('DELETE FROM livros_autores WHERE livro_id=$1', [id]);
    await client.query('DELETE FROM livros_categorias WHERE livro_id=$1', [id]);
    await vincular(client, id, autorIds, categoriaIds);
  });
}

async function vincular(client, livroId, autorIds, categoriaIds) {
  for (const aid of autorIds) {
    await client.query(
      'INSERT INTO livros_autores (livro_id, autor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [livroId, aid]);
  }
  for (const cid of categoriaIds) {
    await client.query(
      'INSERT INTO livros_categorias (livro_id, categoria_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [livroId, cid]);
  }
}

export async function removerLivro(id) {
  await query('DELETE FROM livros WHERE id = $1', [id]);
}

export async function ajustarEstoque(id, estoque) {
  await query('UPDATE livros SET estoque = $2 WHERE id = $1', [id, Math.max(0, estoque)]);
}

// ---------------------------------------------------------------------------
// Autores / Editoras / Categorias
// ---------------------------------------------------------------------------
export async function criarAutor(d) {
  await query('INSERT INTO autores (nome, slug, bio, foto_url) VALUES ($1,$2,$3,$4)',
    [d.nome.trim(), slugify(d.nome), d.bio?.trim() || null, d.foto_url?.trim() || null]);
}
export async function atualizarAutor(id, d) {
  await query('UPDATE autores SET nome=$2, slug=$3, bio=COALESCE($4, bio), foto_url=COALESCE($5, foto_url) WHERE id=$1',
    [id, d.nome.trim(), slugify(d.nome), d.bio?.trim() || null, d.foto_url?.trim() || null]);
}
export async function removerAutor(id) { await query('DELETE FROM autores WHERE id=$1', [id]); }

export async function criarEditora(d) {
  await query('INSERT INTO editoras (nome, slug) VALUES ($1,$2)', [d.nome.trim(), slugify(d.nome)]);
}
export async function atualizarEditora(id, d) {
  await query('UPDATE editoras SET nome=$2, slug=$3 WHERE id=$1', [id, d.nome.trim(), slugify(d.nome)]);
}
export async function removerEditora(id) { await query('DELETE FROM editoras WHERE id=$1', [id]); }

export async function criarCategoria(d) {
  await query('INSERT INTO categorias (nome, slug, parent_id) VALUES ($1,$2,$3)',
    [d.nome.trim(), slugify(d.nome), d.parent_id ? parseInt(d.parent_id, 10) : null]);
}
export async function atualizarCategoria(id, d) {
  // Evita que a categoria seja pai de si mesma.
  const parent = d.parent_id ? parseInt(d.parent_id, 10) : null;
  await query('UPDATE categorias SET nome=$2, slug=$3, parent_id=$4 WHERE id=$1',
    [id, d.nome.trim(), slugify(d.nome), parent === id ? null : parent]);
}
export async function removerCategoria(id) { await query('DELETE FROM categorias WHERE id=$1', [id]); }

export async function listEditoras() {
  const { rows } = await query('SELECT * FROM editoras ORDER BY nome'); return rows;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
export async function listPedidos() {
  const { rows } = await query(
    `SELECT p.id, p.status, p.total, p.criado_em, p.metodo_pagamento,
            u.email, COALESCE(SUM(ip.quantidade),0)::int AS total_itens
     FROM pedidos p
     JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
     GROUP BY p.id, u.email ORDER BY p.criado_em DESC`);
  return rows;
}

export async function atualizarStatusPedido(id, novoStatus) {
  await query('UPDATE pedidos SET status = $2 WHERE id = $1', [id, novoStatus]);
}

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------
export async function listCupons() {
  const { rows } = await query('SELECT * FROM cupons ORDER BY id DESC'); return rows;
}
export async function criarCupom(d) {
  await query(
    `INSERT INTO cupons (codigo, tipo, valor, validade, uso_maximo, valor_minimo, ativo)
     VALUES ($1,$2,$3,$4,$5,$6,true)`,
    [d.codigo.trim().toUpperCase(), d.tipo === 'fixo' ? 'fixo' : 'percentual',
     Number(d.valor) || 0, d.validade || null,
     d.uso_maximo ? parseInt(d.uso_maximo, 10) : null, Number(d.valor_minimo) || 0]);
}
export async function alternarCupom(id) {
  await query('UPDATE cupons SET ativo = NOT ativo WHERE id = $1', [id]);
}
