// Gera capas de livro em SVG no servidor (offline) quando não há capa_url.
// Usa a paleta editorial do design MyBook, escolhendo cor pelo hash do título.

const PALETAS = [
  { bg: '#8a2c2c', fg: '#f5f2ec', accent: '#c8973a' }, // vinho
  { bg: '#1f4d4a', fg: '#f5f2ec', accent: '#c8973a' }, // verde escuro
  { bg: '#2e7d5b', fg: '#f7f4ee', accent: '#efe7d7' }, // verde
  { bg: '#3a352e', fg: '#efe7d7', accent: '#c8973a' }, // tinta
  { bg: '#b8791f', fg: '#211e1a', accent: '#f5f2ec' }, // dourado
  { bg: '#544e45', fg: '#f5f2ec', accent: '#c8973a' }, // taupe escuro
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Quebra o título em linhas curtas para caber na capa.
function wrap(text, max = 16) {
  const palavras = String(text).split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    if ((atual + ' ' + palavra).trim().length > max) {
      if (atual) linhas.push(atual.trim());
      atual = palavra;
    } else {
      atual = (atual + ' ' + palavra).trim();
    }
  }
  if (atual) linhas.push(atual.trim());
  return linhas.slice(0, 5);
}

export function gerarCapaSVG({ titulo = 'Livro', autor = '' } = {}) {
  const pal = PALETAS[hash(titulo) % PALETAS.length];
  const linhas = wrap(titulo, 15);
  const startY = 150 - (linhas.length - 1) * 22;
  const tspans = linhas
    .map((linha, i) =>
      `<tspan x="150" y="${startY + i * 44}">${escapeXml(linha)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450" role="img" aria-label="Capa de ${escapeXml(titulo)}">
  <rect width="300" height="450" fill="${pal.bg}"/>
  <rect x="14" y="14" width="272" height="422" fill="none" stroke="${pal.accent}" stroke-width="2"/>
  <line x1="34" y1="64" x2="266" y2="64" stroke="${pal.accent}" stroke-width="1"/>
  <text font-family="Newsreader, Georgia, serif" font-size="34" font-weight="600" fill="${pal.fg}" text-anchor="middle">${tspans}</text>
  <text x="150" y="408" font-family="'Hanken Grotesk', system-ui, sans-serif" font-size="15" letter-spacing="1" fill="${pal.fg}" text-anchor="middle" opacity="0.85">${escapeXml(autor.toUpperCase())}</text>
  <text x="150" y="48" font-family="'Hanken Grotesk', system-ui, sans-serif" font-size="12" letter-spacing="3" fill="${pal.accent}" text-anchor="middle">MYBOOK</text>
</svg>`;
}
