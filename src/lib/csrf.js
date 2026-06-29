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
    // body (urlencoded), query (?_csrf= — usado por forms multipart cujo corpo
    // ainda não foi parseado neste ponto) ou header.
    const sent = req.body?._csrf || req.query?._csrf || req.headers['x-csrf-token'];
    if (!validoConstantTime(sent, req.session.csrfToken)) {
      res.status(403);
      return next(new Error('Token CSRF inválido. Recarregue a página e tente novamente.'));
    }
  }
  next();
}

// Comparação em tempo constante (evita timing oracle).
function validoConstantTime(sent, expected) {
  if (!sent || !expected) return false;
  const a = Buffer.from(String(sent), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
