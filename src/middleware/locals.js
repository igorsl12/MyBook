import { formatBRL, toCents } from '../lib/money.js';
import { statusLabel, statusCor } from '../lib/orderStatus.js';

// Expõe dados e helpers comuns a TODAS as views (layout, navbar, etc.).
export function locals(req, res, next) {
  res.locals.usuario = req.session?.usuario ?? null;
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.currentPath = req.path;
  res.locals.query = req.query ?? {};
  res.locals.formatBRL = formatBRL;
  res.locals.toCents = toCents;
  res.locals.statusLabel = statusLabel;
  res.locals.statusCor = statusCor;
  res.locals.cartCount = req.cartCount ?? 0;
  res.locals.anoAtual = new Date().getFullYear();

  // Flash messages de uso único (fila — consumida e limpa a cada render).
  res.locals.flash = req.session?.flash ?? [];
  if (req.session) delete req.session.flash;

  // Helper para as rotas enfileirarem flash antes de redirecionar.
  req.flash = (tipo, mensagem) => {
    if (!Array.isArray(req.session.flash)) req.session.flash = [];
    req.session.flash.push({ tipo, mensagem });
  };

  next();
}
