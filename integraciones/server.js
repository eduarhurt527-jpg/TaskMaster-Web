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
import { requireMainSession } from './lib/mainSession.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3002;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(',').map(value => value.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', requireMainSession);
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
