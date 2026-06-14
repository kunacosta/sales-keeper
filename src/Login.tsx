import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail, Loader2, AlertCircle, Watch } from 'lucide-react';
import { useAuth } from './lib/AuthContext.tsx';

const friendlyError = (code: string): string => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled yet.';
    default:
      return 'Could not sign in. Please try again.';
  }
};

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(friendlyError(err?.code ?? ''));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-[#0f172a]/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-2xl bg-indigo-500/20 mb-4">
            <Watch className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Watch Sales</h1>
          <p className="text-slate-500 text-xs mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              autoComplete="username"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#020617]/60 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#020617]/60 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl py-3 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
