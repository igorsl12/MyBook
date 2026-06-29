import crypto from 'node:crypto';

// CSRF leve baseado em token sincronizado por sessão (sem dependência externa).
// O token vive na sessão; formulários enviam num campo oculto `_csrf` e validamos
// requisições que alteram estado (POST/PUT/PATCH/DELETE).

export function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  // Disponível para as views (via res.locals em locals.js).
  req.csrfToken = () => req.session.csrfToken;

  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (mutating) {
    // Requisições multipart (uploads) têm o corpo parseado depois, pela rota
    // (multer) — então validam o CSRF lá, via tokenValido(). Não usamos o token
    // na query string (evita vazá-lo em logs de acesso).
    if (req.is('multipart/form-data')) return next();

    const sent = req.body?._csrf || req.headers['x-csrf-token'];
    if (!tokenValido(req, sent)) {
      res.status(403);
      return next(new Error('Token CSRF inválido. Recarregue a página e tente novamente.'));
    }
  }
  next();
}

// Validação em tempo constante do token enviado contra o da sessão.
// Exportada para rotas multipart validarem após o multer parsear o corpo.
export function tokenValido(req, sent) {
  const expected = req.session?.csrfToken;
  if (!sent || !expected) return false;
  const a = Buffer.from(String(sent), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
