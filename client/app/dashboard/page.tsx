'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, Invoice, Stats, User, money } from '@/lib/api';
import InvoiceModal from '@/components/InvoiceModal';
import PaywallModal from '@/components/PaywallModal';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [modal, setModal] = useState<{ invoice?: Invoice } | null>(null);
  const [paywall, setPaywall] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([
        api<{ user: User }>('/auth/me'),
        api<{ invoices: Invoice[]; stats: Stats }>('/invoices'),
      ]);
      setUser(me.user); setInvoices(list.invoices); setStats(list.stats);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push('/login');
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => { await fn(); load(); };

  if (!user || !stats) return <main className="p-10 text-slate-500">Loading…</main>;

  const overdue = Object.entries(stats.overdueByCurrency);
  const atFreeLimit = user.plan === 'free' && stats.activeCount >= 2;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <span className="text-lg font-bold text-brand-600">NudgePay</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard/templates" className="hover:underline">Templates</Link>
          {user.plan === 'free'
            ? <button className="btn-primary" onClick={() => setPaywall(true)}>Upgrade</button>
            : <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-600">Pro</span>}
          <button className="text-slate-500 hover:underline" onClick={async () => { await api('/auth/logout', { method: 'POST', body: {} }); router.push('/'); }}>Log out</button>
        </nav>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Overdue</div>
          <div className="mt-1 text-xl font-bold text-rose-600">
            {overdue.length ? overdue.map(([c, v]) => <div key={c}>{money(v, c)}</div>) : '$0.00'}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Active invoices</div>
          <div className="mt-1 text-xl font-bold">{stats.activeCount}{user.plan === 'free' && <span className="text-sm font-normal text-slate-400"> / 2</span>}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Nudges sent</div>
          <div className="mt-1 text-xl font-bold">{invoices.reduce((n, i) => n + i.remindersSent, 0)}</div>
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Invoices</h1>
        <button className="btn-primary" onClick={() => (atFreeLimit ? setPaywall(true) : setModal({}))}>+ Add invoice</button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-3">Client</th><th className="p-3">Amount</th><th className="p-3">Due</th><th className="p-3">Status</th><th className="p-3">Nudges</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No invoices yet. Add one and NudgePay takes it from there.</td></tr>}
            {invoices.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="p-3"><div className="font-medium">{i.clientName}</div><div className="text-xs text-slate-500">{i.invoiceNumber || i.clientEmail}</div></td>
                <td className="p-3">{money(i.amountCents, i.currency)}</td>
                <td className="p-3">{i.dueDate}{i.status === 'active' && i.daysOverdue > 0 && <div className="text-xs text-rose-600">{i.daysOverdue}d overdue</div>}</td>
                <td className="p-3">
                  {i.status === 'paid' ? <span className="text-emerald-600">Paid</span> : i.paused ? <span className="text-amber-600">Paused</span> : 'Active'}
                </td>
                <td className="p-3">{i.remindersSent}</td>
                <td className="space-x-3 p-3 text-right text-xs">
                  {i.status === 'active' && <>
                    <button className="text-emerald-600 hover:underline" onClick={() => act(() => api(`/invoices/${i.id}/paid`, { method: 'POST', body: {} }))}>Mark paid</button>
                    <button className="hover:underline" onClick={() => act(() => api(`/invoices/${i.id}/pause`, { body: { paused: !i.paused } }))}>{i.paused ? 'Resume' : 'Pause'}</button>
                    <button className="hover:underline" onClick={() => setModal({ invoice: i })}>Edit</button>
                  </>}
                  <button className="text-rose-600 hover:underline" onClick={() => confirm('Delete this invoice?') && act(() => api(`/invoices/${i.id}`, { method: 'DELETE' }))}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <InvoiceModal invoice={modal.invoice} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          onPaywall={() => { setModal(null); setPaywall(true); }} />
      )}
      {paywall && <PaywallModal userId={user.id} email={user.email} onClose={() => setPaywall(false)} />}
    </main>
  );
}
