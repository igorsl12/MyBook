// Guards de autenticação/autorização para rotas server-rendered.

/** Exige usuário logado; senão redireciona para login preservando o destino. */
export function requireAuth(req, res, next) {
  if (req.session?.usuario) return next();
  const back = encodeURIComponent(req.originalUrl);
  return res.redirect(`/entrar?next=${back}`);
}

/** Exige usuário com papel admin. */
export function requireAdmin(req, res, next) {
  if (req.session?.usuario?.papel === 'admin') return next();
  if (!req.session?.usuario) {
    const back = encodeURIComponent(req.originalUrl);
    return res.redirect(`/entrar?next=${back}`);
  }
  return res.status(403).render('errors/403', { titulo: 'Acesso negado' });
}
