-- ============================================================================
-- MyBook — Migração aditiva: +30 livros ao catálogo.
--
-- Segura para rodar no banco JÁ EM PRODUÇÃO (Neon): é idempotente
-- (ON CONFLICT DO NOTHING) e resolve todas as chaves estrangeiras por slug/isbn,
-- então NÃO depende dos IDs SERIAL atuais e não altera os livros existentes.
--
-- Como aplicar no Neon (uma vez):
--   psql "postgresql://.../neondb?sslmode=require" -f db/init/003_mais_livros.sql
--
-- Capas: URL do CDN de imagens da Amazon derivada do ISBN-10 do livro. Cada URL
-- foi verificada (HTTP 200 + imagem real). Onde a Amazon não tinha capa para o
-- ISBN, capa_url fica NULL e a aplicação usa a capa SVG gerada (fallback).
-- ============================================================================

BEGIN;

-- ---- Editoras novas ----
INSERT INTO editoras (nome, slug) VALUES
  ('Record',        'record'),
  ('Arqueiro',      'arqueiro'),
  ('Suma',          'suma'),
  ('Objetiva',      'objetiva'),
  ('Editora 34',    'editora-34'),
  ('José Olympio',  'jose-olympio'),
  ('Alta Books',    'alta-books'),
  ('Novatec',       'novatec'),
  ('Globo Livros',  'globo')
ON CONFLICT (slug) DO NOTHING;

-- ---- Autores novos ----
INSERT INTO autores (nome, slug, bio) VALUES
  ('George Orwell',            'george-orwell',            'Autor britânico de 1984 e A Revolução dos Bichos, crítico do totalitarismo.'),
  ('Paulo Coelho',             'paulo-coelho',             'Escritor brasileiro, autor de O Alquimista, um dos mais traduzidos do mundo.'),
  ('Aluísio Azevedo',          'aluisio-azevedo',          'Romancista naturalista brasileiro, autor de O Cortiço.'),
  ('Graciliano Ramos',         'graciliano-ramos',         'Mestre do romance regionalista brasileiro, autor de Vidas Secas.'),
  ('João Guimarães Rosa',      'guimaraes-rosa',           'Autor de Grande Sertão: Veredas, renovador da linguagem literária.'),
  ('Jorge Amado',              'jorge-amado',              'Um dos mais lidos escritores brasileiros, autor de Capitães da Areia.'),
  ('Gabriel García Márquez',   'gabriel-garcia-marquez',   'Nobel de Literatura, mestre do realismo mágico, autor de Cem Anos de Solidão.'),
  ('Patrick Rothfuss',         'patrick-rothfuss',         'Autor norte-americano da série A Crônica do Matador do Rei.'),
  ('George R. R. Martin',      'george-rr-martin',         'Autor da saga As Crônicas de Gelo e Fogo.'),
  ('Stephen King',             'stephen-king',             'Mestre do terror e do suspense, autor de It e O Iluminado.'),
  ('J. K. Rowling',            'jk-rowling',               'Criadora da série Harry Potter.'),
  ('William Gibson',           'william-gibson',           'Pioneiro do cyberpunk, autor de Neuromancer.'),
  ('Ray Bradbury',             'ray-bradbury',             'Autor de Fahrenheit 451, clássico da ficção científica.'),
  ('Margaret Atwood',          'margaret-atwood',          'Autora canadense de O Conto da Aia.'),
  ('Jane Austen',              'jane-austen',              'Romancista inglesa, autora de Orgulho e Preconceito.'),
  ('Emily Brontë',             'emily-bronte',             'Autora de O Morro dos Ventos Uivantes.'),
  ('Fiódor Dostoiévski',       'dostoievski',              'Romancista russo, autor de Crime e Castigo.'),
  ('J. D. Salinger',           'jd-salinger',              'Autor de O Apanhador no Campo de Centeio.'),
  ('Markus Zusak',             'markus-zusak',             'Autor australiano de A Menina que Roubava Livros.'),
  ('Harper Lee',               'harper-lee',               'Autora de O Sol é Para Todos, Prêmio Pulitzer.'),
  ('John Green',               'john-green',               'Autor norte-americano de A Culpa é das Estrelas.'),
  ('Carol S. Dweck',           'carol-dweck',              'Psicóloga de Stanford, autora de Mindset.'),
  ('Daniel Kahneman',          'daniel-kahneman',          'Nobel de Economia, autor de Rápido e Devagar.'),
  ('Charles Duhigg',           'charles-duhigg',           'Jornalista, autor de O Poder do Hábito.'),
  ('James Clear',              'james-clear',              'Autor de Hábitos Atômicos, referência em formação de hábitos.'),
  ('Mark Manson',              'mark-manson',              'Autor de A Sutil Arte de Ligar o F*da-se.'),
  ('Robert T. Kiyosaki',       'robert-kiyosaki',          'Autor de Pai Rico, Pai Pobre, sobre educação financeira.'),
  ('Martin Fowler',            'martin-fowler',            'Autor de Refatoração, referência em engenharia de software.')
ON CONFLICT (slug) DO NOTHING;

-- ---- Livros ----
-- capa_url = CDN da Amazon (verificado) ou NULL (fallback para capa SVG gerada).
INSERT INTO livros
  (titulo, subtitulo, slug, isbn, descricao, preco, preco_promocional, estoque,
   capa_url, paginas, idioma, formato, data_publicacao, editora_id, destaque, vendidos) VALUES

  ('1984', NULL, '1984', '9788535914849',
   'A distopia de George Orwell sobre vigilância, controle e o Grande Irmão.',
   54.90, 44.90, 40,
   'https://images-na.ssl-images-amazon.com/images/P/8535914846.01._SCLZZZZZZZ_.jpg',
   416, 'Português', 'fisico', '1949-06-08',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), true, 620),

  ('A Revolução dos Bichos', 'Um conto de fadas', 'a-revolucao-dos-bichos', '9788535909555',
   'A célebre sátira de Orwell ao totalitarismo, ambientada numa fazenda.',
   39.90, 32.90, 35,
   'https://images-na.ssl-images-amazon.com/images/P/8535909559.01._SCLZZZZZZZ_.jpg',
   152, 'Português', 'fisico', '1945-08-17',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), true, 480),

  ('O Alquimista', NULL, 'o-alquimista', '9788576653714',
   'A fábula de Paulo Coelho sobre Santiago e a busca pela Lenda Pessoal.',
   44.90, NULL, 50,
   NULL,
   208, 'Português', 'fisico', '1988-01-01',
   (SELECT id FROM editoras WHERE slug='sextante'), true, 700),

  ('O Cortiço', NULL, 'o-cortico', '9788508133055',
   'Romance naturalista de Aluísio Azevedo sobre a vida num cortiço no Rio.',
   34.90, 27.90, 30,
   NULL,
   288, 'Português', 'fisico', '1890-01-01',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), false, 210),

  ('Vidas Secas', NULL, 'vidas-secas', '9788501043504',
   'Graciliano Ramos narra a saga de uma família retirante no sertão nordestino.',
   36.90, NULL, 28,
   NULL,
   176, 'Português', 'fisico', '1938-01-01',
   (SELECT id FROM editoras WHERE slug='record'), false, 240),

  ('Grande Sertão: Veredas', NULL, 'grande-sertao-veredas', '9788520925157',
   'A obra-prima de Guimarães Rosa: o jagunço Riobaldo e o sertão como travessia.',
   79.90, 64.90, 18,
   NULL,
   624, 'Português', 'fisico', '1956-01-01',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), false, 160),

  ('Capitães da Areia', NULL, 'capitaes-da-areia', '9788535911954',
   'Jorge Amado retrata os meninos de rua de Salvador nos anos 1930.',
   46.90, 38.90, 32,
   'https://images-na.ssl-images-amazon.com/images/P/8535911952.01._SCLZZZZZZZ_.jpg',
   280, 'Português', 'fisico', '1937-01-01',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), true, 300),

  ('Cem Anos de Solidão', NULL, 'cem-anos-de-solidao', '9788501012074',
   'A saga da família Buendía em Macondo, clássico do realismo mágico.',
   74.90, 59.90, 26,
   'https://images-na.ssl-images-amazon.com/images/P/8501012076.01._SCLZZZZZZZ_.jpg',
   448, 'Português', 'fisico', '1967-05-30',
   (SELECT id FROM editoras WHERE slug='record'), true, 380),

  ('O Nome do Vento', 'A Crônica do Matador do Rei: Primeiro Dia', 'o-nome-do-vento', '9788575424964',
   'A história de Kvothe, de menino prodígio a lenda viva, narrada por ele mesmo.',
   89.90, 74.90, 24,
   NULL,
   656, 'Português', 'fisico', '2007-03-27',
   (SELECT id FROM editoras WHERE slug='arqueiro'), true, 350),

  ('A Guerra dos Tronos', 'As Crônicas de Gelo e Fogo: Livro 1', 'a-guerra-dos-tronos', '9788580442298',
   'Intrigas, honra e traição em Westeros — o início da saga de George R. R. Martin.',
   94.90, 79.90, 22,
   NULL,
   592, 'Português', 'fisico', '1996-08-01',
   (SELECT id FROM editoras WHERE slug='suma'), true, 420),

  ('It: A Coisa', NULL, 'it-a-coisa', '9788556510907',
   'Stephen King e o terror de Pennywise em Derry, ao longo de décadas.',
   99.90, 84.90, 20,
   'https://images-na.ssl-images-amazon.com/images/P/8556510906.01._SCLZZZZZZZ_.jpg',
   1104, 'Português', 'fisico', '1986-09-15',
   (SELECT id FROM editoras WHERE slug='suma'), true, 310),

  ('O Iluminado', NULL, 'o-iluminado', '9788581050478',
   'Jack Torrance e o Hotel Overlook: clássico do horror psicológico de King.',
   64.90, 52.90, 24,
   'https://images-na.ssl-images-amazon.com/images/P/8581050476.01._SCLZZZZZZZ_.jpg',
   464, 'Português', 'fisico', '1977-01-28',
   (SELECT id FROM editoras WHERE slug='suma'), false, 220),

  ('Harry Potter e a Pedra Filosofal', NULL, 'harry-potter-e-a-pedra-filosofal', '9788532530788',
   'O primeiro ano de Harry em Hogwarts e o início da maior série de fantasia moderna.',
   49.90, 39.90, 60,
   'https://images-na.ssl-images-amazon.com/images/P/8532530788.01._SCLZZZZZZZ_.jpg',
   264, 'Português', 'fisico', '1997-06-26',
   (SELECT id FROM editoras WHERE slug='rocco'), true, 900),

  ('Neuromancer', NULL, 'neuromancer', '9788576573159',
   'O romance fundador do cyberpunk: Case, o ciberespaço e a IA Wintermute.',
   59.90, 49.90, 22,
   'https://images-na.ssl-images-amazon.com/images/P/8576573156.01._SCLZZZZZZZ_.jpg',
   312, 'Português', 'fisico', '1984-07-01',
   (SELECT id FROM editoras WHERE slug='aleph'), true, 270),

  ('Fahrenheit 451', NULL, 'fahrenheit-451', '9788525056474',
   'Num futuro em que livros são queimados, o bombeiro Montag começa a duvidar.',
   49.90, NULL, 30,
   'https://images-na.ssl-images-amazon.com/images/P/8525056472.01._SCLZZZZZZZ_.jpg',
   216, 'Português', 'fisico', '1953-10-19',
   (SELECT id FROM editoras WHERE slug='globo'), false, 250),

  ('O Conto da Aia', NULL, 'o-conto-da-aia', '9788535928402',
   'A distopia de Margaret Atwood na teocracia de Gilead, contada por Offred.',
   54.90, 44.90, 28,
   'https://images-na.ssl-images-amazon.com/images/P/8535928405.01._SCLZZZZZZZ_.jpg',
   368, 'Português', 'fisico', '1985-01-01',
   (SELECT id FROM editoras WHERE slug='rocco'), true, 290),

  ('Orgulho e Preconceito', NULL, 'orgulho-e-preconceito', '9788594318602',
   'Elizabeth Bennet e o Sr. Darcy no romance mais amado de Jane Austen.',
   44.90, 34.90, 34,
   'https://images-na.ssl-images-amazon.com/images/P/859431860X.01._SCLZZZZZZZ_.jpg',
   424, 'Português', 'fisico', '1813-01-28',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), true, 460),

  ('O Morro dos Ventos Uivantes', NULL, 'o-morro-dos-ventos-uivantes', '9788544001820',
   'A paixão devastadora de Heathcliff e Catherine, único romance de Emily Brontë.',
   42.90, NULL, 26,
   'https://images-na.ssl-images-amazon.com/images/P/8544001823.01._SCLZZZZZZZ_.jpg',
   336, 'Português', 'fisico', '1847-12-01',
   (SELECT id FROM editoras WHERE slug='companhia-das-letras'), false, 200),

  ('Crime e Castigo', NULL, 'crime-e-castigo', '9788573263169',
   'Raskólnikov, o crime e o peso da consciência no clássico de Dostoiévski.',
   69.90, 57.90, 24,
   'https://images-na.ssl-images-amazon.com/images/P/8573263164.01._SCLZZZZZZZ_.jpg',
   568, 'Português', 'fisico', '1866-01-01',
   (SELECT id FROM editoras WHERE slug='editora-34'), true, 260),

  ('O Apanhador no Campo de Centeio', NULL, 'o-apanhador-no-campo-de-centeio', '9788573025002',
   'Holden Caulfield e sua fuga por Nova York, marco da literatura do século XX.',
   46.90, 37.90, 28,
   NULL,
   208, 'Português', 'fisico', '1951-07-16',
   (SELECT id FROM editoras WHERE slug='jose-olympio'), false, 230),

  ('A Menina que Roubava Livros', NULL, 'a-menina-que-roubava-livros', '9788598078175',
   'Liesel, os livros e a Morte como narradora na Alemanha nazista.',
   59.90, 49.90, 32,
   'https://images-na.ssl-images-amazon.com/images/P/8598078174.01._SCLZZZZZZZ_.jpg',
   480, 'Português', 'fisico', '2005-01-01',
   (SELECT id FROM editoras WHERE slug='intrinseca'), true, 410),

  ('O Sol é Para Todos', NULL, 'o-sol-e-para-todos', '9788576571787',
   'Racismo e justiça no Sul dos EUA pelos olhos de Scout — Pulitzer de Harper Lee.',
   52.90, NULL, 26,
   'https://images-na.ssl-images-amazon.com/images/P/8576571781.01._SCLZZZZZZZ_.jpg',
   360, 'Português', 'fisico', '1960-07-11',
   (SELECT id FROM editoras WHERE slug='jose-olympio'), false, 240),

  ('A Culpa é das Estrelas', NULL, 'a-culpa-e-das-estrelas', '9788580573466',
   'Hazel e Gus, dois adolescentes e um amor à sombra do câncer, por John Green.',
   44.90, 34.90, 40,
   'https://images-na.ssl-images-amazon.com/images/P/8580573467.01._SCLZZZZZZZ_.jpg',
   288, 'Português', 'fisico', '2012-01-10',
   (SELECT id FROM editoras WHERE slug='intrinseca'), true, 560),

  ('Mindset', 'A nova psicologia do sucesso', 'mindset', '9788547000097',
   'Carol Dweck e a diferença entre mentalidade fixa e mentalidade de crescimento.',
   54.90, 44.90, 30,
   'https://images-na.ssl-images-amazon.com/images/P/8547000097.01._SCLZZZZZZZ_.jpg',
   312, 'Português', 'fisico', '2006-02-28',
   (SELECT id FROM editoras WHERE slug='objetiva'), false, 280),

  ('Rápido e Devagar', 'Duas formas de pensar', 'rapido-e-devagar', '9788539004119',
   'Daniel Kahneman e os dois sistemas que governam nossas decisões.',
   79.90, 64.90, 24,
   'https://images-na.ssl-images-amazon.com/images/P/8539004119.01._SCLZZZZZZZ_.jpg',
   624, 'Português', 'fisico', '2011-10-25',
   (SELECT id FROM editoras WHERE slug='objetiva'), true, 320),

  ('O Poder do Hábito', 'Por que fazemos o que fazemos', 'o-poder-do-habito', '9788539004072',
   'Charles Duhigg mostra como os hábitos funcionam e como transformá-los.',
   59.90, 47.90, 30,
   'https://images-na.ssl-images-amazon.com/images/P/8539004070.01._SCLZZZZZZZ_.jpg',
   408, 'Português', 'fisico', '2012-02-28',
   (SELECT id FROM editoras WHERE slug='objetiva'), true, 340),

  ('Hábitos Atômicos', 'Um método fácil e comprovado', 'habitos-atomicos', '9788550807560',
   'James Clear e o poder das pequenas mudanças de 1% para grandes resultados.',
   64.90, 52.90, 45,
   'https://images-na.ssl-images-amazon.com/images/P/8550807567.01._SCLZZZZZZZ_.jpg',
   320, 'Português', 'fisico', '2018-10-16',
   (SELECT id FROM editoras WHERE slug='alta-books'), true, 650),

  ('A Sutil Arte de Ligar o F*da-se', NULL, 'a-sutil-arte-de-ligar-o-foda-se', '9788595084377',
   'Mark Manson e uma abordagem contraintuitiva para viver uma vida boa.',
   49.90, 39.90, 38,
   'https://images-na.ssl-images-amazon.com/images/P/8595084378.01._SCLZZZZZZZ_.jpg',
   224, 'Português', 'fisico', '2016-09-13',
   (SELECT id FROM editoras WHERE slug='intrinseca'), true, 500),

  ('Pai Rico, Pai Pobre', NULL, 'pai-rico-pai-pobre', '9788550801483',
   'Robert Kiyosaki e as lições sobre dinheiro que a escola não ensina.',
   54.90, 44.90, 42,
   'https://images-na.ssl-images-amazon.com/images/P/8550801488.01._SCLZZZZZZZ_.jpg',
   336, 'Português', 'fisico', '1997-04-01',
   (SELECT id FROM editoras WHERE slug='alta-books'), true, 480),

  ('Refatoração', 'Aperfeiçoando o design de códigos existentes', 'refatoracao', '9788575225325',
   'Martin Fowler e o catálogo definitivo de técnicas para melhorar código.',
   139.90, 119.90, 14,
   NULL,
   464, 'Português', 'fisico', '1999-07-08',
   (SELECT id FROM editoras WHERE slug='novatec'), false, 130)

ON CONFLICT (isbn) DO NOTHING;

-- ---- Relações livro ↔ autor (resolvidas por slug) ----
INSERT INTO livros_autores (livro_id, autor_id)
SELECT l.id, a.id
FROM (VALUES
  ('1984','george-orwell'),
  ('a-revolucao-dos-bichos','george-orwell'),
  ('o-alquimista','paulo-coelho'),
  ('o-cortico','aluisio-azevedo'),
  ('vidas-secas','graciliano-ramos'),
  ('grande-sertao-veredas','guimaraes-rosa'),
  ('capitaes-da-areia','jorge-amado'),
  ('cem-anos-de-solidao','gabriel-garcia-marquez'),
  ('o-nome-do-vento','patrick-rothfuss'),
  ('a-guerra-dos-tronos','george-rr-martin'),
  ('it-a-coisa','stephen-king'),
  ('o-iluminado','stephen-king'),
  ('harry-potter-e-a-pedra-filosofal','jk-rowling'),
  ('neuromancer','william-gibson'),
  ('fahrenheit-451','ray-bradbury'),
  ('o-conto-da-aia','margaret-atwood'),
  ('orgulho-e-preconceito','jane-austen'),
  ('o-morro-dos-ventos-uivantes','emily-bronte'),
  ('crime-e-castigo','dostoievski'),
  ('o-apanhador-no-campo-de-centeio','jd-salinger'),
  ('a-menina-que-roubava-livros','markus-zusak'),
  ('o-sol-e-para-todos','harper-lee'),
  ('a-culpa-e-das-estrelas','john-green'),
  ('mindset','carol-dweck'),
  ('rapido-e-devagar','daniel-kahneman'),
  ('o-poder-do-habito','charles-duhigg'),
  ('habitos-atomicos','james-clear'),
  ('a-sutil-arte-de-ligar-o-foda-se','mark-manson'),
  ('pai-rico-pai-pobre','robert-kiyosaki'),
  ('refatoracao','martin-fowler')
) AS v(livro_slug, autor_slug)
JOIN livros  l ON l.slug = v.livro_slug
JOIN autores a ON a.slug = v.autor_slug
ON CONFLICT DO NOTHING;

-- ---- Relações livro ↔ categoria (resolvidas por slug) ----
INSERT INTO livros_categorias (livro_id, categoria_id)
SELECT l.id, c.id
FROM (VALUES
  ('1984','ficcao-cientifica'), ('1984','classicos'), ('1984','literatura'),
  ('a-revolucao-dos-bichos','literatura'), ('a-revolucao-dos-bichos','classicos'),
  ('o-alquimista','literatura'), ('o-alquimista','romance'),
  ('o-cortico','literatura'), ('o-cortico','classicos'),
  ('vidas-secas','literatura'), ('vidas-secas','classicos'),
  ('grande-sertao-veredas','literatura'), ('grande-sertao-veredas','classicos'),
  ('capitaes-da-areia','literatura'), ('capitaes-da-areia','classicos'),
  ('cem-anos-de-solidao','literatura'), ('cem-anos-de-solidao','romance'),
  ('o-nome-do-vento','fantasia'),
  ('a-guerra-dos-tronos','fantasia'),
  ('it-a-coisa','literatura'),
  ('o-iluminado','literatura'),
  ('harry-potter-e-a-pedra-filosofal','fantasia'),
  ('neuromancer','ficcao-cientifica'),
  ('fahrenheit-451','ficcao-cientifica'), ('fahrenheit-451','classicos'),
  ('o-conto-da-aia','ficcao-cientifica'),
  ('orgulho-e-preconceito','literatura'), ('orgulho-e-preconceito','romance'), ('orgulho-e-preconceito','classicos'),
  ('o-morro-dos-ventos-uivantes','literatura'), ('o-morro-dos-ventos-uivantes','romance'), ('o-morro-dos-ventos-uivantes','classicos'),
  ('crime-e-castigo','literatura'), ('crime-e-castigo','classicos'),
  ('o-apanhador-no-campo-de-centeio','literatura'), ('o-apanhador-no-campo-de-centeio','classicos'),
  ('a-menina-que-roubava-livros','literatura'), ('a-menina-que-roubava-livros','romance'),
  ('o-sol-e-para-todos','literatura'), ('o-sol-e-para-todos','classicos'),
  ('a-culpa-e-das-estrelas','literatura'), ('a-culpa-e-das-estrelas','romance'),
  ('mindset','ciencias'),
  ('rapido-e-devagar','ciencias'),
  ('o-poder-do-habito','ciencias'),
  ('habitos-atomicos','ciencias'),
  ('a-sutil-arte-de-ligar-o-foda-se','ciencias'),
  ('pai-rico-pai-pobre','ciencias'),
  ('refatoracao','tecnologia'), ('refatoracao','programacao')
) AS v(livro_slug, categoria_slug)
JOIN livros     l ON l.slug = v.livro_slug
JOIN categorias c ON c.slug = v.categoria_slug
ON CONFLICT DO NOTHING;

COMMIT;
