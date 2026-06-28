# Dev Container — Claude Code em modo bypass

Este dev container roda o Claude Code num ambiente **isolado**. Por estar contido,
é seguro usar o modo bypass de permissões (`--dangerously-skip-permissions`), em que
o Claude trabalha sem pedir confirmação a cada ação.

> Nunca use `--dangerously-skip-permissions` direto na sua máquina host.
> O isolamento do container é justamente o que torna o bypass aceitável aqui.

## Pré-requisitos

- Docker Desktop
- VS Code + extensão **Dev Containers** (`ms-vscode-remote.remote-containers`)

## Como abrir

1. Abra a pasta do projeto no VS Code.
2. `F1` → **Dev Containers: Reopen in Container**.
3. Aguarde o build (o CLI do Claude Code é instalado automaticamente).

## Usar o modo bypass

Dentro do terminal do container:

```bash
# Atalho fornecido (valida que está no container antes de liberar o bypass)
bash .devcontainer/claude-bypass.sh

# ...ou diretamente:
claude --dangerously-skip-permissions
```

No primeiro uso faça login normalmente (`claude` → fluxo de autenticação).
O login fica salvo no volume `livraria-claude-config` e persiste entre rebuilds.

## Banco de dados (Postgres integrado)

O dev container sobe um **PostgreSQL 16** junto, via `docker-compose.yml`. A partir
do workspace, o banco está disponível em:

- host: `db` · porta: `5432`
- usuário/senha/db padrão de dev: `livraria` / `livraria_dev` / `livraria`

Essas variáveis já chegam prontas no ambiente (`DB_HOST`, `DB_USER`, etc.), então a
app conecta sem configuração extra. Para testar de dentro do container:

```bash
node -e "import('./src/db.js').then(m=>m.checkConnection()).then(()=>console.log('OK')).catch(e=>{console.error(e.message);process.exit(1)})"
```

Os scripts em `db/init/` rodam na primeira criação do banco. A porta `5432` também é
exposta no host, então dá pra conectar com DBeaver/pgAdmin em `localhost:5432`.

> As senhas aqui são defaults de **desenvolvimento**. Não reaproveite em produção.

## O que está isolado

- O Claude só enxerga `/workspace` (a pasta do projeto montada no container).
- Sem acesso ao resto do seu sistema de arquivos host.
- Config e histórico ficam em volumes Docker dedicados, não na sua home real.
- O Postgres roda em container separado, acessível só pela rede interna do compose
  (e pela porta exposta no seu host).

## Limpeza

```bash
# Remove os volumes (login, histórico e dados do banco) se quiser zerar.
# Os nomes reais ganham o prefixo do projeto compose (ex.: devcontainer_pgdata).
docker volume ls | grep -E 'claude-config|bashhistory|pgdata'
docker volume rm <nome_do_volume>
```
