/** Una conexión dañada no impide consultar el estado de las demás. */
export async function integrationStatuses(read, providers = ['google', 'youtube', 'microsoft']) {
  const results = await Promise.allSettled(providers.map(provider => read(provider)));
  return Object.fromEntries(providers.map((provider, index) => {
    const result = results[index];
    if (result.status === 'rejected') {
      const needsRelink = /unable to authenticate data|Unsupported state|Invalid authentication tag|Invalid initialization vector/.test(result.reason?.message || '');
      return [provider, { connected: needsRelink ? false : null, state: needsRelink ? 'reconnect' : 'unavailable' }];
    }
    const tokens = result.value;
    if (!tokens) return [provider, { connected: false, state: 'disconnected' }];
    const expiresAt = tokens.expiry_date || (tokens.acquired_at && tokens.expires_in ? Number(tokens.acquired_at) + Number(tokens.expires_in) * 1000 : 0);
    const expired = expiresAt && Number(expiresAt) <= Date.now();
    if ((!tokens.access_token && !tokens.refresh_token) || (expired && !tokens.refresh_token)) {
      return [provider, { connected: false, state: 'reconnect' }];
    }
    return [provider, { connected: true, state: 'linked' }];
  }));
}
