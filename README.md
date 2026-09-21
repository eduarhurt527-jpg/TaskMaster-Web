# TaskMaster Web

Sistema web para gestión de tareas académicas.

## Stack actual

- Frontend: HTML5 + CSS3 + JavaScript (patrón MVVM)
- Backend: Node.js + Express
- Base de datos: Firebase Firestore
- Integraciones opcionales (correo, calendario, Drive, Classroom): carpeta `integraciones/`

> Nota: las carpetas `api/`, `config/`, `controllers/`, `models/` y `views/` contienen una
> versión previa del backend en PHP + MySQL (mysqli) que ya **no está en uso** — el proyecto
> migró a Node.js + Firebase. Se mantienen en el repositorio como referencia histórica del
> avance del proyecto, pero ningún archivo actual las invoca (no hay `index.php`).

## Instalación local (Node.js + Firebase)

1. Clona el repositorio y entra a la carpeta del proyecto.
2. Ejecuta `npm install`.
3. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) (o usa uno existente) y habilita **Firestore**.
4. Genera una clave de cuenta de servicio: *Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada*. Se descargará un archivo `.json`.
5. Copia `.env.example` a `.env` y, si guardaste la clave con otro nombre o ruta, actualiza `FIREBASE_SERVICE_ACCOUNT_PATH`. Por defecto se espera el archivo `serviceAccountKey.json` en la raíz del proyecto (este archivo nunca debe subirse a git; ya está en `.gitignore`).
6. Inicia el servidor con `npm start`.
7. Abre `http://localhost:3000/`.

Si `serviceAccountKey.json` falta o es inválido, el servidor lo indica claramente en consola y no arranca, en vez de fallar con un error críptico.

### Integraciones (opcionales)

`server.js` es el único backend activo. Expone autenticación, tareas y las rutas protegidas
de Google Workspace, YouTube y Microsoft 365 bajo el mismo origen. La carpeta
`integraciones/` conserva módulos históricos de referencia y no debe iniciarse como un
segundo servidor.

1. Completa las credenciales OAuth descritas en `.env.example`.
2. Genera `INTEGRATION_TOKEN_KEY` y mantenla fuera del repositorio.
3. Ejecuta `npm start` únicamente desde la raíz.

## Estructura relevante

```
server.js              → servidor principal Node/Express + API REST sobre Firestore
assets/js/model/        → capa Model (consumo de API + fallback localStorage)
assets/js/viewmodel/     → capa ViewModel (estado de la app)
assets/js/view/          → capa View (DOM, eventos, botones)
assets/js/app.js         → coordinador de la app (App)
integraciones/           → módulos heredados de referencia; no se inicia otro servidor
```

## Autenticación y modo invitado

- El registro y el inicio de sesión local generan una cookie `tm_session` con los atributos
  `HttpOnly`, `SameSite=Lax` y `Secure` cuando `NODE_ENV=production`.
- El valor sin procesar de la cookie nunca se guarda en Firestore: el servidor almacena
  solamente su hash SHA-256 en la colección interna `_sessions`.
- Las rutas `/api/tareas` obtienen el propietario desde la sesión validada. El backend no
  acepta `usuario_id` como prueba de identidad.
- Las tareas de un invitado permanecen exclusivamente en el `localStorage` de su navegador
  y no se mezclan con las cuentas registradas.
- El acceso con Google usa OAuth 2.0/OpenID Connect. El backend intercambia el código,
  verifica el ID token firmado, exige un correo verificado y crea la misma sesión segura.
  Las autorizaciones Google/Microsoft de `integraciones/` son independientes.
- Las sesiones duran siete días. Cerrar sesión elimina el registro en Firestore y vence la cookie.
- Los datos locales se separan entre `tm_tareas_guest` y `tm_tareas_user_<id>` para que
  cerrar sesión no muestre las tareas almacenadas en caché de otra cuenta.
- Los errores `401`, `403` y de red no se convierten en operaciones exitosas: solamente
  el modo invitado trabaja de forma local.
- El servidor publica únicamente `index.html` y `assets/`; las credenciales, archivos
  `.env`, logs y código interno nunca se sirven como archivos estáticos.
- Los endpoints de autenticación tienen límite de intentos, validación de email y una
  contraseña de al menos 8 caracteres (máximo 72 bytes, límite seguro de bcrypt).

### Estados de la interfaz

La interfaz usa un control central con tres estados:

- `PUBLIC`: muestra únicamente la landing, información, integraciones, nosotros y contacto.
- `GUEST`: habilita el espacio de tareas local con `tm_tareas_guest`; bloquea integraciones.
- `AUTHENTICATED`: habilita tareas persistentes e integraciones protegidas por sesión.

La gestión no aparece hasta que la persona inicia sesión, se registra, usa Google real o
elige explícitamente **Continuar como invitado**. El rediseño y sus fuentes están documentados
en `docs/UX-RESEARCH.md` y `docs/ASSET-SOURCES.md`.

Para producción, configura `NODE_ENV=production`, utiliza HTTPS y define `CORS_ORIGIN`
con el dominio exacto de la aplicación.

### Configurar el inicio de sesión real con Google

1. En Google Cloud Console configura la pantalla de consentimiento OAuth.
2. Crea credenciales de tipo **ID de cliente OAuth 2.0 → Aplicación web**.
3. Agrega `http://localhost:3000` como origen JavaScript autorizado.
4. Agrega `http://localhost:3000/api/auth/google/callback` como URI de redirección.
5. Copia el ID y el secreto en el archivo `.env` principal:

```dotenv
GOOGLE_LOGIN_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_LOGIN_CLIENT_SECRET=tu-client-secret
GOOGLE_LOGIN_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

El flujo solicita únicamente `openid`, `email` y `profile`. TaskMaster nunca recibe la
contraseña de Google ni guarda los tokens OAuth usados para iniciar sesión. Si el proyecto
OAuth está en modo de prueba, agrega cada correo permitido en **Usuarios de prueba**.

## Seguridad de integraciones OAuth

`server.js` es el único backend activo y expone autenticación, tareas e integraciones bajo
el mismo origen. El comando `npm start` dentro de `integraciones/` está bloqueado para evitar
levantar accidentalmente un segundo backend.

- Cada conexión Google o Microsoft pertenece al `usuario_id` autenticado.
- OAuth usa `state` de un solo uso y PKCE S256; el verificador se conserva diez minutos en
  Firestore y se consume durante el callback.
- Los access y refresh tokens se cifran con AES-256-GCM antes de guardarse en Firestore.
- Calendar, Drive, Classroom, OneDrive, Teams, email e ICS requieren sesión.
- Gmail solicita únicamente `gmail.send`: permite enviar desde la cuenta vinculada, pero no
  leer la bandeja de entrada. Después de incorporar este permiso, las conexiones Google
  existentes deben volver a autorizarse una vez.
- YouTube se vincula mediante un flujo OAuth independiente porque Google no permite solicitar
  `drive.file` y `youtube.upload` juntos. Configura `YOUTUBE_INTEGRATION_REDIRECT_URI` y registra
  esa URI en el mismo cliente web de Google Cloud.
- Los adjuntos y registros incluyen el propietario y no aceptan tareas de otra cuenta.
- La interfaz permite reconectar o desconectar cada proveedor. Google y YouTube intentan revocar el token remoto antes de borrar la copia cifrada; Microsoft elimina el refresh token cifrado para impedir nuevas renovaciones.

Antes de iniciar el microservicio genera su clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia el resultado en el `.env` de la raíz como `INTEGRATION_TOKEN_KEY`. Mantén esa
clave fuera de Git y respaldada en un gestor de secretos: si se pierde, los tokens existentes
no podrán descifrarse y cada usuario deberá volver a conectar sus cuentas.

Las versiones anteriores guardaban documentos compartidos llamados
`int_oauth_tokens/google` e `int_oauth_tokens/microsoft`. El código nuevo no los utiliza.
Antes de producción revoca esas autorizaciones en Google/Microsoft y elimina esos dos
documentos antiguos de Firestore para retirar cualquier token heredado sin cifrar.
