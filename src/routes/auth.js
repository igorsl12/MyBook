import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as Users from '../repositories/users.js';
import * as Cart from '../repositories/cart.js';
import {
  validate, required, isEmail, minLen, hasErrors,
} from '../lib/validate.js';

// Limita tentativas de login/cadastro por IP (anti força-bruta).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
});

// Funde o carrinho de visitante no do usuário ao autenticar.
async function fundirCarrinho(req, usuarioId) {
  const token = req.session.cartToken;
  if (token) {
    await Cart.mergeGuestIntoUser(token, usuarioId);
    delete req.session.cartToken;
  }
}

// Estabelece sessão autenticada com ID novo (evita session fixation),
// preservando uma eventual flash já definida.
function estabelecerSessao(req, usuario) {
  return new Promise((resolve, reject) => {
    const flash = req.session.flash;
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.usuario = usuario;
      if (flash) req.session.flash = flash;
      resolve();
    });
  });
}

export const authRouter = Router();

// Destino seguro pós-login (evita open-redirect: só caminhos internos).
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/';
}

authRouter.get('/entrar', (req, res) => {
  if (req.session.usuario) return res.redirect('/');
  res.render('auth/login', {
    titulo: 'Entrar',
    next: safeNext(req.query.next),
    erros: {},
    valores: {},
  });
});

authRouter.post('/entrar', authLimiter, asyncHandler(async (req, res) => {
  const { email, senha } = req.body;
  const next = safeNext(req.body.next);
  const usuario = await Users.verifyCredentials(email, senha);
  if (!usuario) {
    return res.status(401).render('auth/login', {
      titulo: 'Entrar',
      next,
      erros: { geral: 'E-mail ou senha incorretos.' },
      valores: { email },
    });
  }
  await fundirCarrinho(req, usuario.id);
  await estabelecerSessao(req, usuario);
  req.flash('sucesso', `Bem-vindo(a) de volta!`);
  res.redirect(usuario.papel === 'admin' ? '/admin' : next);
}));

authRouter.get('/cadastrar', (req, res) => {
  if (req.session.usuario) return res.redirect('/');
  res.render('auth/register', { titulo: 'Criar conta', erros: {}, valores: {} });
});

authRouter.post('/cadastrar', authLimiter, asyncHandler(async (req, res) => {
  const { nome, email, senha } = req.body;
  const erros = validate({
    nome: [required('Nome')],
    email: [required('E-mail'), isEmail()],
    senha: [required('Senha'), minLen(8, 'Senha')],
  }, req.body);

  if (!hasErrors(erros) && await Users.findByEmail(email)) {
    erros.email = 'Já existe uma conta com este e-mail.';
  }
  if (hasErrors(erros)) {
    return res.status(422).render('auth/register', {
      titulo: 'Criar conta', erros, valores: { nome, email },
    });
  }

  let usuario;
  try {
    usuario = await Users.create({ nome, email, senha });
  } catch (err) {
    // Corrida: outro cadastro com o mesmo e-mail entre o check e o insert.
    if (err.codigo === 'EMAIL_DUPLICADO') {
      return res.status(422).render('auth/register', {
        titulo: 'Criar conta', erros: { email: err.message }, valores: { nome, email },
      });
    }
    throw err;
  }
  await fundirCarrinho(req, usuario.id);
  await estabelecerSessao(req, { id: usuario.id, email: usuario.email, papel: usuario.papel });
  req.flash('sucesso', 'Conta criada com sucesso. Boas leituras!');
  res.redirect('/');
}));

authRouter.post('/sair', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
