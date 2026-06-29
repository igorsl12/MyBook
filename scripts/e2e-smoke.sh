#!/usr/bin/env bash
# Smoke test end-to-end via HTTP: navegar → cadastrar → carrinho → checkout →
# pedido → conta → admin. Valida o fluxo real (rotas, sessão, CSRF, DB).
# Uso: BASE=http://localhost:3000 bash scripts/e2e-smoke.sh
set -u
BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp)"; AJAR="$(mktemp)"
EMAIL="e2e_$(date +%s)@mybook.test"
pass=0; fail=0
ok(){ echo "  ✓ $1"; pass=$((pass+1)); }
no(){ echo "  ✗ $1"; fail=$((fail+1)); }
csrf(){ grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//'; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== 1. Vitrine pública =="
[ "$(code "$BASE/")" = 200 ] && ok "home 200" || no "home"
curl -s "$BASE/" | grep -q 'My<b>Book</b>' && ok "home tem marca MyBook" || no "marca"
curl -s "$BASE/health" | grep -q '"healthy"' && ok "/health healthy" || no "health"
[ "$(code "$BASE/catalogo")" = 200 ] && ok "catálogo 200" || no "catálogo"
[ "$(code "$BASE/livro/dom-casmurro")" = 200 ] && ok "detalhe do livro 200" || no "detalhe"
[ "$(code "$BASE/buscar?q=duna")" = 200 ] && ok "busca 200" || no "busca"
[ "$(code "$BASE/sitemap.xml")" = 200 ] && ok "sitemap.xml 200" || no "sitemap"

echo "== 2. Cadastro (cria sessão logada) =="
TOK=$(curl -s -c "$JAR" "$BASE/cadastrar" | csrf)
RC=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' \
  --data-urlencode "_csrf=$TOK" --data-urlencode "nome=E2E Teste" \
  --data-urlencode "email=$EMAIL" --data-urlencode "senha=senha12345" \
  "$BASE/cadastrar")
[ "$RC" = 302 ] && ok "cadastro redireciona (logado)" || no "cadastro ($RC)"

echo "== 3. Carrinho =="
TOK=$(curl -s -b "$JAR" -c "$JAR" "$BASE/livro/dom-casmurro" | csrf)
LIVRO_ID=$(curl -s -b "$JAR" "$BASE/livro/dom-casmurro" | grep -o 'name="livro_id" value="[0-9]*"' | head -1 | grep -o '[0-9]*')
RC=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' \
  --data-urlencode "_csrf=$TOK" --data-urlencode "livro_id=$LIVRO_ID" --data-urlencode "quantidade=2" \
  "$BASE/carrinho/adicionar")
[ "$RC" = 302 ] && ok "adicionar ao carrinho" || no "adicionar ($RC)"
curl -s -b "$JAR" "$BASE/carrinho" | grep -q 'Dom Casmurro' && ok "carrinho mostra o livro" || no "carrinho conteúdo"

echo "== 4. Checkout (frete derivado do endereço) =="
TOK=$(curl -s -b "$JAR" -c "$JAR" "$BASE/checkout" | csrf)
# Cadastra o endereço (vira o endereço de entrega; frete é calculado a partir dele)
curl -s -b "$JAR" -c "$JAR" -o /dev/null \
  --data-urlencode "_csrf=$TOK" --data-urlencode "cep=01310-100" --data-urlencode "logradouro=Av. Paulista" \
  --data-urlencode "numero=1000" --data-urlencode "bairro=Bela Vista" --data-urlencode "cidade=São Paulo" \
  --data-urlencode "uf=SP" "$BASE/checkout/endereco"
# confere que o frete apareceu no checkout
curl -s -b "$JAR" "$BASE/checkout" | grep -qiE 'frete grátis|R\$' && ok "frete calculado do endereço" || no "frete do endereço"
LOC=$(curl -s -b "$JAR" -c "$JAR" -D - -o /dev/null \
  --data-urlencode "_csrf=$TOK" --data-urlencode "metodo=cartao" \
  --data-urlencode "cartao_numero=4111111111111111" --data-urlencode "cartao_validade=12/30" --data-urlencode "cartao_cvv=123" \
  "$BASE/checkout/finalizar" | grep -i '^location:' | tr -d '\r' | awk '{print $2}')
echo "    → redirect: $LOC"
case "$LOC" in
  */pedido/*) ok "pedido criado ($LOC)"; PEDIDO="$LOC" ;;
  *) no "finalizar pedido (redirect: $LOC)"; PEDIDO="" ;;
esac

echo "== 5. Conta do usuário =="
[ -n "$PEDIDO" ] && curl -s -b "$JAR" "$BASE$PEDIDO" | grep -q 'confirmado' && ok "confirmação do pedido" || no "confirmação"
curl -s -b "$JAR" "$BASE/minha-conta/pedidos" | grep -q 'Pago\|Aguardando' && ok "pedido no histórico da conta" || no "histórico"

echo "== 6. Admin =="
TOK=$(curl -s -c "$AJAR" "$BASE/entrar" | csrf)
curl -s -b "$AJAR" -c "$AJAR" -o /dev/null \
  --data-urlencode "_csrf=$TOK" --data-urlencode "email=admin@mybook.com.br" --data-urlencode "senha=admin123" \
  "$BASE/entrar"
[ "$(code -b "$AJAR" "$BASE/admin")" = 200 ] && ok "admin dashboard 200" || no "admin dashboard"
curl -s -b "$AJAR" "$BASE/admin/pedidos" | grep -q "$EMAIL" && ok "pedido visível no admin" || no "pedido no admin"

echo ""
echo "== RESULTADO: $pass ok, $fail falhas =="
rm -f "$JAR" "$AJAR"
exit $fail
