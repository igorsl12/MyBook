-- ============================================================================
-- MyBook — Seed de exemplo (catálogo navegável)
-- Roda após 001_schema.sql na primeira criação do banco.
-- Senhas dos usuários de exemplo (apenas DEMO — troque em produção):
--   admin@mybook.com.br   / admin123    (papel: admin)
--   leitor@mybook.com.br  / cliente123  (papel: cliente)
-- ============================================================================

-- ---- Usuários ----
INSERT INTO usuarios (email, senha_hash, papel) VALUES
  ('admin@mybook.com.br',  '$2b$10$3fKCKNp0cUq8C/5Q/76y5uKHD/Q.NqtPYtCRD/o2DXdx3HA5mHtMS', 'admin'),
  ('leitor@mybook.com.br', '$2b$10$25oFQDoKIFbLBgulmvnOSueKRvseVK8lNRpiu7.fOcQceQr9Qlbp6', 'cliente');

INSERT INTO perfis (usuario_id, nome, telefone, cpf) VALUES
  (1, 'Administração MyBook', '(11) 90000-0000', NULL),
  (2, 'Ana Leitora',          '(11) 98888-7777', '123.456.789-00');

INSERT INTO enderecos (usuario_id, cep, logradouro, numero, complemento, bairro, cidade, uf, padrao) VALUES
  (2, '01310-100', 'Av. Paulista', '1000', 'Apto 51', 'Bela Vista', 'São Paulo', 'SP', true);

-- ---- Editoras ----
INSERT INTO editoras (nome, slug) VALUES
  ('Companhia das Letras', 'companhia-das-letras'),
  ('Sextante',             'sextante'),
  ('Intrínseca',           'intrinseca'),
  ('Rocco',                'rocco'),
  ('Aleph',                'aleph');

-- ---- Autores ----
INSERT INTO autores (nome, slug, bio) VALUES
  ('Machado de Assis',      'machado-de-assis',      'Maior nome do realismo brasileiro, autor de Dom Casmurro.'),
  ('Clarice Lispector',     'clarice-lispector',     'Escritora modernista, referência da prosa introspectiva.'),
  ('Yuval Noah Harari',     'yuval-noah-harari',     'Historiador, autor de Sapiens e Homo Deus.'),
  ('Frank Herbert',         'frank-herbert',         'Autor da saga Duna, clássico da ficção científica.'),
  ('J.R.R. Tolkien',        'jrr-tolkien',           'Criador da Terra-média e do gênero fantasia moderna.'),
  ('Andrew Hunt',           'andrew-hunt',           'Coautor de O Programador Pragmático.'),
  ('David Thomas',          'david-thomas',          'Coautor de O Programador Pragmático.'),
  ('Robert C. Martin',      'robert-c-martin',       'Uncle Bob — autor de Código Limpo.'),
  ('Conceição Evaristo',    'conceicao-evaristo',    'Romancista e poeta, voz da literatura afro-brasileira.'),
  ('Itamar Vieira Junior',  'itamar-vieira-junior',  'Autor de Torto Arado, vencedor do Prêmio Jabuti.');

-- ---- Categorias (com hierarquia) ----
INSERT INTO categorias (nome, slug, parent_id) VALUES
  ('Literatura',          'literatura',          NULL),   -- 1
  ('Tecnologia',          'tecnologia',          NULL),   -- 2
  ('Ciências',            'ciencias',            NULL),   -- 3
  ('Ficção Científica',   'ficcao-cientifica',   NULL),   -- 4
  ('Fantasia',            'fantasia',            NULL),   -- 5
  ('Romance',             'romance',             1),      -- 6 (sob Literatura)
  ('Clássicos',           'classicos',           1),      -- 7 (sob Literatura)
  ('Programação',         'programacao',         2),      -- 8 (sob Tecnologia)
  ('História',            'historia',            3);      -- 9 (sob Ciências)

-- ---- Livros ----
-- preço/promoção em reais; estoque, páginas, formato, destaque.
INSERT INTO livros
  (titulo, subtitulo, slug, isbn, descricao, preco, preco_promocional, estoque, paginas, idioma, formato, data_publicacao, editora_id, destaque, vendidos) VALUES
  ('Dom Casmurro', NULL, 'dom-casmurro', '9788535910663',
   'O clássico de Machado de Assis sobre ciúme, memória e a dúvida eterna: teria Capitu traído Bentinho?',
   49.90, 39.90, 25, 256, 'Português', 'fisico', '1899-01-01', 1, true, 320),

  ('A Hora da Estrela', NULL, 'a-hora-da-estrela', '9788520937274',
   'A última obra de Clarice Lispector, a comovente história de Macabéa.',
   44.90, NULL, 18, 96, 'Português', 'fisico', '1977-01-01', 1, true, 210),

  ('Sapiens', 'Uma breve história da humanidade', 'sapiens', '9788525432186',
   'Yuval Noah Harari narra a trajetória da espécie humana, da Idade da Pedra à era da inteligência artificial.',
   69.90, 54.90, 40, 464, 'Português', 'fisico', '2015-01-01', 1, true, 540),

  ('Homo Deus', 'Uma breve história do amanhã', 'homo-deus', '9788535928198',
   'A sequência de Sapiens: para onde caminha a humanidade no século XXI.',
   72.90, NULL, 30, 448, 'Português', 'fisico', '2016-01-01', 1, false, 300),

  ('Duna', NULL, 'duna', '9788576572009',
   'O épico de Frank Herbert no planeta Arrakis: política, religião e ecologia num clássico da ficção científica.',
   89.90, 74.90, 22, 680, 'Português', 'fisico', '1965-01-01', 5, true, 410),

  ('O Senhor dos Anéis', 'A Sociedade do Anel', 'o-senhor-dos-aneis-sociedade-do-anel', '9788595084759',
   'O início da jornada de Frodo para destruir o Um Anel na Terra-média.',
   99.90, 84.90, 35, 576, 'Português', 'fisico', '1954-01-01', 4, true, 480),

  ('O Hobbit', NULL, 'o-hobbit', '9788595084742',
   'A aventura de Bilbo Bolseiro rumo à Montanha Solitária.',
   54.90, NULL, 28, 336, 'Português', 'fisico', '1937-01-01', 4, false, 260),

  ('O Programador Pragmático', 'Sua jornada para a maestria', 'o-programador-pragmatico', '9788576082606',
   'Clássico atemporal sobre boas práticas de desenvolvimento de software.',
   119.90, 99.90, 15, 376, 'Português', 'fisico', '2019-01-01', 2, true, 190),

  ('Código Limpo', 'Habilidades práticas do Agile Software', 'codigo-limpo', '9788576082675',
   'Robert C. Martin ensina a escrever código legível, sustentável e de qualidade.',
   109.90, NULL, 20, 424, 'Português', 'fisico', '2009-01-01', 2, true, 350),

  ('Torto Arado', NULL, 'torto-arado', '9788547000196',
   'Itamar Vieira Junior narra a vida de duas irmãs no sertão baiano. Vencedor do Jabuti.',
   64.90, 49.90, 26, 264, 'Português', 'fisico', '2019-01-01', 3, true, 290),

  ('Olhos D''Água', NULL, 'olhos-dagua', '9788542210668',
   'Contos de Conceição Evaristo sobre a experiência negra no Brasil.',
   42.90, NULL, 14, 116, 'Português', 'ebook', '2014-01-01', 3, false, 120),

  ('Memórias Póstumas de Brás Cubas', NULL, 'memorias-postumas-de-bras-cubas', '9788594318600',
   'O defunto-autor Brás Cubas narra suas memórias com ironia e humor.',
   39.90, 29.90, 32, 208, 'Português', 'fisico', '1881-01-01', 1, false, 230),

  ('A Paixão Segundo G.H.', NULL, 'a-paixao-segundo-gh', '9788520937281',
   'Romance introspectivo de Clarice Lispector sobre identidade e existência.',
   46.90, NULL, 10, 184, 'Português', 'ebook', '1964-01-01', 1, false, 90),

  ('O Messias de Duna', NULL, 'o-messias-de-duna', '9788576572016',
   'A continuação da saga Duna: o império de Paul Atreides.',
   79.90, NULL, 12, 352, 'Português', 'fisico', '1969-01-01', 5, false, 140);

-- ---- Relações livro ↔ autor ----
INSERT INTO livros_autores (livro_id, autor_id) VALUES
  (1,1), (2,2), (3,3), (4,3), (5,4), (6,5), (7,5),
  (8,6), (8,7), (9,8), (10,10), (11,9), (12,1), (13,2), (14,4);

-- ---- Relações livro ↔ categoria ----
INSERT INTO livros_categorias (livro_id, categoria_id) VALUES
  (1,1), (1,7), (1,6),
  (2,1), (2,7),
  (3,3), (3,9),
  (4,3), (4,9),
  (5,4),
  (6,5),
  (7,5),
  (8,2), (8,8),
  (9,2), (9,8),
  (10,1), (10,6),
  (11,1),
  (12,1), (12,7),
  (13,1), (13,6),
  (14,4);

-- ---- Cupons ----
INSERT INTO cupons (codigo, tipo, valor, validade, uso_maximo, valor_minimo, ativo) VALUES
  ('BEMVINDO10', 'percentual', 10.00, '2099-12-31', NULL, 0,     true),
  ('LEIA20',     'fixo',       20.00, '2099-12-31', 100,  100.00, true),
  ('FRETEGRATIS','fixo',       15.00, '2099-12-31', NULL, 80.00,  true);
