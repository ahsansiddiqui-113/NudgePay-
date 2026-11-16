// Same-origin in production (Vercel routes /api/* to the Express service). Set for local dev.
const BASE = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
  get isPaywall() { return this.status === 402 || this.code === 'PAYWALL'; }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: init.method || (init.body ? 'POST' : 'GET'),
    credentials: 'include', // httpOnly session cookie
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data.code);
  return data as T;
}

export interface User { id: string; email: string; businessName: string | null; replyToEmail: string | null; plan: 'free' | 'pro'; reminderDays: number[] }
export interface Invoice {
  id: string; clientName: string; clientEmail: string; invoiceNumber: string | null;
  amountCents: number; currency: string; dueDate: string; paymentLink: string | null;
  status: 'active' | 'paid'; paused: boolean; remindersSent: number; lastNudgeAt: string | null; daysOverdue: number;
}
export interface Stats { overdueByCurrency: Record<string, number>; activeCount: number }

export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
