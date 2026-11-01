# Revisión del backend y Google

## Comprobación local

Se revisaron server.js, AuthView, el estado de integraciones y las pruebas existentes. El backend activo utiliza Node.js, Express y Firestore; no utiliza los endpoints PHP históricos para autenticar. Microsoft no está en las rutas activas.

El acceso Google verifica el ID token firmado, su audiencia y email_verified. La sesión del servidor determina el usuario de tareas e integraciones. Las conexiones de Google y YouTube son independientes y sus tokens se cifran antes de almacenarlos.

## Correcciones

Los callbacks leían y eliminaban el estado OAuth en operaciones separadas. Ahora lo consumen mediante una transacción de Firestore, con validación de caducidad, proveedor, propietario y verificador PKCE. Los retornos cancelados, incompletos o con parámetros de tipo incorrecto se rechazan antes del intercambio de código.

El inicio de sesión Google incorpora PKCE S256. Esto también requiere iniciar de nuevo cualquier autorización de login comenzada antes del despliegue; no revoca las sesiones existentes.

Copia previa: backups/antes-revision-google-20261101/server.js.

Validación: sintaxis de server.js correcta y 38 pruebas automatizadas aprobadas, ninguna fallida. Los tests del consumo de estado comprueban validación y reutilización secuencial con un doble de almacenamiento; no sustituyen una prueba de concurrencia contra Firestore real.

## Pendientes y límites

- No se creó ninguna cuenta falsa, ni se enviaron correos ni vídeos en esta revisión.
- Falta repetir login Google, salida, registro local y operaciones de servicios con cuenta real en el dominio publicado.
- No se inspeccionó la configuración privada actual de Google Cloud ni de Vercel. Si OAuth sigue en Testing, las autorizaciones ampliadas pueden requerir renovación tras siete días.
- El indicador VINCULADA confirma que hay credenciales almacenadas utilizables según sus fechas; no consulta a Google para demostrar que los permisos no fueron revocados.
- El registro local no verifica propiedad del correo; las carreras entre registros del mismo email requieren revisar unicidad transaccional en otra corrección.
- /api/notify registra una notificación en un archivo, no envía correo. El envío real usa /api/integrations/google/gmail/send.
- YouTube: falta subida privada real. La revisión no demuestra resolución completa de todos los servicios.

Fuente técnica: https://developers.google.com/identity/protocols/oauth2/web-server
