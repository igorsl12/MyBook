import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const BCRYPT_COST = 12; // custo de hash de senha (mais alto = mais lento p/ brute-force)

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
  const row = rows[0] ?? null;
  // CPF é armazenado cifrado; decifra apenas no servidor (nunca vai cru ao front).
  if (row) row.cpf = decrypt(row.cpf);
  return row;
}

/** Cria usuário + perfil numa transação. Devolve o usuário criado (sem hash). */
export async function create({ email, senha, nome }) {
  const senhaHash = await bcrypt.hash(senha, BCRYPT_COST);
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
  // Só sobrescreve o CPF quando um novo valor é informado (e o guarda cifrado).
  // Se vier vazio, preserva o CPF atual.
  if (cpf) {
    await query(
      'UPDATE perfis SET nome = $2, telefone = $3, cpf = $4 WHERE usuario_id = $1',
      [usuarioId, nome, telefone || null, encrypt(cpf)],
    );
  } else {
    await query(
      'UPDATE perfis SET nome = $2, telefone = $3 WHERE usuario_id = $1',
      [usuarioId, nome, telefone || null],
    );
  }
}
