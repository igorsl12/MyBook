// Dinheiro em centavos (inteiro) para evitar erros de ponto flutuante.
// Banco guarda NUMERIC(10,2); aqui convertemos para/de centavos.

/** Converte um valor do banco (string "49.90" ou número) para centavos inteiros. */
export function toCents(value) {
  if (value === null || value === undefined || value === '') return null;
  // Trabalha sobre string para não herdar imprecisão de float.
  const n = Math.round(Number(value) * 100);
  return Number.isFinite(n) ? n : null;
}

/** Converte centavos inteiros para o formato NUMERIC do banco ("49.90"). */
export function fromCents(cents) {
  if (cents === null || cents === undefined) return null;
  return (cents / 100).toFixed(2);
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata centavos como moeda brasileira: 4990 → "R$ 49,90". */
export function formatBRL(cents) {
  if (cents === null || cents === undefined) return '';
  return BRL.format(cents / 100);
}

/** Preço efetivo (promoção quando válida e menor) a partir das colunas do livro. */
export function precoEfetivoCents(livro) {
  const base = toCents(livro.preco);
  const promo = toCents(livro.preco_promocional);
  if (promo !== null && promo > 0 && promo < base) return promo;
  return base;
}
