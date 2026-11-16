'use client';
import Script from 'next/script';
import { useState } from 'react';

declare global { interface Window { Paddle?: any } }

const PRICES = {
  monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY,
  yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY,
};

export default function PaywallModal({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');

  function initPaddle() {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!window.Paddle || !token) return;
    if (process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token });
  }

  function checkout() {
    if (!window.Paddle || !PRICES[plan]) { alert('Billing is not configured yet.'); return; }
    window.Paddle.Checkout.open({
      items: [{ priceId: PRICES[plan], quantity: 1 }],
      customer: { email },
      customData: { user_id: userId }, // lets the webhook map the subscription to this user
      settings: { successUrl: `${window.location.origin}/dashboard?upgraded=1` },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" onLoad={initPaddle} />
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">Upgrade to NudgePay Pro</h2>
        <p className="mt-1 text-sm text-slate-600">You have hit the free limit. Pro unlocks:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Unlimited active invoices</li>
          <li>Custom reminder schedules and tone templates</li>
          <li>Custom Reply-To, no &ldquo;Sent via NudgePay&rdquo; footer</li>
        </ul>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {(['monthly', 'yearly'] as const).map((p) => (
            <button key={p} onClick={() => setPlan(p)}
              className={`rounded-xl border-2 p-3 text-left ${plan === p ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
              <div className="text-xs uppercase text-slate-500">{p}</div>
              <div className="text-lg font-bold">{p === 'monthly' ? '$12/mo' : '$59/yr'}</div>
              {p === 'yearly' && <div className="text-xs text-emerald-600">Save 59%</div>}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Not now</button>
          <button className="btn-primary" onClick={checkout}>Upgrade</button>
        </div>
      </div>
    </div>
  );
}
