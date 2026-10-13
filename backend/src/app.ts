import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import api from './routes';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: env.clientUrl.split(',').map((s) => s.trim()),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json({ limit: '100kb' }));
if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api', api);

app.use(notFound);
app.use(errorHandler);

export default app;
