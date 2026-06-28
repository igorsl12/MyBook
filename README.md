# MyBook — E-commerce de Livros

Loja de livros completa em **Node.js + Express + PostgreSQL**, renderizada no
servidor (EJS), containerizada com Docker. Contexto **Brasil**: preços em R$ (BRL),
textos em pt-BR, frete por CEP e pagamento em modo **sandbox**.

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose (v2)

## Como rodar

```bash
# 1. Crie o arquivo de variáveis de ambiente
cp .env.example .env
# edite o .env: defina DB_PASSWORD e SESSION_SECRET

# 2. Suba os containers (app + banco). O schema e o seed sobem automaticamente.
docker compose up --build
```

A loja fica disponível em **http://localhost:3000**

### Usuários de demonstração (criados pelo seed)

| Papel   | E-mail                  | Senha       |
|---------|-------------------------|-------------|
| Admin   | `admin@mybook.com.br`   | `admin123`  |
| Cliente | `leitor@mybook.com.br`  | `cliente123`|

> ⚠️ Credenciais apenas para demonstração — troque/remova em produção.

## Scripts

```bash
npm start          # produção (node src/server.js)
npm run dev        # desenvolvimento com --watch
npm test           # testes unitários (lógica pura: dinheiro, frete, cupom, slug…)
npm run db:reset   # recria o banco do zero (APAGA o volume e roda schema+seed)
```

O painel administrativo fica em **/admin** (acesse com o usuário admin do seed).
SEO básico: `robots.txt`, `sitemap.xml` dinâmico, Open Graph e JSON-LD nos livros.

## Variáveis de ambiente

Documentadas em `.env.example`. Principais:

| Variável             | Descrição                                          |
|----------------------|----------------------------------------------------|
| `PORT`               | Porta HTTP da aplicação (padrão 3000)              |
| `SESSION_SECRET`     | Segredo de assinatura da sessão (**obrigatório**)  |
| `FRETE_GRATIS_ACIMA` | Frete grátis acima deste valor em reais (padrão 150)|
| `DB_HOST`/`DB_PORT`  | Conexão Postgres (`db` no compose)                 |
| `DB_USER`/`DB_PASSWORD`/`DB_NAME` | Credenciais do banco                  |

## Estrutura

```
.
├── src/
│   ├── server.js            # bootstrap (listen + shutdown gracioso)
│   ├── app.js               # configuração do Express (view engine, sessão, rotas)
│   ├── db.js                # pool pg + query() + withTransaction()
│   ├── config/env.js        # leitura centralizada de env
│   ├── lib/                 # money (centavos/BRL), slug, validate, csrf, asyncHandler
│   ├── middleware/          # auth (guards) e locals (helpers p/ views)
│   ├── repositories/        # acesso a dados: books, authors, categories, users
│   ├── services/            # regras de domínio (cover SVG; shipping/payment a seguir)
│   ├── routes/              # storefront, auth (catálogo/carrinho/checkout/admin a seguir)
│   └── views/               # templates EJS (partials, home, auth, errors)
├── public/css/styles.css    # design system MyBook (tokens, componentes)
├── db/init/                 # 001_schema.sql + 002_seed.sql (rodam na 1ª criação)
├── Dockerfile · docker-compose.yml · .env.example
└── package.json
```

## Notas

- Credenciais sempre via `.env` — nada hardcoded. Sessões persistidas no Postgres.
- Senhas com hash `bcrypt`; CSRF em todos os formulários; cookies `httpOnly`.
- Pagamento em **sandbox/mock** — pontos de integração real ficam isolados.
- Capas de livros sem imagem são geradas como SVG no servidor (offline).
- O design segue o mockup `MyBook-loja.html` (fontes Newsreader + Hanken Grotesk;
  paleta editorial em tons quentes).
```
