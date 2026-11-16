'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [signup, setSignup] = useState(params.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(signup ? '/auth/signup' : '/auth/login', { body: { email, password, businessName } });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-6">
      <h1 className="text-2xl font-bold">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {signup && (
          <div><label className="label">Business name</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
        )}
        <div><label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label">Password</label>
          <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
      </form>
      <button onClick={() => setSignup(!signup)} className="mt-4 text-sm text-brand-600 hover:underline">
        {signup ? 'Have an account? Log in' : 'New here? Create an account'}
      </button>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
