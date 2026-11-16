const crypto = require('crypto');
const pool = require('../config/db');

// Paddle-Signature: "ts=1671552777;h1=<hex hmac sha256 of `${ts}:${rawBody}`>"
function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=')));
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window
  const expected = crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(h1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const proPriceIds = () => (process.env.PADDLE_PRO_PRICE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

exports.paddle = async (req, res) => {
  const raw = req.body.toString('utf8'); // express.raw
  if (!verifySignature(raw, req.get('Paddle-Signature'), process.env.PADDLE_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Bad signature' });
  }

  const event = JSON.parse(raw);
  const { event_id: eventId, event_type: type, data } = event;

  const seen = await pool.query('INSERT INTO webhook_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id', [eventId]);
  if (!seen.rows[0]) return res.json({ ok: true, duplicate: true });

  try {
    if (type.startsWith('subscription.')) await handleSubscription(type, data);
  } catch (e) {
    // Un-claim so Paddle's retry can reprocess.
    await pool.query('DELETE FROM webhook_events WHERE event_id = $1', [eventId]);
    throw e;
  }
  res.json({ ok: true });
};

async function handleSubscription(type, data) {
  const userId = data.custom_data?.user_id;
  const subId = data.id;
  const status = data.status; // active | trialing | past_due | paused | canceled

  // Only treat as Pro if the subscription contains one of our Pro prices (when configured).
  const prices = proPriceIds();
  const itemPrices = (data.items || []).map((i) => i.price?.id);
  const isProPrice = !prices.length || itemPrices.some((p) => prices.includes(p));

  const entitled = isProPrice && ['active', 'trialing', 'past_due'].includes(status) && type !== 'subscription.canceled';
  const plan = entitled ? 'pro' : 'free';

  const where = userId ? 'id = $1' : 'paddle_subscription_id = $1';
  await pool.query(
    `UPDATE users SET plan = $2, paddle_customer_id = COALESCE($3, paddle_customer_id),
       paddle_subscription_id = $4, subscription_status = $5
     WHERE ${where}`,
    [userId || subId, plan, data.customer_id || null, subId, status]
  );
}
