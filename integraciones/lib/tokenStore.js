import { db } from './firestore.js';

const COL = 'int_oauth_tokens';

export async function guardarTokens(usuarioId, proveedor, datos) {
  await db.collection(COL).doc(`${usuarioId}_${proveedor}`).set(
    { ...datos, actualizado: new Date().toISOString() },
    { merge: true }
  );
}

export async function leerTokens(usuarioId, proveedor) {
  const doc = await db.collection(COL).doc(`${usuarioId}_${proveedor}`).get();
  return doc.exists ? doc.data() : null;
}

export async function estaConectado(usuarioId, proveedor) {
  const t = await leerTokens(usuarioId, proveedor);
  return !!(t && t.refresh_token);
}
