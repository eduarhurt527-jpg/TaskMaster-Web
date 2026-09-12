import express from 'express';
import * as msOAuth from '../lib/microsoftOAuth.js';
import { estaConectado } from '../lib/tokenStore.js';
import { createOAuthState, requireMainSession, verifyOAuthState } from '../lib/mainSession.js';

const router = express.Router();

router.get('/auth/microsoft', requireMainSession, (req, res) => {
  res.redirect(msOAuth.construirUrlAutorizacion(createOAuthState(req.user.id)));
});

router.get('/auth/microsoft/callback', async (req, res) => {
  try {
    if (req.query.error) throw new Error(req.query.error_description || req.query.error);
    const { userId } = verifyOAuthState(req.query.state);
    await msOAuth.intercambiarCodigo(userId, req.query.code);
    res.redirect('/?conectado=microsoft');
  } catch (error) {
    res.status(400).send(`<h2>Error conectando Microsoft</h2><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

router.get('/api/microsoft/estado', requireMainSession, async (req, res) => {
  res.json({ success: true, conectado: await estaConectado(req.user.id, 'microsoft') });
});

export default router;
