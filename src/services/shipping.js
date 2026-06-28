import { env } from '../config/env.js';

// Cálculo de frete MOCK por região (a partir do CEP). Ponto de integração real
// (ex.: Correios) fica isolado aqui — basta trocar `calcularFrete`.

// Faixas de CEP por região (primeiro dígito do CEP).
// 0-1 SP · 2 RJ/ES · 3 MG · 4 BA/Nordeste-leste · 5 Nordeste · 6 Norte/NE ·
// 7 Centro-Oeste/DF · 8-9 Sul.
const TABELA = [
  { regioes: ['0', '1'], nome: 'Sudeste (SP)',          freteCents: 1490, prazo: 3 },
  { regioes: ['2', '3'], nome: 'Sudeste (RJ/ES/MG)',    freteCents: 1990, prazo: 4 },
  { regioes: ['4', '5'], nome: 'Nordeste',              freteCents: 2990, prazo: 7 },
  { regioes: ['6'],      nome: 'Norte',                 freteCents: 3990, prazo: 9 },
  { regioes: ['7'],      nome: 'Centro-Oeste',          freteCents: 2790, prazo: 6 },
  { regioes: ['8', '9'], nome: 'Sul',                   freteCents: 2290, prazo: 5 },
];

export function normalizarCep(cep) {
  return String(cep || '').replace(/\D/g, '');
}

/**
 * Calcula o frete para um CEP e subtotal (em centavos).
 * Frete grátis acima de FRETE_GRATIS_ACIMA. Retorna null se o CEP for inválido.
 */
export function calcularFrete(cep, subtotalCents = 0) {
  const limpo = normalizarCep(cep);
  if (limpo.length !== 8) return null;

  const faixa = TABELA.find((t) => t.regioes.includes(limpo[0])) ?? TABELA[2];
  const gratis = subtotalCents >= env.freteGratisAcima * 100;

  return {
    cep: `${limpo.slice(0, 5)}-${limpo.slice(5)}`,
    regiao: faixa.nome,
    freteCents: gratis ? 0 : faixa.freteCents,
    gratis,
    prazoDias: faixa.prazo,
  };
}
