Rama de trabajo: `security/secure-session-auth`.
Base recuperada: commit `c6221c7`, repositorio `eduarhurt527-jpg/TaskMaster-Web`.

La copia antigua de septiembre no corresponde al diseño final. El backend activo de esta rama es Node.js + Express + Firebase Firestore; PHP y MySQL se conservan en el repositorio como historial. Las correcciones PHP de la primera revisión no deben publicarse sobre esta versión.

Errores comprobados y correcciones

| Archivo / función | Error | Corrección |
|---|---|---|
| `server.js`, middleware CORS | Solo aceptaba la lista de `CORS_ORIGIN`; rechazaba solicitudes del propio dominio cuando esa lista conservaba otro dominio. El rechazo terminaba en una página HTML de error 500. | CORS y protección de API comparten la validación de origen. Se acepta el origen exacto del servidor o un origen configurado explícitamente; otros orígenes reciben JSON 403. |
| `assets/js/view/AuthView.js`, `_restoreUser`, `_submit`, `logout` | Analizaba directamente JSON incluso ante una respuesta HTML o vacía. | Lectura y validación segura con `_requestAuth`; comprueba HTTP, Content-Type, estructura y usuario. |
| `AuthView._handleOAuthResult` | `?login=google` mostraba éxito aunque la sesión no se recuperara. | Solo muestra éxito si hay un usuario y estado autenticado. Una sesión válida abre el espacio de trabajo; una respuesta fallida muestra un error y conserva la portada pública. |
| `AuthView.logout` | Anunciaba cierre de sesión aunque el servidor fallara. | Solo limpia el estado local tras confirmar la revocación en el servidor. |
| `server.js`, ruta final y errores | Una API GET inexistente podía devolver el HTML de la portada; los errores de middleware podían producir HTML. | Respuestas JSON 404 para API desconocida y errores JSON seguros. |

El diseño se conserva: `index.html`, hojas CSS, ilustraciones, imágenes y video no se modificaron.

Comprobación pública realizada sin cookies ni contraseñas:

| Método y ruta | Estado | Respuesta |
|---|---|---|
| POST `https://www.taskmaster-app.com/api/auth?action=session` | 500 | HTML «Internal Server Error» |
| POST `https://taskmaster-app.com/api/auth?action=session` | 308 | Redirección al dominio con www |
| POST `https://task-master-web-xi.vercel.app/api/auth?action=session` | 401 | JSON de sesión no válida, esperado al no enviar cookie |

Estos resultados corresponden al sitio antes de publicar la corrección. No se inspeccionaron ni cambiaron variables privadas del despliegue. La diferencia de respuesta y el rechazo en el código señalan la validación del origen; la configuración efectiva de `CORS_ORIGIN` en Vercel permanece `[FALTA CONFIRMAR]`.

Pruebas locales: `node --test tests/*.test.js`, 17 aprobadas, 0 fallidas. Incluyen regreso de Google válido, HTTP 500 HTML, 401, JSON corrupto, respuesta vacía, falta de usuario, origen www, rechazo de dominios ajenos y las comprobaciones de seguridad existentes. Además, 5 pruebas HTTP del middleware real con Express y CORS verificaron respuestas JSON 401, 403, 400 y 404, sin utilizar Firebase ni credenciales. Los tiempos están en `RESULTADOS_HTTP_LOCAL.json`. No equivalen a completar OAuth con una cuenta real en producción.

Pendientes de verificación tras publicar:

1. Iniciar Google con una cuenta de prueba y verificar que se abre el panel y aparece el usuario.
2. Listar, crear, editar, completar y eliminar una tarea de prueba en Firestore.
3. Recargar y confirmar persistencia; cerrar sesión y comprobar que no se muestran datos privados.
4. Repetir en ventana privada y registrar métodos, estados HTTP, respuestas y tiempos en Network.
5. Confirmar que cookies OAuth y sesión pertenecen al mismo dominio de retorno y que se usan las variables del proyecto correcto.

Publicación segura

La corrección local no fue subida a GitHub ni desplegada. No se deben subir estos archivos a un hosting PHP como si fuera la versión anterior. El trabajo previo usa un despliegue Node.js en Vercel.

Archivos del parche: `server.js`, `lib/request-origin.js`, `assets/js/view/AuthView.js`; pruebas: `tests/auth-session.test.js`, `tests/security.test.js`. El respaldo anterior a modificar está en `backups/antes-correccion-sesion-20260930.zip`; conservarlo localmente y excluir `backups/` del repositorio y despliegue.

Aplicar el parche a la rama indicada, revisar el diff, ejecutar las pruebas y desplegar en el proyecto que sirve `www.taskmaster-app.com`. Conservar el despliegue previo para poder restaurarlo; no borrar sitios, base de datos, documentos Firestore ni credenciales. No hacen falta cambios de diseño ni migraciones MySQL para esta corrección.

Corrección adicional del acceso al panel: AuthView._restoreUser cerraba automáticamente la sesión al visitar / sin parámetros. Ahora comprueba la cookie del servidor también en la raíz y abre workspace si la sesión es válida. Sin sesión mantiene la portada. Se conservan el diseño y el cierre de sesión explícito. Respaldo: backups/antes-restauracion-panel-20260930.zip. Validación actualizada: 19 pruebas aprobadas, 0 fallidas (node --test --test-isolation=none tests/auth-session.test.js tests/security.test.js). La publicación y la prueba con una cuenta real siguen pendientes.

Estado final: corrección subida a security/secure-session-auth, commit 020a534e20aeb3ced85a3e4b23a2c722b0f63353. Vercel confirmó despliegue success. Se comprobó en www.taskmaster-app.com la restauración de una sesión existente, apertura de Mi panel y formulario Nueva tarea, y persistencia del acceso después de recargar. Consola comprobada sin errores ni advertencias. Sin cookies, POST session devuelve JSON 401 tanto en www como en Vercel; el dominio sin www redirige 308 al dominio canónico. La creación, edición y eliminación de datos reales y un nuevo flujo completo de OAuth siguen sin ejecutar en esta comprobación. Captura local: panel-publicado-corregido.png.
