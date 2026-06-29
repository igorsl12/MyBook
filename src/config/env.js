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
  // Ative SÓ quando servir atrás de HTTPS (proxy/Load Balancer com TLS). Liga
  // HSTS e upgrade-insecure-requests. Mantenha desligado para acesso via http://
  // (ex.: `docker compose up` local em http://localhost), senão o navegador
  // tenta forçar https e a página não carrega.
  forceHttps: process.env.FORCE_HTTPS === 'true',
  // Chave para criptografia de dados sensíveis em repouso (CPF). Hex de 64 chars
  // (32 bytes) ou frase longa (derivada via scrypt). Obrigatória em produção.
  encryptionKey: process.env.ENCRYPTION_KEY ?? 'dev-only-encryption-key-troque-em-producao',
  // TLS na conexão com o Postgres (managed DBs costumam exigir). DB_SSL=true.
  dbSsl: process.env.DB_SSL === 'true',
};

// Em produção, aborta se os segredos forem o default ou fracos.
if (env.isProd) {
  if (env.sessionSecret === 'dev-only-troque-em-producao' || env.sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET ausente ou fraco em produção (defina um valor aleatório com ≥ 32 caracteres no .env).');
  }
  if (env.encryptionKey.startsWith('dev-only') || env.encryptionKey.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY ausente ou fraca em produção (gere 32 bytes: openssl rand -hex 32).');
  }
}
