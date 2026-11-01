import express from 'express';
import * as msOAuth from '../lib/microsoftOAuth.js';
import { desconectar, estaConectado } from '../lib/tokenStore.js';
import { consumeOAuthState, createOAuthState, requireAuth } from '../lib/sessionAuth.js';

const router = express.Router();

router.get('/auth/microsoft', requireAuth, async (req, res) => {
  const state = await createOAuthState(req.user.id, 'microsoft');
  res.redirect(msOAuth.construirUrlAutorizacion(state));
});

router.get('/auth/microsoft/callback', async (req, res) => {
  try {
    if (req.query.error || !req.query.code) throw new Error('Autorización cancelada o incompleta.');
    const userId = await consumeOAuthState(req.query.state, 'microsoft');
    if (!userId) return res.status(400).send('<h2>Solicitud OAuth inválida o expirada</h2><a href="/">Volver</a>');
    await msOAuth.intercambiarCodigo(userId, req.query.code);
    res.redirect('/?conectado=microsoft');
  } catch (error) {
    console.error('MICROSOFT OAUTH CALLBACK ERROR:', error.message);
    res.status(400).send('<h2>No se pudo conectar Microsoft</h2><a href="/">Volver</a>');
  }
});

router.get('/api/microsoft/estado', requireAuth, async (req, res) => {
  res.json({ success: true, conectado: await estaConectado(req.user.id, 'microsoft') });
});

router.post('/api/microsoft/desconectar', requireAuth, async (req, res) => {
  await desconectar(req.user.id, 'microsoft');
  res.json({ success: true });
});

export default router;
