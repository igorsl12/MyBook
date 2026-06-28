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
