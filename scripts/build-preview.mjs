// Gera um snapshot ESTÁTICO das telas do MyBook em preview/, renderizando os
// mesmos templates EJS com dados de exemplo (sem precisar de Postgres/Node-runtime).
// Serve para visualizar o estado visual do projeto.
import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBRL, toCents } from '../src/lib/money.js';
import { statusLabel, statusCor, TRANSICOES } from '../src/lib/orderStatus.js';
import { presentLivro } from '../src/repositories/books.js';
import { gerarCapaSVG } from '../src/services/cover.js';
import { processarPagamento } from '../src/services/payment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'src', 'views');
const OUT = path.join(ROOT, 'preview');

// ---- Dados de exemplo (espelham o seed) ----
const A = (id, nome, slug) => ({ id, nome, slug });
const raw = (o) => ({
  capa_url: null, idioma: 'Português', formato: 'fisico', nota_media: 0,
  total_avaliacoes: 0, autores: [], destaque: false, estoque: 20, ...o,
});
const livrosRaw = [
  raw({ id: 1, titulo: 'Dom Casmurro', slug: 'dom-casmurro', isbn: '9788535910663', preco: '49.90', preco_promocional: '39.90', paginas: 256, data_publicacao: '1899-01-01', editora_nome: 'Companhia das Letras', destaque: true, autores: [A(1, 'Machado de Assis', 'machado-de-assis')], nota_media: '4.7', total_avaliacoes: 12, descricao: 'O clássico sobre ciúme, memória e a dúvida eterna: teria Capitu traído Bentinho?' }),
  raw({ id: 3, titulo: 'Sapiens', slug: 'sapiens', subtitulo: 'Uma breve história da humanidade', preco: '69.90', preco_promocional: '54.90', paginas: 464, editora_nome: 'Companhia das Letras', destaque: true, autores: [A(3, 'Yuval Noah Harari', 'yuval-noah-harari')], nota_media: '4.8', total_avaliacoes: 30, descricao: 'A trajetória da espécie humana, da Idade da Pedra à era da IA.' }),
  raw({ id: 5, titulo: 'Duna', slug: 'duna', preco: '89.90', preco_promocional: '74.90', paginas: 680, editora_nome: 'Aleph', destaque: true, autores: [A(4, 'Frank Herbert', 'frank-herbert')], nota_media: '4.9', total_avaliacoes: 21, descricao: 'O épico no planeta Arrakis: política, religião e ecologia.' }),
  raw({ id: 6, titulo: 'O Senhor dos Anéis', slug: 'o-senhor-dos-aneis-sociedade-do-anel', subtitulo: 'A Sociedade do Anel', preco: '99.90', preco_promocional: '84.90', paginas: 576, editora_nome: 'HarperCollins', destaque: true, autores: [A(5, 'J.R.R. Tolkien', 'jrr-tolkien')], nota_media: '4.9', total_avaliacoes: 40, descricao: 'O início da jornada de Frodo para destruir o Um Anel.' }),
  raw({ id: 8, titulo: 'O Programador Pragmático', slug: 'o-programador-pragmatico', subtitulo: 'Sua jornada para a maestria', preco: '119.90', preco_promocional: '99.90', paginas: 376, editora_nome: 'Sextante', destaque: true, autores: [A(6, 'Andrew Hunt', 'andrew-hunt')], nota_media: '4.6', total_avaliacoes: 8, descricao: 'Clássico sobre boas práticas de desenvolvimento de software.' }),
  raw({ id: 9, titulo: 'Código Limpo', slug: 'codigo-limpo', preco: '109.90', paginas: 424, editora_nome: 'Sextante', destaque: true, autores: [A(8, 'Robert C. Martin', 'robert-c-martin')], nota_media: '4.7', total_avaliacoes: 15, descricao: 'Como escrever código legível, sustentável e de qualidade.' }),
  raw({ id: 10, titulo: 'Torto Arado', slug: 'torto-arado', preco: '64.90', preco_promocional: '49.90', paginas: 264, editora_nome: 'Intrínseca', autores: [A(10, 'Itamar Vieira Junior', 'itamar-vieira-junior')], nota_media: '4.8', total_avaliacoes: 19, descricao: 'A vida de duas irmãs no sertão baiano. Vencedor do Jabuti.' }),
  raw({ id: 7, titulo: 'O Hobbit', slug: 'o-hobbit', preco: '54.90', estoque: 3, paginas: 336, editora_nome: 'HarperCollins', autores: [A(5, 'J.R.R. Tolkien', 'jrr-tolkien')], nota_media: '4.7', total_avaliacoes: 11, descricao: 'A aventura de Bilbo Bolseiro rumo à Montanha Solitária.' }),
];
const livros = livrosRaw.map(presentLivro);
const bySlug = Object.fromEntries(livros.map((l) => [l.slug, l]));
const categoriasArvore = [
  { id: 1, nome: 'Literatura', slug: 'literatura', filhos: [{ id: 6, nome: 'Romance', slug: 'romance' }, { id: 7, nome: 'Clássicos', slug: 'classicos' }] },
  { id: 2, nome: 'Tecnologia', slug: 'tecnologia', filhos: [{ id: 8, nome: 'Programação', slug: 'programacao' }] },
  { id: 3, nome: 'Ciências', slug: 'ciencias', filhos: [{ id: 9, nome: 'História', slug: 'historia' }] },
  { id: 4, nome: 'Ficção Científica', slug: 'ficcao-cientifica', filhos: [] },
  { id: 5, nome: 'Fantasia', slug: 'fantasia', filhos: [] },
];
const categoriasFlat = [
  { id: 1, nome: 'Literatura', slug: 'literatura', parent_id: null },
  { id: 6, nome: 'Romance', slug: 'romance', parent_id: 1 },
  { id: 8, nome: 'Programação', slug: 'programacao', parent_id: 2 },
];
const autoresFlat = [A(1, 'Machado de Assis', 'machado-de-assis'), A(4, 'Frank Herbert', 'frank-herbert'), A(5, 'J.R.R. Tolkien', 'jrr-tolkien')];
const editoras = [{ id: 1, nome: 'Companhia das Letras' }, { id: 2, nome: 'Aleph' }, { id: 5, nome: 'Sextante' }];

const itensCarrinho = [
  { livro_id: 1, slug: 'dom-casmurro', titulo: 'Dom Casmurro', capa: '/capa/dom-casmurro.svg', quantidade: 1, estoque: 20, unitCents: 3990, subtotalCents: 3990, excedeEstoque: false },
  { livro_id: 5, slug: 'duna', titulo: 'Duna', capa: '/capa/duna.svg', quantidade: 2, estoque: 20, unitCents: 7490, subtotalCents: 14980, excedeEstoque: false },
];
const pagamentoPix = processarPagamento('pix', {}, 18970);
const pedidoConf = {
  id: 1042, status: 'pago', subtotal: '189.70', frete: '0.00', desconto: '18.97', total: '170.73',
  metodo_pagamento: 'pix', pagamento_json: pagamentoPix,
  endereco_json: { logradouro: 'Av. Paulista', numero: '1000', complemento: 'Apto 51', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', cep: '01310-100' },
  itens: [{ titulo: 'Dom Casmurro', quantidade: 1, preco_unitario: '39.90' }, { titulo: 'Duna', quantidade: 2, preco_unitario: '74.90' }],
};
const pedidosLista = [
  { id: 1042, criado_em: new Date('2026-06-20'), total_itens: 3, total: '170.73', status: 'pago' },
  { id: 1031, criado_em: new Date('2026-05-12'), total_itens: 1, total: '99.90', status: 'entregue' },
];

// ---- Locals base ----
const helpers = { formatBRL, toCents, statusLabel, statusCor };
const baseGuest = { usuario: null, csrfToken: 'preview', currentPath: '/', query: {}, cartCount: 3, anoAtual: 2026, flash: [], navCategorias: categoriasArvore, ...helpers };
const usuarioCliente = { id: 2, email: 'leitor@mybook.com.br', papel: 'cliente' };
const usuarioAdmin = { id: 1, email: 'admin@mybook.com.br', papel: 'admin' };

const PAGES = [
  ['index.html', 'home.ejs', { ...baseGuest, titulo: 'MyBook', destaques: livros.slice(0, 6), lancamentos: livros.slice(2, 6), maisVendidos: livros.slice(0, 4), categorias: categoriasArvore }],
  ['catalogo.html', 'catalog/list.ejs', { ...baseGuest, currentPath: '/catalogo', titulo: 'Todos os livros', resultado: { itens: livros, total: livros.length, pagina: 1, porPagina: 12, totalPaginas: 2 }, filtros: { ordenar: 'relevancia' }, categorias: categoriasArvore, autores: autoresFlat, contexto: {} }],
  ['livro.html', 'catalog/book.ejs', { ...baseGuest, currentPath: '/livro/duna', titulo: 'Duna', livro: { ...bySlug['duna'], categorias: [{ nome: 'Ficção Científica', slug: 'ficcao-cientifica' }] }, relacionados: livros.slice(0, 4), avaliacoes: [{ autor: 'Ana Leitora', nota: 5, comentario: 'Simplesmente o melhor livro de ficção científica que já li.' }, { autor: 'Carlos M.', nota: 4, comentario: 'Denso, mas recompensador.' }], favoritado: false, podeAvaliar: false, categorias: categoriasArvore }],
  ['carrinho.html', 'cart/index.ejs', { ...baseGuest, currentPath: '/carrinho', titulo: 'Seu carrinho', itens: itensCarrinho, subtotalCents: 18970, totalItens: 3, categorias: categoriasArvore }],
  ['checkout.html', 'checkout/index.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/checkout', titulo: 'Finalizar compra', itens: itensCarrinho, subtotalCents: 18970, totalItens: 3, enderecos: [{ id: 1, logradouro: 'Av. Paulista', numero: '1000', complemento: 'Apto 51', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', cep: '01310-100', padrao: true }], cep: '01310-100', frete: { gratis: true, freteCents: 0, regiao: 'Sudeste (SP)', prazoDias: 3 }, cupom: { codigo: 'BEMVINDO10' }, descontoCents: 1897, freteCents: 0, totalCents: 17073, enderecoId: 1, metodo: 'pix', erros: {} }],
  ['pedido.html', 'checkout/confirmacao.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/pedido/1042', titulo: 'Pedido #1042', pedido: pedidoConf }],
  ['conta.html', 'account/index.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/minha-conta', titulo: 'Minha conta', perfil: { email: 'leitor@mybook.com.br', nome: 'Ana Leitora', telefone: '(11) 98888-7777', cpf: '123.456.789-00' }, pedidos: pedidosLista, totalPedidos: 2, pendentes: [{ slug: 'duna', titulo: 'Duna' }] }],
  ['conta-pedidos.html', 'account/pedidos.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/minha-conta/pedidos', titulo: 'Meus pedidos', pedidos: pedidosLista }],
  ['conta-enderecos.html', 'account/enderecos.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/minha-conta/enderecos', titulo: 'Meus endereços', enderecos: [{ id: 1, logradouro: 'Av. Paulista', numero: '1000', complemento: 'Apto 51', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', cep: '01310-100', padrao: true }], erros: {}, valores: {} }],
  ['conta-perfil.html', 'account/perfil.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/minha-conta/perfil', titulo: 'Meu perfil', perfil: { email: 'leitor@mybook.com.br', nome: 'Ana Leitora', telefone: '(11) 98888-7777', cpf: '123.456.789-00' }, erros: {} }],
  ['favoritos.html', 'account/favoritos.ejs', { ...baseGuest, usuario: usuarioCliente, currentPath: '/favoritos', titulo: 'Meus favoritos', livros: livros.slice(0, 4) }],
  ['entrar.html', 'auth/login.ejs', { ...baseGuest, currentPath: '/entrar', titulo: 'Entrar', next: '/', erros: {}, valores: {} }],
  ['cadastrar.html', 'auth/register.ejs', { ...baseGuest, currentPath: '/cadastrar', titulo: 'Criar conta', erros: {}, valores: {} }],
  // Admin
  ['admin.html', 'admin/dashboard.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin', admin: true, titulo: 'Admin · Dashboard', metricas: { receitaCents: 1284500, pedidosPagos: 47, porStatus: { pendente: 3, pago: 12, separacao: 5, enviado: 8, entregue: 18, cancelado: 1 }, estoqueBaixo: [{ id: 7, titulo: 'O Hobbit', slug: 'o-hobbit', estoque: 3 }, { id: 5, titulo: 'Duna', slug: 'duna', estoque: 0 }], catalogo: { livros: 14, autores: 10, categorias: 9 } } }],
  ['admin-livros.html', 'admin/livros.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin/livros', admin: true, titulo: 'Admin · Livros', livros: livros.map((l) => ({ id: l.id, titulo: l.titulo, slug: l.slug, preco: l.preco, preco_promocional: l.preco_promocional, estoque: l.estoque, ativo: true, destaque: l.destaque, editora: l.editora_nome })) }],
  ['admin-livro-form.html', 'admin/livro-form.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin/livros/5/editar', admin: true, titulo: 'Admin · Editar', livro: { ...livrosRaw[2], id: 5, autorIds: [4], categoriaIds: [4], ativo: true }, editoras, autores: autoresFlat, categorias: categoriasFlat, erros: {} }],
  ['admin-catalogo.html', 'admin/catalogo.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin/catalogo', admin: true, titulo: 'Admin · Catálogo', autores: autoresFlat, editoras, categorias: categoriasFlat }],
  ['admin-pedidos.html', 'admin/pedidos.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin/pedidos', admin: true, titulo: 'Admin · Pedidos', pedidos: [{ id: 1042, email: 'leitor@mybook.com.br', criado_em: new Date('2026-06-20'), total_itens: 3, metodo_pagamento: 'pix', total: '170.73', status: 'pago' }, { id: 1031, email: 'joao@x.com', criado_em: new Date('2026-05-12'), total_itens: 1, metodo_pagamento: 'cartao', total: '99.90', status: 'entregue' }] }],
  ['admin-pedido.html', 'admin/pedido.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin/pedidos/1042', admin: true, titulo: 'Admin · Pedido #1042', pedido: pedidoConf, transicoes: TRANSICOES.pago }],
  ['admin-cupons.html', 'admin/cupons.ejs', { ...baseGuest, usuario: usuarioAdmin, currentPath: '/admin/cupons', admin: true, titulo: 'Admin · Cupons', cupons: [{ id: 1, codigo: 'BEMVINDO10', tipo: 'percentual', valor: '10.00', valor_minimo: '0.00', usos: 23, uso_maximo: null, ativo: true }, { id: 2, codigo: 'LEIA20', tipo: 'fixo', valor: '20.00', valor_minimo: '100.00', usos: 5, uso_maximo: 100, ativo: true }] }],
];

// ---- Mapa de rotas → arquivos estáticos ----
function mapRoute(p) {
  const clean = p.split('?')[0].split('#')[0];
  const m = {
    '/': 'index.html', '/catalogo': 'catalogo.html', '/carrinho': 'carrinho.html',
    '/checkout': 'checkout.html', '/minha-conta': 'conta.html',
    '/minha-conta/pedidos': 'conta-pedidos.html', '/minha-conta/enderecos': 'conta-enderecos.html',
    '/minha-conta/perfil': 'conta-perfil.html', '/favoritos': 'favoritos.html',
    '/entrar': 'entrar.html', '/cadastrar': 'cadastrar.html', '/admin': 'admin.html',
    '/admin/livros': 'admin-livros.html', '/admin/livros/novo': 'admin-livro-form.html',
    '/admin/catalogo': 'admin-catalogo.html', '/admin/pedidos': 'admin-pedidos.html',
    '/admin/cupons': 'admin-cupons.html',
  };
  if (m[clean]) return m[clean];
  if (clean.startsWith('/livro/')) return 'livro.html';
  if (clean.startsWith('/categoria/') || clean.startsWith('/autor/') || clean.startsWith('/buscar')) return 'catalogo.html';
  if (clean.startsWith('/pedido/')) return 'pedido.html';
  if (clean.startsWith('/admin/livros/')) return 'admin-livro-form.html';
  if (clean.startsWith('/admin/pedidos/')) return 'admin-pedido.html';
  return null;
}

function reescrever(html) {
  // Assets estáticos e capas geradas.
  html = html.replaceAll('/static/', 'static/');
  html = html.replace(/(["'(])\/capa\//g, '$1capa/');
  // Links de navegação (href/action) absolutos → arquivos do preview.
  html = html.replace(/\b(href|action)="(\/[^"]*)"/g, (full, attr, p) => {
    if (p.startsWith('/static') || p.startsWith('/capa')) return full;
    const dest = mapRoute(p);
    return dest ? `${attr}="${dest}"` : `${attr}="#"`;
  });
  return html;
}

// ---- Build ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'static'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'capa'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), path.join(OUT, 'static'), { recursive: true });

// Capas SVG de todos os livros usados.
for (const l of livrosRaw) {
  const svg = gerarCapaSVG({ titulo: l.titulo, autor: l.autores[0]?.nome || '' });
  fs.writeFileSync(path.join(OUT, 'capa', `${l.slug}.svg`), svg);
}

let count = 0;
for (const [file, tpl, locals] of PAGES) {
  const html = await ejs.renderFile(path.join(VIEWS, tpl), locals, {});
  fs.writeFileSync(path.join(OUT, file), reescrever(html));
  count++;
}

// Banner de aviso (snapshot estático) injetado no topo de cada página.
const banner = '<div style="background:#8a2c2c;color:#fff;text-align:center;padding:.5rem;font:14px system-ui;position:sticky;top:0;z-index:999">📸 Preview ESTÁTICO do MyBook — navegação entre telas funciona; formulários/POST não (precisa do app Node+Postgres rodando).</div>';
for (const [file] of PAGES) {
  const p = path.join(OUT, file);
  let h = fs.readFileSync(p, 'utf8');
  h = h.replace(/(<body[^>]*>)/i, `$1${banner}`);
  fs.writeFileSync(p, h);
}

console.log(`Preview gerado: ${count} páginas em preview/`);
