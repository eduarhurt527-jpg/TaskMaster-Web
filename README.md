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

### Módulo de integraciones (opcional)

`integraciones/` es un microservicio Express aparte para notificaciones por correo (Brevo),
calendario, Drive/OneDrive y Classroom/Teams.

1. `cd integraciones && npm install`
2. Copia `integraciones/.env.example` a `integraciones/.env` y completa las variables (reutiliza la misma clave de servicio de Firebase).
3. `npm start`

## Estructura relevante

```
server.js              → servidor principal Node/Express + API REST sobre Firestore
assets/js/model/        → capa Model (consumo de API + fallback localStorage)
assets/js/viewmodel/     → capa ViewModel (estado de la app)
assets/js/view/          → capa View (DOM, eventos, botones)
assets/js/app.js         → coordinador de la app (App)
integraciones/           → microservicio de integraciones externas
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
- El acceso simulado con Google está deshabilitado hasta configurar una verificación OAuth
  real; las autorizaciones Google/Microsoft de `integraciones/` son independientes.
- Las sesiones duran siete días. Cerrar sesión elimina el registro en Firestore y vence la cookie.

Para producción, configura `NODE_ENV=production`, utiliza HTTPS y define `CORS_ORIGIN`
con el dominio exacto de la aplicación.
