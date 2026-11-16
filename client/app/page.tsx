import Link from 'next/link';
import NudgeTimeline from '@/components/NudgeTimeline';

export default function Landing() {
  return (
    <main>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold text-brand-600">NudgePay</span>
        <nav className="flex gap-3">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/login?mode=signup" className="btn-primary">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">Stop chasing overdue invoices manually.</h1>
          <p className="mt-4 text-lg text-slate-600">
            Set it once. NudgePay follows up politely until you get paid: a gentle nudge, a firm follow-up, then a final notice.
          </p>
          <Link href="/login?mode=signup" className="btn-primary mt-6 px-6 py-3 text-base">Track your first invoice</Link>
          <p className="mt-3 text-sm text-slate-500">Free for 2 active invoices. No card needed.</p>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Preview nudge sequence</h2>
          <NudgeTimeline />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6">
            <h3 className="font-bold">Free</h3>
            <p className="mt-1 text-3xl font-extrabold">$0</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Up to 2 active invoices</li><li>Default polite templates</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-brand-500 bg-white p-6">
            <h3 className="font-bold text-brand-600">Pro</h3>
            <p className="mt-1 text-3xl font-extrabold">$12<span className="text-base font-medium text-slate-500">/mo</span> <span className="text-sm font-medium text-slate-500">or $59/yr</span></p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Unlimited active invoices</li><li>Custom schedules &amp; tone templates</li>
              <li>Custom Reply-To, no &ldquo;Sent via NudgePay&rdquo; footer</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
