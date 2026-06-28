import * as Categories from '../repositories/categories.js';

// Disponibiliza a árvore de categorias para o cabeçalho em TODAS as páginas,
// com cache em memória (TTL curto) para não consultar o banco a cada request.
let cache = null;
let expira = 0;
const TTL_MS = 60_000;

export async function navCategorias(req, res, next) {
  try {
    const agora = Date.now();
    if (!cache || agora > expira) {
      cache = await Categories.listArvore();
      expira = agora + TTL_MS;
    }
    res.locals.navCategorias = cache;
  } catch (err) {
    console.error('Falha ao carregar categorias do menu:', err.message);
    res.locals.navCategorias = [];
  }
  next();
}

// Permite invalidar o cache quando o admin mexe nas categorias.
export function invalidarCacheCategorias() {
  cache = null;
  expira = 0;
}
