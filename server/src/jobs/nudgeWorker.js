const cron = require('node-cron');
const { Resend } = require('resend');
const pool = require('../config/db');
const { toneForStage, formatMoney, renderEmail } = require('../utils/emailTemplates');

const DEFAULT_SCHEDULE = [1, 7, 14];
let resend;
const getResend = () => (resend ||= new Resend(process.env.RESEND_API_KEY));

/** Highest schedule stage whose day-threshold has been reached and not yet sent. */
function pendingStage(schedule, daysOverdue, sentStages) {
  for (let i = schedule.length - 1; i >= 0; i--) {
    if (daysOverdue >= schedule[i]) return sentStages.has(i) ? null : i;
  }
  return null;
}

async function processInvoice(inv, templatesByUser) {
  const isPro = inv.plan === 'pro';
  const schedule = isPro && inv.reminder_days?.length ? inv.reminder_days : DEFAULT_SCHEDULE;
  const sent = new Set(inv.sent_stages || []);
  const stage = pendingStage(schedule, Number(inv.days_overdue), sent);
  if (stage === null) return false;

  // Claim the stage first; the UNIQUE(invoice_id, stage) makes concurrent runs safe.
  const claim = await pool.query(
    'INSERT INTO reminder_logs (invoice_id, stage, tone) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',
    [inv.id, stage, toneForStage(stage, schedule.length)]
  );
  if (!claim.rows[0]) return false;
  const tone = toneForStage(stage, schedule.length);

  const custom = isPro ? templatesByUser.get(inv.user_id)?.[tone] : undefined;
  const senderName = inv.business_name || inv.user_email;
  const { subject, text, html } = renderEmail({
    tone,
    custom,
    showFooter: !isPro,
    vars: {
      client_name: inv.client_name,
      amount: formatMoney(inv.amount_cents, inv.currency),
      invoice_number: inv.invoice_number || '',
      due_date: inv.due_date,
      days_overdue: String(inv.days_overdue),
      payment_link: inv.payment_link || '',
      sender_name: senderName,
    },
  });

  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM,
      to: inv.client_email,
      replyTo: isPro && inv.reply_to_email ? inv.reply_to_email : inv.user_email,
      subject,
      text,
      html,
    });
    if (error) throw new Error(error.message || 'Resend error');
    await pool.query('UPDATE reminder_logs SET provider_id = $2 WHERE id = $1', [claim.rows[0].id, data?.id || null]);
    await pool.query('UPDATE invoices SET reminders_sent = reminders_sent + 1, last_nudge_at = now() WHERE id = $1', [inv.id]);
    return true;
  } catch (e) {
    // Release the claim so tomorrow's run retries.
    await pool.query('DELETE FROM reminder_logs WHERE id = $1', [claim.rows[0].id]);
    console.error(`[worker] send failed for invoice ${inv.id}:`, e.message);
    return false;
  }
}

async function runNudges() {
  const started = Date.now();
  const { rows } = await pool.query(`
    SELECT i.*, (CURRENT_DATE - i.due_date) AS days_overdue,
           u.plan, u.reminder_days, u.reply_to_email, u.business_name, u.email AS user_email,
           COALESCE((SELECT array_agg(stage) FROM reminder_logs r WHERE r.invoice_id = i.id), '{}') AS sent_stages
    FROM invoices i JOIN users u ON u.id = i.user_id
    WHERE i.status = 'active' AND i.paused = FALSE AND i.due_date < CURRENT_DATE`);

  const proIds = [...new Set(rows.filter((r) => r.plan === 'pro').map((r) => r.user_id))];
  const templatesByUser = new Map();
  if (proIds.length) {
    const t = await pool.query('SELECT user_id, tone, subject, body FROM email_templates WHERE user_id = ANY($1)', [proIds]);
    for (const r of t.rows) {
      if (!templatesByUser.has(r.user_id)) templatesByUser.set(r.user_id, {});
      templatesByUser.get(r.user_id)[r.tone] = { subject: r.subject, body: r.body };
    }
  }

  let sent = 0;
  for (const inv of rows) {
    if (await processInvoice(inv, templatesByUser)) sent++;
  }
  console.log(`[worker] checked ${rows.length} overdue invoices, sent ${sent} nudges in ${Date.now() - started}ms`);
  return sent;
}

function startNudgeWorker() {
  const schedule = process.env.CRON_SCHEDULE || '0 9 * * *';
  cron.schedule(
    schedule,
    () => runNudges().catch((e) => console.error('[worker] run failed', e)),
    { timezone: process.env.CRON_TIMEZONE || 'UTC', noOverlap: true, name: 'nudge-daily' }
  );
  console.log(`[worker] scheduled "${schedule}"`);
}

module.exports = { startNudgeWorker, runNudges, pendingStage };
