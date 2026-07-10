import React, { useState } from 'react';
import { AuthSession, loginAdmin } from '../api';

interface AdminLoginViewProps {
  notice?: string;
  onAuthenticated: (session: AuthSession) => void;
}

export default function AdminLoginView({ notice = '', onAuthenticated }: AdminLoginViewProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const session = await loginAdmin(username, password);
      onAuthenticated(session);
    } catch {
      setErrorMessage('Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center p-4 font-sans selection:bg-primary/30 selection:text-white">
      <div className="w-full max-w-[420px] glass-panel border border-white/[0.06] rounded-2xl p-6 md:p-8 shadow-2xl animate-fadeIn">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/10">
            <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="font-geist font-extrabold text-headline-lg leading-tight">Bistro AI</h1>
            <p className="text-xs text-on-surface-variant/70 font-semibold uppercase tracking-wider mt-0.5">
              Admin Portal
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {notice && (
            <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 text-xs font-semibold text-secondary">
              {notice}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
            />
          </div>

          {errorMessage && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-3 text-xs font-semibold text-error">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-5 py-3 bg-gradient-to-r from-primary to-emerald-500 text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 border border-emerald-400/20 shadow-lg shadow-primary/10 cursor-pointer"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
