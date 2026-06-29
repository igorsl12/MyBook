import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Criptografia simétrica de dados sensíveis em repouso (ex.: CPF), AES-256-GCM.
// Formato armazenado: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext).
// A chave vem de ENCRYPTION_KEY (hex de 64 chars usado direto, ou frase derivada
// via scrypt). NUNCA é exposta ao front-end.

const PREFIX = 'enc:v1:';

function getKey() {
  const raw = env.encryptionKey;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  // Deriva 32 bytes de uma frase arbitrária (salt fixo da aplicação).
  return crypto.scryptSync(raw, 'mybook-aes-gcm-salt', 32);
}

/** Cifra um texto. Retorna a string "enc:v1:..." ou null para entrada vazia. */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decifra um valor "enc:v1:...". Valores legados/plaintext (sem o prefixo) ou
 * adulterados retornam null — nunca expõem conteúdo não confiável.
 */
export function decrypt(value) {
  if (!value || !String(value).startsWith(PREFIX)) return null;
  try {
    const buf = Buffer.from(String(value).slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Mascara um CPF para exibição: "12345678900" → "•••.•••.789-00". */
export function maskCpf(cpf) {
  if (!cpf) return '';
  const d = String(cpf).replace(/\D/g, '');
  if (d.length < 4) return '•••';
  return `•••.•••.${d.slice(-5, -2)}-${d.slice(-2)}`;
}
