'use client';
import { useState } from 'react';
import { api, ApiError, Invoice } from '@/lib/api';

interface Props { invoice?: Invoice; onClose: () => void; onSaved: () => void; onPaywall: () => void }

export default function InvoiceModal({ invoice, onClose, onSaved, onPaywall }: Props) {
  const [f, setF] = useState({
    clientName: invoice?.clientName ?? '',
    clientEmail: invoice?.clientEmail ?? '',
    invoiceNumber: invoice?.invoiceNumber ?? '',
    amount: invoice ? String(invoice.amountCents / 100) : '',
    currency: invoice?.currency ?? 'USD',
    dueDate: invoice?.dueDate ?? new Date().toISOString().slice(0, 10),
    paymentLink: invoice?.paymentLink ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(invoice ? `/invoices/${invoice.id}` : '/invoices', { method: invoice ? 'PATCH' : 'POST', body: f });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.isPaywall) onPaywall();
      else setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">{invoice ? 'Edit invoice' : 'Add invoice'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Client name</label><input className="input" required value={f.clientName} onChange={set('clientName')} /></div>
          <div><label className="label">Client email</label><input className="input" type="email" required value={f.clientEmail} onChange={set('clientEmail')} /></div>
          <div><label className="label">Invoice #</label><input className="input" value={f.invoiceNumber} onChange={set('invoiceNumber')} /></div>
          <div><label className="label">Due date</label><input className="input" type="date" required value={f.dueDate} onChange={set('dueDate')} /></div>
          <div><label className="label">Amount</label><input className="input" type="number" step="0.01" min="0.01" required value={f.amount} onChange={set('amount')} /></div>
          <div><label className="label">Currency</label><input className="input" maxLength={3} required value={f.currency} onChange={set('currency')} /></div>
        </div>
        <div><label className="label">Payment link</label><input className="input" type="url" placeholder="https://" value={f.paymentLink} onChange={set('paymentLink')} /></div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
