import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mídias de avaliação ficam em public/uploads/reviews → servidas em /static/uploads/reviews.
export const REVIEW_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'reviews');
fs.mkdirSync(REVIEW_DIR, { recursive: true });

// Apenas tipos de imagem/vídeo conhecidos (evita servir HTML/SVG → XSS).
const EXT_POR_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};

export const tipoDeMime = (mime) => (mime.startsWith('video/') ? 'video' : 'foto');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REVIEW_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_POR_MIME[file.mimetype] || 'bin';
    cb(null, `${crypto.randomBytes(12).toString('hex')}.${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  cb(null, Boolean(EXT_POR_MIME[file.mimetype])); // ignora tipos não permitidos
}

// Até 5 arquivos, 20 MB cada, campo "midias".
export const uploadReviewMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
}).array('midias', 5);
