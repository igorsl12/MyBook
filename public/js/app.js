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

  // Autofill de endereço via ViaCEP: ao sair de um campo [data-cep], consulta
  // /api/cep e preenche os campos do mesmo formulário (logradouro/bairro/cidade/uf).
  document.addEventListener('blur', function (e) {
    var input = e.target.closest('[data-cep]');
    if (!input || !input.form) return;
    var cep = (input.value || '').replace(/\D/g, '');
    if (cep.length !== 8) return;

    var form = input.form;
    input.setAttribute('aria-busy', 'true');
    fetch('/api/cep/' + cep, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (end) {
        if (!end) return;
        fill(form, 'logradouro', end.logradouro);
        fill(form, 'bairro', end.bairro);
        fill(form, 'cidade', end.cidade);
        fill(form, 'uf', end.uf);
        var numero = form.querySelector('[name="numero"]');
        if (numero && !numero.value) numero.focus(); // leva o usuário ao próximo campo
      })
      .catch(function () { /* offline: ignora, usuário preenche à mão */ })
      .finally(function () { input.removeAttribute('aria-busy'); });
  }, true); // captura (blur não borbulha)

  function fill(form, name, value) {
    var el = form.querySelector('[name="' + name + '"]');
    if (el && value && !el.value) el.value = value;
  }
})();
