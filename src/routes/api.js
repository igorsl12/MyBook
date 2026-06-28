import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../lib/asyncHandler.js';
import { buscarCep } from '../services/cep.js';

export const apiRouter = Router();

// Proxy de consulta de CEP (ViaCEP). Same-origin para o front (respeita a CSP).
const cepLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

apiRouter.get('/api/cep/:cep', cepLimiter, asyncHandler(async (req, res) => {
  const endereco = await buscarCep(req.params.cep);
  if (!endereco) return res.status(404).json({ erro: 'CEP não encontrado.' });
  res.json(endereco);
}));
