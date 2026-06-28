import { query } from '../db.js';
import { toCents } from '../lib/money.js';

export async function findByCodigo(codigo) {
  const { rows } = await query(
    'SELECT * FROM cupons WHERE UPPER(codigo) = UPPER($1)', [String(codigo).trim()]);
  return rows[0] ?? null;
}

/**
 * Valida um cupom para um subtotal (centavos) e calcula o desconto.
 * Retorna { ok, motivo?, cupom?, descontoCents? }.
 */
export async function validar(codigo, subtotalCents) {
  if (!codigo) return { ok: false, motivo: 'Informe um cupom.' };
  const cupom = await findByCodigo(codigo);
  if (!cupom || !cupom.ativo) return { ok: false, motivo: 'Cupom inválido.' };

  if (cupom.validade && new Date(cupom.validade) < new Date()) {
    return { ok: false, motivo: 'Cupom expirado.' };
  }
  if (cupom.uso_maximo !== null && cupom.usos >= cupom.uso_maximo) {
    return { ok: false, motivo: 'Cupom esgotado.' };
  }
  const minimo = toCents(cupom.valor_minimo) ?? 0;
  if (subtotalCents < minimo) {
    return { ok: false, motivo: `Cupom válido para compras acima de R$ ${(minimo / 100).toFixed(2)}.` };
  }

  let descontoCents;
  if (cupom.tipo === 'percentual') {
    descontoCents = Math.round(subtotalCents * (Number(cupom.valor) / 100));
  } else {
    descontoCents = toCents(cupom.valor);
  }
  descontoCents = Math.min(descontoCents, subtotalCents); // nunca maior que o subtotal

  return { ok: true, cupom, descontoCents };
}

/** Incrementa o contador de usos (chamado dentro da transação do pedido). */
export async function registrarUso(client, cupomId) {
  await client.query('UPDATE cupons SET usos = usos + 1 WHERE id = $1', [cupomId]);
}
