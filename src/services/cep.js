// Integração ViaCEP (https://viacep.com.br) — consulta de endereço por CEP.
// Pública e gratuita (sem credenciais). Chamada feita no servidor (proxy), para
// não relaxar a CSP do front. Falha de rede degrada de forma graciosa (null).

const TIMEOUT_MS = 4000;

export function normalizarCep(cep) {
  return String(cep || '').replace(/\D/g, '');
}

/**
 * Consulta um CEP no ViaCEP. Retorna endereço normalizado ou null
 * (CEP inválido, não encontrado ou serviço indisponível).
 */
export async function buscarCep(cep) {
  const limpo = normalizarCep(cep);
  if (limpo.length !== 8) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.erro) return null; // ViaCEP sinaliza CEP inexistente assim
    return {
      cep: `${limpo.slice(0, 5)}-${limpo.slice(5)}`,
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    };
  } catch {
    // Timeout / offline / DNS — segue sem autofill.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
