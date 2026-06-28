# syntax=docker/dockerfile:1

# ---- Estágio de dependências ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Instala apenas dependências de produção.
RUN npm install --omit=dev

# ---- Estágio de runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copia node_modules do estágio anterior e o código-fonte.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Roda como usuário não-root (a imagem node já traz o usuário "node").
USER node

EXPOSE 3000

# Healthcheck a nível de container, batendo no endpoint /health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
