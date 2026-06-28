import pg from 'pg';

const { Pool } = pg;

// Postgres devolve NUMERIC como string para não perder precisão. Mantemos assim
// e convertemos para centavos (inteiro) na camada de dinheiro — nunca float.

// Pool único reaproveitado por toda a aplicação.
// As credenciais vêm sempre de variáveis de ambiente (nunca hardcoded).
export const pool = new Pool({
  host: process.env.DB_HOST ?? 'db',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'livraria',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'livraria',
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Helper de consulta: `query('SELECT ... $1', [valor])` → rows.
export function query(text, params) {
  return pool.query(text, params);
}

// Executa `fn(client)` dentro de uma transação, com commit/rollback automático.
// Use para operações que precisam ser atômicas (ex.: criar pedido + baixar estoque).
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
