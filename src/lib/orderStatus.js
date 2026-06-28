// Rótulos e cores dos status de pedido (usados em conta, admin e confirmação).
export const STATUS = {
  pendente:  { label: 'Aguardando pagamento', cor: 'aviso' },
  pago:      { label: 'Pago',                 cor: 'sucesso' },
  separacao: { label: 'Em separação',         cor: 'info' },
  enviado:   { label: 'Enviado',              cor: 'info' },
  entregue:  { label: 'Entregue',             cor: 'sucesso' },
  cancelado: { label: 'Cancelado',            cor: 'erro' },
};

// Transições permitidas a partir de cada status (usado no admin).
export const TRANSICOES = {
  pendente:  ['pago', 'cancelado'],
  pago:      ['separacao', 'cancelado'],
  separacao: ['enviado', 'cancelado'],
  enviado:   ['entregue'],
  entregue:  [],
  cancelado: [],
};

export const statusLabel = (s) => (STATUS[s]?.label ?? s);
export const statusCor = (s) => (STATUS[s]?.cor ?? 'info');
