import express from 'express';
import * as googleOAuth from '../lib/googleOAuth.js';
import { desconectar, estaConectado } from '../lib/tokenStore.js';
import { consumeOAuthState, createOAuthState, requireAuth } from '../lib/sessionAuth.js';

const router = express.Router();

router.get('/auth/google', requireAuth, async (req, res) => {
  const state = await createOAuthState(req.user.id, 'google');
  res.redirect(googleOAuth.construirUrlAutorizacion(state));
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    if (req.query.error || !req.query.code) throw new Error('Autorización cancelada o incompleta.');
    const userId = await consumeOAuthState(req.query.state, 'google');
    if (!userId) return res.status(400).send('<h2>Solicitud OAuth inválida o expirada</h2><a href="/">Volver</a>');
    await googleOAuth.intercambiarCodigo(userId, req.query.code);
    res.redirect('/?conectado=google');
  } catch (error) {
    console.error('GOOGLE OAUTH CALLBACK ERROR:', error.message);
    res.status(400).send('<h2>No se pudo conectar Google</h2><a href="/">Volver</a>');
  }
});

router.get('/api/google/estado', requireAuth, async (req, res) => {
  res.json({ success: true, conectado: await estaConectado(req.user.id, 'google') });
});

router.post('/api/google/desconectar', requireAuth, async (req, res) => {
  await desconectar(req.user.id, 'google');
  res.json({ success: true });
});

export default router;
