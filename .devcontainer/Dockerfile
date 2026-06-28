# Dev container para trabalhar com o Claude Code em modo isolado.
# Como tudo roda dentro do container, é seguro usar o modo bypass de permissões.
FROM node:20-bookworm

ARG USERNAME=node

# Ferramentas básicas de desenvolvimento.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      sudo \
      less \
      jq \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Permite que o usuário "node" use sudo sem senha (conveniente dentro do container).
RUN echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Instala o CLI do Claude Code globalmente.
RUN npm install -g @anthropic-ai/claude-code

# Persiste histórico do bash entre rebuilds.
ENV HISTFILE=/commandhistory/.bash_history
RUN mkdir -p /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R $USERNAME:$USERNAME /commandhistory

# Cria o diretório de config do Claude com dono "node" ANTES do volume nomeado
# ser anexado. Sem isso o Docker cria o volume como root, o usuário node não
# consegue escrever, e o login não persiste (pede login toda vez).
RUN mkdir -p /home/$USERNAME/.claude \
    && chown -R $USERNAME:$USERNAME /home/$USERNAME/.claude

USER $USERNAME
WORKDIR /workspace

# Diretório padrão de config do Claude (montado como volume no devcontainer.json).
ENV CLAUDE_CONFIG_DIR=/home/$USERNAME/.claude
