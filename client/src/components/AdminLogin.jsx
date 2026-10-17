import React, { useState } from 'react';
import { Lock, User, AlertCircle, Shield } from 'lucide-react';
import { authAPI } from '../services/api';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('hfpl2027');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authAPI.login({ username, password });
      if (res.data.success) {
        localStorage.setItem('hfpl_admin_token', res.data.token);
        localStorage.setItem('hfpl_admin_user', JSON.stringify(res.data.admin));
        onLoginSuccess(res.data.admin);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#151618] border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img
            src={hfplLogo}
            alt="HFPL Logo"
            className="w-20 h-20 object-contain mx-auto mb-3 drop-shadow"
          />
          <h2 className="text-2xl font-bold tracking-tight text-white">HFPL Admin Deck</h2>
          <p className="text-zinc-400 text-xs tracking-wider uppercase mt-1 font-medium">Family Cricket Auction</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition"
              />
            </div>
          </div>

          <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
            <span>Demo: <strong className="text-zinc-200">admin</strong> / <strong className="text-zinc-200">hfpl2027</strong></span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-white hover:bg-zinc-200 text-black font-semibold tracking-wide py-3 rounded-full transition disabled:opacity-50 text-sm shadow-md"
          >
            {loading ? 'Signing in...' : 'Sign In to Control Deck'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/auction" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            ← Return to Projector Screen
          </a>
        </div>
      </div>
    </div>
  );
}
