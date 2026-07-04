# Fase 1 — Estruturação do Sistema

**Projeto:** MyBook — E-commerce de Livros · **Data:** Julho de 2026

## 1. Tecnologias utilizadas

Aplicação web com renderização no servidor (SSR).

- **Node.js 20** + **Express 4** — servidor e rotas
- **EJS** — páginas renderizadas no servidor
- **PostgreSQL 16** — banco de dados
- **Docker + Docker Compose** — containerização
- Segurança: `bcrypt` (senhas), CSRF, AES-256-GCM (CPF), `helmet`, rate-limit

## 2. Hospedagem

Sistema **containerizado com Docker** — roda em qualquer ambiente com Docker.

- **Desenvolvimento:** local em `http://localhost:3000`
- **Produção:** VPS ou nuvem, com HTTPS via proxy TLS e usuário não-root

## 3. IA — local ou API externa?

**O produto não usa IA.** Pagamento em modo sandbox e capas geradas como SVG offline.

A única IA é uma **API externa** (Claude Code / Anthropic), usada só como ferramenta de
desenvolvimento — **não há modelo local**.

## 4. Ambiente de desenvolvimento

- **IDE:** VS Code + extensão Dev Containers
- **Virtualização:** contêineres Docker (não VMs), base `node:20-bookworm`
- **Banco:** PostgreSQL 16 integrado ao contêiner (porta 5432)
- **Ferramentas:** Git, GitHub CLI, DBeaver/pgAdmin
- **Host:** Windows 10
