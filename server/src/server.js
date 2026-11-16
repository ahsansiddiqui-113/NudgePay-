require('dotenv').config();
require('express-async-errors'); // forwards async handler rejections to the error middleware
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const { startNudgeWorker, runNudges } = require('./jobs/nudgeWorker');
const { requireAuth } = require('./middleware/authMiddleware');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));

// Webhooks first: they need the raw body, before express.json().
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }));
app.use('/api/auth/signup', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 }));
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);

// Dev helper: trigger the worker manually.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/run-worker', requireAuth, async (_req, res) => res.json({ sent: await runNudges() }));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`[api] listening on :${port}`);
  if (process.env.RUN_WORKER !== 'false') startNudgeWorker();
});
