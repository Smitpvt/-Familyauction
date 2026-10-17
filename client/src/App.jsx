import React, { useState, useEffect } from 'react';
import ProjectorDisplay from './components/ProjectorDisplay';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import ResultsView from './components/ResultsView';
import { Tv, Shield, ArrowRight, Trophy } from 'lucide-react';
import { authAPI } from './services/api';
import hfplLogo from './logo/HFPL logo-Photoroom.png';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminUser, setAdminUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Handle URL change
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Check existing admin token
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('hfpl_admin_token');
      if (token) {
        try {
          const res = await authAPI.getMe();
          if (res.data.success) {
            setAdminUser(res.data.admin);
          } else {
            localStorage.removeItem('hfpl_admin_token');
          }
        } catch (e) {
          localStorage.removeItem('hfpl_admin_token');
        }
      }
      setAuthChecking(false);
    };
    checkAuth();
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('hfpl_admin_token');
    localStorage.removeItem('hfpl_admin_user');
    setAdminUser(null);
  };

  // Route 1: Projector Auction Screen
  if (currentPath === '/auction') {
    return <ProjectorDisplay />;
  }

  // Route 2: Results View
  if (currentPath === '/results') {
    return <ResultsView />;
  }

  // Route 3: Admin Console
  if (currentPath === '/admin') {
    if (authChecking) {
      return (
        <div className="min-h-screen bg-[#0c0d0e] flex items-center justify-center text-white font-sans">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      );
    }
    if (!adminUser) {
      return <AdminLogin onLoginSuccess={(user) => setAdminUser(user)} />;
    }
    return <AdminPanel onLogout={handleLogout} />;
  }

  // Route 4: Home Hub (Minimal Black-and-White Family Auction Portal)
  return (
    <div className="min-h-screen bg-[#0c0d0e] text-white flex flex-col justify-between font-sans selection:bg-zinc-800">
      {/* Top Header */}
      <header className="px-6 lg:px-12 py-4 border-b border-zinc-800/80 bg-[#0c0d0e] flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <img
            src={hfplLogo}
            alt="HFPL Logo"
            className="h-10 w-auto object-contain"
          />
          <div className="h-5 w-px bg-zinc-800" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">HFPL 2027</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium leading-tight">Family Cricket Auction</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('/auction')}
            className="px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition flex items-center gap-2 shadow-sm"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Projector Screen</span>
          </button>
          <button
            onClick={() => navigateTo('/admin')}
            className="px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs transition flex items-center gap-2"
          >
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
            <span>Admin Deck</span>
          </button>
        </div>
      </header>

      {/* Main Hero */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-16 flex flex-col items-center justify-center text-center">
        {/* Subtle badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Official Family Premier League Portal</span>
        </div>

        {/* Hero Logo */}
        <img
          src={hfplLogo}
          alt="HFPL Logo"
          className="w-28 h-28 md:w-32 md:h-32 object-contain mx-auto mb-4 drop-shadow"
        />

        <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
          HFPL Cricket Auction
        </h2>

        <p className="text-zinc-400 text-base md:text-lg max-w-xl mx-auto mb-12 font-normal leading-relaxed">
          A simple, cute, minimal family cricket auction experience. Clean typography, natural spacing, and real-time live synchronization.
        </p>

        {/* Two Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
          {/* Card 1: Projector Screen */}
          <div
            onClick={() => navigateTo('/auction')}
            className="p-8 rounded-2xl bg-[#151618] border border-zinc-800 hover:border-zinc-500 transition duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 text-white">
                <Tv className="w-5 h-5" />
              </div>
              <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold block mb-1">
                Main Experience
              </span>
              <h3 className="text-xl font-bold text-white mb-2">
                Projector Auction Screen
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Full-screen 16:9 projector layout. Displays only the player photo, name, designation, and base price, with authentic SOLD rubber stamp and confetti.
              </p>
            </div>
            <div className="flex items-center gap-2 text-white font-medium text-xs group-hover:translate-x-1 transition">
              <span>Open /auction</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Admin Panel */}
          <div
            onClick={() => navigateTo('/admin')}
            className="p-8 rounded-2xl bg-[#151618] border border-zinc-800 hover:border-zinc-500 transition duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 text-white">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold block mb-1">
                Auctioneer Control
              </span>
              <h3 className="text-xl font-bold text-white mb-2">
                Admin Control Deck
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Clean minimal control console to manage sets, player details, team bidding, SOLD/UNSOLD hammer, and purse balances.
              </p>
            </div>
            <div className="flex items-center gap-2 text-white font-medium text-xs group-hover:translate-x-1 transition">
              <span>Open /admin</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Results Link */}
        <div className="mt-8">
          <button
            onClick={() => navigateTo('/results')}
            className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition font-medium"
          >
            <Trophy className="w-3.5 h-3.5 text-zinc-500" />
            <span>View Tournament Squads & Final Results</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-zinc-900 text-center text-xs text-zinc-500">
        HFPL Family Premier League • Real-Time Cricket Auction System
      </footer>
    </div>
  );
}
