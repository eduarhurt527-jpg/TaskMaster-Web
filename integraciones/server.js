import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './lib/firestore.js';
import tareasRouter from './routes/tareas.js';
import emailRouter from './routes/email.js';
import icsRouter from './routes/ics.js';
import oauthGoogleRouter from './routes/oauthGoogle.js';
import oauthMicrosoftRouter from './routes/oauthMicrosoft.js';
import googleCalendarRouter from './routes/googleCalendar.js';
import googleDriveRouter from './routes/googleDrive.js';
import oneDriveRouter from './routes/oneDrive.js';
import teamsRouter from './routes/teams.js';
import classroomRouter from './routes/classroom.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from './lib/sessionAuth.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3002;

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.MAIN_API_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin || allowedOrigins.includes(origin)) return next();
  return res.status(403).json({ success: false, error: 'Origen de solicitud no permitido.' });
}

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' },
});

app.use('/api', apiLimiter, requireTrustedOrigin, requireAuth);
app.use('/auth', requireTrustedOrigin, oauthLimiter);
app.use('/api', tareasRouter);
app.use('/api', emailRouter);
app.use('/api', icsRouter);
app.use(oauthGoogleRouter);
app.use(oauthMicrosoftRouter);
app.use(googleCalendarRouter);
app.use(googleDriveRouter);
app.use(oneDriveRouter);
app.use(teamsRouter);
app.use(classroomRouter);

db.collection('_healthcheck').limit(1).get()
  .then(() => console.log('✅ Integraciones: Firestore conectado correctamente'))
  .catch(err => console.error('❌ Integraciones: error conectando a Firestore:', err.message));

app.listen(port, () => {
  console.log(`TaskMaster Integraciones corriendo en http://localhost:${port}`);
});
