const pool = require('../config/db');

const FREE_ACTIVE_LIMIT = 2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const shape = (r) => ({
  id: r.id,
  clientName: r.client_name,
  clientEmail: r.client_email,
  invoiceNumber: r.invoice_number,
  amountCents: Number(r.amount_cents),
  currency: r.currency,
  dueDate: r.due_date, // YYYY-MM-DD (pg date parser disabled in server.js)
  paymentLink: r.payment_link,
  status: r.status,
  paused: r.paused,
  remindersSent: r.reminders_sent,
  lastNudgeAt: r.last_nudge_at,
  daysOverdue: r.days_overdue != null ? Number(r.days_overdue) : undefined,
});

function validate(b, partial = false) {
  const out = {};
  const need = (k) => !partial || b[k] !== undefined;

  if (need('clientName')) {
    if (!b.clientName?.trim()) return { error: 'Client name required' };
    out.client_name = b.clientName.trim().slice(0, 200);
  }
  if (need('clientEmail')) {
    if (!EMAIL_RE.test(b.clientEmail || '')) return { error: 'Valid client email required' };
    out.client_email = b.clientEmail.trim().toLowerCase();
  }
  if (need('amount')) {
    const n = Number(b.amount);
    if (!Number.isFinite(n) || n <= 0 || n > 1e9) return { error: 'Amount must be a positive number' };
    out.amount_cents = Math.round(n * 100);
  }
  if (need('currency')) {
    const c = String(b.currency || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return { error: 'Currency must be a 3-letter code' };
    out.currency = c;
  }
  if (need('dueDate')) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || '') || Number.isNaN(Date.parse(b.dueDate))) return { error: 'Due date must be YYYY-MM-DD' };
    out.due_date = b.dueDate;
  }
  if (b.paymentLink !== undefined) {
    if (b.paymentLink) {
      try {
        const u = new URL(b.paymentLink);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        return { error: 'Payment link must be a valid http(s) URL' };
      }
    }
    out.payment_link = b.paymentLink || null;
  }
  if (b.invoiceNumber !== undefined) out.invoice_number = b.invoiceNumber?.trim().slice(0, 60) || null;
  return { values: out };
}

const SELECT = `SELECT *, (CURRENT_DATE - due_date) AS days_overdue FROM invoices`;

exports.list = async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT} WHERE user_id = $1 AND status <> 'cancelled' ORDER BY (status = 'active') DESC, due_date ASC`,
    [req.userId]
  );
  const invoices = rows.map(shape);
  const overdueByCurrency = {};
  for (const i of invoices) {
    if (i.status === 'active' && i.daysOverdue > 0) {
      overdueByCurrency[i.currency] = (overdueByCurrency[i.currency] || 0) + i.amountCents;
    }
  }
  const active = invoices.filter((i) => i.status === 'active').length;
  res.json({ invoices, stats: { overdueByCurrency, activeCount: active } });
};

exports.create = async (req, res) => {
  const { values, error } = validate(req.body || {});
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the user row so concurrent creates can't bypass the free-tier cap.
    const u = await client.query('SELECT plan FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    if (u.rows[0].plan !== 'pro') {
      const c = await client.query(`SELECT count(*)::int AS n FROM invoices WHERE user_id = $1 AND status = 'active'`, [req.userId]);
      if (c.rows[0].n >= FREE_ACTIVE_LIMIT) {
        await client.query('ROLLBACK');
        return res.status(402).json({ code: 'PAYWALL', error: `Free plan is limited to ${FREE_ACTIVE_LIMIT} active invoices` });
      }
    }
    const { rows } = await client.query(
      `INSERT INTO invoices (user_id, client_name, client_email, invoice_number, amount_cents, currency, due_date, payment_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [req.userId, values.client_name, values.client_email, values.invoice_number ?? null, values.amount_cents, values.currency, values.due_date, values.payment_link ?? null]
    );
    await client.query('COMMIT');
    const inv = await pool.query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ invoice: shape(inv.rows[0]) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
};

exports.update = async (req, res) => {
  const { values, error } = validate(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(values);
  if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });

  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE invoices SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.userId, ...keys.map((k) => values[k])]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  const inv = await pool.query(`${SELECT} WHERE id = $1`, [rows[0].id]);
  res.json({ invoice: shape(inv.rows[0]) });
};

exports.markPaid = async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING id`,
    [req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Active invoice not found' });
  res.json({ ok: true });
};

exports.setPaused = async (req, res) => {
  const paused = !!req.body?.paused;
  const { rows } = await pool.query(
    `UPDATE invoices SET paused = $3 WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING id`,
    [req.params.id, req.userId, paused]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Active invoice not found' });
  res.json({ ok: true });
};

exports.remove = async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM invoices WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (!rowCount) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ ok: true });
};
