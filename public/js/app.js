// Progressive enhancement do MyBook. Substitui handlers inline (proibidos pela
// CSP) por comportamento baseado em atributos data-*. Sem dependências.
(function () {
  'use strict';

  // Auto-submete o formulário ao mudar um controle marcado com [data-autosubmit].
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-autosubmit]');
    if (el && el.form) el.form.submit();
  });

  // Confirmação antes de enviar formulários com [data-confirm="mensagem"].
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var msg = form.getAttribute && form.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Seleciona todo o texto ao clicar em campos [data-select-on-click] (copia-e-cola).
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-select-on-click]');
    if (el && el.select) el.select();
  });

  // ----- Autofill de endereço via ViaCEP -----
  // Dispara ao completar 8 dígitos (input) e ao sair do campo (blur).
  function lookupCep(input) {
    if (!input || !input.form) return;
    var cep = (input.value || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    if (input.dataset.lastCep === cep) return; // evita consulta repetida
    input.dataset.lastCep = cep;

    var form = input.form;
    var status = form.querySelector('[data-cep-status]');
    if (status) { status.textContent = 'Buscando endereço…'; status.style.color = ''; }
    input.setAttribute('aria-busy', 'true');

    fetch('/api/cep/' + cep, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (end) {
        if (!end) {
          if (status) { status.textContent = 'CEP não encontrado — preencha manualmente.'; status.style.color = 'var(--wine)'; }
          return;
        }
        setVal(form, 'logradouro', end.logradouro);
        setVal(form, 'bairro', end.bairro);
        setVal(form, 'cidade', end.cidade);
        setVal(form, 'uf', end.uf);
        if (status) { status.textContent = 'Endereço preenchido ✓'; status.style.color = 'var(--green)'; }
        var numero = form.querySelector('[name="numero"]');
        if (numero && !numero.value) numero.focus(); // pula para o número
      })
      .catch(function () {
        if (status) { status.textContent = 'Não foi possível consultar o CEP agora.'; status.style.color = 'var(--wine)'; }
        input.dataset.lastCep = ''; // permite tentar de novo
      })
      .finally(function () { input.removeAttribute('aria-busy'); });
  }

  // Sobrescreve os campos derivados do CEP (logradouro/bairro/cidade/uf são
  // determinados pelo CEP); número/complemento ficam por conta do usuário.
  function setVal(form, name, value) {
    var el = form.querySelector('[name="' + name + '"]');
    if (el && value) el.value = value;
  }

  document.addEventListener('input', function (e) {
    if (e.target.closest('[data-cep]')) lookupCep(e.target);
  });
  document.addEventListener('blur', function (e) {
    if (e.target.closest('[data-cep]')) lookupCep(e.target);
  }, true);

  // ----- Campos de cartão: visíveis só quando "Cartão" estiver marcado -----
  function syncCardFields() {
    var box = document.querySelector('[data-card-fields]');
    if (!box) return;
    var sel = document.querySelector('input[name="metodo"]:checked');
    box.hidden = !(sel && sel.value === 'cartao');
  }
  document.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'metodo') syncCardFields();
  });

  // Estado inicial (app.js é carregado com defer → DOM já parseado).
  syncCardFields();
})();
