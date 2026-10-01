/** Una solicitud del propio dominio no necesita una excepción CORS. */
export function isTrustedOrigin(req, allowedOrigins = []) {
  const origin = req.get('origin');
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return origin === `${req.protocol}://${req.get('host')}`;
}
