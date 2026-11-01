/** Valida el retorno antes de intercambiar códigos con el proveedor. */
export function validOAuthCallback(query) {
  return !query.error && typeof query.code === 'string' && query.code.length > 0 && query.code.length <= 4096
    && typeof query.state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(query.state);
}

/** La transacción impide que dos callbacks consuman la misma autorización. */
export async function consumeOAuthState(db, ref, {provider, userId} = {}) {
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    if (!data || !Number.isFinite(data.expires_at) || data.expires_at <= Date.now()
      || (provider && data.provider !== provider)
      || (userId != null && String(data.user_id) !== String(userId))
      || typeof data.code_verifier !== 'string' || !data.code_verifier) {
      throw new Error('La autorización ya no es válida. Inicia el proceso nuevamente.');
    }
    tx.delete(ref);
    return data;
  });
}
