import { createApp } from './app.js';
import { pool } from './db.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`MyBook ouvindo na porta ${env.port} (${env.nodeEnv})`);
});

// Encerramento gracioso: fecha o servidor HTTP e o pool do Postgres.
function shutdown(signal) {
  console.log(`Recebido ${signal}, encerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
