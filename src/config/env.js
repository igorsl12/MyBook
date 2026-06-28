// Leitura centralizada de variáveis de ambiente, com defaults seguros para dev.
// Segredos NUNCA têm default de produção — apenas avisos.

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-troque-em-producao',
  // Frete grátis acima deste valor (em reais).
  freteGratisAcima: Number(process.env.FRETE_GRATIS_ACIMA ?? 150),
  // URL pública canônica (evita host header injection em sitemap/robots). Opcional.
  siteUrl: process.env.SITE_URL || null,
};

if (env.isProd && env.sessionSecret === 'dev-only-troque-em-producao') {
  console.warn('[AVISO] SESSION_SECRET não definido em produção — defina no .env!');
}
