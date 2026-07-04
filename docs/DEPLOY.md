# Deploy do MyBook (grátis: Render + Neon)

Este guia sobe o MyBook **de graça** usando:

- **Render** (plano free) — roda o container Docker do app.
- **Neon** (plano free) — Postgres gerenciado e **persistente**.

> ⚠️ **Limitações do grátis** (aceitas para demo/faculdade):
> - O serviço **hiberna após 15 min** de inatividade → o primeiro acesso depois
>   disso leva ~30–60s pra responder (cold start).
> - **Não há disco persistente**: as mídias de avaliação enviadas
>   (`public/uploads/reviews`) **somem a cada redeploy ou hibernação**. O resto
>   dos dados fica no Neon e persiste normalmente.

---

## 1. Pré-requisitos

- Repositório no **GitHub** (o Render faz deploy a partir dele).
- Conta no [Render](https://render.com) e no [Neon](https://neon.tech) (login com GitHub serve).
- `psql` instalado localmente (para criar o schema uma vez). No Windows vem com o
  instalador do PostgreSQL; alternativa: usar o **SQL Editor** do próprio Neon.

---

## 2. Criar o banco no Neon

1. Em [console.neon.tech](https://console.neon.tech): **New Project**.
   - Região: escolha a mais próxima (ex.: `AWS South America (São Paulo)`).
2. Após criar, copie a **connection string** (botão *Connect*). Use a variante
   **Pooled connection** (o host contém `-pooler`), melhor para pools de conexão.
   Ela tem este formato:

   ```
   postgresql://USUARIO:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

3. Anote as 4 partes — você vai colar no Render como variáveis separadas:

   | Variável no Render | Parte da connection string          |
   |--------------------|-------------------------------------|
   | `DB_USER`          | `USUARIO`                           |
   | `DB_PASSWORD`      | `SENHA`                             |
   | `DB_HOST`          | `ep-xxxx-pooler.sa-east-1.aws.neon.tech` |
   | `DB_NAME`          | `neondb` (o que vier antes de `?`)  |

---

## 3. Criar o schema e o seed (uma vez)

Rode os SQLs de `db/init/` contra o Neon. Use a connection string **completa**
(com `?sslmode=require`), entre aspas:

```bash
psql "postgresql://USUARIO:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  -f db/init/001_schema.sql \
  -f db/init/002_seed.sql \
  -f db/init/003_mais_livros.sql
```

> Sem `psql`? Abra `db/init/001_schema.sql`, depois `002_seed.sql` e por fim
> `003_mais_livros.sql`, cole o conteúdo no **SQL Editor** do Neon e execute
> (nessa ordem).

> O `003_mais_livros.sql` é **idempotente** (`ON CONFLICT DO NOTHING`): se o banco
> já estiver no ar com os livros anteriores, rode só ele para adicionar os +30
> novos, sem recriar nada.

---

## 4. Gerar a ENCRYPTION_KEY

O app criptografa o CPF em repouso. Gere uma chave e **guarde-a** — se você
perder/trocar, os CPFs já salvos ficam ilegíveis:

```bash
openssl rand -hex 32
```

---

## 5. Deploy no Render

1. No Render: **New > Blueprint**.
2. Selecione este repositório. O Render detecta o [`render.yaml`](../render.yaml)
   e propõe criar o serviço `mybook`.
3. Ele vai pedir os valores das variáveis marcadas como secretas. Preencha:
   - `ENCRYPTION_KEY` → a chave do passo 4.
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` → do passo 2.
   - `SITE_URL` → deixe em branco por enquanto (preenche no passo 7).
   - `SESSION_SECRET` já é gerado automaticamente.
4. **Apply / Create**. O Render vai buildar a imagem Docker e subir o serviço.

O primeiro build leva alguns minutos. Acompanhe em **Logs**. Quando aparecer
`MyBook ouvindo na porta 3000 (production)` e o health check em `/health` ficar
verde, está no ar.

---

## 6. Verificar

- Acesse a URL `https://mybook-xxxx.onrender.com` que o Render mostra.
- `https://mybook-xxxx.onrender.com/health` deve responder OK.

---

## 7. (Opcional) Fixar a URL canônica

Depois que souber a URL final, defina `SITE_URL` no Render
(**Environment**) com o valor `https://mybook-xxxx.onrender.com` e salve. Isso
deixa sitemap/robots corretos e evita host header injection. O Render redeploya
sozinho.

---

## Atualizações futuras

Com `autoDeploy: true` (no `render.yaml`), todo `git push` na branch conectada
dispara um novo deploy automático. Alterações de schema precisam ser rodadas
manualmente no Neon (repita o passo 3 com os novos SQLs).

## Troubleshooting

| Sintoma | Causa provável | Solução |
|--------|----------------|---------|
| App sobe mas erro de conexão ao banco | `DB_SSL` ausente ou host errado | Confirme `DB_SSL=true` e o host **-pooler** do Neon |
| `SESSION_SECRET ... fraco em produção` | Variável não gerada | Confirme que `SESSION_SECRET` existe no Environment |
| Primeiro acesso do dia demora ~1min | Hibernação do plano free | Normal. Upgrade ou um pinger externo se incomodar |
| Imagens de avaliação sumiram | Sem disco persistente no free | Esperado. Migrar upload p/ Supabase Storage se precisar |
