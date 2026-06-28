import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';

export async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [
    String(email).toLowerCase().trim(),
  ]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.papel, p.nome, p.telefone, p.cpf
     FROM usuarios u LEFT JOIN perfis p ON p.usuario_id = u.id
     WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Cria usuário + perfil numa transação. Devolve o usuário criado (sem hash). */
export async function create({ email, senha, nome }) {
  const senhaHash = await bcrypt.hash(senha, 10);
  try {
    return await withTransaction(async (client) => {
      const u = await client.query(
        `INSERT INTO usuarios (email, senha_hash, papel)
         VALUES ($1, $2, 'cliente') RETURNING id, email, papel`,
        [email.toLowerCase().trim(), senhaHash],
      );
      const usuario = u.rows[0];
      await client.query(
        'INSERT INTO perfis (usuario_id, nome) VALUES ($1, $2)',
        [usuario.id, nome],
      );
      return usuario;
    });
  } catch (err) {
    // Violação de UNIQUE (e-mail já cadastrado) por corrida entre check e insert.
    if (err.code === '23505') {
      const e = new Error('Já existe uma conta com este e-mail.');
      e.codigo = 'EMAIL_DUPLICADO';
      throw e;
    }
    throw err;
  }
}

/** Confere a senha de um usuário. Devolve o usuário (sem hash) ou null. */
export async function verifyCredentials(email, senha) {
  const usuario = await findByEmail(email);
  if (!usuario) return null;
  const ok = await bcrypt.compare(senha, usuario.senha_hash);
  if (!ok) return null;
  return { id: usuario.id, email: usuario.email, papel: usuario.papel };
}

export async function updateProfile(usuarioId, { nome, telefone, cpf }) {
  await query(
    `UPDATE perfis SET nome = $2, telefone = $3, cpf = $4 WHERE usuario_id = $1`,
    [usuarioId, nome, telefone || null, cpf || null],
  );
}
