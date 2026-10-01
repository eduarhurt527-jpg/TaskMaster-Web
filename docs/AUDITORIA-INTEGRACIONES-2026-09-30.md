Proyecto activo: TaskMaster-final, rama security/secure-session-auth. Fecha: 30 de septiembre de 2026 (Ecuador).

Hallazgos confirmados en producción

- GET /api/integrations/status devolvía 500. Los registros de Vercel muestran «Unsupported state or unable to authenticate data»: una autorización almacenada no puede descifrarse con la clave actual. No se cambió esa clave ni se borraron autorizaciones. Es necesario volver a vincular la cuenta afectada.
- La consulta agrupaba las tres conexiones en Promise.all; un fallo ocultaba las demás y la interfaz las anunciaba como sin vincular.
- Faltaban GOOGLE_INTEGRATION_REDIRECT_URI y YOUTUBE_INTEGRATION_REDIRECT_URI en producción. Se añadieron como configuración no secreta con los callbacks existentes del dominio www. Vercel confirmó el guardado; requieren un despliegue nuevo.
- Faltan MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET y MICROSOFT_REDIRECT_URI. No se inventaron identificadores ni secretos. [FALTA CONFIRMAR] el registro de la aplicación Microsoft y sus permisos.

Correcciones de código

| Archivo / función | Problema | Corrección |
|---|---|---|
| server.js / integrations/status; lib/integration-status.js | Fallo de un servicio bloqueaba toda la consulta | Estados independientes; diferencia cuenta sin vincular, caducada y estado desconocido |
| assets/js/ApiClient.js; AuthView; IntegrationView | HTML, JSON corrupto y errores de red producían mensajes técnicos o errores sin controlar | Lectura segura, cookies, Accept JSON y mensajes claros con acción de recuperación |
| AuthView._submit | Posibles solicitudes repetidas de registro o login | Botón ocupado y bloqueo mientras se procesa |
| AuthView._handleOAuthResult | Regreso de integración anunciaba éxito aun sin sesión válida; error genérico sin servicio | Confirma sesión, identifica el servicio y vuelve a sus controles |
| FileWorkspaceView.upload/createGoogleDoc | Errores de red sin controlar; subidas repetidas; documento sin enlace si navegador bloquea ventana | Recuperación, botones ocupados, resultado parcial de múltiples archivos y enlace al documento confirmado |
| RecordingView.uploadYouTube | Errores técnicos y título Unicode no válido en cabecera | Cliente seguro, título codificado y confirmación de respuesta |
| server.js / readyGoogleClient | Credenciales renovadas no persistidas entre ejecuciones | Guarda las credenciales renovadas cifradas |
| server.js / Microsoft OAuth; lib/microsoft-scopes.js | Solicitaba Teams también a cuentas personales | Selección personal o trabajo/estudio; Teams solo para organización |
| server.js / OneDrive upload | Dependía de carpeta TaskMaster existente | Prepara esa misma carpeta si falta antes de subir |
| index.html / controles de consulta | Calendar, Classroom y Teams tenían rutas de consulta sin controles en la interfaz | Añade consulta de datos reales, estado vacío y errores; conserva enlaces a aplicaciones oficiales |

Se preservan el diseño y las rutas existentes. No se sustituyó Firebase por MySQL ni se modificaron credenciales. Respaldo local: backups/antes-auditoria-integraciones-20260930.zip.

Pruebas locales ejecutadas: 30 aprobadas, 0 fallidas. Comando: node --test --test-isolation=none tests/auth-session.test.js tests/security.test.js tests/integrations.test.js. Estas son pruebas unitarias con respuestas controladas; no son cuentas reales ni verificaciones completas de Google o Microsoft.

Fuentes oficiales y límites prácticos

- [Google OAuth de aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server): registro exacto de los callbacks y renovación de autorizaciones.
- [Microsoft: consultar equipos](https://learn.microsoft.com/en-us/graph/api/user-list-joinedteams?view=graph-rest-1.0): cuentas personales no admitidas.
- [Vercel: límites de funciones](https://vercel.com/docs/functions/limitations): las peticiones no pueden superar 4,5 MB. La interfaz limita las subidas directas a 4 MB y ofrece usar la aplicación oficial para archivos mayores. No se implementó subida reanudable de archivos grandes.

Comprobaciones reales pendientes

1. Google: registro exacto de ambos callbacks en el cliente de Google Cloud; pantalla de consentimiento y permisos completos con cuenta autorizada. [FALTA CONFIRMAR] APIs habilitadas, estado de publicación y usuarios permitidos si el proyecto está en modo de prueba.
2. Consultar Calendar y Classroom con cuenta real; crear documento y subir archivo únicamente cuando el usuario autorice el contenido de prueba.
3. Gmail: falta un destinatario y autorización explícita para enviar un correo de prueba. No se enviaron mensajes.
4. Microsoft: completar la configuración privada en Vercel y autorizar una cuenta real; comprobar OneDrive, calendario y Teams con la cuenta adecuada.
5. YouTube: autorizar una cuenta con canal y aprobar un video de prueba; verificar restricciones de la aplicación y visibilidad resultante. No se subieron videos.
6. Registro por correo: completar el formulario personalmente con un correo real y contraseña elegida por el usuario. El registro actual valida el formato, pero no verifica que se posea la dirección mediante un correo de confirmación. Google sí exige email_verified en su respuesta firmada. No se debe presentar el registro por correo como identidad verificada.
7. Nuevo login, cierre de sesión y ventana privada con cuentas reales. La restauración de una sesión existente ya se comprobó; no equivale a todo el flujo anterior.

No se declara que todas las integraciones estén perfectas. El informe distingue correcciones, evidencia real y verificaciones que requieren permisos o configuración externa.
