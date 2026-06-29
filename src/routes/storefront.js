import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as Books from '../repositories/books.js';
import * as Categories from '../repositories/categories.js';
import { gerarCapaSVG } from '../services/cover.js';
import { query } from '../db.js';
import { env } from '../config/env.js';

// URL base canônica: prioriza SITE_URL (configurável) sobre o header Host (forjável).
const baseUrl = (req) => env.siteUrl ?? `${req.protocol}://${req.get('host')}`;

export const storefrontRouter = Router();

// Home: destaques, lançamentos, mais vendidos e categorias.
storefrontRouter.get('/', asyncHandler(async (req, res) => {
  const [destaques, lancamentos, maisVendidos, categorias] = await Promise.all([
    Books.listDestaques(8),
    Books.listLancamentos(6),
    Books.listMaisVendidos(6),
    Categories.listArvore(),
  ]);
  res.render('home', {
    titulo: 'MyBook — sua próxima leitura começa aqui',
    destaques,
    lancamentos,
    maisVendidos,
    categorias,
  });
}));

// SEO: robots.txt aponta para o sitemap.
storefrontRouter.get('/robots.txt', (req, res) => {
  const base = baseUrl(req);
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /minha-conta\nDisallow: /checkout\nDisallow: /carrinho\nSitemap: ${base}/sitemap.xml\n`);
});

// SEO: sitemap dinâmico com home, catálogo, categorias e livros ativos.
storefrontRouter.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const base = baseUrl(req);
  const [livros, categorias] = await Promise.all([
    query('SELECT slug, atualizado_em FROM livros WHERE ativo ORDER BY id'),
    query('SELECT slug FROM categorias ORDER BY id'),
  ]);
  const urls = [
    { loc: `${base}/`, prio: '1.0' },
    { loc: `${base}/catalogo`, prio: '0.8' },
    ...categorias.rows.map((c) => ({ loc: `${base}/categoria/${c.slug}`, prio: '0.6' })),
    ...livros.rows.map((l) => ({
      loc: `${base}/livro/${l.slug}`, prio: '0.7',
      lastmod: l.atualizado_em ? new Date(l.atualizado_em).toISOString().slice(0, 10) : undefined,
    })),
  ];
  // Escapa o conteúdo (o host vem do header e pode ser forjado se SITE_URL não setado).
  const esc = (s) => String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.prio}</priority></url>`).join('\n')
  }\n</urlset>`;
  res.type('application/xml').send(xml);
}));

// Capa SVG gerada no servidor (fallback quando o livro não tem capa_url).
storefrontRouter.get('/capa/:slug.svg', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT l.titulo, COALESCE(
        (SELECT a.nome FROM autores a
         JOIN livros_autores la ON la.autor_id = a.id
         WHERE la.livro_id = l.id LIMIT 1), '') AS autor
     FROM livros l WHERE l.slug = $1`,
    [req.params.slug],
  );
  const dados = rows[0] ?? { titulo: 'Livro', autor: '' };
  res.type('image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(gerarCapaSVG(dados));
}));
