import { db } from './firestore.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

const COL = 'int_oauth_tokens';

function tokenDocumentId(userId, proveedor) {
  return `${Number(userId)}_${proveedor}`;
}

function encryptionKey() {
  const encoded = process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '';
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY debe ser una clave Base64 de 32 bytes.');
  }
  return key;
}

function encrypt(value) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decrypt(payload) {
  if (!payload) return null;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function guardarTokens(userId, proveedor, datos) {
  const protectedData = { ...datos };
  if (Object.prototype.hasOwnProperty.call(datos, 'access_token')) {
    if (datos.access_token) protectedData.access_token_encrypted = encrypt(datos.access_token);
    protectedData.access_token = FieldValue.delete();
  }
  if (Object.prototype.hasOwnProperty.call(datos, 'refresh_token')) {
    if (datos.refresh_token) protectedData.refresh_token_encrypted = encrypt(datos.refresh_token);
    protectedData.refresh_token = FieldValue.delete();
  }
  await db.collection(COL).doc(tokenDocumentId(userId, proveedor)).set(
    { ...protectedData, user_id: Number(userId), proveedor, actualizado: new Date().toISOString() },
    { merge: true }
  );
}

export async function leerTokens(userId, proveedor) {
  const doc = await db.collection(COL).doc(tokenDocumentId(userId, proveedor)).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    ...data,
    access_token: decrypt(data.access_token_encrypted),
    refresh_token: decrypt(data.refresh_token_encrypted),
  };
}

export async function estaConectado(userId, proveedor) {
  const t = await leerTokens(userId, proveedor);
  return !!(t && t.refresh_token);
}

export async function desconectar(userId, proveedor) {
  await db.collection(COL).doc(tokenDocumentId(userId, proveedor)).delete();
}
