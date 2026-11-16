const STEPS = [
  { day: 1, tone: 'Gentle nudge', color: 'bg-emerald-500', subject: 'Friendly reminder: invoice INV-042', preview: 'Just a quick nudge: it may have slipped through the cracks. Here is a link to make it easy...' },
  { day: 7, tone: 'Firm follow-up', color: 'bg-amber-500', subject: 'Following up: invoice INV-042 is 7 days overdue', preview: 'Could you let me know when I can expect payment? If there is an issue, reply and we will sort it out.' },
  { day: 14, tone: 'Final notice', color: 'bg-rose-500', subject: 'Final notice: invoice INV-042 ($1,500.00)', preview: 'Please arrange payment immediately to avoid further action...' },
];

export default function NudgeTimeline({ days }: { days?: number[] }) {
  const steps = STEPS.map((s, i) => ({ ...s, day: days?.[i] ?? s.day }));
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
      {steps.map((s) => (
        <li key={s.tone} className="relative">
          <span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full ring-4 ring-slate-50 ${s.color}`} />
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">{s.tone}</span>
              <span className="text-slate-500">{s.day} day{s.day > 1 ? 's' : ''} after due date</span>
            </div>
            <p className="mt-2 text-sm font-medium">{s.subject}</p>
            <p className="mt-1 text-sm text-slate-600">{s.preview}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
