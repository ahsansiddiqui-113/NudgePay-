// Escalating tone templates. Placeholders: {{client_name}} {{amount}} {{invoice_number}}
// {{due_date}} {{days_overdue}} {{payment_link}} {{sender_name}}

const DEFAULTS = {
  gentle: {
    subject: 'Friendly reminder: invoice {{invoice_number}} from {{sender_name}}',
    body:
      'Hi {{client_name}},\n\n' +
      'Just a quick nudge: invoice {{invoice_number}} for {{amount}} was due on {{due_date}}. ' +
      "It may have slipped through the cracks, so here's a link to make it easy:\n\n" +
      '{{payment_link}}\n\n' +
      'If you have already paid, thank you, and please ignore this note.\n\n' +
      'Best,\n{{sender_name}}',
  },
  firm: {
    subject: 'Following up: invoice {{invoice_number}} is {{days_overdue}} days overdue',
    body:
      'Hi {{client_name}},\n\n' +
      'I am following up on invoice {{invoice_number}} for {{amount}}, now {{days_overdue}} days past its due date of {{due_date}}. ' +
      'Could you let me know when I can expect payment? You can pay here:\n\n' +
      '{{payment_link}}\n\n' +
      'If there is an issue with the invoice, reply to this email and we will sort it out.\n\n' +
      'Thanks,\n{{sender_name}}',
  },
  final: {
    subject: 'Final notice: invoice {{invoice_number}} ({{amount}})',
    body:
      'Hi {{client_name}},\n\n' +
      'This is a final notice regarding invoice {{invoice_number}} for {{amount}}, now {{days_overdue}} days overdue (due {{due_date}}). ' +
      'Please arrange payment immediately to avoid further action:\n\n' +
      '{{payment_link}}\n\n' +
      'If you have already paid or need to discuss this, reply right away.\n\n' +
      'Regards,\n{{sender_name}}',
  },
};

const TONES = Object.keys(DEFAULTS);

function toneForStage(stageIndex, totalStages) {
  if (stageIndex === 0) return 'gentle';
  if (stageIndex === totalStages - 1) return 'final';
  return 'firm';
}

function formatMoney(cents, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(cents) / 100);
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${currency}`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));
}

/**
 * Render an email. `custom` is an optional {subject, body} row (Pro).
 * Returns { subject, text, html }.
 */
function renderEmail({ tone, custom, vars, showFooter }) {
  const tpl = custom || DEFAULTS[tone];
  const subject = fill(tpl.subject, vars);
  let text = fill(tpl.body, vars);
  if (showFooter) text += '\n\n--\nSent via NudgePay';

  const htmlBody = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
    // linkify the payment link (already escaped, so match the escaped form)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">${htmlBody}</div>`;
  return { subject, text, html };
}

module.exports = { DEFAULTS, TONES, toneForStage, formatMoney, renderEmail };
