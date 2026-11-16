const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { setAuthCookie, COOKIE } = require('../middleware/authMiddleware');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  businessName: u.business_name,
  replyToEmail: u.reply_to_email,
  plan: u.plan,
  reminderDays: u.reminder_days,
});

exports.signup = async (req, res) => {
  const { email, password, businessName } = req.body || {};
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Valid email required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const hash = await bcrypt.hash(password, 11);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, business_name) VALUES ($1,$2,$3) RETURNING *',
      [email.toLowerCase().trim(), hash, businessName?.trim() || null]
    );
    setAuthCookie(res, rows[0].id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email || '').toLowerCase().trim()]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(String(password || ''), user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  setAuthCookie(res, user.id);
  res.json({ user: publicUser(user) });
};

exports.logout = (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
};

exports.me = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: publicUser(rows[0]) });
};

// Pro-gated settings: custom reminder schedule + Reply-To branding.
exports.updateSettings = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = rows[0];
  const { businessName, replyToEmail, reminderDays } = req.body || {};
  const wantsPro = replyToEmail !== undefined || reminderDays !== undefined;

  if (wantsPro && user.plan !== 'pro') {
    return res.status(402).json({ code: 'PAYWALL', error: 'Custom schedule and Reply-To require Pro' });
  }
  if (reminderDays !== undefined) {
    const ok =
      Array.isArray(reminderDays) &&
      reminderDays.length >= 1 && reminderDays.length <= 6 &&
      reminderDays.every((d) => Number.isInteger(d) && d >= 1 && d <= 365) &&
      reminderDays.every((d, i) => i === 0 || d > reminderDays[i - 1]);
    if (!ok) return res.status(400).json({ error: 'reminderDays must be 1-6 strictly increasing integers (1-365)' });
  }
  if (replyToEmail && !EMAIL_RE.test(replyToEmail)) return res.status(400).json({ error: 'Invalid Reply-To email' });

  const upd = await pool.query(
    `UPDATE users SET
       business_name  = COALESCE($2, business_name),
       reply_to_email = CASE WHEN $3::boolean THEN $4 ELSE reply_to_email END,
       reminder_days  = COALESCE($5, reminder_days)
     WHERE id = $1 RETURNING *`,
    [req.userId, businessName ?? null, replyToEmail !== undefined, replyToEmail || null, reminderDays ?? null]
  );
  res.json({ user: publicUser(upd.rows[0]) });
};

// Pro-gated custom templates.
exports.listTemplates = async (req, res) => {
  const { rows } = await pool.query('SELECT tone, subject, body FROM email_templates WHERE user_id = $1', [req.userId]);
  res.json({ templates: rows });
};

exports.saveTemplate = async (req, res) => {
  const { rows } = await pool.query('SELECT plan FROM users WHERE id = $1', [req.userId]);
  if (rows[0].plan !== 'pro') return res.status(402).json({ code: 'PAYWALL', error: 'Custom templates require Pro' });

  const { tone, subject, body } = req.body || {};
  if (!['gentle', 'firm', 'final'].includes(tone)) return res.status(400).json({ error: 'Invalid tone' });
  if (!subject?.trim() || !body?.trim()) return res.status(400).json({ error: 'Subject and body required' });
  if (subject.length > 200 || body.length > 5000) return res.status(400).json({ error: 'Template too long' });

  await pool.query(
    `INSERT INTO email_templates (user_id, tone, subject, body) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, tone) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now()`,
    [req.userId, tone, subject.trim(), body]
  );
  res.json({ ok: true });
};
