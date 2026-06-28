# Prompt — E-commerce de Livros: Implementação Completa com Orquestração Multiagente

> Cole este prompt no seu Claude Code. Ele assume que há um design pronto no projeto, um container com permissões totais e uma frota de subagentes em `.claude/agents/` (planejamento, otimização, testes/erros e afins).

---

## 1. Seu papel

Você é o **tech lead / orquestrador** deste projeto. Sua função **não** é escrever todo o código sozinho — é **planejar, decompor, delegar e integrar**. Você coordena os subagentes disponíveis, distribui tarefas independentes, valida cada entrega e garante a coerência do conjunto.

Princípios:
- **Delegue de verdade.** Para cada bloco de trabalho, identifique o agente certo e passe a tarefa com contexto suficiente. Você revisa e costura; os especialistas executam.
- **Paralelize o que é independente, sequencie o que tem dependência.** Duas features que não tocam o mesmo código podem rodar em paralelo; o que depende do modelo de dados espera ele ficar pronto.
- **Aproveite o que já existe.** O design já está no projeto. Não recrie componentes nem tokens do zero — siga o que já foi definido.

Ambiente: container isolado com permissões totais (bypass). Use essa liberdade com responsabilidade (ver seção 8).

---

## 2. Fase 0 — Reconhecimento (NÃO escreva código ainda)

Antes de qualquer implementação, levante o terreno e me devolva um **relatório curto**:

- Liste a estrutura do projeto e identifique o **stack real** (framework, bundler, linguagem, gerenciador de pacotes). Não presuma — confirme lendo `package.json`, arquivos de config e o código existente.
- Leia `CLAUDE.md` (se houver) e absorva convenções, scripts e regras do projeto.
- Mapeie o **design existente**: componentes prontos, design tokens, paleta, tipografia, espaçamento e layout base. Tudo que você construir deve seguir esse design.
- Liste os **subagentes disponíveis** em `.claude/agents/` e descreva, em uma linha cada, o papel que cada um vai cumprir nesta missão.
- Verifique o que já existe de **backend / banco / autenticação** e o que falta.

Só prossiga depois de me apresentar esse reconhecimento.

---

## 3. Fase 1 — Planejamento e arquitetura

Delegue ao **agente de planejamento** (e revise o resultado):

- Definir o **modelo de dados** completo (ver seção 5 como base mínima).
- Definir o **contrato da camada de dados/API** (endpoints ou funções, payloads, autenticação).
- Definir a **árvore de rotas/páginas** e a **hierarquia de componentes**.
- Quebrar tudo em **tarefas discretas**, marcando dependências e o que pode ser paralelizado.
- Produzir um **roadmap em fases** com critérios de pronto por tarefa.

Saída esperada: uma TODO list estruturada que vai guiar o resto da execução.

---

## 4. Escopo funcional (o que construir)

### Catálogo e domínio
- Cadastro de livros com título, subtítulo, autor(es), editora, ISBN, descrição, preço, preço promocional, estoque, capa, número de páginas, idioma, formato (físico/ebook), data de publicação e categorias.
- Autores, editoras e categorias/gêneros (categorias podem ser hierárquicas).

### Vitrine / storefront público
- Home com seções: destaques, lançamentos, mais vendidos e por categoria.
- Página de detalhe do livro: capa, descrição, autor, avaliações, estoque, botão de compra e livros relacionados.
- Listagem por categoria e por autor.

### Busca, filtros e ordenação
- Busca por título/autor/ISBN.
- Filtros por categoria, autor, faixa de preço, formato e disponibilidade.
- Ordenação por relevância, preço, lançamento e mais vendidos.
- Paginação ou scroll infinito.

### Carrinho
- Adicionar/remover itens, alterar quantidade, validar estoque.
- Resumo com subtotal, frete e desconto.
- Persistência do carrinho (logado e visitante).

### Checkout e pagamento
- Fluxo de checkout: endereço → frete → pagamento → confirmação.
- Cálculo de frete por CEP (integração com Correios **ou** mock por região).
- Pagamento em **modo sandbox/mock**: PIX (QR fake), cartão (Mercado Pago/Stripe sandbox) e, opcionalmente, boleto. Deixe os pontos de integração reais claramente isolados.
- Aplicação de cupom de desconto.
- Criação do pedido e tela de confirmação.

### Contas e área do usuário
- Cadastro, login e logout.
- Perfil, endereços salvos e histórico de pedidos com status.
- Lista de desejos/favoritos.
- Avaliações e notas nos livros comprados.

### Painel administrativo
- CRUD de livros, autores, editoras e categorias.
- Gestão de estoque.
- Gestão de pedidos (mudança de status: pendente → pago → em separação → enviado → entregue/cancelado).
- Gestão de cupons.
- Dashboard com métricas (vendas, pedidos, produtos com baixo estoque).

---

## 5. Modelo de dados (base mínima)

Adapte ao stack, mas contemple ao menos:

- **livros**: id, titulo, subtitulo, slug, isbn, descricao, preco, preco_promocional, estoque, capa_url, paginas, idioma, formato, data_publicacao, editora_id, destaque.
- **autores**: id, nome, slug, bio, foto_url.
- **editoras**: id, nome.
- **categorias**: id, nome, slug, parent_id.
- **livros_autores** e **livros_categorias** (relações N:N).
- **perfis** (vinculado ao usuário do auth): nome, telefone, cpf.
- **enderecos**: cep, logradouro, numero, complemento, bairro, cidade, uf.
- **carrinhos** / **itens_carrinho**.
- **pedidos**: id, usuario_id, status, subtotal, frete, desconto, total, metodo_pagamento, endereco, criado_em.
- **itens_pedido**: pedido_id, livro_id, quantidade, preco_unitario.
- **avaliacoes**: livro_id, usuario_id, nota, comentario, criado_em.
- **cupons**: codigo, tipo (percentual/fixo), valor, validade, uso_maximo, valor_minimo.
- **favoritos**: usuario_id, livro_id.

---

## 6. Estratégia de orquestração (como usar a frota de agentes)

Mapeie estes papéis aos agentes reais que você encontrou em `.claude/agents/`:

- **Agente de planejamento** → arquitetura, modelagem, contrato de API, quebra de tarefas e ordem de dependências.
- **Agentes de execução/feature** → implementam módulos discretos (catálogo, carrinho, checkout, auth, admin). Paralelize quando não houver código compartilhado; sequencie o que depende da fundação.
- **Agente de testes/erros** → depois de cada módulo: escreve/roda testes, reproduz e corrige erros, valida build e tipos.
- **Agentes de otimização** → depois que o módulo passa nos testes: revisam performance (queries, re-renders, tamanho do bundle), acessibilidade e qualidade do código.
- **Health check pré-commit** → roda antes de **todo** commit; só commita se passar.

Ordem das fases de execução:

1. **Fundação** — modelo de dados, migrations + seed, camada de dados/API, autenticação.
2. **Catálogo** — listagem, detalhe, busca, filtros e ordenação.
3. **Carrinho + checkout** — carrinho, frete, pagamento sandbox, cupom, criação de pedido.
4. **Área do usuário** — perfil, endereços, pedidos, favoritos, avaliações.
5. **Admin** — CRUD, estoque, pedidos, cupons, dashboard.
6. **Polimento** — estados de loading/erro/vazio, responsividade, acessibilidade, SEO básico e performance.

Entre cada fase, faça um **checkpoint de integração**: garanta que os módulos conversam antes de seguir.

---

## 7. Portões de qualidade (definition of done)

**Por tarefa:**
- Build sem erros; lint e tipos limpos.
- Testes da unidade passando.
- Estados de loading, erro e vazio tratados.
- Responsivo (mobile-first).
- Sem segredos hardcoded; validação de input.
- Fiel ao design existente.

**Global (projeto pronto):**
- A aplicação sobe do zero seguindo o README.
- O seed popula um catálogo de exemplo navegável.
- O `.env.example` documenta todas as variáveis.
- O fluxo completo funciona: navegar → adicionar ao carrinho → checkout → pedido criado → pedido visível na área do usuário e no admin.
- O admin consegue gerenciar catálogo, estoque e pedidos.

---

## 8. Restrições e guardrails

- Mesmo com bypass de permissões, **restrinja as operações ao diretório do projeto**. Nada de comandos destrutivos no host.
- **Nunca** commite `.env`, chaves ou tokens. Use `.env.example`.
- Commits **pequenos e descritivos**; rode o health check antes de cada um.
- Se usar Supabase: **ative RLS** com políticas por usuário e **nunca** exponha a `service_role` no front-end.
- **Pagamento real exige credenciais minhas.** Implemente em modo sandbox/mock e deixe os pontos de integração isolados e documentados.
- Contexto **Brasil**: moeda em BRL (R$), textos em pt-BR, CEP/frete, métodos PIX/cartão/boleto.
- **Pergunte antes de qualquer ação irreversível** (apagar dados, resetar banco, sobrescrever arquivos críticos), mesmo com permissão total.

---

## 9. Protocolo de trabalho

- Mantenha uma **TODO list viva** e atualize o status conforme avança.
- Ao fim de cada fase, **reporte**: o que foi feito, o que cada agente entregou, problemas encontrados e o que falta.
- Não avance de fase com a anterior quebrada — o agente de testes valida antes da transição.

---

## 10. Entregáveis finais

- Aplicação funcional (front-end + back-end + banco).
- `README.md` com setup, scripts e variáveis de ambiente.
- Seed de dados de exemplo.
- `.env.example` completo.

---

**Comece pela Fase 0.** Faça o reconhecimento, me apresente o resumo do stack e dos agentes disponíveis, e só então parta para o planejamento.
