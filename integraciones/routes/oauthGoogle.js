import express from 'express';
import * as googleOAuth from '../lib/googleOAuth.js';
import { estaConectado } from '../lib/tokenStore.js';
import { createOAuthState, requireMainSession, verifyOAuthState } from '../lib/mainSession.js';

const router = express.Router();

router.get('/auth/google', requireMainSession, (req, res) => {
  res.redirect(googleOAuth.construirUrlAutorizacion(createOAuthState(req.user.id)));
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    if (req.query.error) throw new Error(req.query.error_description || req.query.error);
    const { userId } = verifyOAuthState(req.query.state);
    await googleOAuth.intercambiarCodigo(userId, req.query.code);
    res.redirect('/?conectado=google');
  } catch (error) {
    res.status(400).send(`<h2>Error conectando Google</h2><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

router.get('/api/google/estado', requireMainSession, async (req, res) => {
  res.json({ success: true, conectado: await estaConectado(req.user.id, 'google') });
});

export default router;
