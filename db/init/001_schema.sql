-- ============================================================================
-- MyBook — Esquema completo da Livraria (PostgreSQL 16)
-- Roda automaticamente na PRIMEIRA criação do banco (volume pgdata vazio),
-- na ordem alfabética dos arquivos em db/init/.
-- ============================================================================

-- Função utilitária: mantém `atualizado_em` em dia em qualquer tabela.
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Autenticação e usuários
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  papel       VARCHAR(20)  NOT NULL DEFAULT 'cliente'
                CHECK (papel IN ('cliente', 'admin')),
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Perfil 1:1 vinculado ao usuário do auth.
CREATE TABLE perfis (
  usuario_id  INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        VARCHAR(160) NOT NULL,
  telefone    VARCHAR(20),
  cpf         TEXT          -- armazenado CIFRADO (AES-256-GCM), nunca em texto puro
);

CREATE TABLE enderecos (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cep          VARCHAR(9)   NOT NULL,
  logradouro   VARCHAR(255) NOT NULL,
  numero       VARCHAR(20)  NOT NULL,
  complemento  VARCHAR(120),
  bairro       VARCHAR(120) NOT NULL,
  cidade       VARCHAR(120) NOT NULL,
  uf           CHAR(2)      NOT NULL,
  padrao       BOOLEAN      NOT NULL DEFAULT false,
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_enderecos_usuario ON enderecos(usuario_id);

-- ---------------------------------------------------------------------------
-- Catálogo: editoras, autores, categorias, livros
-- ---------------------------------------------------------------------------
CREATE TABLE editoras (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(160) NOT NULL UNIQUE,
  slug  VARCHAR(180) NOT NULL UNIQUE
);

CREATE TABLE autores (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(160) NOT NULL,
  slug      VARCHAR(180) NOT NULL UNIQUE,
  bio       TEXT,
  foto_url  VARCHAR(500)
);

CREATE TABLE categorias (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  slug       VARCHAR(140) NOT NULL UNIQUE,
  parent_id  INTEGER REFERENCES categorias(id) ON DELETE SET NULL
);
CREATE INDEX idx_categorias_parent ON categorias(parent_id);

CREATE TABLE livros (
  id                 SERIAL PRIMARY KEY,
  titulo             VARCHAR(255) NOT NULL,
  subtitulo          VARCHAR(255),
  slug               VARCHAR(280) NOT NULL UNIQUE,
  isbn               VARCHAR(20)  UNIQUE,
  descricao          TEXT,
  preco              NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  preco_promocional  NUMERIC(10,2) CHECK (preco_promocional >= 0),
  estoque            INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  capa_url           VARCHAR(500),
  paginas            INTEGER CHECK (paginas >= 0),
  idioma             VARCHAR(40)  NOT NULL DEFAULT 'Português',
  formato            VARCHAR(10)  NOT NULL DEFAULT 'fisico'
                       CHECK (formato IN ('fisico', 'ebook')),
  data_publicacao    DATE,
  editora_id         INTEGER REFERENCES editoras(id) ON DELETE SET NULL,
  destaque           BOOLEAN NOT NULL DEFAULT false,
  vendidos           INTEGER NOT NULL DEFAULT 0 CHECK (vendidos >= 0),
  ativo              BOOLEAN NOT NULL DEFAULT true,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_livros_editora  ON livros(editora_id);
CREATE INDEX idx_livros_destaque ON livros(destaque) WHERE destaque;
CREATE INDEX idx_livros_ativo    ON livros(ativo);
-- Busca textual simples por título/subtítulo (acento-insensível via unaccent não
-- é assumido; usamos ILIKE nas queries). Índice trigram acelera ILIKE:
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_livros_titulo_trgm ON livros USING gin (titulo gin_trgm_ops);

CREATE TRIGGER trg_livros_atualizado
  BEFORE UPDATE ON livros
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Relações N:N
CREATE TABLE livros_autores (
  livro_id  INTEGER NOT NULL REFERENCES livros(id)  ON DELETE CASCADE,
  autor_id  INTEGER NOT NULL REFERENCES autores(id) ON DELETE CASCADE,
  PRIMARY KEY (livro_id, autor_id)
);
CREATE INDEX idx_livros_autores_autor ON livros_autores(autor_id);

CREATE TABLE livros_categorias (
  livro_id      INTEGER NOT NULL REFERENCES livros(id)     ON DELETE CASCADE,
  categoria_id  INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  PRIMARY KEY (livro_id, categoria_id)
);
CREATE INDEX idx_livros_categorias_cat ON livros_categorias(categoria_id);

-- ---------------------------------------------------------------------------
-- Carrinho (logado e visitante)
-- ---------------------------------------------------------------------------
CREATE TABLE carrinhos (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  token          VARCHAR(64) UNIQUE,            -- carrinho de visitante (cookie)
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (usuario_id IS NOT NULL OR token IS NOT NULL)
);
CREATE UNIQUE INDEX idx_carrinhos_usuario ON carrinhos(usuario_id)
  WHERE usuario_id IS NOT NULL;

CREATE TRIGGER trg_carrinhos_atualizado
  BEFORE UPDATE ON carrinhos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TABLE itens_carrinho (
  id           SERIAL PRIMARY KEY,
  carrinho_id  INTEGER NOT NULL REFERENCES carrinhos(id) ON DELETE CASCADE,
  livro_id     INTEGER NOT NULL REFERENCES livros(id)    ON DELETE CASCADE,
  quantidade   INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  UNIQUE (carrinho_id, livro_id)
);

-- ---------------------------------------------------------------------------
-- Cupons
-- ---------------------------------------------------------------------------
CREATE TABLE cupons (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(40) NOT NULL UNIQUE,
  tipo          VARCHAR(12) NOT NULL CHECK (tipo IN ('percentual', 'fixo')),
  valor         NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  validade      DATE,
  uso_maximo    INTEGER CHECK (uso_maximo >= 0),
  usos          INTEGER NOT NULL DEFAULT 0 CHECK (usos >= 0),
  valor_minimo  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_minimo >= 0),
  ativo         BOOLEAN NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
CREATE TABLE pedidos (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  status            VARCHAR(24) NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','pago','separacao',
                                        'enviado','entregue','cancelado',
                                        'reembolso_solicitado','reembolsado')),
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  frete             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (frete >= 0),
  desconto          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  metodo_pagamento  VARCHAR(20) NOT NULL
                      CHECK (metodo_pagamento IN ('pix','cartao','boleto')),
  cupom_id          INTEGER REFERENCES cupons(id) ON DELETE SET NULL,
  endereco_json     JSONB NOT NULL,             -- snapshot do endereço no momento
  pagamento_json    JSONB,                      -- dados sandbox (qr/boleto/auth)
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_status  ON pedidos(status);

CREATE TRIGGER trg_pedidos_atualizado
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TABLE itens_pedido (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  livro_id        INTEGER REFERENCES livros(id) ON DELETE SET NULL,
  titulo          VARCHAR(255) NOT NULL,        -- snapshot p/ histórico íntegro
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario  NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0)
);
CREATE INDEX idx_itens_pedido_pedido ON itens_pedido(pedido_id);

-- ---------------------------------------------------------------------------
-- Avaliações e favoritos
-- ---------------------------------------------------------------------------
-- Avaliação vinculada ao PEDIDO: o cliente avalia o item daquele pedido
-- específico (uma avaliação por livro por pedido).
CREATE TABLE avaliacoes (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER NOT NULL REFERENCES pedidos(id)  ON DELETE CASCADE,
  livro_id    INTEGER NOT NULL REFERENCES livros(id)   ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota        INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, livro_id)
);
CREATE INDEX idx_avaliacoes_livro  ON avaliacoes(livro_id);
CREATE INDEX idx_avaliacoes_pedido ON avaliacoes(pedido_id);

-- Mídias (fotos/vídeos) anexadas a uma avaliação.
CREATE TABLE avaliacao_midias (
  id           SERIAL PRIMARY KEY,
  avaliacao_id INTEGER NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  tipo         VARCHAR(8) NOT NULL CHECK (tipo IN ('foto', 'video')),
  url          VARCHAR(500) NOT NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_avaliacao_midias_avaliacao ON avaliacao_midias(avaliacao_id);

CREATE TABLE favoritos (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  livro_id    INTEGER NOT NULL REFERENCES livros(id)   ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, livro_id)
);

-- ---------------------------------------------------------------------------
-- Sessões (connect-pg-simple). Mantida aqui para subir junto do schema.
-- ---------------------------------------------------------------------------
CREATE TABLE "session" (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX idx_session_expire ON "session" (expire);
