// Rótulos e cores dos status de pedido (usados em conta, admin e confirmação).
export const STATUS = {
  pendente:             { label: 'Aguardando pagamento', cor: 'aviso' },
  pago:                 { label: 'Pago',                 cor: 'sucesso' },
  separacao:            { label: 'Em separação',         cor: 'info' },
  enviado:              { label: 'Enviado',              cor: 'info' },
  entregue:             { label: 'Entregue',             cor: 'sucesso' },
  cancelado:            { label: 'Cancelado',            cor: 'erro' },
  reembolso_solicitado: { label: 'Reembolso solicitado', cor: 'aviso' },
  reembolsado:          { label: 'Reembolsado',          cor: 'erro' },
};

// Transições permitidas a partir de cada status no painel admin.
// (entregue → reembolso_solicitado é disparado pelo CLIENTE, não pelo admin.)
export const TRANSICOES = {
  pendente:             ['pago', 'cancelado'],
  pago:                 ['separacao', 'cancelado'],
  separacao:            ['enviado', 'cancelado'],
  enviado:              ['entregue'],
  entregue:             [],
  cancelado:            [],
  reembolso_solicitado: ['reembolsado', 'entregue'], // admin aprova ou nega
  reembolsado:          [],
};

export const statusLabel = (s) => (STATUS[s]?.label ?? s);
export const statusCor = (s) => (STATUS[s]?.cor ?? 'info');
