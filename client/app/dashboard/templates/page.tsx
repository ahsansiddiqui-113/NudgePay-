'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, User } from '@/lib/api';
import PaywallModal from '@/components/PaywallModal';
import NudgeTimeline from '@/components/NudgeTimeline';

const TONES = ['gentle', 'firm', 'final'] as const;
type Tone = (typeof TONES)[number];
type Tpl = { subject: string; body: string };

const DEFAULTS: Record<Tone, Tpl> = {
  gentle: { subject: 'Friendly reminder: invoice {{invoice_number}} from {{sender_name}}', body: 'Hi {{client_name}},\n\nJust a quick nudge: invoice {{invoice_number}} for {{amount}} was due on {{due_date}}. Pay here:\n\n{{payment_link}}\n\nBest,\n{{sender_name}}' },
  firm: { subject: 'Following up: invoice {{invoice_number}} is {{days_overdue}} days overdue', body: 'Hi {{client_name}},\n\nInvoice {{invoice_number}} for {{amount}} is now {{days_overdue}} days overdue. Could you let me know when to expect payment?\n\n{{payment_link}}\n\nThanks,\n{{sender_name}}' },
  final: { subject: 'Final notice: invoice {{invoice_number}} ({{amount}})', body: 'Hi {{client_name}},\n\nThis is a final notice for invoice {{invoice_number}} ({{amount}}), {{days_overdue}} days overdue. Please pay immediately:\n\n{{payment_link}}\n\nRegards,\n{{sender_name}}' },
};

export default function Templates() {
  const [user, setUser] = useState<User | null>(null);
  const [tpls, setTpls] = useState<Record<Tone, Tpl>>(DEFAULTS);
  const [days, setDays] = useState('1, 7, 14');
  const [replyTo, setReplyTo] = useState('');
  const [paywall, setPaywall] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const me = await api<{ user: User }>('/auth/me').catch(() => null);
      if (!me) { window.location.href = '/login'; return; }
      setUser(me.user);
      setDays(me.user.reminderDays.join(', '));
      setReplyTo(me.user.replyToEmail || '');
      const { templates } = await api<{ templates: (Tpl & { tone: Tone })[] }>('/auth/templates');
      setTpls((cur) => templates.reduce((a, t) => ({ ...a, [t.tone]: { subject: t.subject, body: t.body } }), cur));
    })();
  }, []);

  async function save() {
    setMsg('');
    try {
      for (const tone of TONES) await api('/auth/templates', { method: 'PUT', body: { tone, ...tpls[tone] } });
      const reminderDays = days.split(',').map((d) => parseInt(d.trim(), 10));
      await api('/auth/settings', { method: 'PATCH', body: { reminderDays, replyToEmail: replyTo } });
      setMsg('Saved.');
    } catch (e) {
      if (e instanceof ApiError && e.isPaywall) setPaywall(true);
      else setMsg(e instanceof ApiError ? e.message : 'Failed to save');
    }
  }

  if (!user) return <main className="p-10 text-slate-500">Loading…</main>;
  const parsedDays = days.split(',').map((d) => parseInt(d.trim(), 10)).filter(Number.isFinite);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/dashboard" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="mt-3 text-2xl font-bold">Reminder templates {user.plan === 'free' && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">Pro</span>}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Placeholders: <code>{'{{client_name}} {{amount}} {{invoice_number}} {{due_date}} {{days_overdue}} {{payment_link}} {{sender_name}}'}</code>
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {TONES.map((t) => (
            <div key={t} className="rounded-xl border bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold capitalize">{t}</h2>
              <input className="input mb-2" value={tpls[t].subject} onChange={(e) => setTpls({ ...tpls, [t]: { ...tpls[t], subject: e.target.value } })} />
              <textarea className="input h-36 font-mono text-xs" value={tpls[t].body} onChange={(e) => setTpls({ ...tpls, [t]: { ...tpls[t], body: e.target.value } })} />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div><label className="label">Send on days after due date</label><input className="input" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div><label className="label">Reply-To email (removes footer)</label><input className="input" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} /></div>
          <button className="btn-primary w-full" onClick={save}>Save changes</button>
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
          <NudgeTimeline days={parsedDays} />
        </div>
      </div>
      {paywall && <PaywallModal userId={user.id} email={user.email} onClose={() => setPaywall(false)} />}
    </main>
  );
}
