export function integrationFailure(error, service) {
  const providerError = error.response?.data?.error;
  const reason = typeof providerError === 'string' ? providerError : providerError?.code;
  const status = error.response?.status || error.status || error.code;
  if (reason === 'invalid_grant' || status === 401 || /unable to authenticate data|Unsupported state|No refresh token|conexión.*caducó/.test(error.message || '')) {
    return { status: 409, message: `La conexión con ${service} caducó o ya no es válida. Vuelve a vincular tu cuenta.` };
  }
  if (status === 403) return { status: 403, message: `La cuenta vinculada no permite esta acción en ${service}. Revisa sus permisos o utiliza otra cuenta.` };
  return { status: 502, message: `No pudimos completar la operación con ${service}. Inténtalo nuevamente más tarde.` };
}
