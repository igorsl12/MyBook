import crypto from 'node:crypto';

// ============================================================================
// PAGAMENTO — MODO SANDBOX / MOCK
// ----------------------------------------------------------------------------
// Tudo aqui é simulado. NENHUMA chamada a gateway real é feita. Os pontos de
// integração real (Mercado Pago / Stripe / PIX do banco) estão claramente
// isolados nas funções marcadas com [INTEGRAÇÃO REAL]. Para produção, troque o
// corpo dessas funções pelas chamadas ao SDK do provedor, usando credenciais
// vindas SOMENTE de variáveis de ambiente.
// ============================================================================

export const METODOS = ['pix', 'cartao', 'boleto'];

export function metodoValido(m) {
  return METODOS.includes(m);
}

/**
 * "Processa" um pagamento sandbox e devolve os dados que a confirmação exibe.
 * @param {('pix'|'cartao'|'boleto')} metodo
 * @param {object} dados  Dados do formulário (não persistimos cartão real).
 * @param {number} totalCents
 */
export function processarPagamento(metodo, dados, totalCents) {
  switch (metodo) {
    case 'pix':
      return gerarPix(totalCents);
    case 'boleto':
      return gerarBoleto(totalCents);
    case 'cartao':
      return autorizarCartao(dados, totalCents);
    default:
      throw new Error('Método de pagamento inválido.');
  }
}

// [INTEGRAÇÃO REAL: PIX] — substituir por criação de cobrança PIX no provedor.
function gerarPix(totalCents) {
  const txid = crypto.randomBytes(12).toString('hex');
  // "copia e cola" fake só para demonstração visual.
  const payload = `00020126BR.GOV.BCB.PIX${txid}5204000053039865802BR6009MYBOOK${totalCents}`;
  return {
    metodo: 'pix',
    status: 'pendente',          // PIX em sandbox fica "aguardando pagamento"
    sandbox: true,
    txid,
    copiaECola: payload,
    // QR como SVG inline fake (não é um QR real — apenas ilustrativo).
    qrSvg: gerarQrFake(txid),
    instrucao: 'Abra o app do seu banco e pague via PIX (simulado).',
  };
}

// [INTEGRAÇÃO REAL: BOLETO] — substituir por emissão de boleto no provedor.
function gerarBoleto(totalCents) {
  const venc = new Date();
  venc.setDate(venc.getDate() + 3);
  const linha = Array.from({ length: 5 }, () =>
    String(crypto.randomInt(10000, 99999))).join('.');
  return {
    metodo: 'boleto',
    status: 'pendente',
    sandbox: true,
    linhaDigitavel: `${linha} ${totalCents}`,
    vencimento: venc.toISOString().slice(0, 10),
    instrucao: 'Pague o boleto até o vencimento (simulado).',
  };
}

// [INTEGRAÇÃO REAL: CARTÃO] — substituir por tokenização + cobrança no provedor.
function autorizarCartao(dados, _totalCents) {
  // NUNCA persistimos PAN/CVV. Em sandbox, "aprovamos" e guardamos só os 4 últimos.
  const numero = String(dados?.cartao_numero || '').replace(/\D/g, '');
  const ultimos4 = numero.slice(-4) || '0000';
  return {
    metodo: 'cartao',
    status: 'pago',              // cartão em sandbox aprova na hora
    sandbox: true,
    bandeira: detectarBandeira(numero),
    ultimos4,
    autorizacao: crypto.randomBytes(6).toString('hex').toUpperCase(),
    instrucao: 'Pagamento aprovado (simulado).',
  };
}

function detectarBandeira(numero) {
  if (/^4/.test(numero)) return 'Visa';
  if (/^5[1-5]/.test(numero)) return 'Mastercard';
  if (/^3[47]/.test(numero)) return 'Amex';
  return 'Cartão';
}

function gerarQrFake(seed) {
  // Grade 21x21 pseudo-aleatória a partir do seed — apenas estética de QR.
  let h = 0;
  const rng = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const n = 21, cell = 8, size = n * cell;
  let rects = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      if (finder ? ((x % 6 === 0) || (y % 6 === 0) || (x > 1 && x < 5 && y > 1 && y < 5)) : rng() > 0.5) {
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#211e1a">${rects}</g></svg>`;
}

/** Status inicial do pedido conforme o método (cartão aprova; pix/boleto pendentes). */
export function statusInicial(pagamento) {
  return pagamento.status === 'pago' ? 'pago' : 'pendente';
}
