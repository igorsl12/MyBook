import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';

import { pool, checkConnection } from './db.js';
import { env } from './config/env.js';
import { csrf } from './lib/csrf.js';
import { locals } from './middleware/locals.js';
import { cartCount } from './middleware/cart.js';
import { navCategorias } from './middleware/categories.js';
import { apiRouter } from './routes/api.js';
import { storefrontRouter } from './routes/storefront.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { cartRouter } from './routes/cart.js';
import { checkoutRouter } from './routes/checkout.js';
import { accountRouter } from './routes/account.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Cabeçalhos de segurança (CSP compatível com Google Fonts e SVG/JSON-LD inline).
  // Em produção (HTTPS real) forçamos upgrade-insecure-requests e HSTS; em dev
  // (HTTP via porta encaminhada) eles são desligados para o navegador não tentar
  // trocar http→https e falhar.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // JSON-LD é <script type="application/ld+json"> (dados, não exec)
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        // null remove a diretiva padrão do helmet quando não estamos em produção.
        ...(env.isProd ? {} : { upgradeInsecureRequests: null }),
      },
    },
    hsts: env.isProd,
  }));

  // View engine (EJS) + diretório de views.
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Estáticos (CSS/JS/imagens).
  app.use('/static', express.static(path.join(__dirname, '..', 'public'), {
    maxAge: env.isProd ? '7d' : 0,
  }));

  // Parsers.
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Sessão persistida no Postgres.
  const PgStore = connectPgSimple(session);
  app.use(session({
    store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
    name: 'mybook.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    },
  }));

  // CSRF + contagem de carrinho + locals comuns às views.
  app.use(csrf);
  app.use(cartCount);
  app.use(locals);
  app.use(navCategorias);

  // Healthcheck (mantido p/ Docker/orquestrador).
  app.get('/health', async (_req, res) => {
    try {
      await checkConnection();
      res.json({ status: 'healthy', database: 'connected' });
    } catch (err) {
      console.error('Healthcheck falhou:', err.message);
      res.status(503).json({ status: 'unhealthy', database: 'unreachable' });
    }
  });

  // Rotas da aplicação.
  app.use('/', apiRouter);
  app.use('/', storefrontRouter);
  app.use('/', authRouter);
  app.use('/', catalogRouter);
  app.use('/', cartRouter);
  app.use('/', checkoutRouter);
  app.use('/', accountRouter);
  app.use('/', adminRouter);

  // 404.
  app.use((req, res) => {
    res.status(404).render('errors/404', { titulo: 'Página não encontrada' });
  });

  // Error handler central.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = res.statusCode >= 400 ? res.statusCode : 500;
    if (status >= 500) console.error('Erro não tratado:', err);
    res.status(status).render('errors/500', {
      titulo: 'Algo deu errado',
      mensagem: status < 500 ? err.message : 'Erro interno do servidor.',
    });
  });

  return app;
}
