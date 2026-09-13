# Configuración de integraciones reales

TaskMaster mantiene el login separado del consentimiento para herramientas. Los tokens OAuth se cifran con AES-256-GCM y se guardan únicamente en Firestore (`_integrations`).

## 1. Clave de cifrado

Genera una clave una sola vez y cópiala en `.env` (nunca en Git):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```env
INTEGRATION_TOKEN_KEY=resultado_del_comando
```

Cambiar esta clave invalida los tokens ya almacenados.

## 2. Google Workspace y YouTube

En Google Cloud Console habilita Google Drive API, Google Docs API, Google Calendar API y YouTube Data API v3. Configura la pantalla de consentimiento y agrega como URI autorizada:

```text
http://localhost:3000/api/integrations/google/callback
```

Completa `.env` con el mismo cliente web utilizado por el proyecto y la nueva URI:

```env
GOOGLE_LOGIN_CLIENT_ID=
GOOGLE_LOGIN_CLIENT_SECRET=
GOOGLE_INTEGRATION_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback
```

En modo de prueba agrega los correos que podrán autorizar la aplicación. La publicación de YouTube se crea como `private` por seguridad.

## 3. Microsoft OneDrive

Registra una aplicación en Microsoft Entra, agrega la plataforma Web y esta URI:

```text
http://localhost:3000/api/integrations/microsoft/callback
```

Concede permisos delegados `User.Read` y `Files.ReadWrite`. Después configura:

```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/integrations/microsoft/callback
```

## 4. Reinicio y prueba

Después de modificar `.env`, reinicia `npm start`. Inicia sesión en TaskMaster, abre **Integraciones**, conecta Google o Microsoft y luego utiliza **Archivos** o **Grabaciones**.

No subas `.env`, secretos OAuth, claves de Firebase ni `INTEGRATION_TOKEN_KEY` al repositorio.
