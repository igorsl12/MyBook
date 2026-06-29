// Validadores leves (sem dependência externa). Cada função devolve string de
// erro ou null. `validate(rules, data)` agrega erros num objeto { campo: msg }.

export function validate(rules, data) {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const msg = check(data[field], data);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return errors;
}

export const required = (label = 'Campo') => (v) =>
  v === undefined || v === null || String(v).trim() === ''
    ? `${label} é obrigatório.`
    : null;

export const isEmail = () => (v) =>
  v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))
    ? 'E-mail inválido.'
    : null;

export const minLen = (n, label = 'Campo') => (v) =>
  v && String(v).length < n
    ? `${label} deve ter ao menos ${n} caracteres.`
    : null;

export const isCEP = () => (v) =>
  v && !/^\d{5}-?\d{3}$/.test(String(v).trim())
    ? 'CEP inválido (use 00000-000).'
    : null;

export const isUF = () => (v) =>
  v && !/^[A-Za-z]{2}$/.test(String(v).trim())
    ? 'UF inválida.'
    : null;

// Validação de CPF com dígitos verificadores (rejeita sequências repetidas).
function cpfValido(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(d[i], 10) * (10 - i);
  let r = (soma * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(d[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(d[i], 10) * (11 - i);
  r = (soma * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(d[10], 10);
}

export const isCPF = () => (v) =>
  v && !cpfValido(v) ? 'CPF inválido.' : null;

export const isInt = (label = 'Valor') => (v) =>
  v !== '' && v !== undefined && !Number.isInteger(Number(v))
    ? `${label} deve ser um número inteiro.`
    : null;

export const min = (n, label = 'Valor') => (v) =>
  v !== '' && v !== undefined && Number(v) < n
    ? `${label} deve ser ≥ ${n}.`
    : null;

/** Há algum erro no objeto retornado por validate()? */
export const hasErrors = (errors) => Object.keys(errors).length > 0;
